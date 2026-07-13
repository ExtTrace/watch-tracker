import { getCloudSettings, getMediaStorage, setMediaStorage } from './storage';
import type { MediaStorage } from '../types/media';
import { WT_API_URL } from '../config/env';

const SYNC_API_URL = `${WT_API_URL}/api/sync`;

export async function pushToCloud(): Promise<void> {
  try {
    const settings = await getCloudSettings();
    if (!settings.enabled || !settings.syncId) return;

    const storage = await getMediaStorage();

    const response = await fetch(SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-id': settings.syncId,
      },
      body: JSON.stringify({ data: storage }),
    });

    if (!response.ok) {
      console.error('[Anime Watch Tracker] Failed to push to cloud:', response.statusText);
    }
  } catch (err) {
    console.error('[Anime Watch Tracker] Sync push error:', err);
  }
}

export async function pullFromCloud(): Promise<void> {
  try {
    const settings = await getCloudSettings();
    if (!settings.enabled || !settings.syncId) return;

    const response = await fetch(SYNC_API_URL, {
      method: 'GET',
      headers: {
        'x-sync-id': settings.syncId,
      },
    });

    if (!response.ok) {
      console.error('[Anime Watch Tracker] Failed to pull from cloud:', response.statusText);
      return;
    }

    const { data } = (await response.json()) as { data: MediaStorage | null };

    if (data && data.items && Array.isArray(data.items)) {
      await setMediaStorage(data);
      console.info('[Anime Watch Tracker] Successfully synced data from cloud.');
    }
  } catch (err) {
    console.error('[Anime Watch Tracker] Sync pull error:', err);
  }
}
