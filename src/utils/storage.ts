import {
  ANIME_DOMAINS_KEY,
  CLOUD_SETTINGS_KEY,
  DISCORD_SETTINGS_KEY,
  LAST_FILTER_KEY,
  LAST_SETTINGS_VIEW_KEY,
  STORAGE_KEY,
  STORAGE_WARN_PREFIX,
  TELEGRAM_SETTINGS_KEY,
  YOUTUBE_CHANNELS_KEY,
} from '../constants/storage';
import type {
  AllowedYouTubeChannel,
  AnimeDomain,
  CloudSettings,
  LegacyNetflixItem,
  MediaItem,
  DiscordSettings,
  MediaStorage,
  Platform,
  TelegramSettings,
} from '../types/media';
import {
  createCustomSeriesKey,
  createNetflixItemId,
  createYouTubeItemId,
  createYouTubeSeriesKey,
  normalizeHostname,
  normalizeTitle,
  parseYouTubeTitleParts
} from './id';
import { NETFLIX_URL } from '../config/env';

export const defaultMediaStorage: MediaStorage = {
  items: [],
};

const DEFAULT_TELEGRAM_SETTINGS: TelegramSettings = {
  chatId: '',
  enabled: false,
};

const DEFAULT_DISCORD_SETTINGS: DiscordSettings = {
  webhookUrl: '',
  enabled: false,
};

const DEFAULT_YOUTUBE_CHANNELS: AllowedYouTubeChannel[] = [];

const DEFAULT_ANIME_DOMAINS: AnimeDomain[] = [];

export function extractNetflixTitleId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsedUrl = new URL(value, NETFLIX_URL);

    const pathnameTitleMatch = parsedUrl.pathname.match(/\/title\/(\d{6,})/i);
    if (pathnameTitleMatch) {
      return pathnameTitleMatch[1];
    }

    const queryCandidates = [
      parsedUrl.searchParams.get('titleId'),
      parsedUrl.searchParams.get('movieid'),
      parsedUrl.searchParams.get('jbv'),
      parsedUrl.searchParams.get('tctx'),
    ];

    for (const candidate of queryCandidates) {
      const match = candidate?.match(/\b(\d{6,})\b/);
      if (match) {
        return match[1];
      }
    }

    const decodedUrl = decodeURIComponent(parsedUrl.toString());
    const nestedTitleMatch = decodedUrl.match(/\/title\/(\d{6,})/i);
    if (nestedTitleMatch) {
      return nestedTitleMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

export function buildNetflixOpenUrl(title: string, titleId: string | null): string {
  if (titleId) {
    return `${NETFLIX_URL}/title/${titleId}`;
  }

  return `${NETFLIX_URL}/search?q=${encodeURIComponent(title)}`;
}

export function normalizeChannelName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeChannelHandle(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');
}

function createYouTubeChannelId(name: string, handle?: string | null): string {
  const normalizedHandle = handle ? normalizeChannelHandle(handle) : '';
  const normalizedName = normalizeTitle(name);
  return normalizedHandle
    ? `youtube-channel-${normalizedHandle}`
    : `youtube-channel-${normalizedName}`;
}

function createAnimeDomainId(name: string, hostname: string): string {
  return normalizeTitle(name) || normalizeHostname(hostname);
}



function logStorageAvailability(reason: string): void {
  const chromeExists = typeof chrome !== 'undefined';
  const storageExists = chromeExists && typeof chrome.storage !== 'undefined';
  const localExists = storageExists && typeof chrome.storage.local !== 'undefined';

  console.debug(`${STORAGE_WARN_PREFIX} storage diagnostics`, {
    reason,
    chromeExists,
    storageExists,
    localExists,
  });
}

export function getStorageArea(): chrome.storage.StorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return null;
  }

  return chrome.storage.local;
}

function isPlatform(value: unknown): value is Platform {
  return value === 'netflix' || value === 'youtube' || value === 'custom';
}

