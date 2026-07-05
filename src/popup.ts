import './style.css';

import type { AnimeDomain, MediaItem } from './types/media';
import {
  clearMediaStorage,
  getAnimeDomains,
  getMediaStorage,
  getYouTubeChannels,
  getTelegramSettings,
  importMediaItems,
  removeAnimeDomain,
  removeMediaItem,
  removeYouTubeChannel,
  setAnimeDomains,
  setMediaItemArchived,
  setTelegramSettings,
  upsertAnimeDomain,
  upsertYouTubeChannel,
  getLastFilter,
  setLastFilter,
  getLastSettingsView,
  setLastSettingsView,
} from './utils/storage';
import {
  state,
  isStandaloneDomainsView,
  type FilterValue,
  type ViewValue,
  type SettingsViewValue
} from './state';
import { describeUnknownError } from './utils/formatters';

import { createHistoryTab } from './components/HistoryTab';
import { createDataManagementSection } from './components/settings/DataSettings';
import { createTelegramSettingsSection } from './components/settings/TelegramSettings';
import { createYouTubeChannelsSection } from './components/settings/YouTubeSettings';
import { createAnimeDomainsSection } from './components/settings/CustomDomainSettings';
import { createSettingsTabNavigation } from './components/SettingsTab';

const DEBUG_PREFIX = '[Anime Watch Tracker]';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Popup root element #app was not found.');
}
const popupRoot = app;

function openUrl(url: string): void {
  chrome.tabs.create({ url });
}

function downloadJsonFile(items: MediaItem[]): void {
  const blob = new Blob([JSON.stringify({ items }, null, 2)], {
    type: 'application/json',
  });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = `anime-watch-tracker-${new Date().toISOString()}.json`;
  anchor.click();
  URL.revokeObjectURL(downloadUrl);
}

async function importJsonFile(file: File): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { items?: unknown };
  const importedItems = Array.isArray(parsed.items) ? parsed.items : [];
  const importedCount = await importMediaItems(importedItems);

  if (importedCount === 0) {
    throw new Error('No valid watch items found in the selected JSON file.');
  }
}

function normalizeChannelHandle(value: string): string {
  return value.trim().replace(/^@+/, '').replace(/\s+/g, '');
}

function normalizeDomainInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '');
}

function normalizeCurrentDomainInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '');
}

function sameAnimeDomainHostname(left: string, right: string): boolean {
  return normalizeDomainInput(left) === normalizeDomainInput(right);
}

function getValidatedAnimeDomainDraft() {
  const name = state.animeDomainDraft.name.trim().replace(/\s+/g, ' ');
  const currentDomain = normalizeCurrentDomainInput(state.animeDomainDraft.currentDomain);
  const hostname = normalizeDomainInput(state.animeDomainDraft.hostname);

  if (!name) throw new Error('Domain name is required.');
  if (!currentDomain) throw new Error('Current domain is required.');
  if (!hostname) throw new Error('Match keyword is required.');

  return { ...state.animeDomainDraft, name, currentDomain, hostname };
}

function buildAnimeDomainBase(domains: AnimeDomain[]) {
  const nextDraft = getValidatedAnimeDomainDraft();
  const existingDomain = domains.find((domain) =>
    sameAnimeDomainHostname(domain.hostname, nextDraft.hostname),
  );

  return {
    nextDraft,
    existingDomain,
    baseDomain: {
      id: nextDraft.id ?? existingDomain?.id ?? `anime-domain-${Date.now()}`,
      name: nextDraft.name,
      hostname: nextDraft.hostname,
      grantedOrigin: existingDomain?.grantedOrigin ?? null,
      enabled: true,
      createdAt: nextDraft.createdAt ?? existingDomain?.createdAt ?? new Date().toISOString(),
    },
  };
}

function mergeAnimeDomains(domains: AnimeDomain[], nextDomain: AnimeDomain): AnimeDomain[] {
  const filteredDomains = domains.filter((existingDomain) => {
    if (existingDomain.id === nextDomain.id) return false;
    return !sameAnimeDomainHostname(existingDomain.hostname, nextDomain.hostname);
  });
  filteredDomains.push(nextDomain);
  return filteredDomains;
}

