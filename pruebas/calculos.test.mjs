/**
 * Pruebas de las cuentas de Finax (sin navegador).
 * Correr con:  node --test "pruebas/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as calc from '../js/calculos.js';
import { inicioSemana, rangoSemana, montoTecleado, aCentavos } from '../js/formato.js';

const estado = (movimientos = [], metas = [], colchon = 0, recurrentes = []) => ({ movimientos, metas, recurrentes, ajustes: { colchon } });
const pagoFijo = (extra) => ({ nombre: 'Renta', monto: 300000, categoria: 'casa', frecuencia: 'mensual', inicio: '2026-10-25', pagadoHasta: null, ...extra });
const gasto = (monto, fecha, extra = {}) => ({ tipo: 'gasto', monto, fecha, categoria: 'comida', ...extra });
const ingreso = (monto, fecha, categoria = 'sueldo') => ({ tipo: 'ingreso', monto, fecha, categoria });

test('la semana empieza en lunes', () => {
  assert.equal(inicioSemana('2026-10-22'), '2026-10-19'); // jueves → lunes
  assert.equal(inicioSemana('2026-10-25'), '2026-10-19'); // domingo → lunes anterior
  assert.equal(inicioSemana('2026-10-19'), '2026-10-19');
  assert.equal(rangoSemana('2026-09-28'), '28 sep – 4 oct');
});

test('el teclado convierte bien a centavos', () => {
  assert.equal(aCentavos('1234.5'), 123450);
  assert.equal(aCentavos('0.1'), 10);
  assert.equal(montoTecleado('1234.5'), '$1,234.5');
});

test('el saldo inicial cuenta en el disponible pero no como ingreso de la semana', () => {
  const est = estado([ingreso(500000, '2026-10-19', 'saldo'), gasto(12000, '2026-10-20')]);
  assert.equal(calc.disponible(est), 488000);
  assert.deepEqual(calc.totales(est.movimientos), { gastos: 12000, fijos: 0, variables: 12000, ingresos: 0 });
});

test('lo apartado en metas sale del disponible', () => {
  const meta = { objetivo: 100000, fechaLimite: null, aportes: [{ monto: 30000 }, { monto: -5000 }] };
  const est = estado([ingreso(200000, '2026-10-01')], [meta]);
  assert.equal(calc.apartado(est), 25000);
  assert.equal(calc.disponible(est), 175000);
});

test('la semana a medias se compara contra los mismos días de la anterior', () => {
  const est = estado([
    gasto(10000, '2026-10-12'), // lunes pasado
    gasto(90000, '2026-10-17'), // sábado pasado: no debe contar si hoy es jueves
    gasto(5000, '2026-10-20'),
  ]);
  const sem = calc.resumenSemana(est, '2026-10-19', 3);
  assert.equal(sem.gastoComparable, 5000);
  assert.equal(sem.gastoComparableAnterior, 10000);
  assert.equal(sem.anterior.gastos, 100000);
});

test('una meta con fecha calcula cuánto apartar por semana', () => {
  const meta = { objetivo: 900000, fechaLimite: '2026-12-22', aportes: [{ monto: 210000 }] };
  const info = calc.infoMeta(meta, '2026-10-22');
  assert.equal(info.semanas, 9); // 61 días → 9 semanas
  assert.equal(info.porSemana, 76700); // 6,900 / 9 = 766.67 → $767
  assert.equal(info.vencida, false);
});

test('una meta vencida o completa no pide aportación', () => {
  assert.equal(calc.infoMeta({ objetivo: 1000, fechaLimite: '2026-01-01', aportes: [] }, '2026-10-22').vencida, true);
  assert.equal(calc.infoMeta({ objetivo: 1000, fechaLimite: '2026-12-01', aportes: [{ monto: 1000 }] }, '2026-10-22').porSemana, null);
});

test('puedes gastar hoy reparte lo disponible entre los días que quedan del mes', () => {
  // 22 de octubre → quedan 10 días (22 al 31). $10,000 − colchón $1,000 = $9,000 → $900 al día.
  // Hoy ya se gastaron $200, así que quedan $700 para hoy.
  const est = estado([ingreso(1000000, '2026-10-01'), gasto(20000, '2026-10-22')], [], 100000);
  const pg = calc.puedesGastarHoy(est, '2026-10-22');
  assert.equal(pg.diasRestantes, 10);
  assert.equal(pg.diario, 90000);
  assert.equal(pg.restante, 70000);
});

/* ---------- Pagos fijos ---------- */

