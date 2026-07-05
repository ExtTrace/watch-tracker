import { createButton } from '../../ui/helpers';

type DataSettingsProps = {
  onImportClick: () => void;
  onExportClick: () => void;
  onClearHistoryClick: () => void;
};

export function createDataManagementSection({
  onImportClick,
  onExportClick,
  onClearHistoryClick,
}: DataSettingsProps): DocumentFragment {
  const fragment = document.createDocumentFragment();

  // Backup & Restore Card
  const backupCard = document.createElement('article');
  backupCard.className = 'channel-item';
  backupCard.style.display = 'flex';
  backupCard.style.flexDirection = 'column';
  backupCard.style.gap = '12px';

  const backupTitle = document.createElement('h3');
  backupTitle.className = 'channel-item-name';
  backupTitle.textContent = 'Backup & Restore';
  
  const backupDesc = document.createElement('p');
  backupDesc.className = 'channel-item-meta';
  backupDesc.textContent = 'Aman dan simpan progress tontonan Anda, atau pulihkan dari file JSON.';

  const backupActions = document.createElement('div');
  backupActions.className = 'channel-item-actions';
  backupActions.style.justifyContent = 'flex-start';
  backupActions.append(
    createButton('Export JSON', onExportClick, 'primary'),
    createButton('Import JSON', onImportClick)
  );

  backupCard.append(backupTitle, backupDesc, backupActions);

  // Danger Zone Card
  const dangerCard = document.createElement('article');
  dangerCard.className = 'channel-item';
  dangerCard.style.display = 'flex';
  dangerCard.style.flexDirection = 'column';
  dangerCard.style.gap = '12px';

  const dangerTitle = document.createElement('h3');
  dangerTitle.className = 'channel-item-name';
  dangerTitle.textContent = 'Danger Zone';
  
  const dangerDesc = document.createElement('p');
  dangerDesc.className = 'channel-item-meta';
  dangerDesc.textContent = 'Hapus seluruh progress tontonan dari ekstensi ini secara permanen.';

  const dangerActions = document.createElement('div');
  dangerActions.className = 'channel-item-actions';
  dangerActions.style.justifyContent = 'flex-start';
  dangerActions.append(
    createButton('Clear History', () => {
      if (window.confirm('Yakin ingin menghapus seluruh history secara permanen?')) {
        onClearHistoryClick();
      }
    }, 'primary')
  );

  dangerCard.append(dangerTitle, dangerDesc, dangerActions);

  fragment.append(backupCard, dangerCard);

  return fragment;
}
