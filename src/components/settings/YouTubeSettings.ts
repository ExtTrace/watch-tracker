import { createButton, createListRowBase } from '../../ui/helpers';
import type { AllowedYouTubeChannel } from '../../types/media';
import { describeUnknownError, stringifyForLog } from '../../utils/formatters';
import type { YouTubeChannelDraft } from '../../state';

const DEBUG_PREFIX = '[Anime Watch Tracker]';

type YouTubeSettingsProps = {
  channels: AllowedYouTubeChannel[];
  draft: YouTubeChannelDraft;
  isModalOpen: boolean;
  onOpenModal: (channel?: AllowedYouTubeChannel) => void;
  onCloseModal: () => void;
  onUpdateDraft: (updates: Partial<YouTubeChannelDraft>) => void;
  onSaveChannel: () => Promise<void>;
  onToggleChannel: (channel: AllowedYouTubeChannel) => Promise<void>;
  onDeleteChannel: (id: string) => Promise<void>;
};

export function createYouTubeChannelsSection({
  channels,
  draft,
  isModalOpen,
  onOpenModal,
  onCloseModal,
  onUpdateDraft,
  onSaveChannel,
  onToggleChannel,
  onDeleteChannel,
}: YouTubeSettingsProps): HTMLElement {
  const section = document.createElement('section');
  section.className = 'channels-panel';

  const header = document.createElement('div');
  header.className = 'channels-panel-header';

  const titleGroup = document.createElement('div');
  const title = document.createElement('h2');
  title.className = 'channels-panel-title';
  title.textContent = 'YouTube Channels';

  titleGroup.append(title);
  header.append(
    titleGroup,
    createButton('Add Channel', () => {
      onOpenModal();
    }),
  );

  const list = document.createElement('div');
  list.className = 'channel-list';

  if (channels.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'channel-list-empty';
    empty.textContent =
      'Belum ada channel. Tambahkan satu channel untuk mulai tracking YouTube.';
    list.append(empty);
  } else {
    for (const channel of channels) {
      list.append(
        createYouTubeChannelRow(
          channel,
          () => onToggleChannel(channel),
          () => onOpenModal(channel),
          () => onDeleteChannel(channel.id)
        )
      );
    }
  }

  section.append(header, list);

  if (isModalOpen) {
    section.append(
      createYouTubeChannelModal({
        draft,
        onUpdateDraft,
        onSaveChannel,
        onCloseModal,
      })
    );
  }

  return section;
}

function createYouTubeChannelRow(
  channel: AllowedYouTubeChannel,
  onToggle: () => void,
  onEdit: () => void,
  onDelete: () => void
): HTMLElement {
  const metaText = [channel.handle, channel.enabled ? 'Enabled' : 'Disabled']
    .filter(Boolean)
    .join(' - ');

  return createListRowBase(
    channel.name,
    metaText,
    channel.enabled,
    onToggle,
    onEdit,
    onDelete
  );
}

function createYouTubeChannelModal({
  draft,
  onUpdateDraft,
  onSaveChannel,
  onCloseModal,
}: {
  draft: YouTubeChannelDraft;
  onUpdateDraft: (updates: Partial<YouTubeChannelDraft>) => void;
  onSaveChannel: () => Promise<void>;
  onCloseModal: () => void;
}): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'domain-modal-overlay';

  const dialog = document.createElement('section');
  dialog.className = 'domain-modal';

  const title = document.createElement('h3');
  title.className = 'domain-form-title';
  title.textContent = draft.id
    ? 'Edit YouTube Channel'
    : 'Add YouTube Channel';

  const copy = document.createElement('p');
  copy.className = 'channels-panel-copy';
  copy.textContent =
    'Hanya channel enabled yang akan dipakai untuk tracking video YouTube.';

  const nameLabel = document.createElement('label');
  nameLabel.className = 'domain-label';
  nameLabel.textContent = 'Channel name';

  const nameInput = document.createElement('input');
  nameInput.className = 'domain-input';
  nameInput.type = 'text';
  nameInput.placeholder = 'Channel name, e.g. Muse Indonesia';
  nameInput.value = draft.name;
  nameInput.addEventListener('input', () => {
    onUpdateDraft({ name: nameInput.value });
  });

  const handleLabel = document.createElement('label');
  handleLabel.className = 'domain-label';
  handleLabel.textContent = 'Channel handle';

  const handleInput = document.createElement('input');
  handleInput.className = 'domain-input';
  handleInput.type = 'text';
  handleInput.placeholder = 'Optional handle, e.g. @MuseIndonesia';
  handleInput.value = draft.handle;
  handleInput.addEventListener('input', () => {
    onUpdateDraft({ handle: handleInput.value });
  });

  const actions = document.createElement('div');
  actions.className = 'domain-form-actions';
  actions.append(
    createButton(
      'Save Channel',
      () => {
        onSaveChannel().catch((error: unknown) => {
          const message =
            describeUnknownError(error) || 'Failed to save YouTube channel.';
          console.warn(
            `${DEBUG_PREFIX} youtube channel save failed ${stringifyForLog({
              draft,
              errorMessage: message,
              rawError: describeUnknownError(error),
            })}`,
          );
          window.alert(message);
        });
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
    nameLabel,
    nameInput,
    handleLabel,
    handleInput,
    actions,
  );
  overlay.append(dialog);
  return overlay;
}
