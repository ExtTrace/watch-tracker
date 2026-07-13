import type { CloudSettings } from '../../types/media';

type CloudSettingsProps = {
  settings: CloudSettings;
  onToggle: (enabled: boolean) => void;
};

export function createCloudSettingsSection({ settings, onToggle }: CloudSettingsProps): HTMLElement {
  const card = document.createElement('article');
  card.className = 'channel-item';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = '12px';

  const title = document.createElement('h3');
  title.className = 'channel-item-name';
  title.textContent = 'Cloud Sync (Beta)';
  
  const desc = document.createElement('p');
  desc.className = 'channel-item-meta';
  desc.textContent = 'Automatically sync your watch history to the cloud so you can access it across all your devices.';

  const actions = document.createElement('div');
  actions.className = 'channel-item-actions';
  actions.style.justifyContent = 'flex-start';
  actions.style.alignItems = 'center';
  
  const enabledToggle = document.createElement('label');
  enabledToggle.className = 'domain-permission-toggle';
  enabledToggle.style.margin = '0';
  
  const enabledCheckbox = document.createElement('input');
  enabledCheckbox.type = 'checkbox';
  enabledCheckbox.checked = settings.enabled;
  enabledCheckbox.addEventListener('change', () => {
    onToggle(enabledCheckbox.checked);
  });

  const enabledText = document.createElement('span');
  enabledText.textContent = 'Enable Cloud Sync';
  
  enabledToggle.append(enabledCheckbox, enabledText);
  actions.append(enabledToggle);

  card.append(title, desc, actions);
  return card;
}