function toNullableString(value: unknown): string | null | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return typeof value === 'string' ? value : undefined;
}

function toNullableBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function normalizeAllowedYouTubeChannel(
  value: unknown,
): AllowedYouTubeChannel | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AllowedYouTubeChannel>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) {
    return null;
  }

  const rawHandle = toNullableString(candidate.handle);
  const handle =
    typeof rawHandle === 'string' && rawHandle.trim().length > 0
      ? `@${normalizeChannelHandle(rawHandle)}`
      : null;
  const id =
    typeof candidate.id === 'string' && candidate.id.trim().length > 0
      ? candidate.id.trim()
      : createYouTubeChannelId(name, handle);

  return {
    id,
    name,
    handle,
    enabled: candidate.enabled !== false,
    createdAt:
      typeof candidate.createdAt === 'string' && candidate.createdAt.trim().length > 0
        ? candidate.createdAt
        : new Date().toISOString(),
  };
}


function deduplicateList<T>(
  items: T[],
  getKey: (item: T) => string,
  merge: (existing: T, current: T) => T
): T[] {
  const byKey = new Map<string, T>();

  for (const item of items) {
    const key = getKey(item);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    byKey.set(key, merge(existing, item));
  }

  return [...byKey.values()];
}

export function normalizeAllowedYouTubeChannels(items: unknown[]): AllowedYouTubeChannel[] {
  const normalizedItems = items
    .map(normalizeAllowedYouTubeChannel)
    .filter((item): item is AllowedYouTubeChannel => item !== null);

  const deduplicated = deduplicateList(
    normalizedItems,
    (normalized) =>
      normalized.handle
        ? `handle:${normalizeChannelHandle(normalized.handle)}`
        : `name:${normalizeChannelName(normalized.name)}`,
    (existing, normalized) => ({
      ...existing,
      ...normalized,
      enabled: normalized.enabled,
    })
  );

  return deduplicated.sort((left, right) => {
    const createdAtDiff = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (!Number.isNaN(createdAtDiff) && createdAtDiff !== 0) {
      return createdAtDiff;
    }
    return left.name.localeCompare(right.name);
  });
}

export function getAnimeDomainCandidate(
  value: unknown,
): { name: string; hostname: string; candidate: Partial<AnimeDomain> } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AnimeDomain>;

  const name =
    typeof candidate.name === 'string'
      ? candidate.name.trim().replace(/\s+/g, ' ')
      : '';

  const hostname =
    typeof candidate.hostname === 'string'
      ? normalizeHostname(candidate.hostname)
      : '';

  if (!name || !hostname) {
    return null;
  }

  return {
    candidate,
    name,
    hostname,
  };
}

export function normalizeAnimeDomain(value: unknown): AnimeDomain | null {
  const result = getAnimeDomainCandidate(value);

  if (!result) {
    return null;
  }

  const { candidate, name, hostname } = result;

  const rawGrantedOrigin = toNullableString(candidate.grantedOrigin);
  const grantedOrigin =
    typeof rawGrantedOrigin === 'string' && rawGrantedOrigin.trim().length > 0
      ? rawGrantedOrigin.trim()
      : null;

  return {
    id:
      typeof candidate.id === 'string' && candidate.id.trim().length > 0
        ? candidate.id.trim()
        : createAnimeDomainId(name, hostname),
    name,
    hostname,
    grantedOrigin,
    enabled: candidate.enabled !== false,
    createdAt:
      typeof candidate.createdAt === 'string' && candidate.createdAt.trim().length > 0
        ? candidate.createdAt
        : new Date().toISOString(),
  };
}

