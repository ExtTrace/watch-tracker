import { createButton, ICONS } from '../../ui/helpers';
import type { TelegramSettings } from '../../types/media';

type TelegramSettingsProps = {
  settings: TelegramSettings;
  onToggle: (enabled: boolean) => void;
  onSave: (chatId: string, botUsername: string) => void;
  onTest: () => void;
};

export function createTelegramSettingsSection({
  settings,
  onToggle,
  onSave,
  onTest,
}: TelegramSettingsProps): HTMLElement {
  const section = document.createElement('article');
  section.className = 'channel-item';
  section.style.display = 'flex';
  section.style.flexDirection = 'column';
  section.style.alignItems = 'stretch';
  section.style.justifyContent = 'flex-start';

  const header = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'channel-item-name';
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
  container.style.marginTop = '0';
  container.style.flex = '1';
  container.style.width = '100%';

  const usernameGroup = document.createElement('div');
  usernameGroup.style.display = 'flex';
  usernameGroup.style.flexDirection = 'column';
  usernameGroup.style.gap = '6px';

  const usernameLabel = document.createElement('label');
  usernameLabel.className = 'domain-label';
  usernameLabel.textContent = 'Bot Username';
  const usernameInputWrapper = document.createElement('div');
  usernameInputWrapper.style.position = 'relative';
  usernameInputWrapper.style.display = 'flex';
  usernameInputWrapper.style.alignItems = 'center';

  const usernameInput = document.createElement('input');
  usernameInput.className = 'domain-input';
  usernameInput.type = 'text';
  usernameInput.style.paddingRight = '40px';
  usernameInput.value = '@ext_tracker_bot';
  usernameInput.disabled = true;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.innerHTML = ICONS.copy;
  copyBtn.style.position = 'absolute';
  copyBtn.style.right = '10px';
  copyBtn.style.background = 'transparent';
  copyBtn.style.border = 'none';
  copyBtn.style.color = 'var(--muted)';
  copyBtn.style.cursor = 'pointer';
  copyBtn.style.display = 'flex';
  copyBtn.title = 'Copy Username';

  copyBtn.addEventListener('click', () => {
    const val = usernameInput.value.trim();
    if (val) {
      navigator.clipboard.writeText(val).then(() => {
        copyBtn.style.color = 'var(--primary)';
        setTimeout(() => { copyBtn.style.color = 'var(--muted)'; }, 1000);
      });
    }
  });

  usernameInputWrapper.append(usernameInput, copyBtn);
  usernameGroup.append(usernameLabel, usernameInputWrapper);

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

  const helperText = document.createElement('p');
  helperText.className = 'channel-item-meta';
  helperText.style.marginTop = '4px';
  helperText.innerHTML = 'Kirim pesan <b>/start</b> ke bot Telegram kita untuk mendapatkan Chat ID Anda.';

  chatGroup.append(chatLabel, chatInputWrapper, helperText);

  const actions = document.createElement('div');
  actions.className = 'domain-form-actions';
  actions.style.marginTop = 'auto';

  const saveBtn = createButton('Save Settings', () => {
    onSave(chatInput.value.trim(), usernameInput.value.trim());
  }, 'primary');

  const testBtn = createButton('Test Notification', onTest);

  actions.append(saveBtn, testBtn);

  container.append(usernameGroup, chatGroup, actions);
  section.append(header, enabledToggle, container);

  return section;
}
