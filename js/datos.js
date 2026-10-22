/**
 * datos.js — Almacén de Finax (movimientos, metas, pagos fijos y ajustes).
 *
 * Los datos viven solo en el iPhone, en localStorage, como un único JSON.
 * Para una persona son pocos datos (miles de movimientos ocupan < 1 MB), así
 * que no hace falta una base de datos. Las vistas leen con estado() y se
 * enteran de los cambios con suscribir() (patrón Observer).
 */
import { pendientes } from './calculos.js';

const CLAVE = 'finax.v1';

// Cada categoría usa un ícono de línea de iconos.js (escala de grises, sin emojis).
export const CATEGORIAS = {
  gasto: [
    { id: 'comida', nombre: 'Comida', icono: 'comida' },
    { id: 'super', nombre: 'Súper', icono: 'super' },
    { id: 'transporte', nombre: 'Transporte', icono: 'transporte' },
    { id: 'casa', nombre: 'Casa', icono: 'casa' },
    { id: 'servicios', nombre: 'Servicios', icono: 'servicios' },
    { id: 'salud', nombre: 'Salud', icono: 'salud' },
    { id: 'ropa', nombre: 'Ropa', icono: 'ropa' },
    { id: 'ocio', nombre: 'Salidas', icono: 'salidas' },
    { id: 'suscripciones', nombre: 'Suscripciones', icono: 'suscripciones' },
    { id: 'educacion', nombre: 'Escuela', icono: 'escuela' },
    { id: 'regalos', nombre: 'Regalos', icono: 'regalo' },
    { id: 'otros-gasto', nombre: 'Otros', icono: 'otros' },
  ],
  ingreso: [
    { id: 'sueldo', nombre: 'Sueldo', icono: 'sueldo' },
    { id: 'extra', nombre: 'Trabajo extra', icono: 'extra' },
    { id: 'ventas', nombre: 'Ventas', icono: 'ventas' },
    { id: 'regalo', nombre: 'Me regalaron', icono: 'regalo' },
    { id: 'reembolso', nombre: 'Reembolso', icono: 'reembolso' },
    { id: 'otros-ingreso', nombre: 'Otros', icono: 'otros' },
    // "Saldo inicial" es el dinero que ya tenías al empezar; no cuenta como ingreso de la semana.
    { id: 'saldo', nombre: 'Saldo inicial', icono: 'banco' },
  ],
};

export const ICONOS_META = ['metas', 'laptop', 'celular', 'viaje', 'auto', 'casa', 'escuela', 'juego', 'audifonos', 'tenis', 'joya', 'emergencia'];

// Las primeras metas guardaban un emoji; así se traducen al ícono equivalente.
const EMOJI_A_ICONO = {
  '🎯': 'metas', '💻': 'laptop', '📱': 'celular', '✈️': 'viaje', '🚗': 'auto', '🏠': 'casa',
  '🎓': 'escuela', '🎮': 'juego', '🎧': 'audifonos', '👟': 'tenis', '💍': 'joya', '🛟': 'emergencia',
};
export const iconoMeta = (meta) => meta.icono ?? EMOJI_A_ICONO[meta.emoji] ?? 'metas';

const INDICE = new Map([...CATEGORIAS.gasto, ...CATEGORIAS.ingreso].map((c) => [c.id, c]));
export const categoria = (id) => INDICE.get(id) ?? { id, nombre: 'Otro', icono: 'otros' };

const vacio = () => ({
  version: 1,
  movimientos: [], // { id, tipo: 'gasto'|'ingreso', monto (centavos), categoria, nota, fecha 'AAAA-MM-DD', clase: 'necesidad'|'gusto'|null, recurrenteId?, creado }
  metas: [], // { id, nombre, icono, objetivo (centavos), fechaLimite|null, creada, aportes: [{ id, monto (+ aparta / − saca), fecha }] }
  recurrentes: [], // { id, nombre, monto, categoria, frecuencia: 'semanal'|'mensual'|'anual', inicio, automatico, pagadoHasta|null, creado }
  ajustes: { tema: 'auto', ocultar: false, colchon: 0 },
});

let datos = cargar();
const oyentes = new Set();

/** Mezcla lo guardado con la forma vacía: así un respaldo viejo gana los campos nuevos. */
function completar(guardado) {
  const base = vacio();
  return { ...base, ...guardado, ajustes: { ...base.ajustes, ...guardado.ajustes } };
}