function normalizeAnimeDomains(items: unknown[]): AnimeDomain[] {
  const normalizedItems = items
    .map(normalizeAnimeDomain)
    .filter((item): item is AnimeDomain => item !== null);

  const deduplicated = deduplicateList(
    normalizedItems,
    (normalized) => normalizeHostname(normalized.hostname),
    (existing, normalized) => ({
      ...existing,
      ...normalized,
      enabled: normalized.enabled,
    })
  );

  return deduplicated.sort((left, right) => {
    const createdAtDiff = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (!Number.isNaN(createdAtDiff) && createdAtDiff !== 0) {
      return createdAtDiff;
    }
    return left.name.localeCompare(right.name);
  });
}

function normalizeMediaItem(value: unknown): MediaItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<MediaItem> & LegacyNetflixItem;
  const rawTitle = typeof candidate.title === 'string' ? candidate.title.trim() : '';
  const url = typeof candidate.url === 'string' ? candidate.url : '';
  const lastWatchedAt =
    typeof candidate.lastWatchedAt === 'string'
      ? candidate.lastWatchedAt
      : new Date().toISOString();
  const platform =
    candidate.source === 'netflix'
      ? 'netflix'
      : isPlatform(candidate.platform)
        ? candidate.platform
        : null;

  if (!rawTitle || !url || !platform) {
    return null;
  }

  const parsedYouTubeTitle =
    platform === 'youtube' ? parseYouTubeTitleParts(rawTitle) : null;
  const title = parsedYouTubeTitle?.title ?? rawTitle;
  const watchUrl =
    platform === 'netflix'
      ? toNullableString(candidate.watchUrl) ?? url
      : toNullableString(candidate.watchUrl);

  let id = typeof candidate.id === 'string' && candidate.id ? candidate.id : '';
  if (!id && platform === 'netflix') {
    id = createNetflixItemId(title);
  }

  if (!id && platform === 'youtube') {
    try {
      const parsedUrl = new URL(url);
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId) {
        id = createYouTubeItemId(videoId);
      }
    } catch {
      return null;
    }
  }

  if (!id && platform === 'custom') {
    const customHostname = toNullableString(candidate.hostname);
    if (customHostname) {
      id = createCustomSeriesKey(customHostname, title);
    }
  }

  if (!id) {
    return null;
  }

  const channel = toNullableString(candidate.channel);

  const normalizedUrl =
    platform === 'netflix'
      ? buildNetflixOpenUrl(title, extractNetflixTitleId(candidate.url) ?? extractNetflixTitleId(watchUrl))
      : url;

  return {
    id,
    platform,
    title,
    url: normalizedUrl,
    watchUrl,
    seriesKey:
      platform === 'youtube'
        ? createYouTubeSeriesKey(title)
        : platform === 'custom'
          ? createCustomSeriesKey(toNullableString(candidate.hostname) ?? '', title)
          : toNullableString(candidate.seriesKey),
    creator: toNullableString(candidate.creator),
    channel,
    season: toNullableString(candidate.season),
    episode: parsedYouTubeTitle?.episode ?? toNullableString(candidate.episode),
    episodeTitle: toNullableString(candidate.episodeTitle),
    duration: toNullableString(candidate.duration),
    thumbnail: toNullableString(candidate.thumbnail),
    publishedAt: toNullableString(candidate.publishedAt),
    siteName: toNullableString(candidate.siteName),
    hostname: toNullableString(candidate.hostname),
    nextEpisode: toNullableString(candidate.nextEpisode),
    nextEpisodeAvailableAt: toNullableString(candidate.nextEpisodeAvailableAt),
    hasNewEpisode: toNullableBoolean(candidate.hasNewEpisode),
    isArchived: toNullableBoolean(candidate.isArchived),
    lastWatchedAt,
  };
}

