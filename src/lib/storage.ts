import type { WatchItem, WatchStorage } from '../types/watch';

const STORAGE_KEY = 'items';

export const defaultWatchStorage: WatchStorage = {
  items: [],
};

export function getWatchStorage(): Promise<WatchStorage> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const items = Array.isArray(result[STORAGE_KEY]) ? (result[STORAGE_KEY] as WatchItem[]) : [];
      resolve({ items });
    });
  });
}

export function setWatchStorage(storage: WatchStorage): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: storage.items }, () => resolve());
  });
}
