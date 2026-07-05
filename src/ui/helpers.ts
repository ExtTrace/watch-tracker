export const ICONS = {
  play: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
  archive: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`,
  unarchive: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="12" y1="12" x2="12" y2="16"></line><polyline points="10 14 12 12 14 14"></polyline></svg>`,
  delete: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
  edit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
  eye: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
  eyeOff: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
};

export function createButton(
  text: string,
  onClick: () => void,
  variant: 'primary' | 'secondary' = 'secondary',
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button button-${variant}`;
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

export function createIconButton(
  iconSvg: string,
  onClick: () => void,
  variant: 'primary' | 'secondary' | 'danger' = 'secondary',
  text?: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-button icon-button-${variant}`;
  button.innerHTML = text ? `${iconSvg}<span>${text}</span>` : iconSvg;
  if (!text) {
    button.classList.add('icon-only');
  }
  button.addEventListener('click', onClick);
  return button;
}

export function createListRowBase(
  nameText: string,
  metaText: string,
  isEnabled: boolean,
  onToggle: () => void,
  onEdit: () => void,
  onDelete: () => void
): HTMLElement {
  const item = document.createElement('article');
  item.className = 'channel-item';

  const info = document.createElement('div');
  info.className = 'channel-item-info';

  const name = document.createElement('p');
  name.className = 'channel-item-name';
  name.textContent = nameText;

  const meta = document.createElement('p');
  meta.className = 'channel-item-meta';
  meta.textContent = metaText;

  info.append(name, meta);

  const actions = document.createElement('div');
  actions.className = 'channel-item-actions';
  actions.append(
    createButton(isEnabled ? 'Disable' : 'Enable', onToggle),
    createIconButton(ICONS.edit, onEdit, 'secondary'),
    createIconButton(ICONS.delete, onDelete, 'danger'),
  );

  item.append(info, actions);
  return item;
}
