import { getAnimeDomains, setAnimeDomains, getMediaStorage, setMediaStorage, getTelegramSettings, getDiscordSettings, migrateStorage, getCloudSettings } from './utils/storage';
import { normalizeHostname } from './utils/id';
import { sendTelegramNotification } from './utils/telegram';
import { searchAniListAnime } from './utils/anilist';
import { dateFormatter } from './utils/formatters';
import { sendDiscordNotification } from './utils/discord';
import { pullFromCloud, pushToCloud } from './utils/sync';
import { STORAGE_KEY, TELEGRAM_SETTINGS_KEY, DISCORD_SETTINGS_KEY, CLOUD_SETTINGS_KEY } from './constants/storage';

let isPulling = false;



function createWildcardOriginFromExact(origin: string): string | null {
  try {
    const parsedUrl = new URL(origin.replace(/\/\*$/, ''));
    return `https://*.${normalizeHostname(parsedUrl.hostname)}/*`;
  } catch {
    return null;
  }
}

async function injectCustomTrackerIfNeeded(
  tabId: number,
  urlValue: string,
): Promise<void> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlValue);
  } catch {
    return;
  }

  if (!/^https:$/i.test(parsedUrl.protocol)) {
    return;
  }

  if (
    parsedUrl.hostname.endsWith('netflix.com') ||
    parsedUrl.hostname === 'www.youtube.com' ||
    parsedUrl.hostname === 'youtube.com'
  ) {
    return;
  }

  const domains = await getAnimeDomains();
  const normalizedCurrentHostname = normalizeHostname(parsedUrl.hostname);
  const matchedDomain = domains.find(
    (domain) =>
      domain.enabled &&
      domain.grantedOrigin &&
      normalizedCurrentHostname.includes(normalizeHostname(domain.hostname)),
  );
  if (!matchedDomain?.grantedOrigin) {
    return;
  }

  // Ensure the grantedOrigin is a valid match pattern (migration from old bug)
  let validGrantedOrigin = matchedDomain.grantedOrigin;
  if (!validGrantedOrigin.includes('://')) {
    validGrantedOrigin = `https://${validGrantedOrigin}/*`;
  }

  const derivedWildcardOrigin = createWildcardOriginFromExact(validGrantedOrigin);
  const hasExactPermission = await chrome.permissions.contains({
    origins: [validGrantedOrigin],
  });
  const hasWildcardPermission = derivedWildcardOrigin
    ? await chrome.permissions.contains({
        origins: [derivedWildcardOrigin],
      })
    : false;
  if (!hasExactPermission && !hasWildcardPermission) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

async function refreshCustomInjectionAcrossOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url) {
      continue;
    }

    await injectCustomTrackerIfNeeded(tab.id, tab.url);
  }
}