function normalizeMediaItems(items: unknown[]): MediaItem[] {
  const byId = new Map<string, MediaItem>();
  const latestYoutubeSeries = new Map<string, MediaItem>();
  const latestCustomSeries = new Map<string, MediaItem>();

  for (const rawItem of items) {
    const normalized = normalizeMediaItem(rawItem);
    if (!normalized) {
      continue;
    }

    const existing = byId.get(normalized.id);
    if (!existing || Date.parse(normalized.lastWatchedAt) >= Date.parse(existing.lastWatchedAt)) {
      byId.set(normalized.id, normalized);
    }

    if (normalized.platform === 'youtube' && normalized.seriesKey) {
      const existingSeries = latestYoutubeSeries.get(normalized.seriesKey);
      if (
        !existingSeries ||
        Date.parse(normalized.lastWatchedAt) >= Date.parse(existingSeries.lastWatchedAt)
      ) {
        latestYoutubeSeries.set(normalized.seriesKey, normalized);
      }
    }

    if (normalized.platform === 'custom' && normalized.seriesKey) {
      const existingSeries = latestCustomSeries.get(normalized.seriesKey);
      if (
        !existingSeries ||
        Date.parse(normalized.lastWatchedAt) >= Date.parse(existingSeries.lastWatchedAt)
      ) {
        latestCustomSeries.set(normalized.seriesKey, normalized);
      }
    }
  }

  const itemsByRecency = [...byId.values()].filter((item) => {
    if (item.platform === 'youtube' && item.seriesKey) {
      return latestYoutubeSeries.get(item.seriesKey)?.id === item.id;
    }

    if (item.platform === 'custom' && item.seriesKey) {
      return latestCustomSeries.get(item.seriesKey)?.id === item.id;
    }

    return true;
  });

  return itemsByRecency.sort(
    (left, right) => Date.parse(right.lastWatchedAt) - Date.parse(left.lastWatchedAt),
  );
}

export function setMediaStorage(storage: MediaStorage): Promise<void> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      logStorageAvailability('setMediaStorage');
      console.warn(`${STORAGE_WARN_PREFIX} chrome.storage.local is unavailable`);
      resolve();
      return;
    }

    storageArea.set({ [STORAGE_KEY]: storage.items }, () => resolve());
  });
}

export function getMediaStorage(): Promise<MediaStorage> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      logStorageAvailability('getMediaStorage');
      console.warn(`${STORAGE_WARN_PREFIX} chrome.storage.local is unavailable`);
      resolve(defaultMediaStorage);
      return;
    }

    storageArea.get([STORAGE_KEY], (result) => {
      const rawItems = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
      const normalizedItems = normalizeMediaItems(rawItems);
      const hasChanged =
        JSON.stringify(rawItems) !== JSON.stringify(normalizedItems);

      if (hasChanged) {
        void setMediaStorage({ items: normalizedItems });
      }

      resolve({ items: normalizedItems });
    });
  });
}

export async function upsertMediaItem(item: MediaItem): Promise<void> {
  const currentStorage = await getMediaStorage();
  const nextItems = currentStorage.items.filter((existingItem) => {
    if (existingItem.id === item.id) {
      return false;
    }

    if (
      item.platform === 'youtube' &&
      (item.seriesKey ?? createYouTubeSeriesKey(item.title)) &&
      existingItem.platform === 'youtube'
    ) {
      const currentSeriesKey = item.seriesKey ?? createYouTubeSeriesKey(item.title);
      const existingSeriesKey =
        existingItem.seriesKey ?? createYouTubeSeriesKey(existingItem.title);

      if (existingSeriesKey === currentSeriesKey) {
        return false;
      }
    }

    if (
      item.platform === 'custom' &&
      (item.seriesKey ?? createCustomSeriesKey(item.hostname ?? '', item.title)) &&
      existingItem.platform === 'custom'
    ) {
      const currentSeriesKey =
        item.seriesKey ?? createCustomSeriesKey(item.hostname ?? '', item.title);
      const existingSeriesKey =
        existingItem.seriesKey ??
        createCustomSeriesKey(existingItem.hostname ?? '', existingItem.title);

      if (existingSeriesKey === currentSeriesKey) {
        return false;
      }
    }

    return true;
  });
  nextItems.push(item);
  nextItems.sort(
    (left, right) => Date.parse(right.lastWatchedAt) - Date.parse(left.lastWatchedAt),
  );
  await setMediaStorage({ items: nextItems });
}

