import type { WatchItem } from './types/watch';

const DEBUG_PREFIX = '[Anime Netflix Tracker]';
const SAVE_DEBOUNCE_MS = 1200;
const MIN_SAVE_INTERVAL_MS = 45000;

const TITLE_SELECTORS = [
  '[data-uia="player-header-title"]',
  '[data-uia="video-title"]',
  '[data-uia="video-title-link"]',
  '[data-uia="watch-video-title"]',
  '[data-uia="watch-video-title"] a',
  '.video-title h4',
  '.video-title a',
  '.watch-video h4',
  '.watch-video--player-view h4',
  '[class*="watch-video"] h4',
  '[class*="videoMetadata"] h4',
];

const TITLE_LINK_SELECTORS = [
  'a[href*="/title/"]',
  'a[href*="/browse"]',
  '.video-title a',
  '[data-uia="watch-video-title"] a',
  '[data-uia="video-title-link"]',
];

const METADATA_SELECTORS = [
  '[data-uia="watch-video-title"]',
  '[data-uia="watch-video-episode-title"]',
  '[data-uia="player-status-subtitle"]',
  '[data-uia="episode-title"]',
  '[data-uia="video-title"]',
  '.video-title',
  '[class*="episode"]',
  '[class*="metadata"]',
  '[class*="videoMetadata"]',
];

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastProcessedUrl = window.location.href;
let lastSavedSignature = '';
let lastSavedAt = 0;

function getStoredItems(): Promise<WatchItem[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['items'], (result) => {
      const items = Array.isArray(result.items) ? (result.items as WatchItem[]) : [];
      resolve(items);
    });
  });
}

function setStoredItems(items: WatchItem[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ items }, () => resolve());
  });
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim() ?? '';
  return text.length > 0 ? text : null;
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^[`"'“”‘’â€œâ€â€˜â€™]+|[`"'“”‘’â€œâ€â€˜â€™]+$/g, '').trim();
}

function isIgnoredTitleText(text: string): boolean {
  return (
    /^Netflix$/i.test(text) ||
    /^rated\s*\d+\+?$/i.test(text) ||
    /^(tv|pg|nc|ma|r)[-\s]?\d*[a-z+]*$/i.test(text) ||
    /^skip intro$/i.test(text)
  );
}

function getTextsFromSelectors(selectors: string[]): string[] {
  const results = new Set<string>();

  for (const selector of selectors) {
    const nodes = document.querySelectorAll<HTMLElement>(selector);

    for (const node of nodes) {
      const text = cleanText(node.textContent);
      if (text) {
        results.add(text);
      }
    }
  }

  return [...results];
}

