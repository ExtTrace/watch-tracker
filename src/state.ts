import type { Platform } from './types/media';

export type FilterValue = 'all' | Platform;
export type ViewValue = 'history' | 'archives' | 'settings';
export type SettingsViewValue = 'data' | 'telegram' | 'youtube' | 'custom';

export type YouTubeChannelDraft = {
  id: string | null;
  createdAt?: string;
  name: string;
  handle: string;
};

export type AnimeDomainDraft = {
  id: string | null;
  createdAt?: string;
  name: string;
  currentDomain: string;
  hostname: string;
};

const currentUrl = new URL(window.location.href);
const initialViewParam = currentUrl.searchParams.get('view');
export const isStandaloneDomainsView = currentUrl.searchParams.get('standalone') === '1';

export const state = {
  filter: 'all' as FilterValue,
  view: initialViewParam === 'settings' ? 'settings' : ('history' as ViewValue),
  settingsView: 'data' as SettingsViewValue,
  youtubeChannelModalOpen: false,
  youtubeChannelDraft: {
    id: null,
    name: '',
    handle: '',
  } as YouTubeChannelDraft,
  animeDomainModalOpen: isStandaloneDomainsView,
  animeDomainRequestPermission: true,
  animeDomainDraft: {
    id: currentUrl.searchParams.get('domainId'),
    createdAt: currentUrl.searchParams.get('createdAt') ?? undefined,
    name: currentUrl.searchParams.get('name') ?? '',
    currentDomain: currentUrl.searchParams.get('currentDomain') ?? '',
    hostname: currentUrl.searchParams.get('hostname') ?? '',
  } as AnimeDomainDraft,
};

type Listener = () => void;
const listeners: Listener[] = [];

export function subscribe(listener: Listener): void {
  listeners.push(listener);
}

export function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}
