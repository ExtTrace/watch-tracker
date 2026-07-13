export type Platform = 'netflix' | 'youtube' | 'custom';

export interface AllowedYouTubeChannel {
  id: string;
  name: string;
  handle?: string | null;
  enabled: boolean;
  createdAt: string;
}

export interface AnimeDomain {
  id: string;
  name: string;
  hostname: string;
  grantedOrigin?: string | null;
  enabled: boolean;
  createdAt: string;
}

export interface MediaItem {
  id: string;
  platform: Platform;
  title: string;
  url: string;
  watchUrl?: string | null;
  seriesKey?: string | null;
  creator?: string | null;
  channel?: string | null;
  season?: string | null;
  episode?: string | null;
  episodeTitle?: string | null;
  duration?: string | null;
  thumbnail?: string | null;
  publishedAt?: string | null;
  siteName?: string | null;
  hostname?: string | null;
  nextEpisode?: string | null;
  nextEpisodeAvailableAt?: string | null;
  hasNewEpisode?: boolean;
  isArchived?: boolean;
  lastWatchedAt: string;
  lastNotifiedEpisode?: string | null;
  lastNotifiedReminderEpisode?: string | null;
}

export interface TelegramSettings {
  chatId: string;
  enabled: boolean;
}

export interface DiscordSettings {
  webhookUrl: string;
  enabled: boolean;
}

export interface CloudSettings {
  enabled: boolean;
}

export interface MediaStorage {
  items: MediaItem[];
}

export interface LegacyNetflixItem {
  id?: string;
  title?: string;
  season?: string | null;
  episode?: string | null;
  episodeTitle?: string | null;
  url?: string;
  watchUrl?: string | null;
  publishedAt?: string | null;
  nextEpisode?: string | null;
  nextEpisodeAvailableAt?: string | null;
  hasNewEpisode?: boolean;
  lastWatchedAt?: string;
  source?: 'netflix';
}
