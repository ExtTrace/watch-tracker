import {
  getCloudSettings,
  getMediaStorage,
  setMediaStorage,
  getTelegramSettings,
  setTelegramSettings,
  getDiscordSettings,
  setDiscordSettings,
  setCloudSettings,
} from './storage';
import { WT_API_URL } from '../config/env';

const SYNC_API_URL = `${WT_API_URL}/api/sync`;

export async function pushToCloud(): Promise<void> {
  try {
    const cloudSettings = await getCloudSettings();
    if (!cloudSettings.enabled || !cloudSettings.syncId) return;

    const storage = await getMediaStorage();
    const telegramSettings = await getTelegramSettings();
    const discordSettings = await getDiscordSettings();

    const payload = {
      items: storage.items,
      telegramSettings,
      discordSettings,
      cloudSettings,
    };

    const response = await fetch(SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-id': cloudSettings.syncId,
      },
      body: JSON.stringify({ data: payload }),
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
    const cloudSettings = await getCloudSettings();
    if (!cloudSettings.enabled || !cloudSettings.syncId) return;

    const response = await fetch(SYNC_API_URL, {
      method: 'GET',
      headers: {
        'x-sync-id': cloudSettings.syncId,
      },
    });

    if (!response.ok) {
      console.error('[Anime Watch Tracker] Failed to pull from cloud:', response.statusText);
      return;
    }

    const { data } = (await response.json()) as { data: any | null };

    if (data) {
      if (data.items && Array.isArray(data.items)) {
        await setMediaStorage({ items: data.items });
      }
      if (data.telegramSettings) {
        await setTelegramSettings(data.telegramSettings);
      }
      if (data.discordSettings) {
        await setDiscordSettings(data.discordSettings);
      }
      if (data.cloudSettings) {
        await setCloudSettings({
          ...data.cloudSettings,
          syncId: cloudSettings.syncId, // Keep local syncId
        });
      }
      console.info('[Anime Watch Tracker] Successfully synced data from cloud.');
    }
  } catch (err) {
    console.error('[Anime Watch Tracker] Sync pull error:', err);
  }
}