function findEpisodeMarkerIndex(text: string): number {
  const combinedPatterns = [
    /S\d+\s*:\s*E\d+/i,
    /Season\s+\d+\s+Episode\s+\d+/i,
    /E\d+(?=[A-Z"'`“”‘’â€œâ€â€˜â€™\s]|$)/i,
  ];

  let bestIndex = -1;

  for (const pattern of combinedPatterns) {
    const match = pattern.exec(text);
    if (!match || match.index === undefined) {
      continue;
    }

    const candidateIndex = match.index;
    if (bestIndex === -1 || candidateIndex < bestIndex) {
      bestIndex = candidateIndex;
    }
  }

  if (bestIndex <= 0) {
    return bestIndex;
  }

  const previousChar = text[bestIndex - 1];
  if (previousChar && /[A-Za-z0-9)]/.test(previousChar)) {
    return bestIndex;
  }

  return bestIndex;
}

function splitCombinedTitleCandidate(text: string): { title: string | null; metadata: string | null } {
  const cleaned = cleanText(stripWrappingQuotes(text));
  if (!cleaned) {
    return { title: null, metadata: null };
  }

  const markerIndex = findEpisodeMarkerIndex(cleaned);
  if (markerIndex <= 0) {
    return { title: cleaned, metadata: null };
  }

  return {
    title: cleanText(cleaned.slice(0, markerIndex)),
    metadata: cleanText(cleaned.slice(markerIndex)),
  };
}

function isValidSeriesTitle(title: string): boolean {
  const cleaned = cleanText(stripWrappingQuotes(title));
  if (!cleaned || isIgnoredTitleText(cleaned) || isEpisodeMetadataText(cleaned)) {
    return false;
  }

  const { title: splitTitle, metadata } = splitCombinedTitleCandidate(cleaned);
  if (!splitTitle || isIgnoredTitleText(splitTitle) || isEpisodeMetadataText(splitTitle)) {
    return false;
  }

  return !metadata;
}

function normalizeMetadataText(text: string): string {
  return text
    .replace(/(S\d+\s*:\s*E\d+)(?=[A-Z"'`“”‘’â€œâ€â€˜â€™])/g, '$1 ')
    .replace(/(Season\s+\d+\s+Episode\s+\d+)(?=[A-Z"'`“”‘’â€œâ€â€˜â€™])/gi, '$1 ')
    .replace(/(E(?:pisode)?\s*\d+)(?=[A-Z"'`“”‘’â€œâ€â€˜â€™])/gi, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNetflixWatchPage(): boolean {
  return window.location.hostname.endsWith('netflix.com') && window.location.pathname.includes('/watch/');
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function createWatchItemId(title: string): string {
  return `netflix-${normalizeTitle(title)}`;
}

export function isEpisodeMetadataText(text: string): boolean {
  const normalized = cleanText(text);
  if (!normalized) {
    return false;
  }

  const metadataText = normalizeMetadataText(normalized);
  return /^(?:s\d+\s*:\s*e\d+\b|s(?:eason)?\s+\d+\s*[:,-]?\s*e(?:pisode)?\s+\d+\b|season\s+\d+\s+episode\s+\d+\b|e(?:pisode)?\s*\d+\b)/i.test(
    metadataText,
  );
}

export function extractTitleFromDocumentTitle(): string | null {
  const pageTitle = cleanText(document.title);
  if (!pageTitle) {
    return null;
  }

  const cleanedTitle = stripWrappingQuotes(
    pageTitle.replace(/\s*\|\s*Netflix(?:\s+Official\s+Site)?\s*$/i, '').replace(/^Watch\s+/i, '').trim(),
  );

  if (!cleanedTitle || isIgnoredTitleText(cleanedTitle) || isEpisodeMetadataText(cleanedTitle)) {
    return null;
  }

  return cleanedTitle;
}

function extractTitleFromMetaTags(): string | null {
  const metaCandidates = [
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content,
    document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.content,
  ];

  for (const candidate of metaCandidates) {
    const cleaned = candidate ? stripWrappingQuotes(candidate.replace(/\s*\|\s*Netflix.*$/i, '').trim()) : null;
    if (cleaned && !isIgnoredTitleText(cleaned) && !isEpisodeMetadataText(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

function extractTitleFromStructuredData(): string | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');

  for (const script of scripts) {
    const content = cleanText(script.textContent);
    if (!content) {
      continue;
    }

    try {
      const parsed = JSON.parse(content) as Record<string, unknown> | Array<Record<string, unknown>>;
      const entries = Array.isArray(parsed) ? parsed : [parsed];

      for (const entry of entries) {
        const partOfSeries = entry.partOfSeries as Record<string, unknown> | undefined;
        const seriesName = cleanText(typeof partOfSeries?.name === 'string' ? partOfSeries.name : null);
        if (seriesName && !isIgnoredTitleText(seriesName) && !isEpisodeMetadataText(seriesName)) {
          return stripWrappingQuotes(seriesName);
        }

        const name = cleanText(typeof entry.name === 'string' ? entry.name : null);
        if (name && !/^Watch\b/i.test(name) && !isIgnoredTitleText(name) && !isEpisodeMetadataText(name)) {
          return stripWrappingQuotes(name.replace(/\s*\|\s*Netflix.*$/i, ''));
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function pickSeriesTitle(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const { title } = splitCombinedTitleCandidate(candidate);
    if (!title || isIgnoredTitleText(title) || isEpisodeMetadataText(title)) {
      continue;
    }

    return title;
  }

  return null;
}

function extractTitle(): string | null {
  const documentTitle = extractTitleFromDocumentTitle();
  if (documentTitle) {
    return documentTitle;
  }

  const structuredTitle = extractTitleFromStructuredData();
  if (structuredTitle) {
    return structuredTitle;
  }

  const metaTitle = extractTitleFromMetaTags();
  if (metaTitle) {
    return metaTitle;
  }

  const linkedTitle = pickSeriesTitle(getTextsFromSelectors(TITLE_LINK_SELECTORS));
  if (linkedTitle) {
    return linkedTitle;
  }

  return pickSeriesTitle(getTextsFromSelectors(TITLE_SELECTORS));
}

function collectMetadataTexts(): string[] {
  const rawTexts = [...getTextsFromSelectors(METADATA_SELECTORS), ...getTextsFromSelectors(TITLE_SELECTORS)];
  const results = new Set<string>();

  for (const rawText of rawTexts) {
    if (rawText.length > 220) {
      continue;
    }

    const normalized = normalizeMetadataText(rawText);
    if (
      isEpisodeMetadataText(normalized) ||
      /\bseason\b/i.test(normalized) ||
      /\bepisode\b/i.test(normalized) ||
      /\bs\d+\s*:\s*e\d+\b/i.test(normalized) ||
      findEpisodeMarkerIndex(normalized) >= 0
    ) {
      results.add(normalized);
    }

    const { metadata } = splitCombinedTitleCandidate(normalized);
    if (metadata) {
      results.add(normalizeMetadataText(metadata));
    }
  }

  return [...results];
}

function extractSeasonAndEpisode(texts: string[]): {
  season: string | null;
  episode: string | null;
  episodeTitle: string | null;
} {
  let season: string | null = null;
  let episode: string | null = null;
  let episodeTitle: string | null = null;

  for (const rawText of texts) {
    const text = normalizeMetadataText(stripWrappingQuotes(rawText));

    const combinedMatch = text.match(/\bSeason\s+(\d+)\b[\s:,-]*Episode\s+(\d+)\b(?:[\s:,-]+(.+))?/i);
    if (combinedMatch) {
      season = `Season ${combinedMatch[1]}`;
      episode = `Episode ${combinedMatch[2]}`;
      episodeTitle = cleanText(stripWrappingQuotes(combinedMatch[3] ?? ''));
      break;
    }

    const shorthandMatch = text.match(/\bS(\d+)\s*:\s*E(\d+)\b(?:[\s:,-]+(.+))?/i);
    if (shorthandMatch) {
      season = `Season ${shorthandMatch[1]}`;
      episode = `Episode ${shorthandMatch[2]}`;
      episodeTitle = cleanText(stripWrappingQuotes(shorthandMatch[3] ?? ''));
      break;
    }

    const shortWordsMatch = text.match(/\bS(?:eason)?\s+(\d+)\s*[:,-]?\s*E(?:pisode)?\s+(\d+)\b(?:[\s:,-]+(.+))?/i);
    if (shortWordsMatch) {
      season = `Season ${shortWordsMatch[1]}`;
      episode = `Episode ${shortWordsMatch[2]}`;
      episodeTitle = cleanText(stripWrappingQuotes(shortWordsMatch[3] ?? ''));
      break;
    }

    if (!season) {
      const seasonMatch = text.match(/(?:^|[\s([{])Season\s+(\d+)\b/i) ?? text.match(/(?:^|[\s([{])S(\d+)\b/i);
      if (seasonMatch) {
        season = `Season ${seasonMatch[1]}`;
      }
    }

    if (!episode) {
      const episodeMatch =
        text.match(/(?:^|[\s([{])Episode\s+(\d+)\b/i) ?? text.match(/(?:^|[\s([{])E(\d+)\b/i);
      if (episodeMatch) {
        episode = `Episode ${episodeMatch[1]}`;
      }
    }

    if (!episodeTitle && isEpisodeMetadataText(text)) {
      const titlePart = text
        .replace(/^\s*S\d+\s*:\s*E\d+\b[\s:,-]*/i, '')
        .replace(/^\s*Season\s+\d+\s+Episode\s+\d+\b[\s:,-]*/i, '')
        .replace(/^\s*E(?:pisode)?\s*\d+\b[\s:,-]*/i, '');
      episodeTitle = cleanText(stripWrappingQuotes(titlePart));
    }
  }

  return { season, episode, episodeTitle };
}

export function extractNetflixWatchData(): WatchItem | null {
  if (!isNetflixWatchPage()) {
    return null;
  }

  const title = cleanText(extractTitle());
  if (!title) {
    console.debug(`${DEBUG_PREFIX} watch data skipped: no valid series title found`);
    return null;
  }

  const metadataTexts = collectMetadataTexts();
  const { season, episode, episodeTitle } = extractSeasonAndEpisode(metadataTexts);

  return {
    id: createWatchItemId(title),
    title,
    season,
    episode,
    episodeTitle,
    url: window.location.href,
    lastWatchedAt: new Date().toISOString(),
    source: 'netflix',
  };
}

export async function saveWatchItem(item: WatchItem): Promise<void> {
  const items = [...(await getStoredItems())].filter((existingItem) => {
    if (!isValidSeriesTitle(existingItem.title)) {
      return false;
    }

    if (existingItem.url === item.url && existingItem.id !== item.id) {
      return false;
    }

    return true;
  });
  const index = items.findIndex((existingItem) => existingItem.id === item.id);

  if (index >= 0) {
    items[index] = {
      ...items[index],
      season: item.season,
      episode: item.episode,
      episodeTitle: item.episodeTitle,
      url: item.url,
      lastWatchedAt: item.lastWatchedAt,
      source: item.source,
    };
  } else {
    items.push(item);
  }

  items.sort((left, right) => Date.parse(right.lastWatchedAt) - Date.parse(left.lastWatchedAt));
  await setStoredItems(items);
}

function scheduleSave(reason: string): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = window.setTimeout(() => {
    void processWatchState(reason);
  }, SAVE_DEBOUNCE_MS);
}

async function processWatchState(reason: string): Promise<void> {
  if (!isNetflixWatchPage()) {
    return;
  }

  const item = extractNetflixWatchData();
  if (!item?.title) {
    console.debug(`${DEBUG_PREFIX} watch data skipped: missing title`);
    return;
  }

  const signature = [item.id, item.season ?? '', item.episode ?? '', item.episodeTitle ?? '', item.url].join('|');
  const now = Date.now();
  if (signature === lastSavedSignature && now - lastSavedAt < MIN_SAVE_INTERVAL_MS) {
    return;
  }

  await saveWatchItem(item);
  lastSavedSignature = signature;
  lastSavedAt = now;

  console.debug(`${DEBUG_PREFIX} saved watch item`, {
    reason,
    title: item.title,
    season: item.season,
    episode: item.episode,
    episodeTitle: item.episodeTitle,
  });
}

function handleUrlChange(reason: string): void {
  const currentUrl = window.location.href;
  if (currentUrl === lastProcessedUrl) {
    return;
  }

  lastProcessedUrl = currentUrl;
  console.debug(`${DEBUG_PREFIX} url changed`, { reason, url: currentUrl });
  scheduleSave('url-change');
}

function handleStorageChanges(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName,
): void {
  if (areaName !== 'local') {
    return;
  }

  const itemChanges = changes.items;
  if (!itemChanges) {
    return;
  }

  const nextItems = Array.isArray(itemChanges.newValue) ? (itemChanges.newValue as WatchItem[]) : [];
  if (nextItems.length > 0) {
    return;
  }

  lastSavedSignature = '';
  lastSavedAt = 0;

  console.debug(`${DEBUG_PREFIX} storage cleared, resetting save state`);

  if (isNetflixWatchPage()) {
    scheduleSave('storage-cleared');
  }
}

function observeWatchPage(): void {
  const observer = new MutationObserver(() => {
    handleUrlChange('mutation');

    if (isNetflixWatchPage()) {
      scheduleSave('mutation');
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });
}

function patchHistoryEvents(): void {
  const wrapHistoryMethod = (methodName: 'pushState' | 'replaceState'): void => {
    const originalMethod = history[methodName];
    history[methodName] = function (...args) {
      const result = originalMethod.apply(this, args);
      window.dispatchEvent(new Event('anime-netflix-tracker:urlchange'));
      return result;
    };
  };

  wrapHistoryMethod('pushState');
  wrapHistoryMethod('replaceState');

  window.addEventListener('popstate', () => {
    window.dispatchEvent(new Event('anime-netflix-tracker:urlchange'));
  });

  window.addEventListener('anime-netflix-tracker:urlchange', () => {
    handleUrlChange('history');
    if (isNetflixWatchPage()) {
      scheduleSave('history');
    }
  });
}

function init(): void {
  console.debug(`${DEBUG_PREFIX} initialized`);
  patchHistoryEvents();
  observeWatchPage();
  chrome.storage.onChanged.addListener(handleStorageChanges);

  if (isNetflixWatchPage()) {
    scheduleSave('init');
  }
}

init();
