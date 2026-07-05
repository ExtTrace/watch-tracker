import { createButton, createListRowBase } from '../../ui/helpers';
import type { AnimeDomain } from '../../types/media';
import { describeUnknownError, stringifyForLog, normalizeCurrentDomainInput } from '../../utils/formatters';
import type { AnimeDomainDraft } from '../../state';

const DEBUG_PREFIX = '[Anime Watch Tracker]';

type CustomDomainSettingsProps = {
  domains: AnimeDomain[];
  draft: AnimeDomainDraft;
  isModalOpen: boolean;
  requestPermission: boolean;
  isStandaloneDomainsView: boolean;
  onOpenModal: (domain?: AnimeDomain) => void;
  onCloseModal: () => void;
  onUpdateDraft: (updates: Partial<AnimeDomainDraft>) => void;
  onToggleRequestPermission: (request: boolean) => void;
  onSaveDomain: () => Promise<void>;
  onToggleDomain: (domain: AnimeDomain) => Promise<void>;
  onDeleteDomain: (id: string) => Promise<void>;
};

export function createAnimeDomainsSection({
  domains,
  draft,
  isModalOpen,
  requestPermission,
  isStandaloneDomainsView,
  onOpenModal,
  onCloseModal,
  onUpdateDraft,
  onToggleRequestPermission,
  onSaveDomain,
  onToggleDomain,
  onDeleteDomain,
}: CustomDomainSettingsProps): HTMLElement {
  const section = document.createElement('section');
  section.className = 'channels-panel';

  const header = document.createElement('div');
  header.className = 'channels-panel-header';

  const titleGroup = document.createElement('div');
  const title = document.createElement('h2');
  title.className = 'channels-panel-title';
  title.textContent = 'Anime Domains';

  titleGroup.append(title);
  header.append(
    titleGroup,
    createButton('Add Domain', () => {
      onOpenModal();
    }),
  );

  const list = document.createElement('div');
  list.className = 'channel-list';

  if (domains.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'channel-list-empty';
    empty.textContent =
      'Belum ada domain anime. Tambahkan satu domain untuk mulai tracking situs custom.';
    list.append(empty);
  } else {
    for (const domain of domains) {
      list.append(
        createAnimeDomainRow(
          domain,
          () => onToggleDomain(domain),
          () => onOpenModal(domain),
          () => onDeleteDomain(domain.id)
        )
      );
    }
  }

  section.append(header, list);

  if (isModalOpen) {
    section.append(
      createAnimeDomainModal({
        draft,
        requestPermission,
        isStandaloneDomainsView,
        onUpdateDraft,
        onToggleRequestPermission,
        onSaveDomain,
        onCloseModal,
      })
    );
  }

  return section;
}

function createAnimeDomainRow(
  domain: AnimeDomain,
  onToggle: () => void,
  onEdit: () => void,
  onDelete: () => void
): HTMLElement {
  const metaText = [
    domain.hostname,
    domain.grantedOrigin
      ? normalizeCurrentDomainInput(domain.grantedOrigin)
      : 'Permission belum diberikan',
    domain.enabled ? 'Enabled' : 'Disabled',
  ]
    .filter(Boolean)
    .join(' - ');

  return createListRowBase(
    domain.name,
    metaText,
    domain.enabled,
    onToggle,
    onEdit,
    onDelete
  );
}