test('un pago mensual del día 31 cae el último día en meses cortos', () => {
  const rec = pagoFijo({ inicio: '2026-01-31' });
  assert.equal(calc.ocurrencia(rec, 1), '2026-02-28');
  assert.equal(calc.ocurrencia(rec, 2), '2026-03-31');
  assert.equal(calc.ocurrencia(rec, 3), '2026-04-30');
});

test('pagos semanales y anuales', () => {
  assert.equal(calc.ocurrencia(pagoFijo({ frecuencia: 'semanal', inicio: '2026-10-19' }), 2), '2026-11-02');
  assert.equal(calc.ocurrencia(pagoFijo({ frecuencia: 'anual', inicio: '2026-03-12' }), 1), '2027-03-12');
  assert.equal(calc.costoMensual(pagoFijo({ frecuencia: 'semanal', monto: 10000 })), 43333);
  assert.equal(calc.costoMensual(pagoFijo({ frecuencia: 'anual', monto: 120000 })), 10000);
});

test('lo ya pagado u omitido no vuelve a quedar pendiente', () => {
  const rec = pagoFijo({ frecuencia: 'semanal', inicio: '2026-10-01', pagadoHasta: '2026-10-08' });
  assert.deepEqual(calc.pendientes(rec, '2026-10-22'), ['2026-10-15', '2026-10-22']);
  assert.equal(calc.proximaFecha(rec), '2026-10-15');
});

test('puedes gastar hoy reserva los pagos fijos que faltan este mes', () => {
  // $10,000 disponibles, renta de $3,000 el 25 → quedan $7,000 entre 10 días = $700.
  const est = estado([ingreso(1000000, '2026-10-01')], [], 0, [pagoFijo()]);
  const antes = calc.puedesGastarHoy(est, '2026-10-22');
  assert.equal(antes.compromisoFijos, 300000);
  assert.equal(antes.diario, 70000);
});

test('pagar un pago fijo hoy no se come lo que puedes gastar hoy', () => {
  const est = estado(
    [ingreso(1000000, '2026-10-01'), gasto(300000, '2026-10-22', { recurrenteId: 'r1' })],
    [], 0, [pagoFijo({ id: 'r1', pagadoHasta: '2026-10-25' })],
  );
  const despues = calc.puedesGastarHoy(est, '2026-10-22');
  assert.equal(despues.compromisoFijos, 0);
  assert.equal(despues.diario, 70000);
  assert.equal(despues.restante, 70000);
});

test('un pago vencido sin pagar sigue reservado', () => {
  const est = estado([ingreso(1000000, '2026-10-01')], [], 0, [pagoFijo({ inicio: '2026-10-05' })]);
  assert.equal(calc.puedesGastarHoy(est, '2026-10-22').compromisoFijos, 300000);
});

/* ---------- Fijos contra variables ---------- */

test('la comparación semanal usa solo gastos variables', () => {
  const est = estado([
    gasto(20000, '2026-10-13'), // martes pasado, variable
    gasto(450000, '2026-10-20', { recurrenteId: 'renta' }), // renta este martes
    gasto(15000, '2026-10-20'),
  ]);
  const sem = calc.resumenSemana(est, '2026-10-19', 3);
  assert.equal(sem.actual.gastos, 465000);
  assert.equal(sem.actual.fijos, 450000);
  assert.equal(sem.actual.variables, 15000);
  assert.equal(sem.gastoComparable, 15000); // sin la renta: −25% en vez de +2,225%
  assert.equal(sem.gastoComparableAnterior, 20000);
  assert.equal(sem.diasActual[1], 15000);
});

test('las observaciones buscan la categoría top entre los variables', () => {
  const est = estado([
    gasto(450000, '2026-10-20', { recurrenteId: 'renta', categoria: 'casa' }),
    gasto(15000, '2026-10-20', { categoria: 'comida' }),
    gasto(5000, '2026-10-21', { categoria: 'transporte' }),
  ]);
  const sem = calc.resumenSemana(est, '2026-10-19', 6);
  const obs = calc.observaciones(est, '2026-10-19', sem, (id) => id);
  assert.deepEqual(obs.find((o) => o.tipo === 'categoria'), { tipo: 'categoria', nombre: 'comida', pct: 75 });
  assert.equal(obs.find((o) => o.tipo === 'fijos').monto, 450000);
  assert.equal(obs.find((o) => o.tipo === 'neto').monto, -470000); // el balance sí cuenta todo
});

test('sin pagos fijos no se habla de variables', () => {
  assert.equal(calc.usaPagosFijos(estado([gasto(100, '2026-10-20')])), false);
  assert.equal(calc.usaPagosFijos(estado([], [], 0, [pagoFijo()])), true);
});
