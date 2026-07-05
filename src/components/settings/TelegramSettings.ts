import { createButton, ICONS } from '../../ui/helpers';
import type { TelegramSettings } from '../../types/media';

type TelegramSettingsProps = {
  settings: TelegramSettings;
  onToggle: (enabled: boolean) => void;
  onSave: (botToken: string, chatId: string) => void;
  onTest: () => void;
};

export function createTelegramSettingsSection({
  settings,
  onToggle,
  onSave,
  onTest,
}: TelegramSettingsProps): HTMLElement {
  const section = document.createElement('section');
  section.className = 'channels-panel';

  const header = document.createElement('div');
  header.className = 'channels-panel-header';
  const title = document.createElement('h2');
  title.className = 'channels-panel-title';
  title.textContent = 'Telegram Notifications';
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
  enabledText.textContent = 'Enable New Episode Notifications';
  enabledToggle.append(enabledCheckbox, enabledText);

  const container = document.createElement('div');
  container.className = 'telegram-settings-container';
  container.style.borderTop = '1px solid rgba(255, 255, 255, 0.07)';
  container.style.paddingTop = '16px';
  container.style.marginTop = '0';

  const tokenGroup = document.createElement('div');
  tokenGroup.style.display = 'flex';
  tokenGroup.style.flexDirection = 'column';
  tokenGroup.style.gap = '6px';

  const tokenLabel = document.createElement('label');
  tokenLabel.className = 'domain-label';
  tokenLabel.textContent = 'Bot Token';
  const tokenInputWrapper = document.createElement('div');
  tokenInputWrapper.style.position = 'relative';
  tokenInputWrapper.style.display = 'flex';
  tokenInputWrapper.style.alignItems = 'center';

  const tokenInput = document.createElement('input');
  tokenInput.className = 'domain-input';
  tokenInput.type = 'password';
  tokenInput.placeholder = 'e.g. 123456789:ABCDefghIJKlmnOPQRstuvWXYZ';
  tokenInput.style.paddingRight = '40px';
  tokenInput.value = settings.botToken;

  const tokenToggleBtn = document.createElement('button');
  tokenToggleBtn.type = 'button';
  tokenToggleBtn.innerHTML = ICONS.eye;
  tokenToggleBtn.style.position = 'absolute';
  tokenToggleBtn.style.right = '10px';
  tokenToggleBtn.style.background = 'transparent';
  tokenToggleBtn.style.border = 'none';
  tokenToggleBtn.style.color = 'var(--muted)';
  tokenToggleBtn.style.cursor = 'pointer';
  tokenToggleBtn.style.display = 'flex';
  tokenToggleBtn.addEventListener('click', () => {
    if (tokenInput.type === 'password') {
      tokenInput.type = 'text';
      tokenToggleBtn.innerHTML = ICONS.eyeOff;
    } else {
      tokenInput.type = 'password';
      tokenToggleBtn.innerHTML = ICONS.eye;
    }
  });

  tokenInputWrapper.append(tokenInput, tokenToggleBtn);
  tokenGroup.append(tokenLabel, tokenInputWrapper);

  const chatGroup = document.createElement('div');
  chatGroup.style.display = 'flex';
  chatGroup.style.flexDirection = 'column';
  chatGroup.style.gap = '6px';

  const chatLabel = document.createElement('label');
  chatLabel.className = 'domain-label';
  chatLabel.textContent = 'Chat ID';
  const chatInputWrapper = document.createElement('div');
  chatInputWrapper.style.position = 'relative';
  chatInputWrapper.style.display = 'flex';
  chatInputWrapper.style.alignItems = 'center';

  const chatInput = document.createElement('input');
  chatInput.className = 'domain-input';
  chatInput.type = 'password';
  chatInput.placeholder = 'e.g. 123456789 or @channelname';
  chatInput.style.paddingRight = '40px';
  chatInput.value = settings.chatId;

  const chatToggleBtn = document.createElement('button');
  chatToggleBtn.type = 'button';
  chatToggleBtn.innerHTML = ICONS.eye;
  chatToggleBtn.style.position = 'absolute';
  chatToggleBtn.style.right = '10px';
  chatToggleBtn.style.background = 'transparent';
  chatToggleBtn.style.border = 'none';
  chatToggleBtn.style.color = 'var(--muted)';
  chatToggleBtn.style.cursor = 'pointer';
  chatToggleBtn.style.display = 'flex';
  chatToggleBtn.addEventListener('click', () => {
    if (chatInput.type === 'password') {
      chatInput.type = 'text';
      chatToggleBtn.innerHTML = ICONS.eyeOff;
    } else {
      chatInput.type = 'password';
      chatToggleBtn.innerHTML = ICONS.eye;
    }
  });

  chatInputWrapper.append(chatInput, chatToggleBtn);
  chatGroup.append(chatLabel, chatInputWrapper);

  const actions = document.createElement('div');
  actions.className = 'domain-form-actions';

  const saveBtn = createButton('Save Settings', () => {
    onSave(tokenInput.value.trim(), chatInput.value.trim());
  }, 'primary');

  const testBtn = createButton('Test Notification', onTest);

  actions.append(saveBtn, testBtn);

  container.append(tokenGroup, chatGroup, actions);
  section.append(header, enabledToggle, container);

  return section;
}
