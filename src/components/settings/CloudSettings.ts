import type { CloudSettings } from '../../types/media';
import { createButton } from '../../ui/helpers';

type CloudSettingsProps = {
  settings: CloudSettings;
  isModalOpen: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
  onSave: (settings: CloudSettings) => void;
};

export function createCloudSettingsSection({
  settings,
  isModalOpen,
  onOpenModal,
  onCloseModal,
  onSave,
}: CloudSettingsProps): HTMLElement {
  const wrapper = document.createElement('div');

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
  desc.textContent = 'Secara otomatis mensinkronkan progress tontonan Anda ke cloud antar perangkat.';

  const actions = document.createElement('div');
  actions.className = 'channel-item-actions';
  actions.style.justifyContent = 'flex-start';
  actions.style.alignItems = 'center';
  actions.style.gap = '16px';

  const enabledToggle = document.createElement('label');
  enabledToggle.className = 'domain-permission-toggle';
  enabledToggle.style.margin = '0';

  const enabledCheckbox = document.createElement('input');
  enabledCheckbox.type = 'checkbox';
  enabledCheckbox.checked = settings.enabled;
  enabledCheckbox.addEventListener('change', () => {
    onSave({ ...settings, enabled: enabledCheckbox.checked });
  });

  const enabledText = document.createElement('span');
  enabledText.textContent = 'Enable Sync';

  enabledToggle.append(enabledCheckbox, enabledText);

  const linkBtn = createButton('Link Device', () => {
    onOpenModal();
  });

  actions.append(enabledToggle, linkBtn);
  card.append(title, desc, actions);
  wrapper.append(card);

  if (isModalOpen) {
    wrapper.append(
      createLinkDeviceModal({
        currentSyncId: settings.syncId || '',
        onCloseModal,
        onLink: (newId) => {
          onSave({ ...settings, syncId: newId });
          onCloseModal();
        },
      })
    );
  }

  return wrapper;
}

function createLinkDeviceModal({
  currentSyncId,
  onCloseModal,
  onLink,
}: {
  currentSyncId: string;
  onCloseModal: () => void;
  onLink: (newId: string) => void;
}): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'domain-modal-overlay';

  const dialog = document.createElement('section');
  dialog.className = 'domain-modal';

  const title = document.createElement('h3');
  title.className = 'domain-form-title';
  title.textContent = 'Link Device';

  const copy = document.createElement('p');
  copy.className = 'channels-panel-copy';
  copy.textContent =
    'Untuk menyinkronkan antar perangkat, copy Sync ID dari perangkat lain dan paste di sini. Atau copy Sync ID Anda untuk digunakan di perangkat lain.';

  const yourIdLabel = document.createElement('label');
  yourIdLabel.className = 'domain-label';
  yourIdLabel.textContent = 'Sync ID Anda';

  const yourIdRow = document.createElement('div');
  yourIdRow.style.display = 'flex';
  yourIdRow.style.gap = '8px';

  const yourIdInput = document.createElement('input');
  yourIdInput.className = 'domain-input';
  yourIdInput.type = 'text';
  yourIdInput.value = currentSyncId;
  yourIdInput.readOnly = true;
  yourIdInput.style.flex = '1';
  yourIdInput.style.cursor = 'default';
  yourIdInput.style.opacity = '0.7';

  const copyBtn = createButton('Copy', () => {
    void navigator.clipboard.writeText(currentSyncId);
    const orig = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = orig; }, 2000);
  });

  yourIdRow.append(yourIdInput, copyBtn);

  const linkIdLabel = document.createElement('label');
  linkIdLabel.className = 'domain-label';
  linkIdLabel.textContent = 'Sync ID Perangkat Lain (opsional)';

  const linkIdInput = document.createElement('input');
  linkIdInput.className = 'domain-input';
  linkIdInput.type = 'text';
  linkIdInput.placeholder = 'awt-sync-xxxxxxxx-xxxx-xxxx-...';

  const formActions = document.createElement('div');
  formActions.className = 'domain-form-actions';
  formActions.append(
    createButton(
      'Link & Sync',
      () => {
        const newId = linkIdInput.value.trim();
        if (!newId) {
          window.alert('Masukkan Sync ID terlebih dahulu.');
          return;
        }
        if (newId === currentSyncId) {
          window.alert('Sync ID yang dimasukkan sama dengan Sync ID Anda saat ini.');
          return;
        }
        onLink(newId);
      },
      'primary',
    ),
    createButton('Cancel', () => {
      onCloseModal();
    }),
  );

  dialog.append(
    title,
    copy,
    yourIdLabel,
    yourIdRow,
    linkIdLabel,
    linkIdInput,
    formActions,
  );
  overlay.append(dialog);
  return overlay;
}
