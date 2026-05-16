export interface WatchItem {
  id: string;
  title: string;
  season?: string | null;
  episode?: string | null;
  episodeTitle?: string | null;
  url: string;
  lastWatchedAt: string;
  source: 'netflix';
}

export interface WatchStorage {
  items: WatchItem[];
}
