import { createIconButton, ICONS } from '../ui/helpers';
import type { MediaItem, Platform } from '../types/media';
import {
  formatWatchTime,
  formatPublishedDate,
  formatPublishedDay,
} from '../utils/formatters';
import type { FilterValue, ViewValue } from '../state';

// We'll pass openUrl, setMediaItemArchived, removeMediaItem, and renderPopup as callbacks
type HistoryTabProps = {
  items: MediaItem[];
  filter: FilterValue;
  view: ViewValue; // 'history' | 'archives'
  onOpenUrl: (url: string) => void;
  onToggleArchive: (id: string, isArchived: boolean) => Promise<void>;
  onEditItem: (item: MediaItem) => void;
  onDelete: (id: string) => Promise<void>;
};

export function createHistoryTab({
  items,
  filter,
  view,
  onOpenUrl,
  onToggleArchive,
  onEditItem,
  onDelete,
}: HistoryTabProps): HTMLElement {
  const content = document.createElement('section');
  content.className = 'content';

  const filteredItems = filterItems(items, filter, view);

  if (filteredItems.length === 0) {
    if (view === 'archives') {
      const emptyState = createEmptyState();
      const title = emptyState.querySelector('h2');
      const desc = emptyState.querySelector('p');
      if (title) title.textContent = 'Belum ada arsip';
      if (desc) desc.textContent = 'Anime yang Anda arsipkan akan muncul di sini.';
      content.append(emptyState);
    } else {
      content.append(createEmptyState());
    }
  } else {
    for (const item of filteredItems) {
      content.append(createWatchCard(item, onOpenUrl, onToggleArchive, onEditItem, onDelete));
    }
  }

  return content;
}

export function filterItems(
  items: MediaItem[],
  filter: FilterValue,
  view: ViewValue,
  isAll: boolean = false
): MediaItem[] {
  let platformFiltered = items;
  if (!isAll) {
    platformFiltered = filter === 'all'
      ? items
      : items.filter((item) => item.platform === filter);
  }

  if (view === 'archives') {
    return platformFiltered.filter((item) => item.isArchived);
  }

  if (view === 'history') {
    return platformFiltered.filter((item) => !item.isArchived);
  }

  return platformFiltered;
}

function createEmptyState(): HTMLElement {
  const emptyState = document.createElement('section');
  emptyState.className = 'empty-state';

  const title = document.createElement('h2');
  title.textContent = 'Belum ada history';

  const description = document.createElement('p');
  description.textContent =
    'Buka Netflix, YouTube yang diizinkan, atau situs anime custom yang aktif, lalu riwayat akan muncul di sini.';

  emptyState.append(title, description);
  return emptyState;
}

function createWatchCard(
  item: MediaItem,
  onOpenUrl: (url: string) => void,
  onToggleArchive: (id: string, isArchived: boolean) => Promise<void>,
  onEditItem: (item: MediaItem) => void,
  onDelete: (id: string) => Promise<void>
): HTMLElement {
  const card = document.createElement('article');
  card.className = 'watch-card';

  const content = document.createElement('div');
  content.className = 'watch-card-content';

  const badgeRow = document.createElement('div');
  badgeRow.className = 'watch-card-badge-row';
  if (item.platform === 'youtube') {
    badgeRow.append(createBadge(item.platform, item.channel!));
  } else if (item.platform === 'custom') {
    badgeRow.append(createBadge(item.platform, item.siteName!));
  } else {
    badgeRow.append(createBadge(item.platform));
  }

  const title = document.createElement('h2');
  title.className = 'watch-card-title';
  title.textContent = item.title;

  const titleRow = document.createElement('div');
  titleRow.className = 'watch-card-title-row';
  titleRow.append(title);

  const metadata = document.createElement('p');
  metadata.className = 'watch-card-meta';
  metadata.textContent = buildMetadataText(item) || 'Metadata belum tersedia';

  const watchedAt = document.createElement('p');
  watchedAt.className = 'watch-card-time';
  watchedAt.textContent = `Last watched: ${formatWatchTime(item.lastWatchedAt)}`;

  const episodeStatus = document.createElement('p');
  episodeStatus.className = 'watch-card-time';
  const episodeStatusText = buildNetflixEpisodeStatusText(item);
  if (episodeStatusText) {
    episodeStatus.textContent = episodeStatusText;
  }

  const publishedAt = document.createElement('p');
  publishedAt.className = 'watch-card-time';
  const publishedText = formatPublishedDate(item.publishedAt);
  if (publishedText) {
    publishedAt.textContent = `Published: ${publishedText}`;
  }

  const publishedDayText = formatPublishedDay(item.publishedAt);
  if (publishedDayText) {
    titleRow.append(createUploadDayBadge(publishedDayText));
  }

  const footer = document.createElement('div');
  footer.className = 'watch-card-footer';

  const mainAction = createIconButton(
    ICONS.play,
    () => onOpenUrl(item.url),
    'primary',
    item.platform === 'netflix' ? 'Netflix' : item.platform === 'youtube' ? 'YouTube' : 'Open Page'
  );
  mainAction.style.flexGrow = '1';

  footer.append(
    mainAction,
    createIconButton(
      ICONS.edit,
      () => {
        onEditItem(item);
      },
      'secondary'
    ),
    createIconButton(
      item.isArchived ? ICONS.unarchive : ICONS.archive,
      () => {
        onToggleArchive(item.id, !item.isArchived).catch(console.error);
      },
      'secondary'
    ),
    createIconButton(
      ICONS.delete,
      () => {
        onDelete(item.id).catch(console.error);
      },
      'danger'
    ),
  );

  content.append(badgeRow, titleRow, metadata, watchedAt);

  if (episodeStatusText) {
    content.append(episodeStatus);
  }

  if (publishedText) {
    content.append(publishedAt);
  }

  content.append(footer);
  card.append(content);
  return card;
}

function createBadge(platform: Platform, text?: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `platform-badge platform-${platform}`;
  badge.textContent = platform === 'netflix'
    ? 'Netflix'
    : platform === 'youtube'
      ? `YT: ${text}`
      : text || 'Custom';
  return badge;
}

function createUploadDayBadge(day: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'platform-badge upload-day-badge';
  badge.textContent = day;
  return badge;
}

function buildMetadataText(item: MediaItem): string {
  if (item.episode && item.episodeTitle && item.episode === item.episodeTitle) {
    return item.episode;
  }
  return [item.episode, item.episodeTitle].filter(Boolean).join(' - ');
}

function buildNetflixEpisodeStatusText(item: MediaItem): string | null {
  if (item.platform !== 'netflix') {
    return null;
  }

  if (item.hasNewEpisode) {
    return item.nextEpisode
      ? `New episode available: ${item.nextEpisode}`
      : 'New episode available';
  }

  if (item.nextEpisode && item.nextEpisodeAvailableAt) {
    const formattedDate = formatPublishedDate(item.nextEpisodeAvailableAt);
    return formattedDate
      ? `Next episode: ${item.nextEpisode} - ${formattedDate}`
      : `Next episode: ${item.nextEpisode}`;
  }

  return null;
}