export function setYouTubeChannels(channels: AllowedYouTubeChannel[]): Promise<void> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      logStorageAvailability('setYouTubeChannels');
      console.warn(`${STORAGE_WARN_PREFIX} chrome.storage.local is unavailable`);
      resolve();
      return;
    }

    const normalizedChannels = normalizeAllowedYouTubeChannels(channels);
    storageArea.set({ [YOUTUBE_CHANNELS_KEY]: normalizedChannels }, () => resolve());
  });
}

export function getYouTubeChannels(): Promise<AllowedYouTubeChannel[]> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      logStorageAvailability('getYouTubeChannels');
      console.warn(`${STORAGE_WARN_PREFIX} chrome.storage.local is unavailable`);
      resolve(DEFAULT_YOUTUBE_CHANNELS.map((channel) => ({ ...channel })));
      return;
    }

    storageArea.get([YOUTUBE_CHANNELS_KEY], (result) => {
      const hasStoredChannels = Object.prototype.hasOwnProperty.call(
        result,
        YOUTUBE_CHANNELS_KEY,
      );
      const rawChannels = Array.isArray(result[YOUTUBE_CHANNELS_KEY])
        ? result[YOUTUBE_CHANNELS_KEY]
        : DEFAULT_YOUTUBE_CHANNELS;
      const normalizedChannels = normalizeAllowedYouTubeChannels(rawChannels);
      const hasChanged =
        !hasStoredChannels ||
        JSON.stringify(rawChannels) !== JSON.stringify(normalizedChannels);

      if (hasChanged) {
        void setYouTubeChannels(normalizedChannels);
      }

      resolve(normalizedChannels);
    });
  });
}

export function setAnimeDomains(domains: AnimeDomain[]): Promise<void> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      logStorageAvailability('setAnimeDomains');
      console.warn(`${STORAGE_WARN_PREFIX} chrome.storage.local is unavailable`);
      resolve();
      return;
    }

    const normalizedDomains = normalizeAnimeDomains(domains);
    storageArea.set({ [ANIME_DOMAINS_KEY]: normalizedDomains }, () => resolve());
  });
}

export function getAnimeDomains(): Promise<AnimeDomain[]> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      logStorageAvailability('getAnimeDomains');
      console.warn(`${STORAGE_WARN_PREFIX} chrome.storage.local is unavailable`);
      resolve(DEFAULT_ANIME_DOMAINS.map((domain) => ({ ...domain })));
      return;
    }

    storageArea.get([ANIME_DOMAINS_KEY], (result) => {
      const hasStoredDomains = Object.prototype.hasOwnProperty.call(
        result,
        ANIME_DOMAINS_KEY,
      );
      const rawDomains = Array.isArray(result[ANIME_DOMAINS_KEY])
        ? result[ANIME_DOMAINS_KEY]
        : DEFAULT_ANIME_DOMAINS;
      const normalizedDomains = normalizeAnimeDomains(rawDomains);
      const hasChanged =
        !hasStoredDomains ||
        JSON.stringify(rawDomains) !== JSON.stringify(normalizedDomains);

      if (hasChanged) {
        void setAnimeDomains(normalizedDomains);
      }

      resolve(normalizedDomains);
    });
  });
}

export async function upsertAnimeDomain(
  domain: Omit<AnimeDomain, 'createdAt'> & { createdAt?: string },
): Promise<void> {
  const currentDomains = await getAnimeDomains();
  const nextDomain = normalizeAnimeDomain(domain);
  if (!nextDomain) {
    return;
  }

  const filteredDomains = currentDomains.filter((existingDomain) => {
    if (existingDomain.id === nextDomain.id) {
      return false;
    }

    return normalizeHostname(existingDomain.hostname) !== normalizeHostname(nextDomain.hostname);
  });

  filteredDomains.push(nextDomain);
  await setAnimeDomains(filteredDomains);
}