function createAnimeDomainModal({
  draft,
  requestPermission,
  isStandaloneDomainsView,
  onUpdateDraft,
  onToggleRequestPermission,
  onSaveDomain,
  onCloseModal,
}: {
  draft: AnimeDomainDraft;
  requestPermission: boolean;
  isStandaloneDomainsView: boolean;
  onUpdateDraft: (updates: Partial<AnimeDomainDraft>) => void;
  onToggleRequestPermission: (request: boolean) => void;
  onSaveDomain: () => Promise<void>;
  onCloseModal: () => void;
}): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'domain-modal-overlay';

  const dialog = document.createElement('section');
  dialog.className = 'domain-modal';

  const title = document.createElement('h3');
  title.className = 'domain-form-title';
  title.textContent = draft.id ? 'Edit Anime Domain' : 'Add Anime Domain';

  const copy = document.createElement('p');
  copy.className = 'channels-panel-copy';
  copy.textContent = isStandaloneDomainsView
    ? 'Klik Save Domain untuk meminta permission dan menyimpan domain.'
    : 'Klik Continue in Tab agar permission request dilakukan dari tab penuh, bukan popup.';

  const nameLabel = document.createElement('label');
  nameLabel.className = 'domain-label';
  nameLabel.textContent = 'Domain name';

  const nameInput = document.createElement('input');
  nameInput.className = 'domain-input';
  nameInput.type = 'text';
  nameInput.placeholder = 'Name, e.g. Otakudesu';
  nameInput.value = draft.name;
  nameInput.addEventListener('input', () => {
    onUpdateDraft({ name: nameInput.value });
  });

  const currentDomainLabel = document.createElement('label');
  currentDomainLabel.className = 'domain-label';
  currentDomainLabel.textContent = 'Current domain';

  const currentDomainInput = document.createElement('input');
  currentDomainInput.className = 'domain-input';
  currentDomainInput.type = 'text';
  currentDomainInput.placeholder = 'Current domain, e.g. otakudesu.blog';
  currentDomainInput.value = draft.currentDomain;
  currentDomainInput.addEventListener('input', () => {
    onUpdateDraft({ currentDomain: currentDomainInput.value });
  });

  const hostnameLabel = document.createElement('label');
  hostnameLabel.className = 'domain-label';
  hostnameLabel.textContent = 'Match keyword';

  const hostnameInput = document.createElement('input');
  hostnameInput.className = 'domain-input';
  hostnameInput.type = 'text';
  hostnameInput.placeholder = 'Match keyword, e.g. otakudesu';
  hostnameInput.value = draft.hostname;
  hostnameInput.addEventListener('input', () => {
    onUpdateDraft({ hostname: hostnameInput.value });
  });

  const permissionToggle = document.createElement('label');
  permissionToggle.className = 'domain-permission-toggle';

  const permissionCheckbox = document.createElement('input');
  permissionCheckbox.type = 'checkbox';
  permissionCheckbox.checked = requestPermission;
  permissionCheckbox.addEventListener('change', () => {
    onToggleRequestPermission(permissionCheckbox.checked);
  });

  const permissionText = document.createElement('span');
  permissionText.textContent = isStandaloneDomainsView
    ? 'Minta permission domain sekarang'
    : 'Minta permission sekarang. Popup mungkin tertutup saat dialog Chrome muncul.';

  permissionToggle.append(permissionCheckbox, permissionText);

  const actions = document.createElement('div');
  actions.className = 'domain-form-actions';
  
  // Note: we let the parent component handle the logic of whether it's standalone or not,
  // by passing the appropriate onSaveDomain callback.
  actions.append(
    createButton(
      isStandaloneDomainsView ? 'Save Domain' : 'Continue in Tab',
      () => {
        onSaveDomain().catch((error: unknown) => {
          const message = describeUnknownError(error) || 'Failed to save anime domain.';
          console.warn(
            `${DEBUG_PREFIX} anime domain save failed ${stringifyForLog({
              draft,
              errorMessage: message,
              rawError: describeUnknownError(error),
            })}`
          );
          window.alert(message);
        });
      },
      'primary'
    ),
    createButton('Cancel', () => {
      onCloseModal();
    })
  );

  dialog.append(
    title,
    copy,
    nameLabel,
    nameInput,
    currentDomainLabel,
    currentDomainInput,
    hostnameLabel,
    hostnameInput,
    permissionToggle,
    actions
  );
  overlay.append(dialog);
  return overlay;
}
