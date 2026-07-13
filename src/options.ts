import './style.css';
import {
  getAnimeDomains,
  setAnimeDomains,
  getTelegramSettings,
  setTelegramSettings,
  getDiscordSettings,
  setDiscordSettings,
  getYouTubeChannels,
  upsertYouTubeChannel,
  removeYouTubeChannel,
  getMediaStorage,
  clearMediaStorage,
  importMediaItems,
  normalizeChannelHandle,
  getCloudSettings,
  setCloudSettings
} from './utils/storage';
import { pushToCloud, pullFromCloud } from './utils/sync';
import { normalizeCurrentDomainInput } from './utils/formatters';
import { createAnimeDomainsSection } from './components/settings/CustomDomainSettings';
import { createYouTubeChannelsSection } from './components/settings/YouTubeSettings';
import { createTelegramSettingsSection } from './components/settings/TelegramSettings';
import { createDiscordSettingsSection } from './components/settings/DiscordSettings';
import { createDataManagementSection } from './components/settings/DataSettings';
import { createCloudSettingsSection } from './components/settings/CloudSettings';
import type { AnimeDomainDraft, YouTubeChannelDraft } from './state';
import type { AnimeDomain, MediaItem } from './types/media';

const DEBUG_PREFIX = '[Anime Watch Tracker]';
const optionsRoot = document.getElementById('app') as HTMLDivElement;

const state = {
  settingsView: 'custom' as 'custom' | 'youtube' | 'notification' | 'data',
  animeDomainDraft: { id: null, name: '', currentDomain: '', hostname: '' } as AnimeDomainDraft,
  animeDomainModalOpen: false,
  animeDomainRequestPermission: false,
  youtubeChannelDraft: { id: null, name: '', handle: '' } as YouTubeChannelDraft,
  youtubeChannelModalOpen: false,
  cloudSyncModalOpen: false,
};

function normalizeDomainInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '');
}

function sameAnimeDomainHostname(left: string, right: string): boolean {
  return normalizeDomainInput(left) === normalizeDomainInput(right);
}

function createSidebarButton(label: string, value: typeof state.settingsView): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `options-sidebar-btn${state.settingsView === value ? ' is-active' : ''}`;
  button.textContent = label;
  button.addEventListener('click', () => {
    state.settingsView = value;
    void renderOptions();
  });
  return button;
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

function importJsonFile(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        void importMediaItems(json.items ?? []).then(() => resolve());
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function getValidatedAnimeDomainDraft() {
  const { name, currentDomain, hostname } = state.animeDomainDraft;
  if (!name.trim()) throw new Error('Name is required');
  if (!currentDomain.trim()) throw new Error('Current domain is required');
  if (!hostname.trim()) throw new Error('Hostname is required');

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
      reject(new Error('chrome.permissions is not available'));
      return;
    }
    chrome.permissions.request(
      { origins: [exactOrigin, wildcardOrigin] },
      (granted) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(granted);
        }
      }
    );
  });

  if (!granted) {
    throw new Error('Permission denied by user');
  }

  const permissions = await new Promise<chrome.permissions.Permissions>((resolve) => {
    chrome.permissions.getAll(resolve);
  });
  const finalOrigin = permissions.origins?.find((o) => o === exactOrigin || o === wildcardOrigin) ?? wildcardOrigin;

  return finalOrigin;
}

