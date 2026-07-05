import { getAnimeDomains, setAnimeDomains, getMediaStorage, setMediaStorage, getTelegramSettings, migrateStorage } from './utils/storage';
import { normalizeHostname } from './utils/id';
import { sendTelegramNotification } from './utils/telegram';
import { searchAniListAnime } from './utils/anilist';



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

chrome.runtime.onInstalled.addListener(() => {
  runMigration('onInstalled');
  chrome.alarms.create('anime-episode-checker', { periodInMinutes: 60 });
});

chrome.runtime.onStartup.addListener(() => {
  runMigration('onStartup');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'anime-episode-checker') {
    void checkNewEpisodes();
  }
});

async function checkNewEpisodes(): Promise<void> {
  const settings = await getTelegramSettings();
  if (!settings.enabled || !settings.chatId) return;

  const storage = await getMediaStorage();
  let updated = false;
  const newlyReleased: { title: string; episode: string; link: string }[] = [];

  for (const item of storage.items) {
    if (item.isArchived) continue;

    let shouldQuery = true;
    if (item.nextEpisodeAvailableAt) {
      const nextAiringMs = new Date(item.nextEpisodeAvailableAt).getTime();
      // If the current time is still BEFORE the known next airing time, do NOT hit the API
      if (Date.now() < nextAiringMs) {
        shouldQuery = false;
      }
    }

    if (shouldQuery) {
      const anilistResult = await searchAniListAnime(item.title);
      if (anilistResult?.nextAiringEpisode) {
        const nextEpNum = anilistResult.nextAiringEpisode.episode;
        const latestAiredEpNum = nextEpNum - 1;
        const latestAiredEpStr = `Episode ${latestAiredEpNum}`;

        // Save the FUTURE airing time so we don't hit the API again until this time passes
        item.nextEpisodeAvailableAt = new Date(anilistResult.nextAiringEpisode.airingAt * 1000).toISOString();

        if (latestAiredEpNum > 0 && item.lastNotifiedEpisode !== latestAiredEpStr) {
          item.lastNotifiedEpisode = latestAiredEpStr;
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
        updated = true;
      }
    }
  }

  if (newlyReleased.length > 0) {
    let message = `🎬 <b>${newlyReleased.length} Episode Baru Rilis!</b>\n\n`;
    for (const release of newlyReleased) {
      message += `<b>${release.title}</b>\n${release.episode} - <a href="${release.link}">Tonton Sekarang</a>\n\n`;
    }

    try {
      await sendTelegramNotification(settings.chatId, message.trim());
    } catch (err) {
      console.error('Failed to notify', err);
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
      sendTelegramNotification(settings.chatId, '🔔 <b>Anime Watch Tracker</b>\n\nNotifikasi percobaan berhasil!').catch(console.error);
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
