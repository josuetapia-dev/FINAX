/**
 * calculos.js — Las cuentas de Finax, sin nada de pantalla.
 *
 * Funciones puras: reciben el estado y devuelven números. Así se pueden
 * revisar por separado y cualquier vista las reutiliza.
 */
import { aISO, deISO, diffDias, sumarDias, DIAS_LARGOS } from './formato.js';

// El saldo inicial no es un "ingreso" de esa semana: es dinero que ya tenías.
const esIngresoReal = (m) => m.tipo === 'ingreso' && m.categoria !== 'saldo';

export const aportadoMeta = (meta) => meta.aportes.reduce((s, a) => s + a.monto, 0);

/** Todo lo que ha entrado menos todo lo que ha salido. */
export const saldo = (est) =>
  est.movimientos.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);

/** Dinero guardado para metas: sigue siendo tuyo, pero ya no está para gastar. */
export const apartado = (est) => est.metas.reduce((s, meta) => s + aportadoMeta(meta), 0);

export const disponible = (est) => saldo(est) - apartado(est);

export const enRango = (est, desde, hasta) =>
  est.movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta);

/** Un gasto fijo es el que salió de un pago fijo (renta, suscripciones...). */
const esFijo = (m) => m.tipo === 'gasto' && Boolean(m.recurrenteId);
export const esGastoVariable = (m) => m.tipo === 'gasto' && !m.recurrenteId;

/** ¿Vale la pena distinguir fijos y variables? Solo si usas pagos fijos. */
export const usaPagosFijos = (est) => (est.recurrentes ?? []).length > 0 || est.movimientos.some(esFijo);

/** `gastos` es el total; `fijos` es la parte de esos gastos que viene de pagos fijos. */
export function totales(movs) {
  let gastos = 0;
  let fijos = 0;
  let ingresos = 0;
  for (const m of movs) {
    if (m.tipo === 'gasto') {
      gastos += m.monto;
      if (esFijo(m)) fijos += m.monto;
    } else if (esIngresoReal(m)) ingresos += m.monto;
  }
  return { gastos, fijos, variables: gastos - fijos, ingresos };
}

/** Solo gastos variables: la renta no dice nada de cómo te fue esa semana. */
function gastosPorDia(est, lunes) {
  const dias = Array(7).fill(0);
  for (const m of enRango(est, lunes, sumarDias(lunes, 6))) {
    if (esGastoVariable(m)) dias[diffDias(lunes, m.fecha)] += m.monto;
  }
  return dias;
}

/**
 * Semana contra la anterior, en gastos variables (los pagos fijos se reportan
 * aparte). Si la semana va a la mitad (hastaDia < 6), compara contra los mismos
 * días de la semana pasada: comparar 3 días contra 7 siempre haría ver que
 * "gastas menos" aunque no sea cierto.
 */
export function resumenSemana(est, lunes, hastaDia = 6) {
  const lunesAnterior = sumarDias(lunes, -7);
  const diasActual = gastosPorDia(est, lunes);
  const diasAnterior = gastosPorDia(est, lunesAnterior);
  const actual = totales(enRango(est, lunes, sumarDias(lunes, 6)));
  const anterior = totales(enRango(est, lunesAnterior, sumarDias(lunesAnterior, 6)));
  const suma = (arr) => arr.slice(0, hastaDia + 1).reduce((a, b) => a + b, 0);
  return {
    actual,
    anterior,
    diasActual,
    diasAnterior,
    gastoComparable: suma(diasActual),
    gastoComparableAnterior: suma(diasAnterior),
  };
}

/** Ingresos y gastos de las últimas n semanas (la más vieja primero). */
export function tendencia(est, lunesActual, n = 8) {
  return Array.from({ length: n }, (_, i) => {
    const lunes = sumarDias(lunesActual, -7 * (n - 1 - i));
    return { lunes, ...totales(enRango(est, lunes, sumarDias(lunes, 6))) };
  });
}

/** Gastos agrupados por categoría, del mayor al menor. */
export function porCategoria(movs) {
  const mapa = new Map();
  for (const m of movs) if (m.tipo === 'gasto') mapa.set(m.categoria, (mapa.get(m.categoria) ?? 0) + m.monto);
  return [...mapa].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto);
}

export function necesidadGusto(movs) {
  const r = { necesidad: 0, gusto: 0, sinMarcar: 0 };
  for (const m of movs) {
    if (m.tipo !== 'gasto') continue;
    if (m.clase === 'necesidad') r.necesidad += m.monto;
    else if (m.clase === 'gusto') r.gusto += m.monto;
    else r.sinMarcar += m.monto;
  }
  return r;
}

/**
 * Estado de una meta y cuánto apartar por semana para llegar a tiempo:
 * lo que falta ÷ semanas que quedan (redondeado hacia arriba al peso).
 */
export function infoMeta(meta, hoy) {
  const aportado = aportadoMeta(meta);
  const restante = Math.max(0, meta.objetivo - aportado);
  const progreso = meta.objetivo > 0 ? Math.min(1, aportado / meta.objetivo) : 0;
  const completa = restante === 0;
  let semanas = null;
  let porSemana = null;
  let vencida = false;
  if (meta.fechaLimite && !completa) {
    const dias = diffDias(hoy, meta.fechaLimite);
    vencida = dias < 0;
    if (!vencida) {
      semanas = Math.max(1, Math.ceil(dias / 7));
      porSemana = Math.ceil(restante / semanas / 100) * 100;
    }
  }
  return { aportado, restante, progreso, completa, semanas, porSemana, vencida };
}

