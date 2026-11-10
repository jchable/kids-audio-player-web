/* Bouton de téléchargement d'un livre, sans texte. */
import { iconHtml } from '../dom.js';

const LONG_PRESS_MS = 1500;
const ICON_BY_STATUS = {
  none: 'download', failed: 'retry', update: 'retry', downloaded: 'check',
};

function askRemovalConfirmation(onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm';
  overlay.innerHTML = `<div class="confirm-box">
      <button class="round confirm-back" data-target aria-label="Retour">${iconHtml('back')}</button>
      <button class="round confirm-delete" data-target aria-label="Supprimer">${iconHtml('trash')}</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.confirm-back').addEventListener('click', close);
  overlay.querySelector('.confirm-delete').addEventListener('click', () => { close(); onConfirm(); });
}

function installLongPress(button, action) {
  let timer = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  button.addEventListener('pointerdown', () => { timer = setTimeout(action, LONG_PRESS_MS); });
  button.addEventListener('pointerup', cancel);
  button.addEventListener('pointerleave', cancel);
  button.addEventListener('pointercancel', cancel);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

export function renderDownloadButton(root, {
  status, progress, onDownload, onRemove,
}) {
  if (status === 'downloading') {
    const degrees = Math.round(progress * 360);
    root.innerHTML = `<div class="download downloading" data-status="downloading" data-target
      style="--progress:${degrees}deg"><span></span></div>`;
    return;
  }

  root.innerHTML = `<button class="round download" data-status="${status}" data-target
    aria-label="Téléchargement">${iconHtml(ICON_BY_STATUS[status])}</button>`;
  const button = root.querySelector('button');
  if (status === 'downloaded') installLongPress(button, () => askRemovalConfirmation(onRemove));
  else button.addEventListener('click', onDownload);
}
