import {icon} from './icons.js';

// Display windows into the original four-panel image; the source stays intact.
const faces = new Set(['smile', 'cry', 'sweet', 'pout']);
const recordFaces = {sleep: 'sweet', feeding: 'smile', food: 'smile', temperature: 'cry', diaper: 'pout'};

export function babyFace(expression = 'smile', size = 40) {
  const face = faces.has(expression) ? expression : 'smile';
  const pixels = Number.isFinite(size) ? Math.max(16, Math.min(120, size)) : 40;
  return `<span class="baby-face baby-face-${face}" style="--face-size:${pixels}px" aria-hidden="true"></span>`;
}

// Charts keep their small SVG symbols; HTML recording surfaces use faces.
export function recordIcon(name, size = 24) {
  const face = recordFaces[name];
  if (!face) return icon(name, size);
  const pixels = Math.max(28, Math.min(64, Number.isFinite(size) ? size : 28));
  return `<span class="record-face" data-record-icon="${name}" aria-hidden="true">${babyFace(face, pixels)}<span class="record-face-badge">${icon(name, 12)}</span></span>`;
}
