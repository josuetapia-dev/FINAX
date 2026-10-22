/**
 * app.js — Punto de entrada de Finax.
 *
 * Dibuja las cuatro vistas (Inicio, Movimientos, Análisis, Metas) y las hojas
 * que suben desde abajo (registrar movimiento, metas, apartar, ajustes).
 * Flujo: el usuario toca algo → se llama a datos.js → datos.js avisa a sus
 * suscriptores → render() vuelve a dibujar la vista activa.
 */
import * as db from './datos.js';
import * as calc from './calculos.js';
import * as f from './formato.js';
import * as g from './graficas.js';
import { icono } from './iconos.js';

const ui = { vista: 'inicio', semana: 0, mes: 0, filtro: 'todos' };
const $vista = document.getElementById('vista');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const ordenMov = (a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado;

/* =========================================================
   Arranque y navegación
   ========================================================= */

function iniciar() {
  const nombres = { inicio: 'Inicio', movimientos: 'Movimientos', analisis: 'Análisis', metas: 'Metas' };
  document.querySelectorAll('[data-tab]').forEach((b) => {
    b.innerHTML = `${icono(b.dataset.tab, 24)}<span>${nombres[b.dataset.tab]}</span>`;
  });
  document.querySelector('.boton-agregar').innerHTML = icono('mas', 28);

  db.suscribir(render);
  document.addEventListener('click', alTocar);
  iniciarDetalleGraficas();
  // Si la app queda abierta y cambia el día, al volver se recalcula "hoy"
  // y se registran las suscripciones que se cobraron mientras tanto.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    cobrarPendientes();
    render();
  });
  cobrarPendientes();
  render();

  // Pide al sistema no borrar los datos aunque falte espacio.
  navigator.storage?.persist?.();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Sin modo sin conexión:', e.message));
  }
}

/** Registra los pagos fijos automáticos que ya vencieron. Devuelve cuántos registró. */
function cobrarPendientes() {
  const registrados = db.cobrarAutomaticos(f.hoyISO());
  if (registrados.length === 1) aviso(`Se registró ${registrados[0].nombre}`);
  else if (registrados.length > 1) aviso(`Se registraron ${registrados.length} pagos fijos`);
  return registrados.length;
}

function irA(vista) {
  ui.vista = vista;
  render();
  window.scrollTo(0, 0);
  // Reinicia la animación de entrada solo al cambiar de pestaña.
  $vista.style.animation = 'none';
  void $vista.offsetHeight;
  $vista.style.animation = '';
}

function aplicarAjustes() {
  const { tema, ocultar } = db.estado().ajustes;
  f.setOcultar(ocultar);
  const raiz = document.documentElement;
  if (tema === 'auto') delete raiz.dataset.theme;
  else raiz.dataset.theme = tema;
  const colores = { light: '#f1f2f5', dark: '#0e1117' };
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.content = tema === 'auto' ? colores[m.media.includes('dark') ? 'dark' : 'light'] : colores[tema];
  });
}

function render() {
  aplicarAjustes();
  document.getElementById('tip').classList.remove('visible');
  const vistas = { inicio: vistaInicio, movimientos: vistaMovimientos, analisis: vistaAnalisis, metas: vistaMetas };
  $vista.innerHTML = vistas[ui.vista]();
  document.querySelectorAll('[data-tab]').forEach((b) => {
    b.setAttribute('aria-current', b.dataset.tab === ui.vista ? 'page' : 'false');
  });
}

/** Un solo escuchador para toda la app: cada botón dice qué hace con data-accion. */
function alTocar(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab) return irA(tab.dataset.tab);
  const ir = e.target.closest('[data-ir]');
  if (ir) return irA(ir.dataset.ir);
  const el = e.target.closest('[data-accion]');
  if (!el) return;
  const { accion, id } = el.dataset;
  const est = db.estado();
  switch (accion) {
    case 'agregar': return hojaMovimiento();
    case 'saldo-inicial': return hojaMovimiento(null, { tipo: 'ingreso', categoria: 'saldo' });
    case 'editar-mov': return hojaMovimiento(est.movimientos.find((m) => m.id === id));
    case 'ocultar': return db.setAjuste('ocultar', !est.ajustes.ocultar);
    case 'ajustes': return hojaAjustes();
    case 'semana': ui.semana = Math.min(0, ui.semana + Number(el.dataset.d)); return render();
    case 'mes': ui.mes = Math.min(0, ui.mes + Number(el.dataset.d)); return render();
    case 'filtro': ui.filtro = el.dataset.valor; return render();
    case 'nueva-meta': return hojaMeta();
    case 'editar-meta': return hojaMeta(est.metas.find((m) => m.id === id));
    case 'aportar': return hojaAporte(est.metas.find((m) => m.id === id), 1);
    case 'retirar': return hojaAporte(est.metas.find((m) => m.id === id), -1);
    case 'recurrentes': return hojaRecurrentes();
    case 'nuevo-recurrente': return hojaRecurrente();
    case 'pago': return hojaPago(est.recurrentes.find((r) => r.id === id));
  }
}

/* =========================================================
   Piezas compartidas
   ========================================================= */

/** En listas agrupadas por día (conFecha = false) no se repite la fecha en cada fila. */
function filaMovimiento(m, conFecha = true) {
  const c = db.categoria(m.categoria);
  const monto = m.tipo === 'gasto' ? f.dinero(-m.monto) : f.dinero(m.monto, { signo: true });
  const etiqueta = m.recurrenteId ? 'Pago fijo' : m.clase === 'necesidad' ? 'Necesidad' : m.clase === 'gusto' ? 'Gusto' : '';
  const detalle = [m.nota && c.nombre, conFecha && f.etiquetaFecha(m.fecha), etiqueta].filter(Boolean).join(', ');
  return `<li><button class="fila" data-accion="editar-mov" data-id="${m.id}">
    <span class="ficha">${icono(c.icono)}</span>
    <span class="fila-texto"><strong>${esc(m.nota || c.nombre)}</strong>${detalle ? `<small>${detalle}</small>` : ''}</span>
    <span class="fila-monto ${m.tipo}">${monto}</span>
  </button></li>`;
}

/** Cambio porcentual de gasto. Gastar menos se pinta como "bueno". */
function deltaGasto(actual, anterior, contexto) {
  if (!anterior) return actual ? '<span class="delta">Sin gastos en la semana anterior para comparar</span>' : '';
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  const clase = pct < 0 ? 'bueno' : pct > 0 ? 'malo' : '';
  return `<span class="delta ${clase}">${icono(pct <= 0 ? 'bajar' : 'subir')}${Math.abs(pct)}% ${contexto}</span>`;
}

function bloqueBienvenida() {
  return `<section class="panel bienvenida">
    <h2>Empieza con lo que tienes hoy</h2>
    <p>Registra cuánto dinero tienes ahora, sumando efectivo y cuentas. Desde ahí, Finax lleva la cuenta.</p>
    <button class="btn-primario" data-accion="saldo-inicial">Registrar saldo inicial</button>
  </section>`;
}

function panelMetaVacia() {
  return `<div class="panel bienvenida">
    <h2>¿Para qué estás juntando?</h2>
    <p>Crea una meta con su monto y su fecha. Finax te dice cuánto apartar cada semana para llegar a tiempo.</p>
    <button class="btn-suave" data-accion="nueva-meta">Crear meta</button>
  </div>`;
}