export async function removeAnimeDomain(domainId: string): Promise<void> {
  const currentDomains = await getAnimeDomains();
  const nextDomains = currentDomains.filter((domain) => domain.id !== domainId);
  await setAnimeDomains(nextDomains);
}

export async function upsertYouTubeChannel(
  channel: Omit<AllowedYouTubeChannel, 'createdAt'> & { createdAt?: string },
): Promise<void> {
  const currentChannels = await getYouTubeChannels();
  const nextChannel = normalizeAllowedYouTubeChannel(channel);
  if (!nextChannel) {
    return;
  }

  const filteredChannels = currentChannels.filter((existingChannel) => {
    if (existingChannel.id === nextChannel.id) {
      return false;
    }

    if (
      nextChannel.handle &&
      existingChannel.handle &&
      normalizeChannelHandle(existingChannel.handle) === normalizeChannelHandle(nextChannel.handle)
    ) {
      return false;
    }

    return normalizeChannelName(existingChannel.name) !== normalizeChannelName(nextChannel.name);
  });

  filteredChannels.push(nextChannel);
  await setYouTubeChannels(filteredChannels);
}

export async function removeYouTubeChannel(channelId: string): Promise<void> {
  const currentChannels = await getYouTubeChannels();
  const nextChannels = currentChannels.filter((channel) => channel.id !== channelId);
  await setYouTubeChannels(nextChannels);
}

export async function clearMediaStorage(): Promise<void> {
  await setMediaStorage(defaultMediaStorage);
}

export function getTelegramSettings(): Promise<TelegramSettings> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve({ ...DEFAULT_TELEGRAM_SETTINGS });
      return;
    }

    try {
      storageArea.get([TELEGRAM_SETTINGS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.warn(`${STORAGE_WARN_PREFIX} ${chrome.runtime.lastError.message}`);
          resolve({ ...DEFAULT_TELEGRAM_SETTINGS });
          return;
        }

        const settings = result[TELEGRAM_SETTINGS_KEY] as TelegramSettings | undefined;
        resolve({
          chatId: settings?.chatId ?? DEFAULT_TELEGRAM_SETTINGS.chatId,
          enabled: settings?.enabled ?? DEFAULT_TELEGRAM_SETTINGS.enabled,
        });
      });
    } catch (error) {
      console.warn(`${STORAGE_WARN_PREFIX} failed to get telegram settings`, error);
      resolve({ ...DEFAULT_TELEGRAM_SETTINGS });
    }
  });
}

export function setTelegramSettings(settings: TelegramSettings): Promise<void> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve();
      return;
    }

    try {
      storageArea.set({ [TELEGRAM_SETTINGS_KEY]: settings }, () => {
        if (chrome.runtime.lastError) {
          console.warn(`${STORAGE_WARN_PREFIX} ${chrome.runtime.lastError.message}`);
        }
        resolve();
      });
    } catch (error) {
      console.warn(`${STORAGE_WARN_PREFIX} failed to set telegram settings`, error);
      resolve();
    }
  });
}

export function getDiscordSettings(): Promise<DiscordSettings> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve({ ...DEFAULT_DISCORD_SETTINGS });
      return;
    }

    try {
      storageArea.get([DISCORD_SETTINGS_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.warn(`${STORAGE_WARN_PREFIX} ${chrome.runtime.lastError.message}`);
          resolve({ ...DEFAULT_DISCORD_SETTINGS });
          return;
        }

        const settings = result[DISCORD_SETTINGS_KEY] as DiscordSettings | undefined;
        resolve({
          webhookUrl: settings?.webhookUrl ?? DEFAULT_DISCORD_SETTINGS.webhookUrl,
          enabled: settings?.enabled ?? DEFAULT_DISCORD_SETTINGS.enabled,
        });
      });
    } catch (error) {
      console.warn(`${STORAGE_WARN_PREFIX} failed to get discord settings`, error);
      resolve({ ...DEFAULT_DISCORD_SETTINGS });
    }
  });
}

