/* ==========================================================================
   icons.js — conjunto único de ícones SVG (traço, 24x24) usado em toda a
   interface no lugar de emojis. icon('nome', tamanho?) devolve o <svg> como
   string, pronto para innerHTML. Herdam a cor do texto (currentColor).
   ========================================================================== */
const ICON_PATHS = {
  'home': '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>',
  'calendar': '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
  'book-open': '<path d="M12 6.5C10.5 5.2 8 4.5 4 4.5v13c4 0 6.5.7 8 2 1.5-1.3 4-2 8-2v-13c-4 0-6.5.7-8 2zM12 6.5v13"/>',
  'repeat': '<path d="M4 11V9a3 3 0 0 1 3-3h11l-3-3M20 13v2a3 3 0 0 1-3 3H6l3 3"/>',
  'help-circle': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01"/>',
  'clipboard': '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
  'layers': '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 12.5 9 5 9-5"/>',
  'pen': '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M14 7l3 3"/>',
  'newspaper': '<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h3v10a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h4"/>',
  'globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  'landmark': '<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
  'file-text': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  'network': '<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2v4.3M12 11.5 6 17M12 11.5 18 17"/>',
  'library': '<path d="M5 4v16M10 4v16M15 5.5l4 14.5M3 20h18"/>',
  'sticky-note': '<path d="M5 4h14v10l-6 6H5z"/><path d="M13 20v-6h6"/>',
  'type': '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
  'settings': '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  'search': '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  'moon': '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  'more': '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'check': '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'trash': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  'refresh': '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
  'sparkle': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7L19 22l-.7-1.6-2-.7 2-.7z"/>',
  'flag': '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  'play': '<path d="M7 4.5v15l12-7.5z"/>',
  'pause': '<path d="M8 5v14M16 5v14"/>',
  'stop': '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  'x': '<path d="M6 6l12 12M18 6 6 18"/>',
  'alert': '<path d="M12 4 2.5 20h19z"/><path d="M12 10v5M12 18h.01"/>',
  'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  'bar-chart': '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  'target': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  'link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  'star': '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  'download': '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  'upload': '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  'filter': '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
  'bookmark': '<path d="M6 4h12v16l-6-4-6 4z"/>',
  'history': '<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4M12 8v4l3 2"/>',
  'flame': '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
  'trending': '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  'cloud': '<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 8.5 4 4 0 0 1 17.5 18z"/>',
  'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  'copy': '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  'highlight': '<path d="m4 20 4-1 10-10-3-3L5 16z"/><path d="M13 8l3 3M3 22h6"/>',
  'message': '<path d="M4 5h16v11H9l-5 4z"/>',
  'calendar-check': '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 3v3M16 3v3m-8.5 9 2.5 2.5 4.5-4.5"/>',
  'columns': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>'
};
function icon(nome, size) {
  const p = ICON_PATHS[nome] || ICON_PATHS['info'];
  const s = size || 18;
  return `<svg class="ic ic-${nome}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
}

/* Converte um emoji de DADOS antigos (ex.: tipo de documento salvo como "📄") no ícone SVG equivalente. */
const EMOJI_ICONE = { '📄': 'file-text', '📝': 'pen', '📚': 'library', '🗂️': 'layers', '🗂': 'layers', '🧠': 'network', '📜': 'file-text', '📰': 'newspaper', '🌐': 'link', '🌍': 'globe', '📅': 'calendar', '⏰': 'clock', '⏱️': 'clock', '⏱': 'clock', '🎯': 'target', '🔥': 'flame', '🧩': 'layers', '✅': 'check', '📈': 'trending', '⭐': 'star', '❌': 'x', '🔄': 'refresh', '🔁': 'repeat', '🏛️': 'landmark', '🏛': 'landmark', '👥': 'user', '💰': 'trending', '✏️': 'pen', '🗑️': 'trash', '⚠️': 'alert', '⚠': 'alert', '📇': 'layers', '🕳️': 'layers', '⚖️': 'columns', '✍️': 'pen', '🖼️': 'file-text', '🆕': 'sparkle', '🌱': 'sparkle', '🌳': 'sparkle', '❓': 'help-circle', '🔀': 'repeat' };
function ico(emoji, size) { return icon(EMOJI_ICONE[emoji] || 'file-text', size || 16); }
function docTipoIcone(tipo) { return ico(tipo || '📄', 20); }
