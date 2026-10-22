/**
 * iconos.js — Íconos de línea propios (SVG en texto), para no depender de una
 * librería ni de internet. Heredan el color del texto con currentColor.
 */
const TRAZOS = {
  inicio: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  movimientos: '<path d="M9 7h11M9 12h11M9 17h11"/><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" stroke-width="2.4"/>',
  analisis: '<path d="M5 20v-7M10 20V5M15 20v-10M20 20v-4"/>',
  metas: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01" stroke-width="2.6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  ojoCerrado: '<path d="M3 3l18 18M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3.1-.4 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  izquierda: '<path d="M15 5l-7 7 7 7"/>',
  derecha: '<path d="M9 5l7 7-7 7"/>',
  borrar: '<path d="M9 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>',
  calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  subir: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  bajar: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  puntos: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="2.6"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  repetir: '<path d="M17 2.5 20 5.5l-3 3"/><path d="M4 11.5V10a4.5 4.5 0 0 1 4.5-4.5H20"/><path d="M7 21.5 4 18.5l3-3"/><path d="M20 12.5V14a4.5 4.5 0 0 1-4.5 4.5H4"/>',

  /* Categorías de gasto */
  comida: '<path d="M6 3v5.5a3 3 0 0 0 6 0V3M9 3v18"/><path d="M18 21V3c-2.2 1.2-3.5 3.8-3.5 7.5V14H18"/>',
  super: '<path d="M3 4h2.2l2.3 10.6a1.2 1.2 0 0 0 1.2.9h8.6a1.2 1.2 0 0 0 1.2-.9L20.2 8H6.1"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  transporte: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18v3M16 18v3"/><path d="M8.5 14.5h.01M15.5 14.5h.01" stroke-width="2.4"/>',
  casa: '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
  servicios: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  salud: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/><path d="M7.5 11.5h2.3l1.2-2 2 4 1.2-2h2.3"/>',
  ropa: '<path d="M9 3.5 4 6.5l1.8 4L8 9.6V20.5h8V9.6l2.2.9 1.8-4-5-3a3 3 0 0 1-6 0z"/>',
  salidas: '<path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z"/><path d="M14.5 6.5v11" stroke-dasharray="1.6 2.2"/>',
  suscripciones: '<rect x="3" y="4.5" width="18" height="13" rx="2.5"/><path d="M10.2 8.6v4.8l4.1-2.4z"/><path d="M8.5 21h7"/>',
  escuela: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.6v4.6c3 2.4 8 2.4 11 0v-4.6M21.5 9.5v5"/>',
  regalo: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5"/><path d="M12 8C10.6 5 7 4.6 7 6.6 7 8 9.8 8 12 8zm0 0c1.4-3 5-3.4 5-1.4C17 8 14.2 8 12 8z"/>',
  otros: '<rect x="4.5" y="4.5" width="6" height="6" rx="1.5"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.5"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.5"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.5"/>',

  /* Categorías de ingreso */
  sueldo: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V7M3 12.5h18"/>',
  extra: '<path d="M13.5 3 5.5 13.5h6L10.5 21l8-10.5h-6z"/>',
  ventas: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z"/><path d="M8 8h.01" stroke-width="2.6"/>',
  reembolso: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  banco: '<path d="M3 9.5 12 4.5l9 5M5.5 10v8M10 10v8M14 10v8M18.5 10v8M3.5 20.5h17"/>',

  /* Metas */
  laptop: '<rect x="4.5" y="4.5" width="15" height="10.5" rx="1.5"/><path d="M2.5 19h19"/>',
  celular: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.5 18.5h3"/>',
  viaje: '<path d="M21 3 3 10.5l7.2 2.7L13 21z"/><path d="M21 3 10.2 13.2"/>',
  auto: '<path d="M3 15l1.9-5.6A2 2 0 0 1 6.8 8h10.4a2 2 0 0 1 1.9 1.4L21 15v3.5H3z"/><path d="M3 15h18M6 18.5v2M18 18.5v2"/><path d="M7 16.8h.01M17 16.8h.01" stroke-width="2.4"/>',
  juego: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><path d="M15.5 11.5h.01M17.5 13.5h.01" stroke-width="2.4"/>',
  audifonos: '<path d="M4 15.5V12a8 8 0 0 1 16 0v3.5"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.8"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.8"/>',
  tenis: '<path d="M3 17.5V8l5 1 2.2 3 6.6 1.8A4.6 4.6 0 0 1 21 18.3v.2H3z"/><path d="M3 21h18M12 12.3l-1.2 1.6M14.6 13l-1.2 1.6"/>',
  joya: '<path d="M7 4.5h10l3.5 4.5L12 20 3.5 9z"/><path d="M3.5 9h17M9.5 4.5 8.5 9 12 20l3.5-11-1-4.5"/>',
  emergencia: '<path d="M12 3 5 6v5.2c0 4.4 3 8.3 7 9.8 4-1.5 7-5.4 7-9.8V6z"/><path d="M12 9v6M9 12h6"/>',
};

export function icono(nombre, tam = 22) {
  return `<svg class="ico" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAZOS[nombre] ?? ''}</svg>`;
}