/* =========================================================
   Vista: Inicio
   ========================================================= */

function vistaInicio() {
  const est = db.estado();
  const hoy = f.hoyISO();
  const disponible = calc.disponible(est);
  const apartado = calc.apartado(est);
  const partes = f.dineroPartes(disponible);
  const sinDatos = est.movimientos.length === 0;

  return `
    <header class="barra">
      <div><p class="marca">Finax</p><p class="fecha-hoy">${f.fechaLarga(hoy)}</p></div>
      <div class="barra-acciones">
        <button class="icono-btn" data-accion="ocultar" aria-label="${est.ajustes.ocultar ? 'Mostrar montos' : 'Ocultar montos'}">${icono(est.ajustes.ocultar ? 'ojoCerrado' : 'ojo')}</button>
        <button class="icono-btn" data-accion="ajustes" aria-label="Ajustes">${icono('ajustes')}</button>
      </div>
    </header>

    <section class="heroe">
      <p class="etiqueta">Disponible</p>
      <p class="cifra-heroe${disponible < 0 ? ' negativo' : ''}">${partes.entero}<span>${partes.decimales}</span></p>
      ${est.metas.length ? `<div class="heroe-sub">
        <div><span class="oro">Apartado en metas</span><strong>${f.dinero(apartado)}</strong></div>
        <div><span>Saldo total</span><strong>${f.dinero(disponible + apartado)}</strong></div>
      </div>` : ''}
    </section>

    ${sinDatos ? bloqueBienvenida() : bloqueHoy(calc.puedesGastarHoy(est, hoy))}
    ${sinDatos ? '' : bloquePagos(est, hoy)}
    ${sinDatos ? '' : bloqueSemana(est, hoy)}
    ${bloqueMetasMini(est, hoy)}
    ${sinDatos ? '' : `<section class="seccion">
      <div class="seccion-cab"><h2>Recientes</h2><button class="enlace" data-ir="movimientos">Ver todos</button></div>
      <ul class="lista">${[...est.movimientos].sort(ordenMov).slice(0, 5).map((m) => filaMovimiento(m)).join('')}</ul>
    </section>`}
  `;
}

function bloqueHoy(pg) {
  const excedido = pg.restante < 0;
  const usado = pg.diario ? Math.min(1, pg.gastadoHoy / pg.diario) : pg.gastadoHoy ? 1 : 0;
  let nota;
  if (excedido) nota = `Hoy te pasaste por ${f.dinero(-pg.restante)}. Mañana el cálculo se ajusta solo.`;
  else if (!pg.diario) nota = 'Este mes ya no queda margen después de tus metas y tu colchón.';
  else nota = `Llevas ${f.dinero(pg.gastadoHoy)} de ${f.dinero(pg.diario)} al día. ${pg.diasRestantes === 1 ? 'Hoy termina el mes.' : `Quedan ${pg.diasRestantes} días del mes.`}`;
  return `<section class="panel">
    <p class="etiqueta">Puedes gastar hoy</p>
    <p class="cifra-panel">${f.dinero(Math.max(0, pg.restante))}</p>
    <div class="medidor" role="img" aria-label="Llevas ${Math.round(usado * 100)}% de lo de hoy"><span class="${excedido ? 'excedido' : ''}" style="width:${usado * 100}%"></span></div>
    <p class="nota-panel">${nota}</p>
    ${pg.compromisoFijos ? `<p class="nota-panel reserva">${icono('repetir', 15)}Ya se apartaron ${f.dinero(pg.compromisoFijos)} para los pagos fijos que faltan este mes.</p>` : ''}
  </section>`;
}

/* ---------- Pagos fijos en Inicio ---------- */

