/**
 * formato.js — Dinero y fechas en español de México.
 *
 * Todo el dinero se guarda en CENTAVOS (enteros) para evitar errores de
 * redondeo de JavaScript (0.1 + 0.2 !== 0.3). Aquí se convierte a texto.
 * Las fechas se manejan como texto 'AAAA-MM-DD' en hora local, así un gasto
 * de las 11 pm no "se mueve" de día por la zona horaria.
 */

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const monedaEntera = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

// Modo "ocultar montos" (para usar la app en público). Lo activa app.js.
let ocultar = false;
export const setOcultar = (valor) => { ocultar = valor; };

export function dinero(centavos, { entero = false, signo = false } = {}) {
  if (ocultar) return '$ ••••';
  const texto = (entero ? monedaEntera : moneda).format(Math.abs(centavos) / 100);
  if (signo) return (centavos < 0 ? '−' : '+') + texto;
  return centavos < 0 ? '−' + texto : texto;
}

/** Separa "$12,345" y ".67" para dibujar los centavos más pequeños. */
export function dineroPartes(centavos) {
  if (ocultar) return { entero: '$ ••••', decimales: '' };
  const texto = dinero(centavos);
  const i = texto.lastIndexOf('.');
  return { entero: texto.slice(0, i), decimales: texto.slice(i) };
}

/** Versión corta para ejes de gráficas: $850, $1.2k. */
export function compacto(centavos) {
  if (ocultar) return '•';
  const v = centavos / 100;
  if (v >= 1000) return '$' + (v / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 }) + 'k';
  return '$' + Math.round(v).toLocaleString('es-MX');
}

/** Texto que escribe el teclado ('1234.5') → '$1,234.5' mientras se teclea. */
export function montoTecleado(texto) {
  const [ent, dec] = texto.split('.');
  return '$' + Number(ent).toLocaleString('es-MX') + (dec !== undefined ? '.' + dec : '');
}

export const aCentavos = (texto) => Math.round(parseFloat(texto || '0') * 100);

/* ---------- Fechas ---------- */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function aISO(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function deISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export const hoyISO = () => aISO(new Date());

export function sumarDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
}

/** Días entre dos fechas ISO (b − a). Math.round absorbe el cambio de horario. */
export const diffDias = (a, b) => Math.round((deISO(b) - deISO(a)) / 86400000);

/** Lunes de la semana de esa fecha. En México la semana se cuenta de lunes a domingo. */
export function inicioSemana(iso) {
  const d = deISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return aISO(d);
}

const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function fechaCorta(iso) {
  const d = deISO(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function fechaLarga(iso) {
  const d = deISO(iso);
  return capital(`${DIAS_LARGOS[(d.getDay() + 6) % 7]} ${d.getDate()} de ${d.toLocaleDateString('es-MX', { month: 'long' })}`);
}

/** "Hoy", "Ayer" o "Lunes 19 de octubre". */
export function etiquetaFecha(iso) {
  const hoy = hoyISO();
  if (iso === hoy) return 'Hoy';
  if (iso === sumarDias(hoy, -1)) return 'Ayer';
  return fechaLarga(iso);
}

/** "19 – 25 oct" o "28 sep – 4 oct". */
export function rangoSemana(lunes) {
  const a = deISO(lunes);
  const b = deISO(sumarDias(lunes, 6));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${MESES[b.getMonth()]}`
    : `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
}

export function nombreMes(d) {
  return capital(d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).replace(' de ', ' '));
}
