import './style.css';

import { defaultWatchStorage, getWatchStorage, setWatchStorage } from './lib/storage';
import type { WatchItem } from './types/watch';

const NETFLIX_HOME_URL = 'https://www.netflix.com/browse';
const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Popup root element #app was not found.');
}

const popupRoot = app;

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatWatchTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return dateFormatter.format(new Date(timestamp));
}

function openUrl(url: string): void {
  chrome.tabs.create({ url });
}

function downloadJsonFile(items: WatchItem[]): void {
  const blob = new Blob([JSON.stringify({ items }, null, 2)], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = `anime-netflix-tracker-${new Date().toISOString()}.json`;
  anchor.click();
  URL.revokeObjectURL(downloadUrl);
}

async function clearHistory(): Promise<void> {
  await setWatchStorage(defaultWatchStorage);
  await renderPopup();
}

function createActionButton(label: string, onClick: () => void, variant = 'secondary'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button button-${variant}`;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function createWatchCard(item: WatchItem): HTMLElement {
  const card = document.createElement('article');
  card.className = 'watch-card';

  const title = document.createElement('h2');
  title.className = 'watch-card-title';
  title.textContent = item.title;

  const meta = document.createElement('p');
  meta.className = 'watch-card-meta';
  meta.textContent =
    [item.season, item.episode, item.episodeTitle].filter(Boolean).join(' - ') ||
    'Episode metadata not available';

  const timestamp = document.createElement('p');
  timestamp.className = 'watch-card-time';
  timestamp.textContent = `Last watched: ${formatWatchTime(item.lastWatchedAt)}`;

  const actions = document.createElement('div');
  actions.className = 'watch-card-actions';
  actions.append(createActionButton('Open Netflix', () => openUrl(item.url), 'primary'));

  card.append(title, meta, timestamp, actions);
  return card;
}

function createEmptyState(): HTMLElement {
  const emptyState = document.createElement('section');
  emptyState.className = 'empty-state';

  const title = document.createElement('h2');
  title.textContent = 'Belum ada history';

  const description = document.createElement('p');
  description.textContent = 'Mulai nonton anime atau series di Netflix lewat browser untuk mengisi daftar ini.';

  emptyState.append(title, description);
  return emptyState;
}

async function renderPopup(): Promise<void> {
  const storage = await getWatchStorage();
  const items = [...storage.items].sort(
    (left, right) => Date.parse(right.lastWatchedAt) - Date.parse(left.lastWatchedAt),
  );

  popupRoot.replaceChildren();

  const container = document.createElement('main');
  container.className = 'popup';

  const header = document.createElement('header');
  header.className = 'popup-header';

  const title = document.createElement('div');
  title.innerHTML = '<h1>Anime Netflix Tracker</h1><p>Riwayat tontonan Netflix yang tersimpan lokal.</p>';

  const actions = document.createElement('div');
  actions.className = 'toolbar';
  actions.append(
    createActionButton('Open Netflix', () => openUrl(NETFLIX_HOME_URL), 'primary'),
    createActionButton('Export JSON', () => downloadJsonFile(items)),
    createActionButton('Clear History', () => void clearHistory()),
  );

  header.append(title, actions);

  const summary = document.createElement('p');
  summary.className = 'summary';
  summary.textContent = items.length > 0 ? `${items.length} item tersimpan` : 'Belum ada item tersimpan';

  const content = document.createElement('section');
  content.className = 'content';

  if (items.length === 0) {
    content.append(createEmptyState());
  } else {
    for (const item of items) {
      content.append(createWatchCard(item));
    }
  }

  container.append(header, summary, content);
  popupRoot.append(container);
}

void renderPopup();
