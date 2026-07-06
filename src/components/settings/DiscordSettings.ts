import { createButton, ICONS } from '../../ui/helpers';
import type { DiscordSettings } from '../../types/media';

type DiscordSettingsProps = {
  settings: DiscordSettings;
  onToggle: (enabled: boolean) => void;
  onSave: (webhookUrl: string) => void;
  onTest: () => void;
};

export function createDiscordSettingsSection({
  settings,
  onToggle,
  onSave,
  onTest,
}: DiscordSettingsProps): HTMLElement {
  const section = document.createElement('article');
  section.className = 'channel-item';
  section.style.display = 'flex';
  section.style.flexDirection = 'column';
  section.style.alignItems = 'stretch';
  section.style.justifyContent = 'flex-start';

  const header = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'channel-item-name';
  title.textContent = 'Discord Webhook Notifications';
  header.append(title);

  const enabledToggle = document.createElement('label');
  enabledToggle.className = 'domain-permission-toggle';
  enabledToggle.style.margin = '16px 0';
  const enabledCheckbox = document.createElement('input');
  enabledCheckbox.type = 'checkbox';
  enabledCheckbox.checked = settings.enabled;
  enabledCheckbox.addEventListener('change', () => {
    onToggle(enabledCheckbox.checked);
  });
  const enabledText = document.createElement('span');
  enabledText.textContent = 'Enable Discord Webhook Notifications';
  enabledToggle.append(enabledCheckbox, enabledText);

  const container = document.createElement('div');
  container.className = 'telegram-settings-container';
  container.style.marginTop = '0';
  container.style.flex = '1';
  container.style.width = '100%';

  const urlGroup = document.createElement('div');
  urlGroup.style.display = 'flex';
  urlGroup.style.flexDirection = 'column';
  urlGroup.style.gap = '6px';

  const urlLabel = document.createElement('label');
  urlLabel.className = 'domain-label';
  urlLabel.textContent = 'Webhook URL';
  const urlInputWrapper = document.createElement('div');
  urlInputWrapper.style.position = 'relative';
  urlInputWrapper.style.display = 'flex';
  urlInputWrapper.style.alignItems = 'center';

  const urlInput = document.createElement('input');
  urlInput.type = 'password';
  urlInput.className = 'domain-input';
  urlInput.value = settings.webhookUrl;
  urlInput.placeholder = 'https://discord.com/api/webhooks/...';
  urlInput.style.paddingRight = '40px';

  const toggleVisibilityBtn = document.createElement('button');
  toggleVisibilityBtn.type = 'button';
  toggleVisibilityBtn.className = 'password-toggle-btn';
  toggleVisibilityBtn.innerHTML = ICONS.eye;
  toggleVisibilityBtn.title = 'Show Webhook URL';
  toggleVisibilityBtn.style.position = 'absolute';
  toggleVisibilityBtn.style.right = '8px';
  toggleVisibilityBtn.style.background = 'none';
  toggleVisibilityBtn.style.border = 'none';
  toggleVisibilityBtn.style.cursor = 'pointer';
  toggleVisibilityBtn.style.padding = '4px';
  toggleVisibilityBtn.style.color = '#a1a1aa';
  toggleVisibilityBtn.style.display = 'flex';
  toggleVisibilityBtn.style.alignItems = 'center';
  toggleVisibilityBtn.style.justifyContent = 'center';

  let isPasswordVisible = false;
  toggleVisibilityBtn.addEventListener('click', () => {
    isPasswordVisible = !isPasswordVisible;
    urlInput.type = isPasswordVisible ? 'text' : 'password';
    toggleVisibilityBtn.innerHTML = isPasswordVisible ? ICONS.eyeOff : ICONS.eye;
    toggleVisibilityBtn.title = isPasswordVisible ? 'Hide Webhook URL' : 'Show Webhook URL';
  });

  urlInputWrapper.append(urlInput, toggleVisibilityBtn);
  const helperText = document.createElement('p');
  helperText.className = 'channel-item-meta';
  helperText.style.marginTop = '4px';
  helperText.innerHTML = 'Buat Webhook pada Discord Server Settings &gt; Integrations &gt; Webhooks.';

  urlGroup.append(urlLabel, urlInputWrapper, helperText);

  const actions = document.createElement('div');
  actions.className = 'domain-form-actions';
  actions.style.marginTop = 'auto';

  const saveBtn = createButton('Save Settings', () => {
    onSave(urlInput.value.trim());
  }, 'primary');

  const testBtn = createButton('Test Notification', () => {
    const tempUrl = urlInput.value.trim();
    if (!tempUrl) return;

    if (tempUrl !== settings.webhookUrl) {
      onSave(tempUrl);
    }

    testBtn.textContent = 'Testing...';
    testBtn.disabled = true;

    onTest();

    setTimeout(() => {
      testBtn.textContent = 'Test Notification';
      testBtn.disabled = false;
    }, 1500);
  });

  urlInput.addEventListener('input', () => {
    testBtn.disabled = !urlInput.value.trim();
  });
  testBtn.disabled = !settings.webhookUrl && !urlInput.value.trim();

  actions.append(saveBtn, testBtn);
  container.append(urlGroup, actions);
  section.append(header, enabledToggle, container);



  return section;
}
