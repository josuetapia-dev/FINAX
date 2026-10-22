/**
 * graficas.js — Gráficas hechas a mano en SVG (sin librerías).
 *
 * Cada función devuelve texto SVG/HTML. Los colores salen de variables CSS
 * (--serie-*), así el modo claro y el oscuro cambian sin tocar este archivo.
 * Cada barra lleva un área táctil invisible con data-tip: al tocarla, app.js
 * muestra el detalle (en el iPhone no existe el "hover").
 */
import { compacto, dinero, DIAS_CORTOS, DIAS_LARGOS, fechaCorta } from './formato.js';

const ANCHO = 340;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Barra con esquinas de arriba redondeadas (4px) y base recta. */
function barra(x, y, ancho, alto, r = 4) {
  if (alto <= 0) return '';
  r = Math.min(r, alto, ancho / 2);
  return `M${x},${y + alto}V${y + r}Q${x},${y} ${x + r},${y}H${x + ancho - r}Q${x + ancho},${y} ${x + ancho},${y + r}V${y + alto}Z`;
}

/** Tope "bonito" del eje: 850 → 1,000; 2,300 → 2,500. */
function tope(max) {
  if (max <= 0) return 10000;
  const escala = 10 ** Math.floor(Math.log10(max));
  const n = max / escala;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * escala;
}

function marco(alto, etiqueta, contenido) {
  return `<svg class="grafica" viewBox="0 0 ${ANCHO} ${alto}" role="img" aria-label="${esc(etiqueta)}">${contenido}</svg>`;
}

/** Líneas de referencia: base y tope con su valor. */
function guias(arriba, h, max) {
  return `<line class="guia" x1="0" x2="${ANCHO}" y1="${arriba}" y2="${arriba}"/>
    <text class="eje" x="${ANCHO}" y="${arriba - 5}" text-anchor="end">${compacto(max)}</text>
    <line class="base" x1="0" x2="${ANCHO}" y1="${arriba + h}" y2="${arriba + h}"/>`;
}

/**
 * Gastos por día: semana pasada (gris) junto a esta semana (cobalto).
 * hoy = índice del día actual; los días que aún no llegan no dibujan barra.
 */
export function barrasSemana({ actual, anterior, hoy = 6, alto = 150, nombres = ['Esta semana', 'Semana pasada'] }) {
  const arriba = 18;
  const abajo = 22;
  const h = alto - arriba - abajo;
  const max = tope(Math.max(...actual, ...anterior));
  const banda = ANCHO / 7;
  const grosor = Math.min(14, (banda - 16) / 2);
  let marcas = '';
  let zonas = '';
  let ejes = '';
  for (let i = 0; i < 7; i++) {
    const centro = banda * i + banda / 2;
    const ha = (anterior[i] / max) * h;
    const hc = (actual[i] / max) * h;
    // 2px de separación entre las dos barras del mismo día.
    marcas += `<path class="m-anterior" d="${barra(centro - 1 - grosor, arriba + h - ha, grosor, ha)}"/>`;
    if (i <= hoy) marcas += `<path class="m-actual" d="${barra(centro + 1, arriba + h - hc, grosor, hc)}"/>`;
    ejes += `<text class="eje${i === hoy ? ' eje-fuerte' : ''}" x="${centro}" y="${alto - 5}" text-anchor="middle">${DIAS_CORTOS[i]}</text>`;
    const tip = [DIAS_LARGOS[i], `${nombres[0]}|${i <= hoy ? dinero(actual[i]) : '—'}`, `${nombres[1]}|${dinero(anterior[i])}`].join('\n');
    zonas += `<rect class="zona" x="${banda * i}" y="0" width="${banda}" height="${alto}" data-tip="${esc(tip)}"/>`;
  }
  return marco(alto, 'Gastos por día: esta semana contra la pasada', guias(arriba, h, max) + marcas + ejes + zonas);
}

/** Ingresos (verde) y gastos (cobalto) de las últimas semanas. */
export function tendencia(semanas, alto = 170) {
  const arriba = 18;
  const abajo = 22;
  const h = alto - arriba - abajo;
  const max = tope(Math.max(...semanas.flatMap((s) => [s.ingresos, s.gastos])));
  const banda = ANCHO / semanas.length;
  const grosor = Math.min(12, (banda - 12) / 2);
  let marcas = '';
  let zonas = '';
  let ejes = '';
  semanas.forEach((s, i) => {
    const centro = banda * i + banda / 2;
    const hi = (s.ingresos / max) * h;
    const hg = (s.gastos / max) * h;
    const ultima = i === semanas.length - 1;
    marcas += `<path class="m-ingreso" d="${barra(centro - 1 - grosor, arriba + h - hi, grosor, hi)}"/>`;
    marcas += `<path class="m-gasto" d="${barra(centro + 1, arriba + h - hg, grosor, hg)}"/>`;
    ejes += `<text class="eje${ultima ? ' eje-fuerte' : ''}" x="${centro}" y="${alto - 5}" text-anchor="middle">${ultima ? 'Esta' : fechaCorta(s.lunes)}</text>`;
    const tip = [`Semana del ${fechaCorta(s.lunes)}`, `Ingresos|${dinero(s.ingresos)}`, `Gastos|${dinero(s.gastos)}`, `Balance|${dinero(s.ingresos - s.gastos, { signo: true })}`].join('\n');
    zonas += `<rect class="zona" x="${banda * i}" y="0" width="${banda}" height="${alto}" data-tip="${esc(tip)}"/>`;
  });
  return marco(alto, 'Ingresos y gastos por semana', guias(arriba, h, max) + marcas + ejes + zonas);
}

/** Anillo de progreso de una meta (dorado = ahorro). */
export function anillo(progreso, tam = 64, grosor = 6) {
  const r = (tam - grosor) / 2;
  const largo = 2 * Math.PI * r;
  const lleno = Math.max(0, Math.min(1, progreso)) * largo;
  return `<svg class="anillo" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}" aria-hidden="true">
    <circle class="anillo-pista" cx="${tam / 2}" cy="${tam / 2}" r="${r}" stroke-width="${grosor}" fill="none"/>
    ${lleno > 0 ? `<circle class="anillo-lleno" cx="${tam / 2}" cy="${tam / 2}" r="${r}" stroke-width="${grosor}" fill="none"
      stroke-dasharray="${lleno} ${largo}" stroke-linecap="round" transform="rotate(-90 ${tam / 2} ${tam / 2})"/>` : ''}
  </svg>`;
}

/** Leyenda: siempre visible cuando hay dos series, para no depender solo del color. */
export function leyenda(series) {
  return `<ul class="leyenda">${series.map((s) => `<li><span class="muestra ${s.clase}"></span>${s.texto}</li>`).join('')}</ul>`;
}