function cargar() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    return guardado ? completar(guardado) : vacio();
  } catch {
    return vacio();
  }
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch (error) {
    console.error('No se pudo guardar en el teléfono', error);
  }
  oyentes.forEach((fn) => fn());
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const estado = () => datos;
export function suscribir(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/* ---------- Movimientos ---------- */

export function agregarMovimiento(mov) {
  const nuevo = { id: uid(), creado: Date.now(), nota: '', clase: null, ...mov };
  datos.movimientos.push(nuevo);
  guardar();
  return nuevo;
}

export function actualizarMovimiento(id, cambios) {
  const mov = datos.movimientos.find((m) => m.id === id);
  if (mov) Object.assign(mov, cambios);
  guardar();
}

export function eliminarMovimiento(id) {
  const i = datos.movimientos.findIndex((m) => m.id === id);
  const [quitado] = i >= 0 ? datos.movimientos.splice(i, 1) : [];
  guardar();
  return quitado;
}

/** Para "Deshacer": vuelve a poner un movimiento tal como estaba. */
export function restaurarMovimiento(mov) {
  datos.movimientos.push(mov);
  guardar();
}

/* ---------- Metas ---------- */

export function crearMeta(meta) {
  datos.metas.push({ id: uid(), creada: Date.now(), aportes: [], fechaLimite: null, ...meta });
  guardar();
}

export function actualizarMeta(id, cambios) {
  const meta = datos.metas.find((m) => m.id === id);
  if (meta) Object.assign(meta, cambios);
  guardar();
}

/** Al eliminar una meta, lo apartado regresa solo a "Disponible" (deja de restarse). */
export function eliminarMeta(id) {
  datos.metas = datos.metas.filter((m) => m.id !== id);
  guardar();
}

export function aportar(metaId, monto, fecha) {
  const meta = datos.metas.find((m) => m.id === metaId);
  if (!meta) return;
  meta.aportes.push({ id: uid(), monto, fecha });
  guardar();
}

/* ---------- Pagos fijos ---------- */

export function guardarRecurrente(rec) {
  const existente = rec.id && datos.recurrentes.find((r) => r.id === rec.id);
  if (existente) Object.assign(existente, rec);
  else datos.recurrentes.push({ id: uid(), creado: Date.now(), pagadoHasta: null, automatico: false, ...rec });
  guardar();
}

export function eliminarRecurrente(id) {
  datos.recurrentes = datos.recurrentes.filter((r) => r.id !== id);
  guardar();
}

/**
 * Marca como atendida la fecha `fecha` de un pago fijo. Si viene `gasto`, además
 * lo registra como movimiento (pagar); si no, solo lo salta (omitir).
 * Devuelve lo necesario para deshacerlo.
 */
export function atenderRecurrente(id, fecha, gasto = null) {
  const rec = datos.recurrentes.find((r) => r.id === id);
  if (!rec) return null;
  const anterior = rec.pagadoHasta;
  rec.pagadoHasta = fecha;
  let movimiento = null;
  if (gasto) {
    movimiento = { id: uid(), creado: Date.now(), tipo: 'gasto', categoria: rec.categoria, nota: rec.nombre, clase: 'necesidad', recurrenteId: rec.id, ...gasto };
    datos.movimientos.push(movimiento);
  }
  guardar();
  return { id, anterior, movimientoId: movimiento?.id ?? null };
}

export function deshacerAtencion({ id, anterior, movimientoId }) {
  const rec = datos.recurrentes.find((r) => r.id === id);
  if (rec) rec.pagadoHasta = anterior;
  if (movimientoId) datos.movimientos = datos.movimientos.filter((m) => m.id !== movimientoId);
  guardar();
}

/**
 * Los pagos que "se cobran solos" (suscripciones con tarjeta) se registran como
 * gasto en su fecha, sin que tengas que tocar nada. Se llama al abrir la app.
 */
export function cobrarAutomaticos(hoy) {
  const registrados = [];
  for (const rec of datos.recurrentes) {
    if (!rec.automatico) continue;
    for (const fecha of pendientes(rec, hoy)) {
      datos.movimientos.push({
        id: uid(), creado: Date.now(), tipo: 'gasto', monto: rec.monto, categoria: rec.categoria,
        nota: rec.nombre, clase: 'necesidad', fecha, recurrenteId: rec.id,
      });
      rec.pagadoHasta = fecha;
      registrados.push(rec);
    }
  }
  if (registrados.length) guardar();
  return registrados;
}

/* ---------- Ajustes y respaldo ---------- */

export function setAjuste(clave, valor) {
  datos.ajustes[clave] = valor;
  guardar();
}

export const exportar = () => JSON.stringify(datos, null, 2);

/** Reemplaza todo con un respaldo. Revisa la forma antes de aceptar el archivo. */
export function importar(texto) {
  const entrada = JSON.parse(texto);
  if (!entrada || !Array.isArray(entrada.movimientos) || !Array.isArray(entrada.metas)) {
    throw new Error('El archivo no es un respaldo de Finax.');
  }
  datos = completar(entrada);
  guardar();
}

export function borrarTodo() {
  datos = vacio();
  guardar();
}
