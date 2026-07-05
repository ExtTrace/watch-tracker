import './style.css';


import {
  getMediaStorage,
  removeMediaItem,
  setMediaItemArchived,
  getLastFilter,
  setLastFilter,
} from './utils/storage';
import {
  state,
  type FilterValue,
  type ViewValue,
} from './state';
import { createHistoryTab } from './components/HistoryTab';
import { ICONS } from './ui/helpers';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Popup root element #app was not found.');
}
const popupRoot = app;

function openUrl(url: string): void {
  chrome.tabs.create({ url });
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
    if (value === 'settings') return; // Handled by icon now
    state.view = value;
    void renderPopup();
  });
  return button;
}

async function renderPopup(): Promise<void> {
  const storage = await getMediaStorage();
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

  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'popup-settings-btn';
  settingsBtn.innerHTML = ICONS.settings;
  settingsBtn.title = 'Open Settings';
  settingsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  hero.append(settingsBtn);

  const tabs = document.createElement('div');
  tabs.className = 'view-tabs';
  tabs.append(
    createViewTabButton('History', 'history'),
    createViewTabButton('Archives', 'archives'),
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
  }

  popupRoot.append(container);
}

chrome.storage.onChanged.addListener(() => {
  void renderPopup();
});

Promise.all([
  getLastFilter()
]).then(([filter]) => {
  state.filter = filter as FilterValue;
  void renderPopup();
});
