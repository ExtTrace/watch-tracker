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
}: DataSettingsProps): HTMLElement {
  const section = document.createElement('section');
  section.className = 'channels-panel';

  const header = document.createElement('div');
  header.className = 'channels-panel-header';
  const title = document.createElement('h2');
  title.className = 'channels-panel-title';
  title.textContent = 'Data Management';
  header.append(title);

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.style.marginTop = '12px';
  toolbar.append(
    createButton('Import JSON', onImportClick),
    createButton('Export JSON', onExportClick),
    createButton('Clear History', onClearHistoryClick, 'primary'),
  );

  section.append(header, toolbar);

  return section;
}