async function renderOptions(): Promise<void> {
  const youtubeChannels = await getYouTubeChannels();
  const animeDomains = await getAnimeDomains();
  const telegramSettings = await getTelegramSettings();
  const discordSettings = await getDiscordSettings();
  const cloudSettings = await getCloudSettings();
  const storage = await getMediaStorage();

  optionsRoot.replaceChildren();

  const layout = document.createElement('div');
  layout.className = 'options-layout';

  const sidebar = document.createElement('aside');
  sidebar.className = 'options-sidebar';

  const sidebarTitle = document.createElement('h1');
  sidebarTitle.className = 'options-sidebar-title';
  sidebarTitle.textContent = 'Settings';

  const sidebarMenu = document.createElement('div');
  sidebarMenu.className = 'options-sidebar-menu';
  sidebarMenu.append(
    createSidebarButton('Custom Domains', 'custom'),
    createSidebarButton('YouTube Channels', 'youtube'),
    createSidebarButton('Notifications', 'notification'),
    createSidebarButton('Data Management', 'data'),
  );

  sidebar.append(sidebarTitle, sidebarMenu);

  const content = document.createElement('main');
  content.className = 'options-content';

  const contentTitle = document.createElement('h2');
  contentTitle.className = 'options-content-title';

  layout.append(sidebar, content);

  if (state.settingsView === 'youtube') {
    const header = document.createElement('div');
    header.className = 'options-content-header';
    contentTitle.textContent = 'YouTube Channels';
    header.append(contentTitle);

    content.append(
      header,
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
          void renderOptions();
        },
        onCloseModal: () => {
          state.youtubeChannelModalOpen = false;
          void renderOptions();
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
          await renderOptions();
        },
        onToggleChannel: async (channel) => {
          await upsertYouTubeChannel({ ...channel, enabled: !channel.enabled });
          await renderOptions();
        },
        onDeleteChannel: async (id) => {
          await removeYouTubeChannel(id);
          await renderOptions();
        }
      })
    );
  } else if (state.settingsView === 'custom') {
    const header = document.createElement('div');
    header.className = 'options-content-header';
    contentTitle.textContent = 'Custom Anime Domains';
    header.append(contentTitle);

    content.append(
      header,
      createAnimeDomainsSection({
        domains: animeDomains,
        draft: state.animeDomainDraft,
        isModalOpen: state.animeDomainModalOpen,
        requestPermission: state.animeDomainRequestPermission,
        isStandaloneDomainsView: true,
        onOpenModal: (domain) => {
          if (domain) {
            state.animeDomainDraft = {
              id: domain.id, createdAt: domain.createdAt, name: domain.name,
              currentDomain: domain.grantedOrigin ? normalizeCurrentDomainInput(domain.grantedOrigin) : '',
              hostname: domain.hostname,
            };
            state.animeDomainRequestPermission = !domain.grantedOrigin;
          } else {
            state.animeDomainDraft = { id: null, name: '', currentDomain: '', hostname: '' };
            state.animeDomainRequestPermission = true;
          }
          state.animeDomainModalOpen = true;
          void renderOptions();
        },
        onCloseModal: () => {
          state.animeDomainModalOpen = false;
          void renderOptions();
        },
        onUpdateDraft: (updates) => {
          state.animeDomainDraft = { ...state.animeDomainDraft, ...updates };
        },
        onToggleRequestPermission: (request) => {
          state.animeDomainRequestPermission = request;
        },
        onSaveDomain: async () => {
          const { baseDomain, nextDraft } = buildAnimeDomainBase(animeDomains);

          if (!state.animeDomainRequestPermission && baseDomain.grantedOrigin) {
            const nextDomains = mergeAnimeDomains(animeDomains, baseDomain);
            await setAnimeDomains(nextDomains);
            state.animeDomainModalOpen = false;
            state.animeDomainDraft = { id: null, name: '', currentDomain: '', hostname: '' };
            await renderOptions();
            return;
          }

          const grantedOrigin = await requestAnimeDomainPermission(nextDraft.currentDomain);
          const finalDomain: AnimeDomain = { ...baseDomain, grantedOrigin };
          const nextDomains = mergeAnimeDomains(animeDomains, finalDomain);

          await setAnimeDomains(nextDomains);

          if (chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ type: 'anime-watch-tracker:refresh-custom-injection' }).catch(() => { });
          }

          state.animeDomainModalOpen = false;
          state.animeDomainDraft = { id: null, name: '', currentDomain: '', hostname: '' };
          await renderOptions();
        },
        onToggleDomain: async (domain) => {
          const nextDomains = animeDomains.map((d) =>
            d.id === domain.id ? { ...d, enabled: !d.enabled } : d
          );
          await setAnimeDomains(nextDomains);
          await renderOptions();
        },
        onDeleteDomain: async (id) => {
          const nextDomains = animeDomains.filter((d) => d.id !== id);
          await setAnimeDomains(nextDomains);
          await renderOptions();
        }
      })
    );
  } else if (state.settingsView === 'notification') {
    const header = document.createElement('div');
    header.className = 'options-content-header';
    contentTitle.textContent = 'Notification Settings';
    header.append(contentTitle);

    const grid = document.createElement('div');
    grid.className = 'channel-grid';
    grid.append(
      createTelegramSettingsSection({
        settings: telegramSettings,
        onToggle: (enabled) => {
          void setTelegramSettings({ ...telegramSettings, enabled });
        },
        onSave: (chatId) => {
          void setTelegramSettings({ enabled: telegramSettings.enabled, chatId }).then(() => {
            window.alert('Telegram credentials saved!');
            void renderOptions();
          });
        },
        onTest: () => {
          chrome.runtime.sendMessage({ type: 'anime-watch-tracker:test-telegram' });
        }
      }),
      createDiscordSettingsSection({
        settings: discordSettings,
        onToggle: (enabled) => {
          void setDiscordSettings({ ...discordSettings, enabled });
        },
        onSave: (webhookUrl) => {
          void setDiscordSettings({ enabled: discordSettings.enabled, webhookUrl }).then(() => {
            window.alert('Discord Webhook saved!');
            void renderOptions();
          });
        },
        onTest: () => {
          chrome.runtime.sendMessage({ type: 'anime-watch-tracker:test-discord' });
        }
      })
    );

    content.append(header, grid);
  } else if (state.settingsView === 'data') {
    const header = document.createElement('div');
    header.className = 'options-content-header';
    contentTitle.textContent = 'Data Management';
    header.append(contentTitle);



    const dataSectionGrid = document.createElement('div');
    dataSectionGrid.className = 'channel-grid';

    const cloudSection = createCloudSettingsSection({
      settings: cloudSettings,
      isModalOpen: state.cloudSyncModalOpen,
      onOpenModal: () => {
        state.cloudSyncModalOpen = true;
        void renderOptions();
      },
      onCloseModal: () => {
        state.cloudSyncModalOpen = false;
        void renderOptions();
      },
      onSave: (newSettings) => {
        const wasEnabled = cloudSettings.enabled;
        const syncIdChanged = newSettings.syncId !== cloudSettings.syncId;

        void setCloudSettings(newSettings).then(() => {
          // Push immediately when user enables Cloud Sync
          if (!wasEnabled && newSettings.enabled) {
            void pushToCloud();
          }
          // Pull immediately when user links a new device (Sync ID changed)
          if (syncIdChanged && newSettings.syncId) {
            void pullFromCloud();
          }
          void renderOptions();
        });
      }
    });

    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importInput.className = 'visually-hidden';
    importInput.addEventListener('change', () => {
      const [file] = importInput.files ?? [];
      if (!file) return;
      void importJsonFile(file)
        .then(() => renderOptions())
        .catch((error: unknown) => {
          window.alert(error instanceof Error ? error.message : 'Failed to import JSON file.');
        })
        .finally(() => { importInput.value = ''; });
    });

    const dataSection = createDataManagementSection({
      onImportClick: () => importInput.click(),
      onExportClick: () => downloadJsonFile(storage.items),
      onClearHistoryClick: () => {
        void clearMediaStorage().then(() => renderOptions());
      },
    });

    dataSectionGrid.append(cloudSection, dataSection);

    content.append(header, dataSectionGrid, importInput);
  }

  optionsRoot.append(layout);
}

document.addEventListener('DOMContentLoaded', () => {
  void renderOptions();
});
