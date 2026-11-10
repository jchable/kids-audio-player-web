/* Écrans sans livre à montrer : une image pour l'enfant, une courte phrase pour l'adulte. */

const SLEEPING_BEAR = `<svg viewBox="0 0 200 160" aria-hidden="true">
  <rect y="130" width="200" height="22" rx="4" fill="#B5763A"/>
  <g transform="translate(100 88) scale(2)">
    <circle cx="-13" cy="-14" r="8" fill="#8A5630"/><circle cx="13" cy="-14" r="8" fill="#8A5630"/>
    <circle r="20" fill="#9C6137"/><ellipse cy="6" rx="10" ry="8" fill="#E9C9A0"/>
    <path d="M-11-4q4 3 8 0M3-4q4 3 8 0" stroke="#2A1A10" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <ellipse cy="2.5" rx="3.4" ry="2.4" fill="#2A1A10"/>
  </g>
</svg>`;

const CLOUD = `<svg viewBox="0 0 200 160" aria-hidden="true">
  <path d="M58 118a30 30 0 0 1-3-60 42 42 0 0 1 81-8 34 34 0 0 1 6 68Z" fill="#fff"/>
  <path d="M84 62l34 40M118 62l-34 40" stroke="#E8483F" stroke-width="12" stroke-linecap="round"/>
</svg>`;

function renderState(root, picture, message) {
  root.innerHTML = `<div class="state">${picture}<p>${message}</p></div>`;
}

export function renderEmptyLibrary(root) {
  renderState(root, SLEEPING_BEAR, 'Aucun livre pour le moment.');
}

export function renderLoadFailure(root) {
  renderState(root, CLOUD, 'Connectez le téléphone au réseau de la maison.');
}