async function requestAnimeDomainPermission(currentDomain: string): Promise<string> {
  const normalizedCurrentDomain = normalizeCurrentDomainInput(currentDomain);
  const exactOrigin = `https://${normalizedCurrentDomain}/*`;
  const wildcardOrigin = `https://*.${normalizedCurrentDomain}/*`;
  console.debug(`${DEBUG_PREFIX} requesting anime domain permission`, { currentDomain, normalizedCurrentDomain, exactOrigin, wildcardOrigin });

  const granted = await new Promise<boolean>((resolve, reject) => {
    if (!chrome.permissions?.request) {
      reject(new Error('chrome.permissions.request is unavailable in this popup context.'));
      return;
    }
    chrome.permissions.request({ origins: [exactOrigin, wildcardOrigin] }, (result) => {
      if (chrome.runtime.lastError?.message) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(Boolean(result));
    });
  });

  console.debug(`${DEBUG_PREFIX} anime domain permission result`, { normalizedCurrentDomain, granted });
  if (!granted) {
    throw new Error('Permission denied. Domain was not saved.');
  }
  return exactOrigin;
}

async function injectTrackerIntoActiveTabIfNeeded(hostnameKeyword: string): Promise<void> {
  if (!chrome.tabs?.query || !chrome.scripting?.executeScript) return;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id || !activeTab.url) return;

  try {
    const parsedUrl = new URL(activeTab.url);
    if (!normalizeDomainInput(parsedUrl.hostname).includes(normalizeDomainInput(hostnameKeyword))) return;
    await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ['content.js'] });
  } catch {}
}

async function notifyBackgroundToInjectCustomDomain(): Promise<void> {
  if (!chrome.runtime?.sendMessage) return;
  try {
    await chrome.runtime.sendMessage({ type: 'anime-watch-tracker:refresh-custom-injection' });
  } catch {}
}

async function saveAnimeDomainFromDraft(domains: AnimeDomain[]): Promise<void> {
  const { nextDraft, existingDomain, baseDomain } = buildAnimeDomainBase(domains);
  const grantedOrigin = await requestAnimeDomainPermission(nextDraft.currentDomain);
  await upsertAnimeDomain({ ...baseDomain, grantedOrigin });
  await injectTrackerIntoActiveTabIfNeeded(nextDraft.hostname);
  await notifyBackgroundToInjectCustomDomain();
  state.animeDomainModalOpen = false;
  state.animeDomainDraft = { id: null, name: '', currentDomain: '', hostname: '' };
  await renderPopup();
  window.alert(nextDraft.id || existingDomain ? 'Anime domain updated.' : 'Anime domain saved.');
}

function saveAnimeDomainFromPopup(domains: AnimeDomain[]): void {
  let prepared;
  try {
    prepared = buildAnimeDomainBase(domains);
  } catch (error) {
    window.alert(describeUnknownError(error));
    return;
  }
  if (!prepared) return;

  const { nextDraft, existingDomain, baseDomain } = prepared;
  const nextDomains = mergeAnimeDomains(domains, baseDomain);
  void setAnimeDomains(nextDomains);

  if (!state.animeDomainRequestPermission) {
    state.animeDomainModalOpen = false;
    state.animeDomainDraft = { id: null, name: '', currentDomain: '', hostname: '' };
    void renderPopup();
    window.alert(`${nextDraft.id || existingDomain ? 'Anime domain updated.' : 'Anime domain saved.'} Permission bisa diminta nanti.`);
    return;
  }

  void requestAnimeDomainPermission(nextDraft.currentDomain)
    .then(async (grantedOrigin) => {
      await upsertAnimeDomain({ ...baseDomain, grantedOrigin });
      await injectTrackerIntoActiveTabIfNeeded(nextDraft.hostname);
      await notifyBackgroundToInjectCustomDomain();
      state.animeDomainModalOpen = false;
      state.animeDomainDraft = { id: null, name: '', currentDomain: '', hostname: '' };
      await renderPopup();
      window.alert(nextDraft.id || existingDomain ? 'Anime domain updated.' : 'Anime domain saved.');
    })
    .catch(console.warn);
}

function createFilterButton(label: string, value: FilterValue): HTMLElement {
  const isSelected = state.filter === value;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `filter-chip ${isSelected ? 'is-active' : ''}`;
  button.textContent = label;
  button.addEventListener('click', () => {
    if (state.filter !== value) {
      state.filter = value;
      void setLastFilter(value);
      void renderPopup();
    }
  });
  return button;
}

