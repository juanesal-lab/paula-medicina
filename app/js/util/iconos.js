// Íconos SVG en línea, de trazo fino (24x24). Contenido estático, sin datos externos.

const TRAZOS = {
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.4"/>',
  ocultar: '<path d="M3 3l18 18"/><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a14 14 0 0 1-3.2 3.9M6.6 7.6A14 14 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.4 0 2.7-.3 3.8-.8"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>',
  aislar: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21"/>',
  transparente: '<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>',
  deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  restaurar: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4.5v4h4"/>',
  preguntar: '<path d="M4 5.5h16v10.5H10.5L6 20v-4H4z"/><path d="M8.5 10.7h7"/>',
  enfocar: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  sistemas: '<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12l8.5 4.5 8.5-4.5"/><path d="M3.5 16l8.5 4.5 8.5-4.5"/>',
  panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M9.5 4.5v15"/>',
  copiar: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5v-3a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
  corte: '<path d="M3 12h18"/><path d="M6 8l-3 4 3 4M18 8l3 4-3 4"/>',
  invertir: '<path d="M7 4v14M3.5 14.5L7 18l3.5-3.5M17 20V6M13.5 9.5L17 6l3.5 3.5"/>',
  arbol: '<path d="M4 5.5h5M4 12h5M4 18.5h5"/><path d="M9 5.5h11M9 12h8M9 18.5h11"/><path d="M6.5 5.5V18.5"/>',
  flecha: '<path d="M9 6l6 6-6 6"/>',
  ojo: '<path d="M2.5 12C4 8.8 7.5 6 12 6s8 2.8 9.5 6c-1.5 3.2-5 6-9.5 6s-8-2.8-9.5-6z"/><circle cx="12" cy="12" r="2.8"/>',
  separar: '<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2"/>',
  ficha: '<path d="M7 3.5h8l3.5 3.5v13.5H7z"/><path d="M15 3.5V7h3.5M9.5 12h6M9.5 15.5h6"/>',
  girar: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"/><path d="M19.5 4.5v4h-4"/>',
  mover: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  libro: '<path d="M4 5.5C6.5 4.5 9.5 4.7 12 6.5c2.5-1.8 5.5-2 8-1v13c-2.5-1-5.5-.8-8 1-2.5-1.8-5.5-2-8-1z"/><path d="M12 6.5v13"/>',
};

export function icono(nombre, tam = 18) {
  const span = document.createElement('span');
  span.className = 'icono';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">${TRAZOS[nombre] || ''}</svg>`;
  return span;
}