function runMigration(reason: string): void {
  void migrateStorage().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Anime Watch Tracker] storage migration failed during ${reason}`, message);
  });
}

function scheduleDailyDigest(): void {
  // Clear any existing legacy alarm
  chrome.alarms.clear('anime-episode-checker', () => {});

  // Calculate the next 12:00 WIB (05:00 UTC)
  const now = new Date();
  const nextTarget = new Date();
  nextTarget.setUTCHours(5, 0, 0, 0);

  // If we already passed 12:00 UTC today, set it for tomorrow
  if (now.getTime() > nextTarget.getTime()) {
    nextTarget.setDate(nextTarget.getDate() + 1);
  }

  chrome.alarms.create('anime-daily-digest', {
    when: nextTarget.getTime(),
    periodInMinutes: 24 * 60 // Repeat every 24 hours
  });
}

chrome.runtime.onInstalled.addListener(() => {
  runMigration('onInstalled');
  scheduleDailyDigest();
  isPulling = true;
  pullFromCloud().finally(() => { isPulling = false; });
});

chrome.runtime.onStartup.addListener(() => {
  runMigration('onStartup');
  scheduleDailyDigest();
  isPulling = true;
  pullFromCloud().finally(() => { isPulling = false; });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'anime-daily-digest') {
    void checkNewEpisodes();
  }
});

async function checkNewEpisodes(): Promise<void> {
  const cloudSettings = await getCloudSettings();
  if (cloudSettings.enabled && cloudSettings.useCloudCron) {
    console.info('[Anime Watch Tracker] Skipping local daily digest check (handled by Cloud Cron)');
    return;
  }

  const settings = await getTelegramSettings();
  const discordSettings = await getDiscordSettings();

  if ((!settings.enabled || !settings.chatId) && (!discordSettings.enabled || !discordSettings.webhookUrl)) {
    return;
  }

  const storage = await getMediaStorage();
  let updated = false;
  const newlyReleased: { title: string; episode: string; link: string }[] = [];
  const upcomingReminders: { title: string; episode: string; time: string; link: string }[] = [];

  for (const item of storage.items) {
    if (item.isArchived) continue;

    let shouldQuery = true;
    if (item.nextEpisodeAvailableAt) {
      const nextAiringMs = new Date(item.nextEpisodeAvailableAt).getTime();
      const now = Date.now();
      const timeUntilAiring = nextAiringMs - now;

      if (timeUntilAiring > 0) {
        shouldQuery = false;
        
        // Reminder within 24 hours
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        if (timeUntilAiring <= ONE_DAY_MS && item.nextEpisode) {
          const reminderStr = `Episode ${item.nextEpisode}`;
          if (item.lastNotifiedReminderEpisode !== reminderStr) {
            item.lastNotifiedReminderEpisode = reminderStr;
            updated = true;
            upcomingReminders.push({
              title: item.title,
              episode: reminderStr,
              time: item.nextEpisodeAvailableAt,
              link: item.url,
            });
          }
        }
      }
    }

    if (shouldQuery) {
      const anilistResult = await searchAniListAnime(item.title);
      if (anilistResult?.nextAiringEpisode) {
        const nextEpNum = anilistResult.nextAiringEpisode.episode;
        const latestAiredEpNum = nextEpNum - 1;
        const latestAiredEpStr = `Episode ${latestAiredEpNum}`;

        const userWatchedEpMatch = item.episode?.match(/\d+/);
        const userWatchedEpNum = userWatchedEpMatch ? parseInt(userWatchedEpMatch[0], 10) : 0;

        // Save the FUTURE airing time so we don't hit the API again until this time passes
        item.nextEpisodeAvailableAt = new Date(anilistResult.nextAiringEpisode.airingAt * 1000).toISOString();
        item.nextEpisode = nextEpNum.toString();

        if (
          latestAiredEpNum > 0 &&
          latestAiredEpNum > userWatchedEpNum &&
          item.lastNotifiedEpisode !== latestAiredEpStr
        ) {
          item.lastNotifiedEpisode = latestAiredEpStr;
          item.hasNewEpisode = true;
          updated = true;
          newlyReleased.push({
            title: item.title,
            episode: latestAiredEpStr,
            link: item.url,
          });
        }
      } else {
        // If nextAiringEpisode is null, the anime might be finished.
        // Set to check again in 7 days to avoid spamming the API for completed series.
        item.nextEpisodeAvailableAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        item.nextEpisode = null;
        updated = true;
      }
    }
  }

  let fullMessage = '';

  if (upcomingReminders.length > 0) {
    fullMessage += `⏰ <b>${upcomingReminders.length} Anime Akan Tayang (Besok)!</b>\n\n`;
    for (const reminder of upcomingReminders) {
      const formattedTime = dateFormatter.format(new Date(reminder.time));
      fullMessage += `<b>${reminder.title}</b>\n${reminder.episode} - ${formattedTime}\n<a href="${reminder.link}">Tonton Besok</a>\n\n`;
    }
  }

  if (newlyReleased.length > 0) {
    fullMessage += `🎬 <b>${newlyReleased.length} Anime Sedang Tayang!</b>\n\n`;
    for (const release of newlyReleased) {
      fullMessage += `<b>${release.title}</b>\n${release.episode} - <a href="${release.link}">Tonton Sekarang</a>\n\n`;
    }
  }

  if (fullMessage.trim()) {
    const finalMessage = `🌙 <b>Anime Daily Digest</b>\n\n${fullMessage.trim()}`;
    
    if (settings.enabled && settings.chatId) {
      try {
        await sendTelegramNotification(settings.chatId, finalMessage);
      } catch (err) {
        console.error('Failed to notify telegram', err);
      }
    }

    if (discordSettings.enabled && discordSettings.webhookUrl) {
      try {
        await sendDiscordNotification(discordSettings.webhookUrl, finalMessage);
      } catch (err) {
        console.error('Failed to notify discord', err);
      }
    }
  }

  if (updated) {
    await setMediaStorage(storage);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) {
    return;
  }

  void injectCustomTrackerIfNeeded(tabId, tab.url).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[Anime Watch Tracker] custom domain injection failed', message);
  });
});

chrome.permissions.onAdded.addListener(async (permissions) => {
  if (!permissions.origins || permissions.origins.length === 0) {
    return;
  }

  const domains = await getAnimeDomains();
  let updated = false;

  for (const origin of permissions.origins) {
    const match = origin.match(/^https?:\/\/(?:\*\.)?([^/]+)\/\*$/);
    if (match) {
      const hostname = normalizeHostname(match[1]);
      for (const domain of domains) {
        if (!domain.grantedOrigin && normalizeHostname(domain.hostname) === hostname) {
          domain.grantedOrigin = origin;
          updated = true;
        }
      }
    }
  }

  if (updated) {
    await setAnimeDomains(domains);
    chrome.tabs.query({ url: permissions.origins }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id && tab.url) {
          injectCustomTrackerIfNeeded(tab.id, tab.url).catch(() => {});
        }
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'anime-watch-tracker:test-telegram') {
    getTelegramSettings().then((settings) => {
      if (!settings.chatId) {
        console.warn('Chat ID is missing');
        return;
      }
      sendTelegramNotification(settings.chatId, '🔔 <b>Anime Watch Tracker</b>\n\nNotifikasi percobaan Telegram berhasil!').catch(console.error);
    }).catch(console.error);
    sendResponse({ status: 'ok' });
    return;
  }

  if (message?.type === 'anime-watch-tracker:test-discord') {
    getDiscordSettings().then((settings) => {
      if (!settings.webhookUrl) {
        console.warn('Webhook URL is missing');
        return;
      }
      sendDiscordNotification(settings.webhookUrl, '🔔 <b>Anime Watch Tracker</b>\n\nNotifikasi percobaan Discord berhasil!').catch(console.error);
    }).catch(console.error);
    sendResponse({ status: 'ok' });
    return;
  }

  if (message?.type !== 'anime-watch-tracker:refresh-custom-injection') {
    return;
  }

  void refreshCustomInjectionAcrossOpenTabs()
    .then(() => sendResponse({ ok: true }))
    .catch((error: unknown) => {
      const messageText = error instanceof Error ? error.message : String(error);
      console.warn('[Anime Watch Tracker] custom domain refresh failed', messageText);
      sendResponse({ ok: false });
    });

  return true;
});

chrome.storage.local.onChanged.addListener((changes) => {
  const keysToSync = [STORAGE_KEY, TELEGRAM_SETTINGS_KEY, DISCORD_SETTINGS_KEY, CLOUD_SETTINGS_KEY];
  const hasChanged = keysToSync.some((key) => changes[key] !== undefined);
  if (hasChanged && !isPulling) {
    void pushToCloud();
  }
});