function cuandoVence(dias, fecha) {
  if (dias < 0) return `Venció hace ${plural(-dias, 'día', 'días')}`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días, ${f.fechaCorta(fecha)}`;
}

function frecuenciaTexto(frecuencia, inicio) {
  const d = f.deISO(inicio);
  if (frecuencia === 'semanal') return `Cada ${f.DIAS_LARGOS[(d.getDay() + 6) % 7]}`;
  if (frecuencia === 'anual') return `Cada año, el ${f.fechaCorta(inicio)}`;
  return `Cada mes, el día ${d.getDate()}`;
}

/** Lo que vence en los próximos 7 días (y lo vencido sin pagar), del más urgente al menos. */
function bloquePagos(est, hoy) {
  if (!est.recurrentes.length) {
    return `<section class="seccion"><div class="seccion-cab"><h2>Pagos fijos</h2></div>
      <div class="panel bienvenida">
        <h2>¿Tienes pagos que se repiten?</h2>
        <p>Renta, internet, Spotify, el gimnasio. Agrégalos y Finax los aparta antes de decirte cuánto puedes gastar.</p>
        <button class="btn-suave" data-accion="nuevo-recurrente">Agregar pago fijo</button>
      </div></section>`;
  }
  const todos = est.recurrentes
    .map((r) => ({ r, fecha: calc.proximaFecha(r) }))
    .filter((x) => x.fecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const limite = f.sumarDias(hoy, 7);
  const proximos = todos.filter((x) => x.fecha <= limite);
  const cuerpo = proximos.length
    ? `<ul class="lista">${proximos.map(({ r, fecha }) => {
      const dias = f.diffDias(hoy, fecha);
      return `<li><button class="fila" data-accion="pago" data-id="${r.id}">
        <span class="ficha">${icono(db.categoria(r.categoria).icono)}</span>
        <span class="fila-texto"><strong>${esc(r.nombre)}</strong>
          <small class="${dias < 0 ? 'vencido' : ''}">${cuandoVence(dias, fecha)}${r.automatico ? ', se cobra solo' : ''}</small></span>
        <span class="fila-monto">${f.dinero(r.monto)}</span>
      </button></li>`;
    }).join('')}</ul>`
    : `<p class="nota-panel">Nada por pagar en los próximos 7 días.${todos[0] ? ` Sigue ${esc(todos[0].r.nombre)} el ${f.fechaCorta(todos[0].fecha)}.` : ''}</p>`;
  return `<section class="seccion">
    <div class="seccion-cab"><h2>Próximos pagos</h2><button class="enlace" data-accion="recurrentes">Administrar</button></div>
    ${cuerpo}
  </section>`;
}

function bloqueSemana(est, hoy) {
  const lunes = f.inicioSemana(hoy);
  const diaHoy = f.diffDias(lunes, hoy);
  const sem = calc.resumenSemana(est, lunes, diaHoy);
  // Con pagos fijos, la cifra grande y la comparación son solo de gastos variables;
  // los fijos se dicen aparte para que la semana de la renta no parezca un desastre.
  const conFijos = calc.usaPagosFijos(est);
  return `<section class="seccion">
    <div class="seccion-cab"><h2>Esta semana</h2><button class="enlace" data-ir="analisis">Análisis</button></div>
    <div class="dupla">
      <div><span class="etiqueta">${conFijos ? 'Gastos variables' : 'Gastado'}</span><strong class="cifra-media">${f.dinero(sem.actual.variables)}</strong>
        ${deltaGasto(sem.gastoComparable, sem.gastoComparableAnterior, 'vs. la semana pasada')}
        ${sem.actual.fijos ? `<span class="aparte">${icono('repetir', 14)}Más ${f.dinero(sem.actual.fijos)} en pagos fijos</span>` : ''}</div>
      <div><span class="etiqueta">Ingresos</span><strong class="cifra-media">${f.dinero(sem.actual.ingresos)}</strong></div>
    </div>
    ${g.barrasSemana({ actual: sem.diasActual, anterior: sem.diasAnterior, hoy: diaHoy, alto: 130 })}
    ${g.leyenda([{ clase: 's-actual', texto: 'Esta semana' }, { clase: 's-anterior', texto: 'Semana pasada' }])}
    ${conFijos ? '<p class="nota-panel">Las barras no incluyen pagos fijos.</p>' : ''}
  </section>`;
}

function bloqueMetasMini(est, hoy) {
  if (!est.metas.length) return `<section class="seccion"><div class="seccion-cab"><h2>Metas</h2></div>${panelMetaVacia()}</section>`;
  const tarjetas = est.metas.map((m) => {
    const i = calc.infoMeta(m, hoy);
    return `<button class="meta-mini" data-ir="metas">
      <span class="con-icono">${g.anillo(i.progreso, 52, 5)}${icono(db.iconoMeta(m), 20)}</span>
      <strong>${esc(m.nombre)}</strong>
      <small>${Math.round(i.progreso * 100)}% de ${f.dinero(m.objetivo, { entero: true })}</small>
    </button>`;
  });
  return `<section class="seccion">
    <div class="seccion-cab"><h2>Metas</h2><button class="enlace" data-ir="metas">Ver todas</button></div>
    <div class="metas-carrusel">${tarjetas.join('')}</div>
  </section>`;
}

/* =========================================================
   Vista: Movimientos (por mes, agrupados por día)
   ========================================================= */

function vistaMovimientos() {
  const est = db.estado();
  const hoy = f.deISO(f.hoyISO());
  const ref = new Date(hoy.getFullYear(), hoy.getMonth() + ui.mes, 1);
  const desde = f.aISO(ref);
  const hasta = f.aISO(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));
  const delMes = calc.enRango(est, desde, hasta);
  const tot = calc.totales(delMes);
  const visibles = delMes.filter((m) => ui.filtro === 'todos' || m.tipo === ui.filtro).sort(ordenMov);

  const grupos = new Map();
  for (const m of visibles) {
    if (!grupos.has(m.fecha)) grupos.set(m.fecha, []);
    grupos.get(m.fecha).push(m);
  }
  const lista = [...grupos].map(([fecha, movs]) => {
    const neto = movs.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0);
    return `<section class="grupo-dia">
      <div class="grupo-cab"><span>${f.etiquetaFecha(fecha)}</span><span>${f.dinero(neto, { signo: true })}</span></div>
      <ul class="lista">${movs.map((m) => filaMovimiento(m, false)).join('')}</ul>
    </section>`;
  }).join('');

  const filtros = [['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos']]
    .map(([v, t]) => `<button data-accion="filtro" data-valor="${v}" aria-pressed="${ui.filtro === v}">${t}</button>`).join('');

  return `
    <header class="titulo-vista"><h1>Movimientos</h1>
      <button class="icono-btn" data-accion="recurrentes" aria-label="Pagos fijos">${icono('repetir', 24)}</button></header>
    <div class="nav-periodo">
      <button class="icono-btn" data-accion="mes" data-d="-1" aria-label="Mes anterior">${icono('izquierda')}</button>
      <span>${f.nombreMes(ref)}</span>
      <button class="icono-btn" data-accion="mes" data-d="1" aria-label="Mes siguiente" ${ui.mes >= 0 ? 'disabled' : ''}>${icono('derecha')}</button>
    </div>
    <div class="dupla">
      <div><span class="etiqueta">Entró</span><strong class="cifra-media">${f.dinero(tot.ingresos)}</strong></div>
      <div><span class="etiqueta">Salió</span><strong class="cifra-media">${f.dinero(tot.gastos)}</strong></div>
    </div>
    <div class="segmento" role="group" aria-label="Filtrar">${filtros}</div>
    ${lista || `<p class="vacio">No hay movimientos en ${f.nombreMes(ref).toLowerCase()}. Toca + para registrar uno.</p>`}
  `;
}

/* =========================================================
   Vista: Análisis
   ========================================================= */

function vistaAnalisis() {
  const est = db.estado();
  const hoy = f.hoyISO();
  const lunesHoy = f.inicioSemana(hoy);
  const lunes = f.sumarDias(lunesHoy, ui.semana * 7);
  const domingo = f.sumarDias(lunes, 6);
  const esActual = ui.semana === 0;
  const hastaDia = esActual ? f.diffDias(lunes, hoy) : 6;
  const sem = calc.resumenSemana(est, lunes, hastaDia);
  const movs = calc.enRango(est, lunes, domingo);
  const titulo = esActual ? 'Esta semana' : ui.semana === -1 ? 'Semana pasada' : `Hace ${-ui.semana} semanas`;
  const nombres = esActual ? ['Esta semana', 'Semana pasada'] : ['Esa semana', 'La anterior'];
  const conFijos = calc.usaPagosFijos(est);
  const contexto = `${conFijos ? 'en gastos variables ' : ''}${esActual && hastaDia < 6 ? 'vs. la semana pasada a estas alturas' : 'vs. la semana anterior'}`;

  return `
    <header class="titulo-vista"><h1>Análisis</h1></header>
    <div class="nav-periodo">
      <button class="icono-btn" data-accion="semana" data-d="-1" aria-label="Semana anterior">${icono('izquierda')}</button>
      <span>${titulo}<small>${f.rangoSemana(lunes)}</small></span>
      <button class="icono-btn" data-accion="semana" data-d="1" aria-label="Semana siguiente" ${esActual ? 'disabled' : ''}>${icono('derecha')}</button>
    </div>

    <section>
      <p class="etiqueta">Gastaste</p>
      <p class="cifra-heroe chica">${f.dineroPartes(sem.actual.gastos).entero}<span>${f.dineroPartes(sem.actual.gastos).decimales}</span></p>
      ${sem.actual.fijos ? `<p class="desglose"><strong>${f.dinero(sem.actual.variables)}</strong> en gastos variables y <strong>${f.dinero(sem.actual.fijos)}</strong> en pagos fijos</p>` : ''}
      ${deltaGasto(sem.gastoComparable, sem.gastoComparableAnterior, contexto)}
    </section>

    <section class="seccion">
      <div class="seccion-cab"><h2>Día por día</h2>${conFijos ? '<span class="cab-nota">Sin pagos fijos</span>' : ''}</div>
      ${g.barrasSemana({ actual: sem.diasActual, anterior: sem.diasAnterior, hoy: hastaDia, alto: 180, nombres })}
      ${g.leyenda([{ clase: 's-actual', texto: nombres[0] }, { clase: 's-anterior', texto: nombres[1] }])}
      ${listaObservaciones(calc.observaciones(est, lunes, sem, (id) => db.categoria(id).nombre), conFijos)}
    </section>

    ${seccionCategorias(movs, sem.actual.gastos)}
    ${seccionNecesidadGusto(calc.necesidadGusto(movs))}
    ${seccionTendencia(est, lunesHoy)}
  `;
}

function listaObservaciones(obs, conFijos) {
  if (!obs.length) return '<p class="vacio">No hay movimientos en esta semana.</p>';
  const frases = obs.map((o) => {
    if (o.tipo === 'dia') return `El <strong>${o.dia}</strong> fue tu día con más gasto${conFijos ? ' variable' : ''}: <strong>${f.dinero(o.monto)}</strong>.`;
    if (o.tipo === 'categoria') return `<strong>${esc(o.nombre)}</strong> se llevó el <strong>${o.pct}%</strong> de ${conFijos ? 'tus gastos variables' : 'lo que gastaste'}.`;
    if (o.tipo === 'fijos') return `En pagos fijos se fueron <strong>${f.dinero(o.monto)}</strong>.`;
    return o.monto >= 0
      ? `Entró <strong>${f.dinero(o.monto)}</strong> más de lo que salió.`
      : `Salió <strong>${f.dinero(-o.monto)}</strong> más de lo que entró.`;
  });
  return `<ul class="observaciones seccion">${frases.map((t) => `<li>${t}</li>`).join('')}</ul>`;
}

function seccionCategorias(movs, total) {
  const cats = calc.porCategoria(movs);
  if (!cats.length) return '';
  // Las 5 más grandes y el resto junto en "Lo demás", para que la lista se lea de un vistazo.
  const filas = cats.slice(0, 5).map((c) => ({ ...db.categoria(c.categoria), monto: c.monto }));
  const resto = cats.slice(5).reduce((s, c) => s + c.monto, 0);
  if (resto) filas.push({ nombre: 'Lo demás', icono: 'puntos', monto: resto });
  const mayor = filas[0].monto;
  return `<section class="seccion">
    <div class="seccion-cab"><h2>En qué se fue</h2></div>
    <ul class="ranking">${filas.map((c) => `<li>
      <span class="ficha">${icono(c.icono, 18)}</span>
      <span class="nombre">${esc(c.nombre)}</span>
      <span class="valor"><span class="pct">${Math.round((c.monto / total) * 100)}%</span>${f.dinero(c.monto)}</span>
      <span class="pista"><span style="width:${(c.monto / mayor) * 100}%"></span></span>
    </li>`).join('')}</ul>
  </section>`;
}

function seccionNecesidadGusto(ng) {
  const total = ng.necesidad + ng.gusto + ng.sinMarcar;
  if (!total) return '';
  const pct = (v) => Math.round((v / total) * 100);
  const partes = [
    { clase: 's-necesidad', texto: 'Necesidad', monto: ng.necesidad },
    { clase: 's-gusto', texto: 'Gusto', monto: ng.gusto },
    { clase: 's-sin', texto: 'Sin marcar', monto: ng.sinMarcar },
  ].filter((p) => p.monto > 0);
  return `<section class="seccion">
    <div class="seccion-cab"><h2>Necesidad o gusto</h2></div>
    <div class="apilada" role="img" aria-label="${partes.map((p) => `${p.texto} ${pct(p.monto)}%`).join(', ')}">
      ${partes.map((p) => `<span class="${p.clase}" style="flex:${p.monto}"></span>`).join('')}
    </div>
    ${g.leyenda(partes.map((p) => ({ clase: p.clase, texto: `${p.texto} ${pct(p.monto)}% (${f.dinero(p.monto, { entero: true })})` })))}
    ${ng.sinMarcar && pct(ng.sinMarcar) >= 30 ? '<p class="nota-panel">Al registrar un gasto, márcalo como necesidad o gusto para que esta barra diga más.</p>' : ''}
  </section>`;
}

function seccionTendencia(est, lunesHoy) {
  if (!est.movimientos.length) return '';
  const semanas = calc.tendencia(est, lunesHoy, 8);
  // El promedio solo cuenta semanas completas desde que empezaste a usar Finax.
  const primera = f.inicioSemana(est.movimientos.reduce((min, m) => (m.fecha < min ? m.fecha : min), est.movimientos[0].fecha));
  const completas = semanas.slice(0, -1).filter((s) => s.lunes >= primera);
  const promedio = completas.length ? completas.reduce((s, x) => s + x.gastos, 0) / completas.length : null;
  return `<section class="seccion">
    <div class="seccion-cab"><h2>Últimas 8 semanas</h2></div>
    ${g.tendencia(semanas)}
    ${g.leyenda([{ clase: 's-ingreso', texto: 'Ingresos' }, { clase: 's-gasto', texto: 'Gastos' }])}
    ${promedio !== null ? `<p class="nota-panel">En promedio gastas ${f.dinero(Math.round(promedio))} por semana.</p>` : ''}
  </section>`;
}

/* =========================================================
   Vista: Metas
   ========================================================= */

function vistaMetas() {
  const est = db.estado();
  const hoy = f.hoyISO();
  const cab = `<header class="titulo-vista"><h1>Metas</h1>
    <button class="icono-btn" data-accion="nueva-meta" aria-label="Nueva meta">${icono('mas', 24)}</button></header>`;
  if (!est.metas.length) return cab + panelMetaVacia();
  const total = est.metas.reduce((s, m) => s + m.objetivo, 0);
  return `${cab}
    <p class="resumen-metas">Llevas <strong>${f.dinero(calc.apartado(est))}</strong> apartado de <strong>${f.dinero(total)}</strong> en ${plural(est.metas.length, 'meta', 'metas')}.</p>
    ${est.metas.map((m) => tarjetaMeta(m, hoy)).join('')}`;
}

function tarjetaMeta(m, hoy) {
  const i = calc.infoMeta(m, hoy);
  let plan;
  if (i.completa) plan = `Juntaste los <strong>${f.dinero(m.objetivo)}</strong>. Meta cumplida.`;
  else if (i.vencida) plan = `La fecha ya pasó y faltan <strong>${f.dinero(i.restante)}</strong>. Cambia la fecha para recalcular.`;
  else if (i.porSemana) plan = `Aparta <strong>${f.dinero(i.porSemana, { entero: true })} por semana</strong> para llegar el ${f.fechaCorta(m.fechaLimite)}. Quedan ${plural(i.semanas, 'semana', 'semanas')}.`;
  else plan = `Faltan <strong>${f.dinero(i.restante)}</strong>. Ponle fecha y Finax calcula cuánto apartar por semana.`;
  return `<article class="meta">
    <div class="meta-cab">
      <span class="con-icono">${g.anillo(i.progreso, 72, 7)}${icono(db.iconoMeta(m), 28)}</span>
      <div><h2>${esc(m.nombre)}</h2><p>${f.dinero(i.aportado)} de ${f.dinero(m.objetivo)}</p></div>
      <span class="pct-meta">${Math.round(i.progreso * 100)}%</span>
    </div>
    <p class="meta-plan">${plan}</p>
    <div class="meta-acciones">
      <button class="btn-suave" data-accion="aportar" data-id="${m.id}" ${i.completa ? 'disabled' : ''}>Apartar</button>
      <button class="btn-suave" data-accion="retirar" data-id="${m.id}" ${i.aportado <= 0 ? 'disabled' : ''}>Sacar</button>
      <button class="btn-suave icono-solo" data-accion="editar-meta" data-id="${m.id}" aria-label="Editar meta">${icono('puntos')}</button>
    </div>
  </article>`;
}

/* =========================================================
   Hojas (paneles que suben desde abajo)
   ========================================================= */

let hojaActual = null;

function abrirHoja(html) {
  cerrarHoja(true);
  const velo = document.createElement('div');
  velo.className = 'velo';
  const hoja = document.createElement('section');
  hoja.className = 'hoja';
  hoja.setAttribute('role', 'dialog');
  hoja.setAttribute('aria-modal', 'true');
  hoja.innerHTML = `<div class="hoja-asa" aria-hidden="true"></div>${html}`;
  document.body.append(velo, hoja);
  requestAnimationFrame(() => { velo.classList.add('abierta'); hoja.classList.add('abierta'); });
  velo.addEventListener('click', () => cerrarHoja());
  hoja.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrarHoja(); });
  arrastrarParaCerrar(hoja);
  document.body.style.overflow = 'hidden';
  hojaActual = { velo, hoja };
  return hoja;
}

function cerrarHoja(inmediato = false) {
  if (!hojaActual) return;
  const { velo, hoja } = hojaActual;
  hojaActual = null;
  document.body.style.overflow = '';
  if (inmediato) { velo.remove(); hoja.remove(); return; }
  velo.classList.remove('abierta');
  hoja.classList.remove('abierta');
  setTimeout(() => { velo.remove(); hoja.remove(); }, 400);
}

/** Deslizar hacia abajo desde el asa o la cabecera cierra la hoja, como en iOS. */
function arrastrarParaCerrar(hoja) {
  let inicio = null;
  let dy = 0;
  hoja.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.hoja-asa, .hoja-cab') || e.target.closest('button, input')) return;
    inicio = e.clientY;
    dy = 0;
    hoja.style.transition = 'none';
    hoja.setPointerCapture(e.pointerId);
  });
  hoja.addEventListener('pointermove', (e) => {
    if (inicio === null) return;
    dy = Math.max(0, e.clientY - inicio);
    hoja.style.transform = `translateY(${dy}px)`;
  });
  const soltar = () => {
    if (inicio === null) return;
    inicio = null;
    hoja.style.transition = '';
    if (dy > 110) { hoja.style.transform = 'translateY(100%)'; cerrarHoja(); }
    else hoja.style.transform = '';
  };
  hoja.addEventListener('pointerup', soltar);
  hoja.addEventListener('pointercancel', soltar);
}

/**
 * Teclado numérico propio: más grande que el del sistema y no tapa la pantalla.
 * Mantiene el monto como texto ('1234.5') para respetar lo que se va tecleando.
 */
function teclado(contenedor, inicial, alCambiar) {
  let texto = inicial || '0';
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'borrar'];
  contenedor.innerHTML = teclas.map((k) => `<button type="button" class="tecla" data-k="${k}" aria-label="${k === 'borrar' ? 'Borrar' : k === '.' ? 'Punto decimal' : k}">${k === 'borrar' ? icono('borrar', 26) : k}</button>`).join('');
  contenedor.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (!k) return;
    const [entero, decimales] = texto.split('.');
    if (k === 'borrar') texto = texto.length > 1 ? texto.slice(0, -1) : '0';
    else if (k === '.') { if (decimales === undefined) texto += '.'; }
    else if (decimales !== undefined) { if (decimales.length < 2) texto += k; }
    else if (entero === '0') texto = k;
    else if (entero.length < 8) texto += k;
    alCambiar(texto);
  });
}

/* ---------- Registrar / editar movimiento ---------- */

function hojaMovimiento(mov = null, preset = {}) {
  const editando = Boolean(mov);
  const s = {
    tipo: mov?.tipo ?? preset.tipo ?? 'gasto',
    monto: mov ? String(mov.monto / 100) : '0',
    categoria: mov?.categoria ?? preset.categoria ?? null,
    fecha: mov?.fecha ?? f.hoyISO(),
    nota: mov?.nota ?? '',
    clase: mov?.clase ?? null,
  };
  const hoja = abrirHoja(`
    <div class="hoja-cab">
      <button class="texto-btn" data-cerrar>Cancelar</button>
      <div class="segmento" role="group" aria-label="Tipo de movimiento">
        <button data-tipo="gasto">Gasto</button><button data-tipo="ingreso">Ingreso</button>
      </div>
      <span></span>
    </div>
    <p class="monto-grande" aria-live="polite"></p>
    <div class="cats" role="group" aria-label="Categoría"></div>
    <div class="opciones">
      <label class="chip">${icono('calendario')}<span class="fecha-texto"></span><input type="date" max="${f.hoyISO()}" aria-label="Fecha"></label>
      <div class="segmento clase" role="group" aria-label="Necesidad o gusto">
        <button data-clase="necesidad">Necesidad</button><button data-clase="gusto">Gusto</button>
      </div>
    </div>
    <input class="campo nota" placeholder="Nota (opcional)" maxlength="60" enterkeyhint="done" autocomplete="off">
    <div class="teclado"></div>
    <button class="btn-primario guardar"></button>
    ${editando ? '<button class="btn-texto peligro eliminar">Eliminar movimiento</button>' : ''}
  `);
  const $ = (sel) => hoja.querySelector(sel);

  // Las categorías se redibujan solo al cambiar de tipo, para no perder el scroll horizontal.
  const pintarCategorias = () => {
    $('.cats').innerHTML = db.CATEGORIAS[s.tipo]
      .map((c) => `<button class="cat" data-cat="${c.id}"><span class="ficha">${icono(c.icono)}</span>${c.nombre}</button>`).join('');
  };
  const pintar = () => {
    hoja.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tipo === s.tipo));
    hoja.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === s.categoria));
    hoja.querySelectorAll('[data-clase]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.clase === s.clase));
    const centavos = f.aCentavos(s.monto);
    $('.monto-grande').textContent = f.montoTecleado(s.monto);
    $('.monto-grande').classList.toggle('cero', centavos === 0);
    $('.fecha-texto').textContent = ['Hoy', 'Ayer'].includes(f.etiquetaFecha(s.fecha)) ? f.etiquetaFecha(s.fecha) : f.fechaCorta(s.fecha);
    $('.clase').hidden = s.tipo !== 'gasto';
    const boton = $('.guardar');
    boton.disabled = !centavos || !s.categoria;
    boton.textContent = !centavos ? 'Escribe el monto'
      : !s.categoria ? 'Elige una categoría'
      : editando ? 'Guardar cambios'
      : s.tipo === 'gasto' ? 'Guardar gasto' : 'Guardar ingreso';
  };

  hoja.addEventListener('click', (e) => {
    const tipo = e.target.closest('[data-tipo]');
    if (tipo) {
      s.tipo = tipo.dataset.tipo;
      if (!db.CATEGORIAS[s.tipo].some((c) => c.id === s.categoria)) s.categoria = null;
      pintarCategorias();
      return pintar();
    }
    const cat = e.target.closest('[data-cat]');
    if (cat) { s.categoria = cat.dataset.cat; return pintar(); }
    const clase = e.target.closest('[data-clase]');
    if (clase) { s.clase = s.clase === clase.dataset.clase ? null : clase.dataset.clase; return pintar(); }
  });

  const fecha = $('input[type="date"]');
  fecha.value = s.fecha;
  fecha.addEventListener('change', () => { if (fecha.value) { s.fecha = fecha.value; pintar(); } });
  const nota = $('.nota');
  nota.value = s.nota;
  nota.addEventListener('input', () => { s.nota = nota.value; });
  nota.addEventListener('keydown', (e) => { if (e.key === 'Enter') nota.blur(); });
  teclado($('.teclado'), s.monto, (v) => { s.monto = v; pintar(); });

  $('.guardar').addEventListener('click', () => {
    const datos = {
      tipo: s.tipo, monto: f.aCentavos(s.monto), categoria: s.categoria, fecha: s.fecha,
      nota: s.nota.trim(), clase: s.tipo === 'gasto' ? s.clase : null,
    };
    cerrarHoja();
    if (editando) {
      db.actualizarMovimiento(mov.id, datos);
      aviso('Cambios guardados');
    } else {
      const nuevo = db.agregarMovimiento(datos);
      aviso(s.tipo === 'gasto' ? 'Gasto guardado' : 'Ingreso guardado', { texto: 'Deshacer', fn: () => db.eliminarMovimiento(nuevo.id) });
    }
  });
  $('.eliminar')?.addEventListener('click', () => {
    cerrarHoja();
    const quitado = db.eliminarMovimiento(mov.id);
    aviso('Movimiento eliminado', { texto: 'Deshacer', fn: () => db.restaurarMovimiento(quitado) });
  });

  pintarCategorias();
  pintar();
}

/* ---------- Crear / editar meta ---------- */

const leerMonto = (texto) => Math.round(parseFloat(String(texto).replace(/[^\d.]/g, '') || '0') * 100);

function hojaMeta(meta = null) {
  const editando = Boolean(meta);
  let iconoElegido = meta ? db.iconoMeta(meta) : db.ICONOS_META[0];
  const historial = editando && meta.aportes.length
    ? `<p class="ajustes-titulo">Lo que has apartado y sacado</p><ul class="historial">${[...meta.aportes].reverse().map((a) =>
      `<li><span>${f.etiquetaFecha(a.fecha)}</span><span>${f.dinero(a.monto, { signo: true })}</span></li>`).join('')}</ul>`
    : '';
  const hoja = abrirHoja(`
    <div class="hoja-cab"><button class="texto-btn" data-cerrar>Cancelar</button><h2>${editando ? 'Editar meta' : 'Nueva meta'}</h2><span></span></div>
    <label class="campo-grupo"><span>¿Para qué estás juntando?</span>
      <input class="campo" name="nombre" maxlength="40" placeholder="Ej. Laptop nueva" autocomplete="off" value="${esc(meta?.nombre ?? '')}"></label>
    <div class="campo-grupo"><span>Ícono</span>
      <div class="iconos-meta">${db.ICONOS_META.map((n) => `<button type="button" data-icono="${n}" aria-pressed="${n === iconoElegido}">${icono(n)}</button>`).join('')}</div></div>
    <label class="campo-grupo"><span>¿Cuánto necesitas?</span>
      <input class="campo" name="objetivo" inputmode="decimal" placeholder="$0.00" autocomplete="off" value="${meta ? meta.objetivo / 100 : ''}"></label>
    <label class="campo-grupo"><span>¿Para cuándo? (opcional)</span>
      <input class="campo" type="date" name="fecha" min="${f.sumarDias(f.hoyISO(), 1)}" value="${meta?.fechaLimite ?? ''}">
      <small>Con fecha, Finax te dice cuánto apartar cada semana.</small></label>
    <p class="aviso-campo" aria-live="polite"></p>
    <button class="btn-primario guardar">${editando ? 'Guardar cambios' : 'Crear meta'}</button>
    ${editando ? `${historial}<button class="btn-texto peligro eliminar">Eliminar meta</button>` : ''}
  `);
  const $ = (sel) => hoja.querySelector(sel);

  hoja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-icono]');
    if (!b) return;
    iconoElegido = b.dataset.icono;
    hoja.querySelectorAll('[data-icono]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  });

  $('.guardar').addEventListener('click', () => {
    const nombre = $('[name="nombre"]').value.trim();
    const objetivo = leerMonto($('[name="objetivo"]').value);
    const fechaLimite = $('[name="fecha"]').value || null;
    if (!nombre) return void ($('.aviso-campo').textContent = 'Escribe para qué estás juntando.');
    if (!objetivo) return void ($('.aviso-campo').textContent = 'Escribe cuánto necesitas.');
    const datos = { nombre, icono: iconoElegido, objetivo, fechaLimite };
    cerrarHoja();
    if (editando) { db.actualizarMeta(meta.id, datos); aviso('Meta actualizada'); }
    else { db.crearMeta(datos); aviso('Meta creada'); }
  });

  $('.eliminar')?.addEventListener('click', () => {
    const apartado = calc.aportadoMeta(meta);
    const extra = apartado > 0 ? ` Los ${f.dinero(apartado)} apartados regresan a tu disponible.` : '';
    if (!confirm(`¿Eliminar la meta "${meta.nombre}"?${extra}`)) return;
    cerrarHoja();
    db.eliminarMeta(meta.id);
    aviso('Meta eliminada');
  });
}

/* ---------- Apartar o sacar dinero de una meta ---------- */

function hojaAporte(meta, signo) {
  const hoy = f.hoyISO();
  const info = calc.infoMeta(meta, hoy);
  const limite = signo > 0 ? calc.disponible(db.estado()) : info.aportado;
  // Al apartar, se sugiere de una vez lo que toca esta semana.
  let monto = signo > 0 && info.porSemana && limite > 0 ? String(Math.min(info.porSemana, info.restante, limite) / 100) : '0';

  const hoja = abrirHoja(`
    <div class="hoja-cab"><button class="texto-btn" data-cerrar>Cancelar</button><h2>${signo > 0 ? 'Apartar' : 'Sacar'}</h2><span></span></div>
    <p class="sub-hoja">${esc(meta.nombre)}: llevas ${f.dinero(info.aportado)} de ${f.dinero(meta.objetivo)}</p>
    <p class="monto-grande" aria-live="polite"></p>
    <p class="aviso-campo" aria-live="polite"></p>
    <div class="teclado"></div>
    <button class="btn-primario guardar"></button>
  `);
  const $ = (sel) => hoja.querySelector(sel);

  const pintar = () => {
    const centavos = f.aCentavos(monto);
    const excede = centavos > limite;
    $('.monto-grande').textContent = f.montoTecleado(monto);
    $('.monto-grande').classList.toggle('cero', centavos === 0);
    $('.aviso-campo').textContent = excede
      ? (signo > 0 ? `Solo tienes ${f.dinero(Math.max(0, limite))} disponible.` : `En esta meta hay ${f.dinero(limite)}.`)
      : '';
    $('.guardar').disabled = !centavos || excede;
    $('.guardar').textContent = centavos ? `${signo > 0 ? 'Apartar' : 'Sacar'} ${f.dinero(centavos)}` : 'Escribe el monto';
  };
  teclado($('.teclado'), monto, (v) => { monto = v; pintar(); });

  $('.guardar').addEventListener('click', () => {
    const centavos = f.aCentavos(monto);
    cerrarHoja();
    db.aportar(meta.id, signo * centavos, hoy);
    const cumplida = signo > 0 && calc.infoMeta(meta, hoy).completa;
    aviso(cumplida ? `Meta cumplida: ${meta.nombre}` : signo > 0 ? `Apartaste ${f.dinero(centavos)}` : `Sacaste ${f.dinero(centavos)}`);
  });
  pintar();
}

/* ---------- Pagos fijos: lista, formulario y registrar un pago ---------- */

function hojaRecurrentes() {
  const est = db.estado();
  const recs = [...est.recurrentes].sort((a, b) => (calc.proximaFecha(a) ?? '').localeCompare(calc.proximaFecha(b) ?? ''));
  const total = recs.reduce((s, r) => s + calc.costoMensual(r), 0);
  const filas = recs.map((r) => {
    const proxima = calc.proximaFecha(r);
    return `<li><button class="fila" data-rec="${r.id}">
      <span class="ficha">${icono(db.categoria(r.categoria).icono)}</span>
      <span class="fila-texto"><strong>${esc(r.nombre)}</strong>
        <small>${{ semanal: 'Semanal', mensual: 'Mensual', anual: 'Anual' }[r.frecuencia]}${proxima ? `, próximo ${f.fechaCorta(proxima)}` : ''}${r.automatico ? ', se cobra solo' : ''}</small></span>
      <span class="fila-monto">${f.dinero(r.monto)}</span>
    </button></li>`;
  }).join('');
  const hoja = abrirHoja(`
    <div class="hoja-cab"><span></span><h2>Pagos fijos</h2><button class="texto-btn listo" data-cerrar>Listo</button></div>
    ${recs.length
      ? `<p class="sub-hoja">Suman ${f.dinero(total)} al mes</p><ul class="lista lista-hoja">${filas}</ul>`
      : '<p class="vacio">Agrega la renta, los servicios y tus suscripciones. Finax los aparta de lo que puedes gastar cada día.</p>'}
    <button class="btn-primario" data-nuevo>Agregar pago fijo</button>
  `);
  hoja.addEventListener('click', (e) => {
    const fila = e.target.closest('[data-rec]');
    if (fila) return hojaRecurrente(db.estado().recurrentes.find((r) => r.id === fila.dataset.rec), hojaRecurrentes);
    if (e.target.closest('[data-nuevo]')) hojaRecurrente(null, hojaRecurrentes);
  });
}

/** `volver`: hoja a la que se regresa al terminar (la lista, si se abrió desde ahí). */
function hojaRecurrente(rec = null, volver = null) {
  const editando = Boolean(rec);
  const hoy = f.hoyISO();
  const proxima = rec ? calc.proximaFecha(rec) ?? hoy : hoy;
  const s = { categoria: rec?.categoria ?? 'suscripciones', frecuencia: rec?.frecuencia ?? 'mensual' };
  const frecuencias = [['semanal', 'Semanal'], ['mensual', 'Mensual'], ['anual', 'Anual']];
  const hoja = abrirHoja(`
    <div class="hoja-cab"><button class="texto-btn" data-cerrar>Cancelar</button><h2>${editando ? 'Editar pago fijo' : 'Nuevo pago fijo'}</h2><span></span></div>
    <label class="campo-grupo"><span>¿Qué pagas?</span>
      <input class="campo" name="nombre" maxlength="40" placeholder="Ej. Renta, Spotify, internet" autocomplete="off" value="${esc(rec?.nombre ?? '')}"></label>
    <label class="campo-grupo"><span>¿Cuánto?</span>
      <input class="campo" name="monto" inputmode="decimal" placeholder="$0.00" autocomplete="off" value="${rec ? rec.monto / 100 : ''}">
      <small>Si cambia cada vez, como la luz, pon un aproximado. Al pagar lo ajustas.</small></label>
    <div class="campo-grupo"><span>Categoría</span>
      <div class="cats">${db.CATEGORIAS.gasto.map((c) => `<button type="button" class="cat" data-cat="${c.id}" aria-pressed="${c.id === s.categoria}"><span class="ficha">${icono(c.icono)}</span>${c.nombre}</button>`).join('')}</div></div>
    <div class="campo-grupo"><span>¿Cada cuánto?</span>
      <div class="segmento" role="group" aria-label="Frecuencia">${frecuencias.map(([v, t]) => `<button type="button" data-frec="${v}" aria-pressed="${v === s.frecuencia}">${t}</button>`).join('')}</div></div>
    <label class="campo-grupo"><span>Próximo pago</span>
      <input class="campo" type="date" name="fecha" ${editando ? '' : `min="${hoy}"`} value="${proxima}">
      <small class="desc-frecuencia"></small></label>
    <div class="ajustes-grupo"><label class="ajuste"><span>Se cobra solo</span><input type="checkbox" class="interruptor" name="automatico" ${rec?.automatico ? 'checked' : ''}></label></div>
    <p class="ajustes-nota">Actívalo para suscripciones que se cargan a tu tarjeta: Finax registra el gasto ese día sin que hagas nada.</p>
    <p class="aviso-campo" aria-live="polite"></p>
    <button class="btn-primario guardar">${editando ? 'Guardar cambios' : 'Agregar pago fijo'}</button>
    ${editando ? '<button class="btn-texto peligro eliminar">Eliminar pago fijo</button>' : ''}
  `);
  const $ = (sel) => hoja.querySelector(sel);
  const terminar = () => (volver ? volver() : cerrarHoja());
  const pintarFrecuencia = () => {
    const fecha = $('[name="fecha"]').value;
    $('.desc-frecuencia').textContent = fecha ? `${frecuenciaTexto(s.frecuencia, fecha)}.` : '';
  };

  hoja.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      s.categoria = cat.dataset.cat;
      hoja.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-pressed', b === cat));
    }
    const frec = e.target.closest('[data-frec]');
    if (frec) {
      s.frecuencia = frec.dataset.frec;
      hoja.querySelectorAll('[data-frec]').forEach((b) => b.setAttribute('aria-pressed', b === frec));
      pintarFrecuencia();
    }
  });
  $('[name="fecha"]').addEventListener('change', pintarFrecuencia);

  $('.guardar').addEventListener('click', () => {
    const nombre = $('[name="nombre"]').value.trim();
    const monto = leerMonto($('[name="monto"]').value);
    const fecha = $('[name="fecha"]').value;
    const avisoCampo = $('.aviso-campo');
    if (!nombre) return void (avisoCampo.textContent = 'Escribe qué pagas.');
    if (!monto) return void (avisoCampo.textContent = 'Escribe cuánto pagas.');
    if (!fecha) return void (avisoCampo.textContent = 'Elige la fecha del próximo pago.');
    const datos = { nombre, monto, categoria: s.categoria, frecuencia: s.frecuencia, automatico: $('[name="automatico"]').checked };
    // Si cambia el calendario, se empieza a contar desde la nueva fecha.
    if (!editando || fecha !== proxima || s.frecuencia !== rec.frecuencia) Object.assign(datos, { inicio: fecha, pagadoHasta: null });
    db.guardarRecurrente(editando ? { id: rec.id, ...datos } : datos);
    // Si se cobra solo y la fecha es hoy, se registra de una vez.
    if (!cobrarPendientes()) aviso(editando ? 'Pago fijo actualizado' : 'Pago fijo agregado');
    terminar();
  });

  $('.eliminar')?.addEventListener('click', () => {
    if (!confirm(`¿Eliminar "${rec.nombre}"? Los pagos que ya registraste se quedan en tus movimientos.`)) return;
    db.eliminarRecurrente(rec.id);
    aviso('Pago fijo eliminado');
    terminar();
  });

  pintarFrecuencia();
}

/** Registrar (con el monto real) u omitir la siguiente fecha de un pago fijo. */
function hojaPago(rec) {
  const hoy = f.hoyISO();
  const fecha = calc.proximaFecha(rec);
  let monto = String(rec.monto / 100);
  const hoja = abrirHoja(`
    <div class="hoja-cab"><button class="texto-btn" data-cerrar>Cancelar</button><h2>${esc(rec.nombre)}</h2><span></span></div>
    <p class="sub-hoja">${cuandoVence(f.diffDias(hoy, fecha), fecha)}. ${frecuenciaTexto(rec.frecuencia, rec.inicio)}.</p>
    <p class="monto-grande" aria-live="polite"></p>
    <div class="teclado"></div>
    <button class="btn-primario guardar"></button>
    <button class="btn-texto omitir">Omitir esta vez</button>
    <button class="btn-texto editar">Editar pago fijo</button>
  `);
  const $ = (sel) => hoja.querySelector(sel);
  const pintar = () => {
    const centavos = f.aCentavos(monto);
    $('.monto-grande').textContent = f.montoTecleado(monto);
    $('.monto-grande').classList.toggle('cero', centavos === 0);
    $('.guardar').disabled = !centavos;
    $('.guardar').textContent = centavos ? `Registrar pago de ${f.dinero(centavos)}` : 'Escribe el monto';
  };
  teclado($('.teclado'), monto, (v) => { monto = v; pintar(); });

  // El gasto se registra hoy, que es cuando sale el dinero, aunque venza otro día.
  $('.guardar').addEventListener('click', () => {
    const atencion = db.atenderRecurrente(rec.id, fecha, { monto: f.aCentavos(monto), fecha: hoy });
    cerrarHoja();
    aviso('Pago registrado', { texto: 'Deshacer', fn: () => db.deshacerAtencion(atencion) });
  });
  $('.omitir').addEventListener('click', () => {
    const atencion = db.atenderRecurrente(rec.id, fecha);
    cerrarHoja();
    aviso(`Omitiste el pago del ${f.fechaCorta(fecha)}`, { texto: 'Deshacer', fn: () => db.deshacerAtencion(atencion) });
  });
  $('.editar').addEventListener('click', () => hojaRecurrente(rec));
  pintar();
}

/* ---------- Ajustes ---------- */

function hojaAjustes() {
  const a = db.estado().ajustes;
  const temas = [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']];
  const hoja = abrirHoja(`
    <div class="hoja-cab"><span></span><h2>Ajustes</h2><button class="texto-btn listo" data-cerrar>Listo</button></div>

    <p class="ajustes-titulo">Apariencia</p>
    <div class="segmento" role="group" aria-label="Tema">${temas.map(([v, t]) => `<button data-tema="${v}" aria-pressed="${a.tema === v}">${t}</button>`).join('')}</div>

    <p class="ajustes-titulo">Privacidad</p>
    <div class="ajustes-grupo"><label class="ajuste"><span>Ocultar montos</span><input type="checkbox" class="interruptor" name="ocultar" ${a.ocultar ? 'checked' : ''}></label></div>
    <p class="ajustes-nota">Útil en público. También puedes usar el ojo de Inicio.</p>

    <p class="ajustes-titulo">Puedes gastar hoy</p>
    <label class="campo-grupo"><span>Colchón que no quieres tocar</span>
      <input class="campo" name="colchon" inputmode="decimal" placeholder="$0" autocomplete="off" value="${a.colchon ? a.colchon / 100 : ''}">
      <small>Finax lo descuenta antes de calcular cuánto puedes gastar al día.</small></label>

    <p class="ajustes-titulo">Tus datos</p>
    <div class="ajustes-grupo">
      <button class="ajuste exportar"><span>Guardar respaldo</span>${icono('derecha', 18)}</button>
      <label class="ajuste"><span>Restaurar respaldo</span>${icono('derecha', 18)}<input type="file" class="importar" accept="application/json,.json" hidden></label>
    </div>
    <p class="ajustes-nota">Tus datos viven solo en este iPhone. Guarda un respaldo de vez en cuando en Archivos o en iCloud Drive.</p>
    <button class="btn-texto peligro borrar">Borrar todos los datos</button>
    <p class="ajustes-nota centrado">Finax 1.2</p>
  `);
  const $ = (sel) => hoja.querySelector(sel);

  hoja.addEventListener('click', (e) => {
    const tema = e.target.closest('[data-tema]');
    if (!tema) return;
    db.setAjuste('tema', tema.dataset.tema);
    hoja.querySelectorAll('[data-tema]').forEach((b) => b.setAttribute('aria-pressed', b === tema));
  });
  $('[name="ocultar"]').addEventListener('change', (e) => db.setAjuste('ocultar', e.target.checked));
  $('[name="colchon"]').addEventListener('change', (e) => db.setAjuste('colchon', leerMonto(e.target.value)));
  $('.exportar').addEventListener('click', exportarRespaldo);
  $('.importar').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    if (!confirm('Esto reemplaza tus datos actuales con los del respaldo. ¿Continuar?')) return;
    try {
      db.importar(await archivo.text());
      cerrarHoja();
      aviso('Respaldo restaurado');
    } catch (error) {
      alert(error instanceof SyntaxError ? 'El archivo no es un respaldo de Finax.' : error.message);
    }
  });
  $('.borrar').addEventListener('click', () => {
    if (!confirm('¿Borrar todos tus movimientos y metas? Esto no se puede deshacer.')) return;
    db.borrarTodo();
    cerrarHoja();
    aviso('Datos borrados');
  });
}

/**
 * En el iPhone, el menú Compartir permite guardar el archivo en Archivos o
 * iCloud Drive. Si el navegador no lo soporta, se descarga normal.
 */
async function exportarRespaldo() {
  const nombre = `finax-respaldo-${f.hoyISO()}.json`;
  const archivo = new File([db.exportar()], nombre, { type: 'application/json' });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: 'Respaldo de Finax' });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(archivo);
  Object.assign(document.createElement('a'), { href: url, download: nombre }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================================================
   Aviso inferior y detalle de gráficas
   ========================================================= */

let temporizadorAviso;
function aviso(texto, accion) {
  const el = document.getElementById('aviso');
  el.innerHTML = `<span>${esc(texto)}</span>${accion ? `<button>${accion.texto}</button>` : ''}`;
  if (accion) {
    el.querySelector('button').onclick = () => { accion.fn(); el.classList.remove('visible'); };
  }
  el.classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => el.classList.remove('visible'), 4000);
}

/** Al tocar (o pasar el ratón sobre) una barra, se muestra el detalle del día o la semana. */
function iniciarDetalleGraficas() {
  const tip = document.getElementById('tip');
  let activa = null;
  const ocultar = () => {
    tip.classList.remove('visible');
    activa?.classList.remove('activa');
    activa = null;
  };
  const mostrar = (zona) => {
    if (activa === zona) return;
    activa?.classList.remove('activa');
    activa = zona;
    zona.classList.add('activa');
    const [titulo, ...filas] = zona.dataset.tip.split('\n');
    tip.innerHTML = `<b>${esc(titulo.charAt(0).toUpperCase() + titulo.slice(1))}</b>${filas.map((fila) => {
      const [nombre, valor] = fila.split('|');
      return `<div><span>${esc(nombre)}</span><span>${esc(valor)}</span></div>`;
    }).join('')}`;
    tip.classList.add('visible');
    const r = zona.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - t.width - 12, Math.max(12, r.left + r.width / 2 - t.width / 2))}px`;
    tip.style.top = `${Math.max(12, r.top - t.height - 6)}px`;
  };
  document.addEventListener('pointerdown', (e) => {
    const zona = e.target.closest?.('.zona');
    if (zona) mostrar(zona);
    else ocultar();
  });
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const zona = e.target.closest?.('.zona');
    if (zona) mostrar(zona);
    else if (activa) ocultar();
  });
  window.addEventListener('scroll', ocultar, { passive: true });
}

iniciar();
