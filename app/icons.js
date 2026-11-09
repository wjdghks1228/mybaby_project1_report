const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',
  record: '<path d="M12 5v14M5 12h14"/>',
  stats: '<path d="M4 20h16M7 16V9m5 7V4m5 12v-5"/>',
  settings: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  feeding: '<path d="m10 3 4 0v3l2 2v2l3 3a3 3 0 0 1 0 4l-3 3a3 3 0 0 1-4 0l-5-5a3 3 0 0 1 0-4l2-2V6h1zM9 9l7 7m-5-3-2 2m5-1-2 2"/>',
  food: '<path d="M3 11h18a9 9 0 0 1-18 0ZM7 21h10M18 3l-5 8M5 4v3m4-4v4"/>',
  diaper: '<path d="M3 7h18v5a9 9 0 0 1-18 0zM3 10h4l2 3h6l2-3h4M5 16l3-2m11 2-3-2"/>',
  sleep: '<path d="M20.5 14a8.5 8.5 0 0 1-10.5-10.5A8.5 8.5 0 1 0 20.5 14Z"/><path d="M16 3v4m-2-2h4"/>',
  temperature: '<path d="M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0ZM12 8v9"/><circle cx="12" cy="18" r="1"/>',
  growth: '<path d="M12 21V10M12 14C4 15 3 8 3 6c7-1 10 3 9 8ZM12 10c0-6 4-8 9-8 1 6-3 10-9 8"/>',
  activity: '<path d="M20.5 4.5a5 5 0 0 0-7 0L12 6l-1.5-1.5a5 5 0 0 0-7 7L12 20l8.5-8.5a5 5 0 0 0 0-7Z"/>',
  guide: '<path d="M12 5C8 2 4 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-2-10 1Zm0 0v16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  hospital: '<path d="M9 3h6v5h5v6h-5v7H9v-7H4V8h5z"/>',
  note: '<path d="M6 3h10l4 4v14H4V3zM15 3v5h5M8 12h8M8 16h5"/>',
  backup: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  shield: '<path d="m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6z"/><path d="m8 12 3 3 5-6"/>',
};

export function icon(name, size = 24) {
  return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] ?? paths.activity}</svg>`;
}
