import type { AnimeDomain, MediaItem } from '../types/media';
import { cleanText, getMetaContent } from '../utils/dom';

const ANIME_DOMAINS_KEY = 'animeDomains';
const DEFAULT_ANIME_DOMAINS: AnimeDomain[] = [
  {
    id: 'otakudesu',
    name: 'Otakudesu',
    hostname: 'otakudesu',
    grantedOrigin: null,
    enabled: true,
    createdAt: new Date('2026-05-17T00:00:00.000Z').toISOString(),
  },
];

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeHostname(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\/$/, '');
}

function getStorageArea(): chrome.storage.StorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return null;
  }

  return chrome.storage.local;
}

function normalizeAnimeDomain(value: unknown): AnimeDomain | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AnimeDomain>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim().replace(/\s+/g, ' ') : '';
  const hostname =
    typeof candidate.hostname === 'string' ? normalizeHostname(candidate.hostname) : '';
  if (!name || !hostname) {
    return null;
  }

  return {
    id:
      typeof candidate.id === 'string' && candidate.id.trim().length > 0
        ? candidate.id.trim()
        : normalizeTitle(name) || hostname,
    name,
    hostname,
    grantedOrigin:
      typeof candidate.grantedOrigin === 'string' && candidate.grantedOrigin.trim().length > 0
        ? candidate.grantedOrigin.trim()
        : null,
    enabled: candidate.enabled !== false,
    createdAt:
      typeof candidate.createdAt === 'string' && candidate.createdAt.trim().length > 0
        ? candidate.createdAt
        : new Date().toISOString(),
  };
}

function getAnimeDomains(): Promise<AnimeDomain[]> {
  return new Promise((resolve) => {
    const storageArea = getStorageArea();
    if (!storageArea) {
      resolve(DEFAULT_ANIME_DOMAINS.map((domain) => ({ ...domain })));
      return;
    }

    storageArea.get([ANIME_DOMAINS_KEY], (result) => {
      const rawDomains = Array.isArray(result[ANIME_DOMAINS_KEY])
        ? result[ANIME_DOMAINS_KEY]
        : DEFAULT_ANIME_DOMAINS;
      const domains = rawDomains
        .map((domain) => normalizeAnimeDomain(domain))
        .filter((domain): domain is AnimeDomain => Boolean(domain));
      resolve(domains);
    });
  });
}

function extractTitle(): string | null {
  const selectorCandidates = [
    cleanText(document.querySelector<HTMLElement>('h1.entry-title')?.textContent),
    cleanText(document.querySelector<HTMLElement>('h1')?.textContent),
    cleanText(document.querySelector<HTMLElement>('.entry-title')?.textContent),
  ];

  for (const candidate of selectorCandidates) {
    if (candidate) {
      return candidate;
    }
  }

  return (
    getMetaContent('meta[property="og:title"]') ??
    cleanText(document.title)
  );
}

function extractThumbnail(): string | null {
  return getMetaContent('meta[property="og:image"]');
}

function extractPublishedAt(): string | null {
  const metaCandidate = getMetaContent('meta[property="article:published_time"]');
  if (metaCandidate) {
    const timestamp = Date.parse(metaCandidate);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  const timeCandidate = document.querySelector<HTMLTimeElement>('time[datetime]')?.dateTime;
  if (timeCandidate) {
    const timestamp = Date.parse(timeCandidate);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return null;
}

function extractCanonicalUrl(): string {
  return (
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
    window.location.href
  );
}

function extractVideoSourceUrl(): string | null {
  const directVideoSrc = document.querySelector<HTMLVideoElement>('video')?.currentSrc;
  if (directVideoSrc) {
    return directVideoSrc;
  }

  const videoSourceSrc = document.querySelector<HTMLSourceElement>('video source')?.src;
  if (videoSourceSrc) {
    return videoSourceSrc;
  }

  const iframeSrc = document.querySelector<HTMLIFrameElement>('iframe')?.src;
  if (iframeSrc) {
    return iframeSrc;
  }

  return null;
}

function findMatchingAnimeDomain(
  currentHostname: string,
  domains: AnimeDomain[],
): AnimeDomain | null {
  return (
    domains.find(
      (domain) =>
        domain.enabled &&
        currentHostname.includes(domain.hostname),
    ) ?? null
  );
}

export async function isCustomAnimePage(
  url: URL = new URL(window.location.href),
): Promise<boolean> {
  if (!/^https?:$/i.test(url.protocol)) {
    return false;
  }

  const domains = await getAnimeDomains();
  const normalizedCurrentHostname = normalizeHostname(url.hostname);
  return Boolean(findMatchingAnimeDomain(normalizedCurrentHostname, domains));
}

export async function extractGenericAnimeWatchData(): Promise<MediaItem | null> {
  const currentUrl = new URL(window.location.href);
  if (!/^https?:$/i.test(currentUrl.protocol)) {
    return null;
  }

  const domains = await getAnimeDomains();
  const normalizedCurrentHostname = normalizeHostname(currentUrl.hostname);
  const matchedDomain = findMatchingAnimeDomain(normalizedCurrentHostname, domains);
  if (!matchedDomain) {
    return null;
  }

  const title = extractTitle();
  if (!title) {
    return null;
  }

  const normalizedHost = normalizeTitle(normalizedCurrentHostname);
  const normalizedTitle = normalizeTitle(title);
  const canonicalUrl = extractCanonicalUrl();
  const videoSourceUrl = extractVideoSourceUrl();

  return {
    id: `anime-domain-${normalizedHost}-${normalizedTitle}`,
    platform: 'custom',
    title,
    url: canonicalUrl,
    thumbnail: extractThumbnail(),
    publishedAt: extractPublishedAt(),
    siteName: matchedDomain.name,
    hostname: normalizedCurrentHostname,
    creator: videoSourceUrl,
    lastWatchedAt: new Date().toISOString(),
  };
}
