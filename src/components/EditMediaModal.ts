import type { MediaItem } from '../types/media';
import { createButton } from '../ui/helpers';

type EditMediaModalProps = {
  item: MediaItem;
  onCloseModal: () => void;
  onSave: (updatedItem: MediaItem) => Promise<void>;
};

export function createEditMediaModal({
  item,
  onCloseModal,
  onSave,
}: EditMediaModalProps): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'domain-modal-overlay';

  const dialog = document.createElement('section');
  dialog.className = 'domain-modal';
  dialog.style.maxWidth = '400px';

  const title = document.createElement('h3');
  title.className = 'domain-form-title';
  title.textContent = 'Edit Watch Item';

  // Title Input
  const titleLabel = document.createElement('label');
  titleLabel.className = 'domain-label';
  titleLabel.textContent = 'Judul Anime / Konten';

  const titleInput = document.createElement('input');
  titleInput.className = 'domain-input';
  titleInput.type = 'text';
  titleInput.value = item.title || '';

  // Episode Input
  const episodeLabel = document.createElement('label');
  episodeLabel.className = 'domain-label';
  episodeLabel.textContent = 'Episode';

  const episodeInput = document.createElement('input');
  episodeInput.className = 'domain-input';
  episodeInput.type = 'text';
  episodeInput.placeholder = 'e.g. Episode 5 atau 5';
  episodeInput.value = item.episode || '';

  // Season Input
  const seasonLabel = document.createElement('label');
  seasonLabel.className = 'domain-label';
  seasonLabel.textContent = 'Season (Opsional)';

  const seasonInput = document.createElement('input');
  seasonInput.className = 'domain-input';
  seasonInput.type = 'text';
  seasonInput.placeholder = 'e.g. Season 1';
  seasonInput.value = item.season || '';

  // URL Input
  const urlLabel = document.createElement('label');
  urlLabel.className = 'domain-label';
  urlLabel.textContent = 'URL Stream / Link Nonton';

  const urlInput = document.createElement('input');
  urlInput.className = 'domain-input';
  urlInput.type = 'text';
  urlInput.value = item.url || '';

  const formActions = document.createElement('div');
  formActions.className = 'domain-form-actions';
  formActions.append(
    createButton(
      'Simpan',
      () => {
        const newTitle = titleInput.value.trim();
        if (!newTitle) {
          window.alert('Judul tidak boleh kosong.');
          return;
        }

        const updatedItem: MediaItem = {
          ...item,
          title: newTitle,
          episode: episodeInput.value.trim() || null,
          season: seasonInput.value.trim() || null,
          url: urlInput.value.trim() || item.url,
        };

        onSave(updatedItem)
          .then(() => {
            onCloseModal();
          })
          .catch((err: unknown) => {
            console.error('Failed to save edited item:', err);
            window.alert('Gagal menyimpan perubahan.');
          });
      },
      'primary',
    ),
    createButton('Batal', () => {
      onCloseModal();
    }),
  );

  dialog.append(
    title,
    titleLabel,
    titleInput,
    episodeLabel,
    episodeInput,
    seasonLabel,
    seasonInput,
    urlLabel,
    urlInput,
    formActions,
  );
  overlay.append(dialog);

  return overlay;
}