function createViewTabButton(label: string, value: ViewValue): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `view-tab${state.view === value ? ' is-active' : ''}`;
  button.textContent = label;
  button.addEventListener('click', () => {
    state.view = value;
    void renderPopup();
  });
  return button;
}

async function renderPopup(): Promise<void> {
  const [storage, youtubeChannels, animeDomains, telegramSettings] = await Promise.all([
    getMediaStorage(),
    getYouTubeChannels(),
    getAnimeDomains(),
    getTelegramSettings(),
  ]);
  const items = [...storage.items].sort((l, r) => Date.parse(r.lastWatchedAt) - Date.parse(l.lastWatchedAt));
  
  // Calculate shown / total counts
  const isAll = state.filter === 'all';
  const platformFiltered = isAll ? items : items.filter(i => i.platform === state.filter);
  const allFilteredItems = state.view === 'archives' ? platformFiltered.filter(i => i.isArchived) : platformFiltered.filter(i => !i.isArchived);

  popupRoot.replaceChildren();

  const container = document.createElement('main');
  container.className = 'popup-shell';

  const hero = document.createElement('header');
  hero.className = 'hero-panel';
  hero.innerHTML = '<h1 class="hero-title">Anime Watch Tracker</h1>';

  const tabs = document.createElement('div');
  tabs.className = 'view-tabs';
  tabs.append(
    createViewTabButton('History', 'history'),
    createViewTabButton('Archives', 'archives'),
    createViewTabButton('Settings', 'settings'),
  );

  container.append(hero, tabs);

  if (state.view === 'history' || state.view === 'archives') {
    const filters = document.createElement('div');
    filters.className = 'filter-row';
    filters.append(
      createFilterButton('All', 'all'),
      createFilterButton('Netflix', 'netflix'),
      createFilterButton('YouTube', 'youtube'),
      createFilterButton('Custom', 'custom'),
    );

    const summary = document.createElement('section');
    summary.className = 'summary-panel';
    summary.innerHTML = `<p>${allFilteredItems.length} shown</p><p>${allFilteredItems.length} Items</p>`;

    container.append(filters, summary);

    container.append(
      createHistoryTab({
        items,
        filter: state.filter,
        view: state.view,
        onOpenUrl: openUrl,
        onToggleArchive: async (id, isArchived) => {
          await setMediaItemArchived(id, isArchived);
          await renderPopup();
        },
        onDelete: async (id) => {
          await removeMediaItem(id);
          await renderPopup();
        },
      })
    );
  } else if (state.view === 'settings') {
    container.append(
      createSettingsTabNavigation({
        currentView: state.settingsView,
        onTabClick: (view) => {
          state.settingsView = view;
          void setLastSettingsView(view);
          void renderPopup();
        }
      })
    );

    if (state.settingsView === 'data') {
      const importInput = document.createElement('input');
      importInput.type = 'file';
      importInput.accept = 'application/json,.json';
      importInput.className = 'visually-hidden';
      importInput.addEventListener('change', () => {
        const [file] = importInput.files ?? [];
        if (!file) return;
        void importJsonFile(file)
          .then(() => renderPopup())
          .catch((error: unknown) => {
            window.alert(error instanceof Error ? error.message : 'Failed to import JSON file.');
          })
          .finally(() => { importInput.value = ''; });
      });

      const dataSection = createDataManagementSection({
        onImportClick: () => importInput.click(),
        onExportClick: () => downloadJsonFile(items),
        onClearHistoryClick: () => {
          void clearMediaStorage().then(() => renderPopup());
        },
      });
      container.append(dataSection, importInput);
    } else if (state.settingsView === 'telegram') {
      container.append(
        createTelegramSettingsSection({
          settings: telegramSettings,
          onToggle: (enabled) => {
            void setTelegramSettings({ ...telegramSettings, enabled });
          },
          onSave: (chatId) => {
            void setTelegramSettings({ enabled: telegramSettings.enabled, chatId }).then(() => {
              window.alert('Telegram credentials saved!');
              void renderPopup();
            });
          },
          onTest: () => {
            chrome.runtime.sendMessage({ type: 'anime-watch-tracker:test-telegram' });
          }
        })
      );
    } else if (state.settingsView === 'youtube') {
      container.append(
        createYouTubeChannelsSection({
          channels: youtubeChannels,
          draft: state.youtubeChannelDraft,
          isModalOpen: state.youtubeChannelModalOpen,
          onOpenModal: (channel) => {
            if (channel) {
              state.youtubeChannelDraft = { id: channel.id, createdAt: channel.createdAt, name: channel.name, handle: channel.handle ?? '' };
            } else {
              state.youtubeChannelDraft = { id: null, name: '', handle: '' };
            }
            state.youtubeChannelModalOpen = true;
            void renderPopup();
          },
          onCloseModal: () => {
            state.youtubeChannelModalOpen = false;
            void renderPopup();
          },
          onUpdateDraft: (updates) => {
            state.youtubeChannelDraft = { ...state.youtubeChannelDraft, ...updates };
          },
          onSaveChannel: async () => {
            const name = state.youtubeChannelDraft.name.trim().replace(/\s+/g, ' ');
            if (!name) throw new Error('Channel name is required.');
            const handle = state.youtubeChannelDraft.handle.trim();
            const normalizedHandle = handle ? normalizeChannelHandle(handle) : null;
            const existingChannel = youtubeChannels.find((ch) => {
              if (ch.id === state.youtubeChannelDraft.id) return true;
              if (normalizedHandle && ch.handle) return normalizeChannelHandle(ch.handle) === normalizedHandle;
              return ch.name.trim().toLowerCase() === name.toLowerCase();
            });

            await upsertYouTubeChannel({
              id: state.youtubeChannelDraft.id ?? existingChannel?.id ?? `youtube-channel-${Date.now()}`,
              name,
              handle: normalizedHandle ? `@${normalizedHandle}` : null,
              enabled: existingChannel?.enabled ?? true,
              createdAt: state.youtubeChannelDraft.createdAt ?? existingChannel?.createdAt,
            });

            state.youtubeChannelModalOpen = false;
            state.youtubeChannelDraft = { id: null, name: '', handle: '' };
            await renderPopup();
          },
          onToggleChannel: async (channel) => {
            await upsertYouTubeChannel({ ...channel, enabled: !channel.enabled });
            await renderPopup();
          },
          onDeleteChannel: async (id) => {
            await removeYouTubeChannel(id);
            await renderPopup();
          }
        })
      );
    } else if (state.settingsView === 'custom') {
      container.append(
        createAnimeDomainsSection({
          domains: animeDomains,
          draft: state.animeDomainDraft,
          isModalOpen: state.animeDomainModalOpen,
          requestPermission: state.animeDomainRequestPermission,
          isStandaloneDomainsView,
          onOpenModal: (domain) => {
            if (domain) {
              state.animeDomainDraft = {
                id: domain.id, createdAt: domain.createdAt, name: domain.name,
                currentDomain: domain.grantedOrigin ? normalizeCurrentDomainInput(domain.grantedOrigin) : '',
                hostname: domain.hostname,
              };
            } else {
              state.animeDomainDraft = { id: null, name: '', currentDomain: '', hostname: '' };
            }
            state.animeDomainModalOpen = true;
            void renderPopup();
          },
          onCloseModal: () => {
            state.animeDomainModalOpen = false;
            void renderPopup();
          },
          onUpdateDraft: (updates) => {
            state.animeDomainDraft = { ...state.animeDomainDraft, ...updates };
          },
          onToggleRequestPermission: (request) => {
            state.animeDomainRequestPermission = request;
          },
          onSaveDomain: async () => {
            if (isStandaloneDomainsView) {
              await saveAnimeDomainFromDraft(animeDomains);
            } else {
              saveAnimeDomainFromPopup(animeDomains);
            }
          },
          onToggleDomain: async (domain) => {
            await upsertAnimeDomain({ ...domain, enabled: !domain.enabled });
            await renderPopup();
          },
          onDeleteDomain: async (id) => {
            await removeAnimeDomain(id);
            await renderPopup();
          }
        })
      );
    }
  }

  popupRoot.append(container);
}

chrome.storage.onChanged.addListener(() => {
  void renderPopup();
});

Promise.all([
  getLastFilter(),
  getLastSettingsView()
]).then(([filter, settingsView]) => {
  state.filter = filter as FilterValue;
  state.settingsView = settingsView as SettingsViewValue;
  void renderPopup();
});