export function setDiscordSettings(settings: DiscordSettings): Promise<void> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve();
      return;
    }

    try {
      storageArea.set({ [DISCORD_SETTINGS_KEY]: settings }, () => {
        if (chrome.runtime.lastError) {
          console.warn(`${STORAGE_WARN_PREFIX} ${chrome.runtime.lastError.message}`);
        }
        resolve();
      });
    } catch (error) {
      console.warn(`${STORAGE_WARN_PREFIX} failed to set discord settings`, error);
      resolve();
    }
  });
}

export async function removeMediaItem(itemId: string): Promise<void> {
  const currentStorage = await getMediaStorage();
  const nextItems = currentStorage.items.filter((item) => item.id !== itemId);
  await setMediaStorage({ items: nextItems });
}

export async function setMediaItemArchived(itemId: string, isArchived: boolean): Promise<void> {
  const currentStorage = await getMediaStorage();
  let updated = false;
  const nextItems = currentStorage.items.map((item) => {
    if (item.id === itemId) {
      updated = true;
      return { ...item, isArchived };
    }
    return item;
  });

  if (updated) {
    await setMediaStorage({ items: nextItems });
  }
}

export async function importMediaItems(items: unknown[]): Promise<number> {
  const currentStorage = await getMediaStorage();
  const normalizedImportedItems = normalizeMediaItems(items);

  if (normalizedImportedItems.length === 0) {
    return 0;
  }

  const mergedItems = normalizeMediaItems([
    ...currentStorage.items,
    ...normalizedImportedItems,
  ]);

  await setMediaStorage({ items: mergedItems });
  return normalizedImportedItems.length;
}

export async function migrateStorage(): Promise<void> {
  await getMediaStorage();
  await getYouTubeChannels();
  await getAnimeDomains();
}

export function setLastFilter(filter: string): Promise<void> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve();
      return;
    }
    storageArea.set({ [LAST_FILTER_KEY]: filter }, () => {
      resolve();
    });
  });
}

export function getLastSettingsView(): Promise<string> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve('data');
      return;
    }
    storageArea.get([LAST_SETTINGS_VIEW_KEY], (result) => {
      resolve((result[LAST_SETTINGS_VIEW_KEY] as string) || 'data');
    });
  });
}

export function setLastSettingsView(view: string): Promise<void> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve();
      return;
    }
    storageArea.set({ [LAST_SETTINGS_VIEW_KEY]: view }, () => {
      resolve();
    });
  });
}

export function getLastFilter(): Promise<string> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve('all');
      return;
    }
    storageArea.get([LAST_FILTER_KEY], (result) => {
      resolve((result[LAST_FILTER_KEY] as string) || 'all');
    });
  });
}

export function getCloudSettings(): Promise<CloudSettings> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve({ enabled: false, syncId: null });
      return;
    }
    storageArea.get([CLOUD_SETTINGS_KEY], (result) => {
      const stored = result[CLOUD_SETTINGS_KEY] as CloudSettings | undefined;
      const settings = {
        enabled: stored?.enabled ?? false,
        syncId: stored?.syncId ?? null,
      };

      if (!settings.syncId) {
        settings.syncId = `awt-sync-${crypto.randomUUID()}`;
        void setCloudSettings(settings);
      }

      resolve(settings);
    });
  });
}

export function setCloudSettings(settings: CloudSettings): Promise<void> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve();
      return;
    }
    storageArea.set({ [CLOUD_SETTINGS_KEY]: settings }, () => {
      if (chrome.runtime.lastError) {
        console.warn(`${STORAGE_WARN_PREFIX} ${chrome.runtime.lastError.message}`);
      }
      resolve();
    });
  });
}