/* ---------- Pagos fijos (recurrentes y suscripciones) ---------- */

/**
 * Fecha de la k-ésima vez que toca el pago (k = 0 es la primera, `inicio`).
 * Si el pago es el día 31 y el mes tiene 30, se cobra el último día del mes.
 */
export function ocurrencia(rec, k) {
  if (rec.frecuencia === 'semanal') return sumarDias(rec.inicio, 7 * k);
  const ancla = deISO(rec.inicio);
  const mes = ancla.getMonth() + (rec.frecuencia === 'anual' ? 12 * k : k);
  const ultimoDia = new Date(ancla.getFullYear(), mes + 1, 0).getDate();
  return aISO(new Date(ancla.getFullYear(), mes, Math.min(ancla.getDate(), ultimoDia)));
}

/**
 * Fechas que todavía no se pagan ni se omiten, hasta `hasta` (incluida).
 * `pagadoHasta` es la última fecha ya atendida; todo lo anterior se ignora.
 */
export function pendientes(rec, hasta) {
  const fechas = [];
  for (let k = 0; k < 5000; k++) {
    const fecha = ocurrencia(rec, k);
    if (fecha > hasta) break;
    if (!rec.pagadoHasta || fecha > rec.pagadoHasta) fechas.push(fecha);
  }
  return fechas;
}

/** La siguiente fecha por atender (puede estar vencida). */
export function proximaFecha(rec) {
  for (let k = 0; k < 5000; k++) {
    const fecha = ocurrencia(rec, k);
    if (!rec.pagadoHasta || fecha > rec.pagadoHasta) return fecha;
  }
  return null;
}

/** Cuánto cuesta al mes, para comparar pagos semanales, mensuales y anuales. */
export function costoMensual(rec) {
  if (rec.frecuencia === 'semanal') return Math.round((rec.monto * 52) / 12);
  if (rec.frecuencia === 'anual') return Math.round(rec.monto / 12);
  return rec.monto;
}

/** Lo que falta pagar de pagos fijos desde hoy hasta `hasta`, incluidos los vencidos. */
export const reservaPagosFijos = (est, hasta) =>
  (est.recurrentes ?? []).reduce((s, rec) => s + pendientes(rec, hasta).length * rec.monto, 0);

/**
 * "Puedes gastar hoy": lo disponible, menos el colchón que no quieres tocar,
 * menos lo que tus metas te piden apartar en lo que resta del mes, menos los
 * pagos fijos que faltan este mes, repartido entre los días que quedan.
 * Lo que ya gastaste hoy se cuenta dentro del día, excepto los pagos fijos:
 * ya estaban reservados, así que pagarlos no te "come" el día.
 */
export function puedesGastarHoy(est, hoy) {
  const d = deISO(hoy);
  const finMes = aISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const diasRestantes = diffDias(hoy, finMes) + 1;
  const gastadoHoy = est.movimientos
    .filter((m) => m.tipo === 'gasto' && m.fecha === hoy && !m.recurrenteId)
    .reduce((s, m) => s + m.monto, 0);
  const compromisoMetas = est.metas.reduce((s, meta) => {
    const info = infoMeta(meta, hoy);
    return info.porSemana ? s + Math.min(info.restante, Math.round((info.porSemana * diasRestantes) / 7)) : s;
  }, 0);
  const compromisoFijos = reservaPagosFijos(est, finMes);
  const base = disponible(est) + gastadoHoy - est.ajustes.colchon - compromisoMetas - compromisoFijos;
  const diario = Math.max(0, Math.floor(base / diasRestantes / 100) * 100);
  return { diario, gastadoHoy, restante: diario - gastadoHoy, diasRestantes, compromisoMetas, compromisoFijos };
}

/** Frases cortas que explican la semana (las muestra Análisis). */
export function observaciones(est, lunes, sem, nombreCategoria) {
  const frases = [];
  const max = Math.max(...sem.diasActual);
  if (max > 0) frases.push({ tipo: 'dia', dia: DIAS_LARGOS[sem.diasActual.indexOf(max)], monto: max });
  // La categoría que más pesa se busca entre los variables: la renta siempre ganaría.
  const cats = porCategoria(enRango(est, lunes, sumarDias(lunes, 6)).filter(esGastoVariable));
  if (cats.length && sem.actual.variables > 0) {
    frases.push({ tipo: 'categoria', nombre: nombreCategoria(cats[0].categoria), pct: Math.round((cats[0].monto / sem.actual.variables) * 100) });
  }
  if (sem.actual.fijos) frases.push({ tipo: 'fijos', monto: sem.actual.fijos });
  // El balance sí cuenta todo: es lo que de verdad entró y salió.
  if (sem.actual.ingresos || sem.actual.gastos) frases.push({ tipo: 'neto', monto: sem.actual.ingresos - sem.actual.gastos });
  return frases;
}
