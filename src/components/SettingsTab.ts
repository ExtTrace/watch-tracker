import type { SettingsViewValue } from '../state';

type SettingsTabProps = {
  currentView: SettingsViewValue;
  onTabClick: (view: SettingsViewValue) => void;
};

export function createSettingsTabNavigation({
  currentView,
  onTabClick,
}: SettingsTabProps): HTMLElement {
  const settingsTabs = document.createElement('div');
  settingsTabs.className = 'filter-row';
  settingsTabs.style.marginBottom = '16px';

  const createTab = (label: string, view: SettingsViewValue) => {
    const btn = document.createElement('button');
    btn.className = `filter-chip ${currentView === view ? 'is-active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      onTabClick(view);
    });
    return btn;
  };

  settingsTabs.append(
    createTab('Data', 'data'),
    createTab('Telegram', 'telegram'),
    createTab('YouTube', 'youtube'),
    createTab('Custom', 'custom'),
  );

  return settingsTabs;
}
