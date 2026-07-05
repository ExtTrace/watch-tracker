import type { AllowedYouTubeChannel, MediaItem } from '../types/media';
import { formatDurationFromSeconds, normalizeIsoDateString } from '../utils/date';
import { getFirstText, getMetaContent, cleanText, getStructuredDataEntries } from '../utils/dom';
import {
  createYouTubeItemId,
  createYouTubeSeriesKey,
  parseYouTubeTitleParts,
} from '../utils/id';
import { YOUTUBE_URL, YOUTUBE_IMG_URL } from '../config/env';
import {
  normalizeChannelHandle,
  normalizeChannelName,
  getYouTubeChannels,
} from '../utils/storage';

const TITLE_SELECTORS = ['h1.ytd-watch-metadata', 'h1.title'];
const CHANNEL_SELECTORS = ['ytd-channel-name a', '#channel-name a'];


export function isYouTubeWatchPage(
  url: URL = new URL(window.location.href),
): boolean {
  const isSupportedHost =
    url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com';

  return isSupportedHost && url.pathname === '/watch';
}

function matchesAllowedYouTubeChannel(
  channelName: string,
  channelHandle: string | null,
  allowedChannels: AllowedYouTubeChannel[],
): boolean {
  const normalizedChannelName = normalizeChannelName(channelName);
  const normalizedChannelHandle = channelHandle
    ? normalizeChannelHandle(channelHandle)
    : null;

  return allowedChannels.some((channel) => {
    if (!channel.enabled) {
      return false;
    }

    if (normalizeChannelName(channel.name) === normalizedChannelName) {
      return true;
    }

    return Boolean(
      normalizedChannelHandle &&
      channel.handle &&
      normalizeChannelHandle(channel.handle) === normalizedChannelHandle,
    );
  });
}



function getYouTubeVideoId(
  url: URL = new URL(window.location.href),
): string | null {
  const videoId = cleanText(url.searchParams.get('v'));
  return videoId;
}

function extractYouTubeTitle(): string | null {
  const selectorTitle = getFirstText(TITLE_SELECTORS);
  if (selectorTitle) {
    return selectorTitle;
  }

  const metaTitle = getMetaContent('meta[property="og:title"]');
  if (metaTitle) {
    return metaTitle;
  }

  const documentTitle = cleanText(document.title)
    ?.replace(/\s*-\s*YouTube\s*$/i, '')
    .trim();
  return cleanText(documentTitle);
}

function extractYouTubeChannel(): string | null {
  const selectorChannel = getFirstText(CHANNEL_SELECTORS);
  if (selectorChannel) {
    return selectorChannel;
  }

  return getMetaContent('meta[name="author"]');
}

function extractYouTubeChannelHandle(): string | null {
  const links = document.querySelectorAll<HTMLAnchorElement>(
    CHANNEL_SELECTORS.join(','),
  );

  for (const link of links) {
    const linkText = cleanText(link.textContent);
    if (linkText?.startsWith('@')) {
      return linkText;
    }

    const href = cleanText(link.getAttribute('href'));
    const handleMatch = href?.match(/\/(@[^/?#]+)/);
    if (handleMatch) {
      return handleMatch[1];
    }
  }

  return null;
}

function extractYouTubeDuration(): string | null {
  const video = document.querySelector<HTMLVideoElement>('video');
  if (!video) {
    return null;
  }

  return formatDurationFromSeconds(video.duration);
}

function extractPublishedAtFromPlayerResponse(
  playerResponse: unknown,
): string | null {
  if (!playerResponse || typeof playerResponse !== 'object') {
    return null;
  }

  const microformat = (
    playerResponse as {
      microformat?: {
        playerMicroformatRenderer?: {
          publishDate?: string;
          uploadDate?: string;
        };
      };
    }
  ).microformat?.playerMicroformatRenderer;

  return (
    normalizeIsoDateString(microformat?.publishDate) ??
    normalizeIsoDateString(microformat?.uploadDate)
  );
}

function extractPublishedAtFromWindowState(): string | null {
  const scopedWindow = window as Window & {
    ytInitialPlayerResponse?: unknown;
  };

  return extractPublishedAtFromPlayerResponse(
    scopedWindow.ytInitialPlayerResponse,
  );
}

function extractPublishedAtFromInlineScripts(): string | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script');

  for (const script of scripts) {
    const content = cleanText(script.textContent);
    if (!content || !content.includes('ytInitialPlayerResponse')) {
      continue;
    }

    const publishDateMatch = content.match(/"publishDate":"([^"]+)"/);
    if (publishDateMatch) {
      const normalized = normalizeIsoDateString(publishDateMatch[1]);
      if (normalized) {
        return normalized;
      }
    }

    const uploadDateMatch = content.match(/"uploadDate":"([^"]+)"/);
    if (uploadDateMatch) {
      const normalized = normalizeIsoDateString(uploadDateMatch[1]);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function extractYouTubePublishedAt(): string | null {
  const metaCandidates = [
    document.querySelector<HTMLMetaElement>('meta[itemprop="datePublished"]')
      ?.content,
    document.querySelector<HTMLMetaElement>(
      'meta[property="video:release_date"]',
    )?.content,
    document.querySelector<HTMLMetaElement>('meta[name="date"]')?.content,
  ];

  for (const candidate of metaCandidates) {
    const normalized = normalizeIsoDateString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  const playerResponsePublishedAt = extractPublishedAtFromWindowState();
  if (playerResponsePublishedAt) {
    return playerResponsePublishedAt;
  }

  const entries = getStructuredDataEntries();

  for (const entry of entries) {
    const publishedAt = normalizeIsoDateString(
      typeof entry.datePublished === 'string' ? entry.datePublished : null,
    );
    if (publishedAt) {
      return publishedAt;
    }
  }

  const inlineScriptPublishedAt = extractPublishedAtFromInlineScripts();
  if (inlineScriptPublishedAt) {
    return inlineScriptPublishedAt;
  }

  return null;
}

export async function extractYouTubeWatchData(): Promise<MediaItem | null> {
  if (!isYouTubeWatchPage()) {
    return null;
  }

  const videoId = getYouTubeVideoId();
  const rawTitle = extractYouTubeTitle();
  const channel = extractYouTubeChannel();
  const channelHandle = extractYouTubeChannelHandle();
  const allowedChannels = await getYouTubeChannels();

  if (
    !videoId ||
    !rawTitle ||
    !channel ||
    !matchesAllowedYouTubeChannel(channel, channelHandle, allowedChannels)
  ) {
    return null;
  }

  const parsedTitle = parseYouTubeTitleParts(rawTitle);

  const canonicalUrl = `${YOUTUBE_URL}/watch?v=${videoId}`;

  return {
    id: createYouTubeItemId(videoId),
    platform: 'youtube',
    title: parsedTitle.title,
    seriesKey: createYouTubeSeriesKey(parsedTitle.title),
    channel,
    creator: channel,
    episode: parsedTitle.episode,
    duration: extractYouTubeDuration(),
    thumbnail: `${YOUTUBE_IMG_URL}/vi/${videoId}/hqdefault.jpg`,
    publishedAt: extractYouTubePublishedAt(),
    url: canonicalUrl,
    lastWatchedAt: new Date().toISOString(),
  };
}
