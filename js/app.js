import { ATRIBUTOS, NOMBRE_ATRIBUTO, COLORES, CATEGORIAS, TIPOS_PRESENCIA, MOMENTOS, LUCES, CLIMAS, TEMPERATURAS, fichaVacia } from './datos.js?v=20261118c';
import { crearSync, claveSegura } from './sync.js?v=20261118c';
import { vista as vistaReglasSRD } from './reglas.js?v=20261118c';
import { tirarExpr, tirarD20, bonoNum, modDe, promedio, saludAprox } from './dados.js?v=20261118c';
import { ARMAS, ARMADURAS, MONEDAS, competenteCon } from './equipo.js?v=20261118c';

/* ================= UTILIDADES ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } },
};
const nuevoId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const lineas = (t) => String(t || '').split('\n').map((s) => s.trim()).filter(Boolean);
const mod = (v) => { const m = Math.floor((v - 10) / 2); return (m >= 0 ? '+' : '') + m; };
const RUTAS = ['mesa', 'ficha', 'historia', 'reglas', 'dm'];
const TIPOS_IMG = { mapa: 'Mapa', retrato: 'Retrato', ilustracion: 'Ilustración' };
const PLURAL_IMG = { mapa: 'Mapas', retrato: 'Retratos', ilustracion: 'Ilustraciones' };
const TIPO = { hecho: 'Lo vimos', dicho: 'Lo dijeron', misterio: 'Misterio' };

const ui = {
  ruta: 'mesa',
  tv: false,
  yo: ls.get('mesa-yo'),
  desbloqueos: JSON.parse(ls.get('mesa-desbloqueos') || '{}'), // id -> PIN con que se abrió
  ver: null,
  pin: '',
  pinError: false,
  borradores: {},
  confirmar: null,
  moverFichas: false,
  arrastrando: false,
  dmTab: 'mesa',
  editandoPj: null, // id del personaje en el editor, o 'nuevo'
  editandoEnt: null, // { cat, id } de la entrada de Historia en edición
  pistaPara: null,
  prepCombate: false,
  diarioDe: null,
  ultimoTurno: 'inicio',
  ocupado: false,
  reglas: { jugador: { q: '', sec: null, qPrevia: '' }, dm: { q: '', sec: null, qPrevia: '' } },
  editandoPl: null, // id de la plantilla del banco en edición, o 'nuevo'
  tiradas: [], // últimas tiradas del DM (solo en este dispositivo)
  modoTirada: 'normal',
  abiertos: new Set(), // perfiles desplegados (para que no se cierren al llegar cambios)
};
ui.ver = ui.yo;
let sync;
let E;

function aviso(t) {
  const a = $('#aviso');
  a.textContent = t; a.classList.add('ver');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove('ver'), 2600);
}
function hora(ts) {
  if (!ts) return '';
  const d = new Date(ts); const hoy = new Date();
  const h = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === hoy.toDateString() ? h : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/* ---------- acceso al estado ---------- */
const imgs = () => E.imagenes || {};
const srcDe = (id) => (id && imgs()[id] ? imgs()[id].src : '');
const mapas = () => Object.entries(imgs()).filter(([, i]) => i.tipo === 'mapa');
const retratos = () => Object.entries(imgs()).filter(([, i]) => i.tipo === 'retrato');
const porOrden = (obj, campo = (x) => x.orden) => Object.entries(obj || {}).sort((a, b) => (campo(a[1]) || 0) - (campo(b[1]) || 0));
// Grupos de la Historia (arcos, capítulos…): grupos/<id> = { nombre, orden }; cada entrada guarda grupo: <id>
const listaGrupos = () => porOrden(E.grupos).filter(([, g]) => g && g.nombre);
const grupoDe = (x) => (x && x.grupo && (E.grupos || {})[x.grupo] && E.grupos[x.grupo].nombre ? x.grupo : '');
const plegados = new Set(JSON.parse(ls.get('mesa-plegados') || '[]'));
const abiertoAttr = (clave) => (plegados.has(clave) ? '' : ' open');
const listaPj = () => porOrden(E.personajes, (p) => (p.ficha || {}).orden).filter(([, p]) => p.ficha);
const F = (id) => ((E.personajes || {})[id] || {}).ficha || {};
const S = (id) => ((E.personajes || {})[id] || {}).estado || {};
const tienePv = (id) => +F(id).pvMax > 0;
const pvDe = (id) => { const f = F(id); const v = S(id).pv; return Math.min(+f.pvMax || 0, v ?? +f.pvMax ?? 0); };
const dato = (v) => (v === '' || v == null ? '—' : v);
const secretosDe = (id) => (((E.personajes || {})[id] || {}).dm || {}).secretos || '';
const espDe = (id, n) => { const max = +((F(id).espacios || {})['n' + n] || 0); const v = (S(id).espacios || {})['n' + n]; return Math.min(max, v ?? max); };
const recDe = (id, r) => { const v = (S(id).recursos || {})[r.id]; return Math.min(r.max, v ?? r.max); };
const pinDe = (id) => (id === 'dm' ? (E.campana || {}).pinDM : F(id).pin);
const abierto = (id) => !!pinDe(id) && ui.desbloqueos[id] === pinDe(id);
const esDM = () => abierto('dm');
const puedeVer = (id) => abierto(id) || esDM();
const nivelPv = (pv, max) => (!max ? '' : pv / max <= 0.25 ? 'baja' : pv / max <= 0.5 ? 'media' : '');
const pct = (a, b) => (b ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);
// Banco de PNJ: banco/<id> = plantilla. Las presencias creadas desde el banco guardan
// plantilla (id), pvMax, ca, ini y ataques propios; su PV es pvMax − dano.
const listaBanco = () => porOrden(E.banco).filter(([, t]) => t && t.nombre);
const plantillaDe = (p) => (p && p.plantilla && (E.banco || {})[p.plantilla]) || null;
const pvPr = (p) => Math.max(0, (+p.pvMax || 0) - (+p.dano || 0));
const verOcultos = () => esDM() && !ui.tv; // el DM ve lo oculto en su pantalla, nunca en el modo TV
const presenciasVisibles = () => porOrden(E.presencias).filter(([, p]) => !p.oculto || verOcultos());
function guardarDesbloqueos() { ls.set('mesa-desbloqueos', JSON.stringify(ui.desbloqueos)); }

function avatar(id, clase = 'pj-retrato') {
  const f = F(id);
  const src = srcDe(f.retrato);
  if (src) return `<img class="${clase}" src="${src}" alt="" style="--c:${f.color}">`;
  const ini = (f.nombre || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return `<span class="${clase} avatar-ini" style="--c:${f.color}" aria-hidden="true">${esc(ini)}</span>`;
}

/* ================= MESA ================= */
function mapaActual() {
  const e = E.escena || {};
  if (imgs()[e.mapa] && imgs()[e.mapa].tipo === 'mapa') return e.mapa;
  const m = mapas(); return m.length ? m[0][0] : null;
}

function htmlMapa(editable) {
  const clave = mapaActual();
  if (!clave) return `<div class="vacio">Todavía no hay mapas. ${esDM() ? 'Súbelos en DM → Biblioteca.' : 'El DM puede subirlos en su Biblioteca.'}</div>`;
  const mapa = imgs()[clave];
  const pos = (E.fichas || {})[clave] || {};
  const fichas = [];
  listaPj().forEach(([id], i) => {
    const p = pos[id] || { x: 20 + i * 7, y: 92 };
    const f = F(id); const src = srcDe(f.retrato);
    fichas.push(`<div class="ficha-mapa" data-ficha="${esc(id)}" style="left:${p.x}%;top:${p.y}%;--c:${f.color}${src ? `;background-image:url(${src})` : ''}" role="img" aria-label="${esc(f.nombre)}">${src ? '' : esc((f.nombre || '?')[0].toUpperCase())}<span class="etq">${esc(f.nombre)}</span></div>`);
  });
  presenciasVisibles().forEach(([k, pr], i) => {
    const p = pos[k] || { x: 92, y: 10 + i * 9 };
    const src = srcDe(pr.img);
    const letra = esc((pr.nombre || '?').slice(0, 2).replace(/^./, (c) => c.toUpperCase()));
    fichas.push(`<div class="ficha-mapa presencia ${esc(pr.tipo || 'enemigo')}${pr.derrotado ? ' caido' : ''}${pr.oculto ? ' oculta' : ''}" data-ficha="${esc(k)}" style="left:${p.x}%;top:${p.y}%${src ? `;background-image:url(${src})` : ''}" role="img" aria-label="${esc(pr.nombre)}">${src ? '' : letra}<span class="etq">${esc(pr.nombre)}</span></div>`);
  });
  return `<div class="mapa${editable ? ' editable' : ''}" id="mapa" data-mapa="${esc(clave)}"><img src="${mapa.src}" alt="Mapa: ${esc(mapa.nombre)}" draggable="false">${fichas.join('')}</div>`;
}

function htmlEscenaVisual() {
  const ilu = (E.escena || {}).ilustracion;
  if (ilu && imgs()[ilu]) return `<figure class="ilustracion"><img src="${imgs()[ilu].src}" alt="${esc(imgs()[ilu].nombre)}" data-accion="ver-imagen" data-src="${esc(imgs()[ilu].src)}"><figcaption>${esc(imgs()[ilu].nombre)}</figcaption></figure>`;
  return htmlMapa(false);
}

// Entrada de la Historia que usa una imagen (la primera revelada, si hay varias)
function entradaDeImagen(imgId) {
  if (!imgId) return null;
  const hallados = [];
  for (const [cat, lista] of Object.entries(E.enciclopedia || {})) {
    if (cat === 'misterios') continue;
    for (const [id, x] of porOrden(lista || {})) if (x && x.img === imgId) hallados.push([cat, id, x]);
  }
  if (!hallados.length) {
    // sin enlace directo: entrada que la espera por nombre o que se llama igual que la imagen
    const nombre = norm((imgs()[imgId] || {}).nombre);
    if (nombre) for (const [cat, lista] of Object.entries(E.enciclopedia || {})) {
      if (cat === 'misterios') continue;
      for (const [id, x] of porOrden(lista || {})) if (x && (norm(x.imgPendiente) === nombre || norm(x.titulo) === nombre)) hallados.push([cat, id, x]);
    }
  }
  return hallados.find(([, , x]) => !x.oculto) || hallados[0] || null;
}

// Texto de la entrada cuya imagen está en la mesa (nunca las notas del DM)
function htmlRevelado() {
  const ilu0 = (E.escena || {}).ilustracion;
  const ilu = ilu0 && imgs()[ilu0] ? ilu0 : mapaActual(); // la ilustración en pantalla, o si no, el mapa
  if (!ilu || !imgs()[ilu]) return '';
  const h = entradaDeImagen(ilu);
  if (!h || h[2].oculto) {
    if (ui.tv || !esDM() || (!h && ilu !== ilu0)) return ''; // un mapa sin entrada no necesita aviso
    return `<section class="panel revelado-vacio"><p class="tenue" style="margin:0;font-size:15px">${h ? `La entrada <b>${esc(h[2].titulo)}</b> está sin revelar: revélala en DM → Biblioteca para que su texto salga aquí.` : `La imagen <b>${esc(imgs()[ilu].nombre)}</b> no tiene una entrada en la Historia. Crea una o edita una existente y elige esta imagen para que su texto salga aquí.`} <span style="font-size:13px">(Solo lo ves tú como DM.)</span></p></section>`;
  }
  const x = h[2];
  return `<section class="pergamino revelado">
    <h2 class="panel-titulo">${esc(CATEGORIAS[h[0]] ? CATEGORIAS[h[0]].singular : 'En la mesa')}</h2>
    <h3 class="revelado-titulo">${esc(x.titulo)}</h3>
    ${x.sub ? `<p class="revelado-sub">${esc(x.sub)}</p>` : ''}
    ${x.texto ? `<p class="revelado-texto">${esc(x.texto)}</p>` : ''}
    ${listasVistoDicho(x, h[0] === 'pnj' ? 'Lo vimos' : 'Novedades')}
  </section>`;
}

function pjMini(id) {
  const f = F(id); const s = S(id); const pv = pvDe(id);
  const est = Object.keys(s.estados || {});
  return `<button type="button" class="pj${esTurnoDe('pj', id) ? ' turno' : ''}" style="--c:${f.color};text-align:left" data-accion="elegir" data-id="${esc(id)}">
    ${avatar(id)}
    <div>
      <div class="pj-fila"><span class="pj-nombre">${esc(f.nombre)}${ui.yo === id ? '<span class="tu">TÚ</span>' : ''}</span><span class="pv-num num">${tienePv(id) ? `<b>${pv}</b>/${f.pvMax} PV` : 'PV por definir'}</span></div>
      <div class="pj-fila"><span class="pj-clase">${esc([f.raza, f.clase].filter(Boolean).join(' · '))}</span><span class="pj-clase num">CA ${esc(dato(caDe(id).valor))}</span></div>
      ${tienePv(id) ? `<div class="barra-pv ${nivelPv(pv, f.pvMax)}"><span style="width:${pct(pv, f.pvMax)}%"></span></div>` : ''}
      ${(s.concentra || est.length || (tienePv(id) && pv <= 0)) ? `<div class="pj-chips">${tienePv(id) && pv <= 0 ? '<span class="chip malo">Inconsciente</span>' : ''}${s.concentra ? `<span class="chip conc">◈ ${esc(s.concentra)}</span>` : ''}${est.map((x) => `<span class="chip est">${esc(x)}</span>`).join('')}</div>` : ''}
    </div>
  </button>`;
}

function htmlPresencias() {
  const lista = presenciasVisibles();
  if (!lista.length) return '';
  return `<section class="panel">
    <h2 class="panel-titulo">En escena</h2>
    <div class="guardianes">${lista.map(([k, p]) => {
      const est = Object.keys(p.estados || {});
      // Con PV del banco la mesa muestra la salud aproximada, nunca los números
      const salud = !p.derrotado && +p.pvMax > 0 ? saludAprox(pvPr(p), +p.pvMax) : null;
      const info = p.derrotado ? ' · Derrotado' : salud ? '' : p.dano ? ` · ${p.dano} de daño recibido` : '';
      return `<div class="guardian ${esc(p.tipo || 'enemigo')}${p.derrotado ? ' caido' : ''}${p.oculto ? ' oculta' : ''}${esTurnoDe('pr', k) ? ' turno' : ''}">${srcDe(p.img) ? `<img class="guardian-foto" src="${srcDe(p.img)}" alt="">` : ''}<div style="flex:1;min-width:0"><div class="guardian-nombre">${esc(p.nombre)}${p.oculto ? ' <span class="tenue">(oculto)</span>' : ''}</div><div class="guardian-info">${esc(TIPOS_PRESENCIA[p.tipo] || 'Enemigo')}${info}</div></div><div class="pj-chips" style="justify-content:flex-end;margin:0">${salud ? `<span class="chip salud ${salud.clase}">${salud.texto}</span>` : ''}${est.map((x) => `<span class="chip est">${esc(x)}</span>`).join('')}</div></div>`;
    }).join('')}</div>
  </section>`;
}

/* ---------- iniciativa, ambiente y relojes ---------- */
const ICONOS = {
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  'sol-bajo': '<path d="M3 17h18M7 17a5 5 0 0110 0M12 6v3M5.6 9.6l1.8 1.8M18.4 9.6l-1.8 1.8M6 21h12"/>',
  luna: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  nube: '<path d="M7 18h10a4 4 0 000-8 6 6 0 00-11.5 2A3 3 0 007 18z"/>',
  lluvia: '<path d="M7 14h10a4 4 0 000-8 6 6 0 00-11.5 2A3 3 0 007 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  niebla: '<path d="M4 8h16M3 12h18M5 16h14M8 20h8"/>',
  viento: '<path d="M3 9h11a3 3 0 10-3-3M3 15h15a3 3 0 11-3 3"/>',
  rayo: '<path d="M7 13h10a4 4 0 000-8 6 6 0 00-11.5 2A3 3 0 007 13z"/><path d="M12 14l-2 4h4l-2 4"/>',
  nieve: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
  luz: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9V16h7v-2.1A6 6 0 0012 3z"/>',
  termo: '<path d="M14 14.8V5a2 2 0 10-4 0v9.8a4 4 0 104 0z"/>',
  espadas: '<path d="M4 4l10 10M14 14l2 4 2-2-4-2M20 4L10 14M10 14l-2 4-2-2 4-2"/>',
};
const icono = (k) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[k] || ''}</svg>`;
const COLOR_TIPO = { enemigo: '#e0564b', aliado: '#79c27a', neutral: '#d8dbe8' };

const C = () => E.combate || {};
const iniNum = (p) => (p.ini === '' || p.ini == null ? -999 : +p.ini);
function participantes() {
  return Object.entries(C().participantes || {}).sort((a, b) => iniNum(b[1]) - iniNum(a[1]) || (+b[1].desempate || 0) - (+a[1].desempate || 0) || String(a[1].nombre).localeCompare(String(b[1].nombre)));
}
const presencia = (k) => (E.presencias || {})[k] || null;
const derrotadoP = (p) => p.tipo === 'pr' && !!(presencia(p.ref) || {}).derrotado;
const ocultoP = (p) => p.tipo === 'pr' && !!(presencia(p.ref) || {}).oculto;
const nombreP = (p) => (p.tipo === 'pj' ? F(p.ref).nombre : p.tipo === 'pr' ? (presencia(p.ref) || {}).nombre : '') || p.nombre;
const colorP = (p) => (p.tipo === 'pj' ? F(p.ref).color : p.tipo === 'pr' ? COLOR_TIPO[(presencia(p.ref) || {}).tipo] || COLOR_TIPO.enemigo : '#a89e8b');
const turnoDe = () => { const c = C(); return c.activo ? (c.participantes || {})[c.turno] || null : null; };
const esTurnoDe = (tipo, ref) => { const t = turnoDe(); return !!t && t.tipo === tipo && t.ref === ref; };

function htmlIniciativa() {
  const c = C(); if (!c.activo) return '';
  return `<section class="panel iniciativa">
    <h2 class="panel-titulo">${icono('espadas')} Iniciativa <span class="extra">Ronda ${c.ronda}</span></h2>
    <ol class="orden">${participantes().filter(([, p]) => !ocultoP(p) || verOcultos()).map(([pid, p]) => `<li class="${pid === c.turno ? 'actual' : ''}${derrotadoP(p) ? ' caido' : ''}" style="--c:${colorP(p)}"><span class="ini num">${p.ini === '' || p.ini == null ? '—' : esc(p.ini)}</span><span class="quien">${esc(nombreP(p))}${ocultoP(p) ? ' <span class="tenue">(oculto)</span>' : ''}</span>${pid === c.turno ? '<span class="su-turno">Su turno</span>' : ''}</li>`).join('')}</ol>
  </section>`;
}

function ambienteActual() {
  const a = E.ambiente || {};
  return { a, m: MOMENTOS[a.momento] || MOMENTOS.manana, l: LUCES[a.luz] || LUCES.brillante, cl: CLIMAS[a.clima] || CLIMAS.despejado, t: TEMPERATURAS[a.temperatura] || TEMPERATURAS.templado };
}
function htmlAmbiente() {
  const { a, m, l, cl, t } = ambienteActual();
  const reglas = [[l.nombre, l.regla], [cl.nombre, cl.regla], [t.nombre, t.regla]].filter(([, r]) => r);
  return `<section class="panel ambiente">
    <div class="amb-cab">${icono(m.icono)}<div style="min-width:0"><div class="amb-dia">Día ${esc(a.dia || 1)} · ${esc(m.nombre)}</div>
      <div class="amb-chips"><span class="chip">${icono('luz')}${esc(l.nombre)}</span><span class="chip">${icono(cl.icono)}${esc(cl.nombre)}</span>${a.temperatura && a.temperatura !== 'templado' ? `<span class="chip malo">${icono('termo')}${esc(t.nombre)}</span>` : ''}</div></div></div>
    ${a.sensacion ? `<p class="sensacion">${esc(a.sensacion)}</p>` : ''}
    ${reglas.length ? `<ul class="reglas">${reglas.map(([n, r]) => `<li><b>${esc(n)}:</b> ${esc(r)}</li>`).join('')}</ul>` : ''}
  </section>`;
}

function svgReloj(llenos, total, tam = 64) {
  const r = 28, cx = 32, cy = 32; let d = '';
  for (let i = 0; i < total; i++) {
    const a0 = (i / total) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / total) * 2 * Math.PI - Math.PI / 2;
    d += `<path d="M${cx} ${cy}L${(cx + r * Math.cos(a0)).toFixed(2)} ${(cy + r * Math.sin(a0)).toFixed(2)}A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(2)} ${(cy + r * Math.sin(a1)).toFixed(2)}Z"${i < llenos ? ' class="lleno"' : ''}/>`;
  }
  return `<svg class="reloj" viewBox="0 0 64 64" width="${tam}" height="${tam}" aria-hidden="true">${d}</svg>`;
}
function htmlRelojes() {
  const lista = porOrden(E.relojes); if (!lista.length) return '';
  return `<section class="panel"><h2 class="panel-titulo">Relojes</h2><div class="relojes">${lista.map(([, r]) => { const ok = (r.llenos || 0) >= r.segmentos; return `<div class="reloj-item${ok ? ' completo' : ''}">${svgReloj(r.llenos || 0, r.segmentos)}<div style="min-width:0"><div class="reloj-nombre">${esc(r.nombre)}</div><div class="tenue num" style="font-size:14px">${r.llenos || 0} de ${r.segmentos}${ok ? ' · ¡Se cumplió!' : ''}</div></div></div>`; }).join('')}</div></section>`;
}

function vistaMesa() {
  const e = E.escena || {};
  const pjs = listaPj();
  if (!pjs.length && !e.lugar) {
    return `<section class="panel bienvenida">
      <h1>${esc((E.campana || {}).nombre || 'Mi campaña')}</h1>
      <p>La mesa está lista para una campaña nueva.</p>
      <ol>
        <li><b>DM:</b> entra a <a href="#dm">DM</a> y crea tu PIN.</li>
        <li><b>Personajes:</b> créalos desde DM → Personajes, o que cada jugador cree el suyo en <a href="#ficha">Mi personaje</a>.</li>
        <li><b>Mapas e imágenes:</b> súbelos en DM → Biblioteca.</li>
        <li><b>A jugar:</b> pon esta pantalla en <a href="#tv">Modo TV</a> y lleva la iniciativa, el ambiente y los relojes desde DM → Mesa.</li>
      </ol>
    </section>`;
  }
  return `<div class="mesa">
    <div class="columna">
      ${e.alerta ? `<div class="alerta" role="alert"><span class="alerta-icono" aria-hidden="true"></span><span>${esc(e.alerta)}</span></div>` : ''}
      <section class="panel">
        <div class="lugar"><h1>${esc(e.lugar || 'Sin lugar definido')}</h1>${ui.tv ? `<a class="btn btn-peq" href="#mesa">Salir del modo TV</a>` : `<a class="btn btn-peq solo-grande" href="#tv">Modo TV</a>`}</div>
        ${e.texto ? `<p class="escena-texto" style="margin-top:8px">${esc(e.texto)}</p>` : ''}
      </section>
      ${htmlEscenaVisual()}
    </div>
    <div class="columna">
      ${htmlIniciativa()}
      ${htmlRegistro()}
      ${htmlAmbiente()}
      ${htmlRelojes()}
      ${htmlRevelado()}
      ${htmlPresencias()}
    </div>
    <section class="panel mesa-grupo">
      <h2 class="panel-titulo">El grupo</h2>
      ${pjs.length ? `<div class="grupo">${pjs.map(([id]) => pjMini(id)).join('')}</div>` : '<p class="tenue" style="margin:0">Todavía no hay personajes.</p>'}
    </section>
  </div>`;
}

/* ================= PIN ================= */
function vistaPin(id) {
  const esDm = id === 'dm';
  const f = esDm ? {} : F(id);
  return `<div class="panel pin" style="--c:${esDm ? 'var(--cristal)' : f.color};max-width:420px">
    ${esDm ? '<span class="marca-cristal" style="width:60px;height:68px" aria-hidden="true"></span>' : avatar(id, 'pin-avatar')}
    <h1 style="font-size:24px;color:var(--oro-claro)">${esDm ? 'Dungeon Master' : esc(f.nombre)}</h1>
    <p class="tenue" style="margin:0">Escribe el PIN ${esDm ? 'del DM' : 'de este personaje'}.</p>
    <div class="pin-puntos${ui.pinError ? ' error' : ''}" aria-label="${ui.pin.length} de 4 dígitos">${[0, 1, 2, 3].map((i) => `<span class="${i < ui.pin.length ? 'lleno' : ''}"></span>`).join('')}</div>
    <div class="pin-msg" role="alert">${ui.pinError ? 'PIN incorrecto. Prueba otra vez.' : ''}</div>
    <div class="teclado">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button type="button" data-accion="pin-tecla" data-d="${d}">${d}</button>`).join('')}
      <button type="button" class="peq" data-accion="pin-volver">Volver</button>
      <button type="button" data-accion="pin-tecla" data-d="0">0</button>
      <button type="button" class="peq" data-accion="pin-borrar" aria-label="Borrar">Borrar</button>
    </div>
  </div>`;
}

/* ================= MI PERSONAJE ================= */
function vistaElegir() {
  const pjs = listaPj();
  return `<section class="columna">
    <div><h1 style="font-size:26px;color:var(--oro-claro)">¿Quién eres?</h1><p class="tenue" style="margin:4px 0 0">Elige tu personaje y escribe su PIN. En este dispositivo solo se pide una vez.</p></div>
    <div class="elegir">${pjs.map(([id]) => {
      const f = F(id);
      return `<button type="button" class="carta" style="--c:${f.color}" data-accion="elegir" data-id="${esc(id)}">${avatar(id, 'carta-img')}<div class="carta-txt"><div class="carta-nombre">${esc(f.nombre)}</div><div class="carta-sub">${esc([f.raza, f.clase].filter(Boolean).join(' · '))}</div><span class="candado">${puedeVer(id) ? 'Abierto en este dispositivo' : 'Pide PIN'}</span></div></button>`;
    }).join('')}
      <button type="button" class="carta carta-nueva" data-accion="pj-nuevo"><span class="carta-img avatar-ini" aria-hidden="true">+</span><div class="carta-txt"><div class="carta-nombre">Crear personaje</div><div class="carta-sub">Ficha nueva con su propio PIN</div></div></button>
    </div>
  </section>`;
}

function pips(n, max, accion, datos, clase = '') {
  return `<div class="pips">${Array.from({ length: max }, (_, i) => `<button type="button" class="pip ${clase}${i < n ? ' lleno' : ''}" data-accion="${accion}" ${datos} data-i="${i}" aria-label="${i < n ? 'Disponible' : 'Gastado'} ${i + 1} de ${max}"></button>`).join('')}</div>`;
}

function htmlPista(p) {
  const texto = typeof p === 'string' ? p : p.texto;
  const im = typeof p === 'object' && p ? srcDe(p.img) : '';
  return `<div class="pista${im ? ' con-img' : ''}">${im ? `<img src="${im}" alt="" data-accion="ver-imagen" data-src="${esc(im)}">` : ''}<span>${esc(texto)}</span></div>`;
}

/* ---------- Inventario y equipo ----------
   estado/monedas = { pc, pp, pe, po, ppt } (po hereda el viejo estado/oro).
   estado/objetos/<id> = { nombre, clase: arma|armadura|escudo|objeto, cantidad, equipado, magia, orden,
     arma: ref, dado, tipo, dist, sutil, versatil, arrojadiza, props, maestria, competente, extra
     armadura: ref, base, des (total|max2|no), tipoArm, sigilo, fuerza
     objeto: bonoCA, nota }
   Lo equipado calcula los ataques y la CA de la ficha. */
const objetosDe = (id) => porOrden(S(id).objetos).filter(([, o]) => o && o.nombre);
const monedaDe = (id, k) => { const m = S(id).monedas || {}; return +(m[k] ?? (k === 'po' ? S(id).oro : 0) ?? 0) || 0; };
const modAtr = (id, a) => { const v = (F(id).atributos || {})[a]; return v === '' || v == null ? 0 : Math.floor((+v - 10) / 2); };
const compDe = (id) => modDe(F(id).competencia) || 2 + Math.floor(((+F(id).nivel || 1) - 1) / 4);
const conSigno = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);

function ataquesDeArma(id, o) {
  const fue = modAtr(id, 'FUE'); const des = modAtr(id, 'DES');
  const m = o.dist ? des : o.sutil ? Math.max(fue, des) : fue;
  const magia = +o.magia || 0;
  const bono = conSigno(m + (o.competente ? compDe(id) : 0) + magia);
  const dm = m + magia;
  const expr = (dado) => (/d/i.test(dado) ? `${dado}${dm ? ` ${dm > 0 ? '+' : '−'} ${Math.abs(dm)}` : ''}` : String(Math.max(0, (+dado || 0) + dm)));
  const dano = (dado) => `${expr(dado)} ${o.tipo || ''}`.trim() + (o.extra ? ` + ${o.extra}` : '');
  const l = [{ nombre: o.nombre, bono, dano: dano(o.dado), equipo: true, nota: [o.props, o.maestria ? `Maestría: ${o.maestria}` : ''].filter(Boolean).join(' · ') }];
  if (o.versatil) l.push({ nombre: `${o.nombre} (a dos manos)`, bono, dano: dano(o.versatil), equipo: true });
  if (o.arrojadiza && !o.dist) l.push({ nombre: `${o.nombre} (lanzada, ${o.arrojadiza} m)`, bono, dano: dano(o.dado), equipo: true });
  return l;
}
// Solo una armadura y un escudo a la vez: al equipar uno, se quita el anterior
function desequiparIncompatibles(id, o, excepto) {
  const u = {};
  if (o.clase !== 'armadura' && o.clase !== 'escudo') return u;
  for (const [k, x] of objetosDe(id)) if (k !== excepto && x.equipado && x.clase === o.clase) u[`personajes/${id}/estado/objetos/${k}/equipado`] = false;
  return u;
}
// Ataques de un personaje: los de sus armas equipadas y los que escribió a mano en la ficha
const ataquesPj = (id, conConjuros = false) => [...objetosDe(id).filter(([, o]) => o.equipado && o.clase === 'arma').flatMap(([, o]) => ataquesDeArma(id, o)), ...(F(id).ataques || []).filter((a) => a && a.nombre), ...(conConjuros ? conjurosDeCombate(id) : [])];

// CA: si hay armadura, escudo u objetos de CA equipados se calcula; si no, la que se escribió en la ficha
function caDe(id) {
  const f = F(id);
  const eq = objetosDe(id).map(([, o]) => o).filter((o) => o.equipado);
  const arm = eq.find((o) => o.clase === 'armadura'); const esc0 = eq.find((o) => o.clase === 'escudo');
  const extras = eq.filter((o) => o.clase === 'objeto' && +o.bonoCA);
  if (!arm && !esc0 && !extras.length) return { valor: f.ca, nota: f.caNota || '' };
  const des = modAtr(id, 'DES'); const partes = []; let v;
  if (arm) {
    const d = arm.des === 'total' ? des : arm.des === 'max2' ? Math.min(2, des) : 0;
    v = (+arm.base || 10) + d + (+arm.magia || 0);
    partes.push(arm.nombre);
  } else {
    v = +f.caBase || 10 + des;
    partes.push(+f.caBase ? 'sin armadura' : '10 + DES');
  }
  if (esc0) { v += 2 + (+esc0.magia || 0); partes.push(esc0.nombre); }
  for (const o of extras) { v += +o.bonoCA; partes.push(o.nombre); }
  return { valor: v, nota: partes.join(' + ') };
}

function resumenObjeto(id, o) {
  if (o.clase === 'arma') { const a = ataquesDeArma(id, o)[0]; return `${a.bono} · ${a.dano}`; }
  if (o.clase === 'armadura') return `CA ${o.base}${o.des === 'total' ? ' + DES' : o.des === 'max2' ? ' + DES (máx. 2)' : ''}${+o.magia ? ` ${conSigno(+o.magia)}` : ''} · ${o.tipoArm || ''}${o.sigilo ? ' · desventaja en Sigilo' : ''}${o.fuerza ? ` · ${o.fuerza}` : ''}`;
  if (o.clase === 'escudo') return `${conSigno(2 + (+o.magia || 0))} CA`;
  return [+o.bonoCA ? `${conSigno(+o.bonoCA)} CA` : '', o.nota || ''].filter(Boolean).join(' · ');
}
const equipable = (o) => o.clase !== 'objeto' || !!+o.bonoCA;

function htmlInventario(id) {
  const f = F(id); const b = ui.borradores;
  const dm = esDM(); // solo el DM agrega, quita, equipa o cambia monedas; el jugador lo consulta
  const objs = objetosDe(id); const legado = Object.entries(S(id).inventario || {});
  const equipados = objs.filter(([, o]) => o.equipado); const mochila = objs.filter(([, o]) => !o.equipado);
  const clase = b['inv-clase'] || 'arma';
  const armaSel = ARMAS.find((a) => a.nombre === (b['inv-arma'] || ARMAS[0].nombre)) || ARMAS[0];
  const compPorDefecto = competenteCon(f.clase, armaSel);
  const fila = ([k, o]) => `<li class="obj"><div style="min-width:0;flex:1"><div><b>${esc(o.nombre)}</b>${+o.cantidad > 1 ? ` <span class="tenue num">×${o.cantidad}</span>` : ''}</div>${resumenObjeto(id, o) ? `<div class="recurso-det">${esc(resumenObjeto(id, o))}</div>` : ''}</div>
    ${!dm ? '' : `<span class="fila" style="flex:none;gap:6px">${o.clase === 'arma' ? `<button type="button" class="btn btn-peq" data-accion="obj-comp" data-id="${esc(id)}" data-k="${esc(k)}" aria-pressed="${!!o.competente}" title="Si sabe usar esta arma, suma su bono de competencia">${o.competente ? 'Competente' : 'Sin competencia'}</button>` : ''}${equipable(o) ? `<button type="button" class="btn btn-peq${o.equipado ? '' : ' btn-oro'}" data-accion="obj-equipar" data-id="${esc(id)}" data-k="${esc(k)}">${o.equipado ? 'Quitar' : 'Equipar'}</button>` : ''}
      ${o.equipado ? '' : `<button type="button" class="btn btn-red btn-peq" data-accion="obj-cant" data-id="${esc(id)}" data-k="${esc(k)}" data-d="-1" aria-label="Uno menos">−</button><button type="button" class="btn btn-red btn-peq" data-accion="obj-cant" data-id="${esc(id)}" data-k="${esc(k)}" data-d="1" aria-label="Uno más">+</button>`}
      ${botonConfirmar(`borrar-obj-${k}`, 'Borrar', 'obj-borrar', `data-id="${esc(id)}" data-k="${esc(k)}"`, 'btn btn-peq btn-peligro')}</span>`}</li>`;
  const grupoArmas = (cat, dist) => `<optgroup label="${cat === 'sencilla' ? 'Sencillas' : 'Marciales'} ${dist ? 'a distancia' : 'cuerpo a cuerpo'}">${ARMAS.filter((a) => a.cat === cat && a.dist === dist).map((a) => `<option value="${esc(a.nombre)}"${a.nombre === armaSel.nombre ? ' selected' : ''}>${esc(a.nombre)} · ${esc(a.dado)} ${esc(a.tipo)}</option>`).join('')}</optgroup>`;
  const campoMagia = `<div><label class="etq" for="inv-magia">Bono mágico</label><input class="campo num" id="inv-magia" type="number" min="0" max="5" inputmode="numeric" placeholder="0" data-borrador value="${val('inv-magia')}"></div>`;
  const campoNombre = (ph) => `<div><label class="etq" for="inv-nombre">Nombre propio (opcional)</label><input class="campo" id="inv-nombre" data-borrador placeholder="${esc(ph)}" value="${val('inv-nombre')}"></div>`;
  const equiparYa = `<label class="check"><input type="checkbox" id="inv-equipar" data-borrador-check${(b['inv-equipar'] ?? true) ? ' checked' : ''}> Equiparlo ya</label>`;
  return `<section class="panel">
    <h2 class="panel-titulo">Inventario</h2>
    ${dm ? '' : '<p class="tenue" style="margin:0 0 10px;font-size:14px">Solo el DM agrega o quita cosas del inventario.</p>'}
    <div class="monedas">${MONEDAS.map(([k, n]) => dm ? `<div class="moneda m-${k}"><label for="mon-${k}">${n}</label><input class="campo num" id="mon-${k}" type="number" min="0" inputmode="numeric" value="${monedaDe(id, k)}" data-cambio="moneda" data-id="${esc(id)}" data-k="${k}"></div>` : `<div class="moneda m-${k}"><span class="moneda-etq">${n}</span><b class="campo num moneda-val">${monedaDe(id, k)}</b></div>`).join('')}</div>
    <p class="sub" style="margin-top:14px">Equipado</p>
    ${equipados.length ? `<ul class="lista objetos">${equipados.map(fila).join('')}</ul>` : `<p class="tenue" style="margin:0;font-size:15px">Nada equipado.${dm ? ' Las armas equipadas salen en Ataques y la armadura y el escudo cambian la CA.' : ''}</p>`}
    <p class="sub" style="margin-top:14px">Mochila</p>
    ${mochila.length || legado.length ? `<ul class="lista objetos">${mochila.map(fila).join('')}${legado.map(([k, t]) => `<li class="obj"><span style="flex:1">${esc(t)}</span>${dm ? `<button type="button" class="btn btn-peq btn-peligro" data-accion="inv-quitar" data-id="${esc(id)}" data-k="${esc(k)}" aria-label="Quitar ${esc(t)}">Borrar</button>` : ''}</li>`).join('')}</ul>` : '<p class="tenue" style="margin:0;font-size:15px">Vacía.</p>'}
    ${!dm ? '' : `<details class="pl-perfil inv-anadir" data-abrir="inv:${esc(id)}"${ui.abiertos.has('inv:' + id) ? ' open' : ''}><summary>Añadir al inventario</summary>
      <div class="seg seg-peq" role="group" aria-label="Qué añadir" style="margin-top:8px">${[['arma', 'Arma'], ['armadura', 'Armadura'], ['escudo', 'Escudo'], ['objeto', 'Otro objeto']].map(([k, t]) => `<button type="button" aria-pressed="${clase === k}" data-accion="inv-clase" data-c="${k}">${t}</button>`).join('')}</div>
      <div class="form-grid dos" style="margin-top:8px">
      ${clase === 'arma' ? `<div style="grid-column:1/-1"><label class="etq" for="inv-arma">Arma del SRD</label><select class="campo" style="width:100%" id="inv-arma" data-borrador data-cambio="redibujar">${grupoArmas('sencilla', false)}${grupoArmas('sencilla', true)}${grupoArmas('marcial', false)}${grupoArmas('marcial', true)}</select>
          <p class="ayuda" style="margin:4px 0 0">${esc([armaSel.props, `Maestría: ${armaSel.maestria}`, armaSel.peso, armaSel.precio].filter((x) => x && x !== '—').join(' · '))}</p></div>
        ${campoNombre('Ej. Colmillo de plata')}${campoMagia}
        <div><label class="etq" for="inv-extra">Daño extra (opcional)</label><input class="campo" id="inv-extra" data-borrador placeholder="Ej. 1d6 fuego" value="${val('inv-extra')}"></div>
        <div style="align-self:end"><label class="check"><input type="checkbox" id="inv-comp" data-borrador-check${(b['inv-comp'] ?? compPorDefecto) ? ' checked' : ''}> Es competente con ella${f.clase ? ` <span class="tenue">(${compPorDefecto ? 'su clase sí' : 'su clase no'})</span>` : ''}</label></div>`
      : clase === 'armadura' ? `<div style="grid-column:1/-1"><label class="etq" for="inv-armadura">Armadura del SRD</label><select class="campo" style="width:100%" id="inv-armadura" data-borrador>${['ligera', 'media', 'pesada'].map((t) => `<optgroup label="Armaduras ${t}s">${ARMADURAS.filter((a) => a.tipo === t).map((a) => `<option value="${esc(a.nombre)}"${b['inv-armadura'] === a.nombre ? ' selected' : ''}>${esc(a.nombre)} · CA ${a.base}${a.des === 'total' ? ' + DES' : a.des === 'max2' ? ' + DES (máx. 2)' : ''}</option>`).join('')}</optgroup>`).join('')}</select></div>
        ${campoNombre('Ej. Coraza élfica')}${campoMagia}`
      : clase === 'escudo' ? `${campoNombre('Ej. Escudo de la orden')}${campoMagia}`
      : `<div><label class="etq" for="inv-onombre">Nombre</label><input class="campo" id="inv-onombre" data-borrador placeholder="Ej. Cuerda de cáñamo (15 m)" value="${val('inv-onombre')}"></div>
        <div><label class="etq" for="inv-ocant">Cantidad</label><input class="campo num" id="inv-ocant" type="number" min="1" inputmode="numeric" data-borrador value="${val('inv-ocant', '1')}"></div>
        <div><label class="etq" for="inv-oca">Bono a la CA (si da)</label><input class="campo num" id="inv-oca" type="number" min="0" max="5" inputmode="numeric" placeholder="0" data-borrador value="${val('inv-oca')}"></div>
        <div><label class="etq" for="inv-onota">Nota</label><input class="campo" id="inv-onota" data-borrador placeholder="Ej. Brilla cerca de no muertos" value="${val('inv-onota')}"></div>`}
      </div>
      <div class="fila" style="margin-top:8px">${clase !== 'objeto' ? equiparYa : ''}<button type="button" class="btn btn-peq btn-oro" data-accion="inv-anadir" data-id="${esc(id)}">Añadir</button></div>
    </details>`}
    ${dm && (f.equipo || []).length ? `<div class="equipo-base"><p class="sub" style="margin-top:14px">Equipo base de la ficha</p><p style="margin:0;color:var(--tenue);font-size:15px">${f.equipo.map(esc).join(' · ')}</p>
      <div class="fila" style="margin-top:8px"><button type="button" class="btn btn-peq" data-accion="inv-migrar" data-id="${esc(id)}">Pasar al inventario</button><span class="tenue" style="font-size:14px">Reconoce armas y armaduras del SRD.</span></div></div>` : ''}
  </section>`;
}

// Lista de ataques con botones (ficha y panel Atacar)
function htmlListaAtaques(id, enPanel) {
  const lista = ataquesPj(id, enPanel); const b = ui.borradores;
  const sel = b['ja-atq'] ?? (lista.length ? '0' : 'otro');
  return `<div class="atq-lista">${lista.map((a, i) => {
    const bono = bonoNum(a.bono); const conDado = !!tirarExpr(a.dano);
    return `<div class="atq${enPanel && sel === String(i) ? ' elegido' : ''}">
      <span style="min-width:0;flex:1">${enPanel ? `<button type="button" class="atq-nombre atq-elegir" data-accion="ja-elegir" data-i="${i}" aria-pressed="${sel === String(i)}">${esc(a.nombre)}</button>` : `<span class="atq-nombre">${esc(a.nombre)}</span>`}
        <small class="atq-det">${a.conjuro ? '✦ ' : ''}${esc([a.bono, a.salva ? `CD ${a.salva.cd} ${a.salva.attr}${a.salva.mitad ? ' (mitad si supera)' : ''}` : '', a.dano].filter(Boolean).join(' · '))}${a.nota ? ` · ${esc(a.nota)}` : ''}</small>
        ${enPanel && sel === String(i) && a.conjuro && a.nivel ? (() => { const libres = Array.from({ length: 10 - a.nivel }, (_, k) => a.nivel + k).filter((k) => +((F(id).espacios || {})['n' + k] || 0) > 0); return libres.length ? `<span class="fila" style="gap:6px;margin-top:4px"><label class="etq" for="jlz-${esc(a.conjuro)}" style="margin:0">Espacio</label><select class="campo campo-peq" id="jlz-${esc(a.conjuro)}" data-cambio="nivel-conj" data-c="${esc(a.conjuro)}" style="margin:0">${libres.map((k) => `<option value="${k}"${k === a.nivelEsp ? ' selected' : ''}>Nivel ${k} (${espDe(id, k)} libre${espDe(id, k) === 1 ? '' : 's'})</option>`).join('')}</select></span>` : '<span class="chip malo" style="margin-top:4px">Sin espacios</span>'; })() : ''}</span>
      <span class="fila" style="gap:6px;flex:none">${bono != null ? `<button type="button" class="btn btn-peq" data-accion="ja-tirar-golpe" data-i="${i}" data-id="${esc(id)}">Atacar ${conSigno(bono)}</button>` : ''}${conDado ? `<button type="button" class="btn btn-peq" data-accion="ja-tirar-dano" data-i="${i}" data-id="${esc(id)}" title="${esc(a.dano)}">Daño</button><button type="button" class="btn btn-peq" data-accion="ja-tirar-dano" data-i="${i}" data-id="${esc(id)}" data-crit="1" title="Crítico: dobla los dados">Crít.</button>` : ''}</span>
    </div>`;
  }).join('')}${enPanel ? `<div class="atq${sel === 'otro' ? ' elegido' : ''}"><button type="button" class="atq-nombre atq-elegir" data-accion="ja-elegir" data-i="otro" aria-pressed="${sel === 'otro'}">Otro (conjuro, improvisado…)</button></div>` : ''}</div>`;
}

/* ---------- Libro de conjuros ----------
   estado/libro/<id> = copia del conjuro (SRD o propio): { nombre, nivel, escuela, ritual, tiempo, alcance, componentes, duracion, conc,
   texto, mejora, tirada (ataque|salvacion|''), salva (FUE…CAR), dano, tipo, cura, sumaMod, masNivel, mitad, propio, orden }.
   Solo el DM da, ajusta o quita conjuros; el jugador los lanza. El catálogo del SRD (reglas/conjuros.json) se carga al abrir «Dar un conjuro». */
const libroDe = (id) => Object.entries(S(id).libro || {}).filter(([, c]) => c && c.nombre).sort((a, b) => (a[1].nivel - b[1].nivel) || a[1].nombre.localeCompare(b[1].nombre, 'es'));
const cdMagia = (id) => { const cd = modDe(F(id).cd); if (cd) return cd; const a = bonoNum(F(id).ataqueConjuro); return a != null ? a + 8 : null; };
const ataqueMagia = (id) => { const a = bonoNum(F(id).ataqueConjuro); if (a != null) return a; const cd = modDe(F(id).cd); return cd ? cd - 8 : null; };
const modMagia = (id) => { const cd = cdMagia(id); return cd ? cd - 8 - compDe(id) : 0; };
const NOMBRE_SALVA = { FUE: 'Fuerza', DES: 'Destreza', CON: 'Constitución', INT: 'Inteligencia', SAB: 'Sabiduría', CAR: 'Carisma' };
// Nivel de espacio elegido para un conjuro: el que se marcó, o el más bajo con espacios libres
function nivelConj(id, cid, c) {
  if (!c || !c.nivel) return 0;
  const elegido = +ui.borradores['lz-' + cid];
  if (elegido >= c.nivel) return elegido;
  for (let n = c.nivel; n <= 9; n++) if (espDe(id, n) > 0) return n;
  return c.nivel;
}
// Expresión de daño o curación del conjuro al nivel indicado (trucos según el nivel del personaje)
function exprConj(id, c, nivelEsp) {
  let base = String(c.dano || c.cura || '').trim(); if (!base) return '';
  const m = base.match(/^(\d+)d(\d+)/);
  if (m && c.nivel === 0 && /aumenta/i.test(c.mejora || '')) { const lv = +F(id).nivel || 1; const t = lv >= 17 ? 4 : lv >= 11 ? 3 : lv >= 5 ? 2 : 1; base = base.replace(/^(\d+)d(\d+)/, `${+m[1] * t}d${m[2]}`); }
  const extra = c.nivel > 0 ? Math.max(0, (nivelEsp || c.nivel) - c.nivel) : 0;
  const mm = String(c.masNivel || '').match(/^(\d+)d(\d+)$/);
  if (extra && mm) {
    const m2 = base.match(/^(\d+)d(\d+)/);
    if (m2 && m2[2] === mm[2]) base = base.replace(/^(\d+)d(\d+)/, `${+m2[1] + extra * +mm[1]}d${m2[2]}`);
    else base += ` + ${extra * +mm[1]}d${mm[2]}`;
  }
  if (c.sumaMod) { const mg = modMagia(id); if (mg) base += ` ${mg > 0 ? '+' : '−'} ${Math.abs(mg)}`; }
  return c.dano ? `${base} ${c.tipo || ''}`.trim() : base;
}
// Conjuros que sirven en el panel Atacar (con tirada de ataque, salvación o daño; las curaciones van aparte)
const conjurosDeCombate = (id) => libroDe(id).filter(([, c]) => !c.cura && (c.tirada || c.dano)).map(([cid, c]) => {
  const n = nivelConj(id, cid, c); const atq = ataqueMagia(id);
  return { nombre: c.nombre, bono: c.tirada === 'ataque' && atq != null ? conSigno(atq) : '', dano: exprConj(id, c, n), conjuro: cid, nivel: c.nivel, nivelEsp: n, salva: c.tirada === 'salvacion' ? { attr: c.salva || 'DES', cd: cdMagia(id) ?? '', mitad: !!c.mitad } : null, nota: c.nivel ? `Nivel ${n}${c.conc ? ' · concentración' : ''}` : 'Truco' };
});

let catalogoConj = null; let cargandoConj = false;
function cargarCatalogoConj() {
  if (catalogoConj || cargandoConj) return;
  cargandoConj = true;
  fetch('reglas/conjuros.json?v=20261118c').then((r) => r.json()).then((d) => { catalogoConj = d.conjuros || []; }).catch(() => { aviso('No se pudo cargar el catálogo de conjuros'); }).finally(() => { cargandoConj = false; render(); });
}
const RAICES_CLASE = { bardo: 'bard', brujo: 'bruj', 'clérigo': 'cleri', druida: 'druid', explorador: 'explor', hechicero: 'hechicer', mago: 'mag', 'paladín': 'paladin' };
const deSuClase = (f, c) => { const cl = norm(f.clase); return !!cl && (c.clases || []).some((k) => cl.includes(RAICES_CLASE[k] || norm(k))); };

function htmlConjuro(id, cid, c, dm) {
  const n = nivelConj(id, cid, c);
  const libres = c.nivel ? Array.from({ length: 10 - c.nivel }, (_, i) => c.nivel + i).filter((k) => +((F(id).espacios || {})['n' + k] || 0) > 0) : [];
  const atq = ataqueMagia(id); const cd = cdMagia(id); const expr = exprConj(id, c, n);
  return `<div class="conj">
    <div class="conj-cab"><b>${esc(c.nombre)}</b>${c.conc ? ' <span class="chip conc" title="Concentración">◈</span>' : ''}${c.ritual ? ' <span class="chip">Ritual</span>' : ''}${c.propio ? ' <span class="chip">Propio</span>' : ''}
      <small>${esc([c.tiempo, c.alcance, c.duracion].filter(Boolean).join(' · '))}</small></div>
    <div class="fila conj-acc">
      ${c.nivel ? (libres.length ? `<label class="sr" for="lz-${esc(cid)}">Espacio para ${esc(c.nombre)}</label><select class="campo campo-peq" id="lz-${esc(cid)}" data-borrador data-cambio="redibujar" style="margin:0">${libres.map((k) => `<option value="${k}"${k === n ? ' selected' : ''}>Nivel ${k} (${espDe(id, k)} libre${espDe(id, k) === 1 ? '' : 's'})</option>`).join('')}</select>` : '<span class="chip malo">Sin espacios de su nivel</span>') : ''}
      <button type="button" class="btn btn-peq btn-oro" data-accion="cj-lanzar" data-id="${esc(id)}" data-c="${esc(cid)}">Lanzar</button>
      ${c.tirada === 'ataque' && atq != null ? `<button type="button" class="btn btn-peq" data-accion="cj-atacar" data-id="${esc(id)}" data-c="${esc(cid)}">Atacar ${conSigno(atq)}</button>` : ''}
      ${c.tirada === 'salvacion' ? `<span class="chip" title="Salvación de ${esc(NOMBRE_SALVA[c.salva] || '')}">CD ${esc(cd ?? '?')} ${esc(c.salva || '')}</span>` : ''}
      ${c.dano && expr ? `<button type="button" class="btn btn-peq" data-accion="cj-tirar" data-id="${esc(id)}" data-c="${esc(cid)}" title="${esc(expr)}">Daño ${esc(expr.replace(/\s+\D+$/, ''))}</button>` : ''}
      ${c.cura && expr ? `<button type="button" class="btn btn-peq btn-bien" data-accion="cj-tirar" data-id="${esc(id)}" data-c="${esc(cid)}" title="${esc(expr)}">Curación ${esc(expr)}</button>` : ''}
    </div>
    <details class="pl-perfil" data-abrir="cj:${esc(cid)}"${ui.abiertos.has('cj:' + cid) ? ' open' : ''}><summary>Descripción</summary>
      <p class="tenue" style="margin:6px 0 4px;font-size:14px">${esc([c.nivel ? `${c.escuela} de nivel ${c.nivel}` : `Truco de ${String(c.escuela || '').toLowerCase()}`, c.componentes].filter(Boolean).join(' · '))}</p>
      <p class="pre conj-texto">${esc(c.texto || '')}</p>${c.mejora ? `<p class="conj-texto"><i>${esc(c.mejora)}</i></p>` : ''}
      ${dm ? `<div class="lista-campo secreto" style="margin-top:8px"><span class="etq">Ajustar (solo el DM)</span><p class="ayuda">La app lo sacó del texto; corrígelo si hace falta.</p>
        <div class="form-grid dos">
          <div><label class="etq" for="cja-tir-${esc(cid)}">Tirada</label><select class="campo" id="cja-tir-${esc(cid)}">${[['', 'Ninguna'], ['ataque', 'Ataque de conjuro'], ['salvacion', 'Salvación del objetivo']].map(([k, t]) => `<option value="${k}"${(c.tirada || '') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label class="etq" for="cja-sal-${esc(cid)}">Salvación de</label><select class="campo" id="cja-sal-${esc(cid)}">${ATRIBUTOS.map((a) => `<option value="${a}"${(c.salva || 'DES') === a ? ' selected' : ''}>${NOMBRE_SALVA[a]}</option>`).join('')}</select></div>
          <div><label class="etq" for="cja-dano-${esc(cid)}">${c.cura ? 'Curación' : 'Daño'} (dados)</label><input class="campo" id="cja-dano-${esc(cid)}" value="${esc(c.dano || c.cura || '')}" placeholder="Ej. 8d6"></div>
          <div><label class="etq" for="cja-tipo-${esc(cid)}">Tipo de daño</label><input class="campo" id="cja-tipo-${esc(cid)}" value="${esc(c.tipo || '')}" placeholder="Ej. fuego"></div>
          <div><label class="etq" for="cja-mas-${esc(cid)}">Aumenta por nivel extra</label><input class="campo" id="cja-mas-${esc(cid)}" value="${esc(c.masNivel || '')}" placeholder="Ej. 1d6"></div>
          <div style="align-self:end"><label class="check"><input type="checkbox" id="cja-mitad-${esc(cid)}"${c.mitad ? ' checked' : ''}> Mitad si supera la salvación</label><label class="check"><input type="checkbox" id="cja-mod-${esc(cid)}"${c.sumaMod ? ' checked' : ''}> Suma su modificador mágico</label></div>
        </div>
        <div class="fila" style="margin-top:8px"><button type="button" class="btn btn-peq btn-oro" data-accion="cj-ajustar" data-id="${esc(id)}" data-c="${esc(cid)}">Guardar ajustes</button>${botonConfirmar(`quitar-cj-${cid}`, 'Quitar del libro', 'cj-quitar', `data-id="${esc(id)}" data-c="${esc(cid)}"`, 'btn btn-peq btn-peligro')}</div>
      </div>` : ''}
    </details>
  </div>`;
}

function htmlDarConjuro(id) {
  const f = F(id); const b = ui.borradores;
  if (!catalogoConj) cargarCatalogoConj();
  const tiene = new Set(libroDe(id).map(([, c]) => norm(c.nombre)));
  const q = norm(b['cj-q']); const niv = b['cj-niv'] ?? ''; const suClase = b['cj-suclase'] ?? !!f.clase;
  const lista = (catalogoConj || []).filter((c) => (!q || norm(c.nombre).includes(q)) && (niv === '' || c.nivel === +niv) && (!suClase || deSuClase(f, c)));
  const legado = [...(f.trucos || []), ...(f.conjuros || [])].filter((x) => x && x.nombre);
  return `<details class="pl-perfil dar-conj" data-abrir="dar:${esc(id)}"${ui.abiertos.has('dar:' + id) ? ' open' : ''}><summary>Dar un conjuro</summary>
    ${!catalogoConj ? '<p class="tenue" style="margin:8px 0 0">Cargando el catálogo del SRD…</p>' : `
    <div class="form-grid dos" style="margin-top:8px">
      <div><label class="sr" for="cj-q">Buscar conjuro</label><input class="campo" style="width:100%" id="cj-q" type="search" placeholder="Buscar por nombre" data-borrador data-filtro value="${val('cj-q')}"></div>
      <div><label class="sr" for="cj-niv">Nivel</label><select class="campo" style="width:100%" id="cj-niv" data-borrador data-cambio="redibujar"><option value="">Todos los niveles</option>${Array.from({ length: 10 }, (_, k) => `<option value="${k}"${niv === String(k) ? ' selected' : ''}>${k ? `Nivel ${k}` : 'Trucos'}</option>`).join('')}</select></div>
    </div>
    ${f.clase ? `<label class="check" style="margin-top:6px"><input type="checkbox" id="cj-suclase" data-borrador-check data-cambio="redibujar"${suClase ? ' checked' : ''}> Solo los de su clase (${esc(f.clase)})</label>` : ''}
    <ul class="lista dar-lista">${lista.slice(0, 40).map((c) => { const ya = tiene.has(norm(c.nombre)); return `<li><span style="min-width:0;flex:1"><b>${esc(c.nombre)}</b>${c.conc ? ' <span class="chip conc">◈</span>' : ''} <small class="tenue">${c.nivel ? `Nivel ${c.nivel}` : 'Truco'} · ${esc(c.escuela)} · ${esc(c.clases.join(', '))}</small></span>${ya ? '<span class="tenue" style="font-size:14px">Ya lo tiene</span>' : `<button type="button" class="btn btn-peq btn-oro" data-accion="cj-dar" data-id="${esc(id)}" data-n="${esc(c.nombre)}">Dar</button>`}</li>`; }).join('') || '<li class="tenue">Ningún conjuro coincide.</li>'}</ul>
    ${lista.length > 40 ? `<p class="tenue" style="margin:4px 0 0;font-size:14px">Se muestran 40 de ${lista.length}. Escribe parte del nombre para encontrar el que buscas.</p>` : ''}
    ${legado.length ? `<div class="fila" style="margin-top:10px"><button type="button" class="btn btn-peq" data-accion="cj-migrar" data-id="${esc(id)}">Pasar al libro los ${legado.length} anotados en la ficha</button></div>` : ''}`}
    <details class="pl-perfil" data-abrir="propio:${esc(id)}"${ui.abiertos.has('propio:' + id) ? ' open' : ''}><summary>Conjuro propio (de tu mundo)</summary>
      <div class="form-grid dos" style="margin-top:8px">
        <div><label class="etq" for="cjp-nombre">Nombre</label><input class="campo" id="cjp-nombre" data-borrador value="${val('cjp-nombre')}"></div>
        <div><label class="etq" for="cjp-nivel">Nivel (0 = truco)</label><input class="campo num" id="cjp-nivel" type="number" min="0" max="9" inputmode="numeric" data-borrador value="${val('cjp-nivel', '1')}"></div>
        <div><label class="etq" for="cjp-tirada">Tirada</label><select class="campo" id="cjp-tirada" data-borrador>${[['', 'Ninguna'], ['ataque', 'Ataque de conjuro'], ['salvacion', 'Salvación del objetivo']].map(([k, t]) => `<option value="${k}"${(b['cjp-tirada'] || '') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        <div><label class="etq" for="cjp-salva">Salvación de</label><select class="campo" id="cjp-salva" data-borrador>${ATRIBUTOS.map((a) => `<option value="${a}"${(b['cjp-salva'] || 'DES') === a ? ' selected' : ''}>${NOMBRE_SALVA[a]}</option>`).join('')}</select></div>
        <div><label class="etq" for="cjp-dano">Daño (dados)</label><input class="campo" id="cjp-dano" data-borrador placeholder="Ej. 3d6" value="${val('cjp-dano')}"></div>
        <div><label class="etq" for="cjp-tipo">Tipo de daño</label><input class="campo" id="cjp-tipo" data-borrador placeholder="Ej. necrótico" value="${val('cjp-tipo')}"></div>
        <div><label class="etq" for="cjp-meta">Tiempo · alcance · duración</label><input class="campo" id="cjp-meta" data-borrador placeholder="Acción · 18 m · Instantáneo" value="${val('cjp-meta')}"></div>
        <div style="align-self:end"><label class="check"><input type="checkbox" id="cjp-conc" data-borrador-check${b['cjp-conc'] ? ' checked' : ''}> Concentración</label></div>
        <div style="grid-column:1/-1"><label class="etq" for="cjp-texto">Descripción</label><textarea class="campo" id="cjp-texto" data-borrador style="min-height:70px">${val('cjp-texto')}</textarea></div>
      </div>
      <div class="fila" style="margin-top:8px"><button type="button" class="btn btn-peq btn-oro" data-accion="cj-propio" data-id="${esc(id)}">Dar este conjuro</button></div>
    </details>
  </details>`;
}

function htmlLibro(id) {
  const f = F(id); const dm = esDM();
  const libro = libroDe(id);
  const legado = [...(f.trucos || []).map((c) => ({ ...c, nivel: 0 })), ...(f.conjuros || [])].filter((x) => x && x.nombre);
  const lanzador = libro.length || legado.length || f.cd || f.ataqueConjuro || Object.keys(f.espacios || {}).length;
  if (!lanzador && !dm) return '';
  if (!lanzador && dm) return `<section class="panel"><h2 class="panel-titulo">Libro de conjuros</h2><p class="tenue" style="margin:0 0 6px;font-size:15px">Si este personaje usa magia, ponle su CD y su ataque de conjuro en «Editar ficha» y dale conjuros aquí.</p>${htmlDarConjuro(id)}</section>`;
  const grupos = {};
  for (const [cid, c] of libro) (grupos[c.nivel] = grupos[c.nivel] || []).push([cid, c]);
  const atq = ataqueMagia(id); const cd = cdMagia(id);
  return `<section class="panel libro">
    <h2 class="panel-titulo">Libro de conjuros</h2>
    <div class="fila" style="gap:8px;margin-bottom:6px">${cd != null ? `<span class="chip">CD ${cd}</span>` : ''}${atq != null ? `<span class="chip">Ataque ${conSigno(atq)}</span>` : ''}${S(id).concentra ? `<span class="chip conc">◈ ${esc(S(id).concentra)}</span>` : ''}${cd == null && atq == null ? `<span class="tenue" style="font-size:14px">${dm ? 'Falta la CD y el ataque de conjuro: ponlos en «Editar ficha».' : 'El DM aún no anota tu CD de conjuros.'}</span>` : ''}</div>
    ${libro.length ? Object.keys(grupos).sort((a, b) => a - b).map((n) => `<p class="sub" style="margin-top:12px">${+n ? `Nivel ${n}` : 'Trucos (sin gastar espacios)'}</p>${grupos[n].map(([cid, c]) => htmlConjuro(id, cid, c, dm)).join('')}`).join('')
      : `<p class="tenue" style="margin:0;font-size:15px">${dm ? 'Todavía no tiene conjuros en su libro.' : 'Tu libro está vacío. El DM te irá dando conjuros a medida que avance la historia.'}</p>`}
    ${C().activo && libro.some(([, c]) => !c.cura && (c.tirada || c.dano)) ? '<p class="tenue" style="margin:10px 0 0;font-size:14px">En combate, los conjuros contra enemigos también están en el panel Atacar: al enviarlos al DM se gasta el espacio.</p>' : ''}
    ${legado.length ? `<p class="sub" style="margin-top:14px">Anotados en la ficha</p>${legado.map((c) => `<div class="conjuro"><b>${esc(c.nombre)}</b>${c.texto ? `<p>${esc(c.texto)}</p>` : ''}</div>`).join('')}` : ''}
    ${dm ? htmlDarConjuro(id) : ''}
  </section>`;
}

function vistaHoja(id) {
  const f = F(id); const s = S(id); const pv = pvDe(id);
  const est = Object.keys(s.estados || {});
  const pistas = porOrden(s.pistas, (p) => p.ts || 0).map(([, p]) => p);
  const notasId = `notas-${id}`;
  const niveles = Array.from({ length: 9 }, (_, i) => i + 1).filter((n) => +((f.espacios || {})['n' + n] || 0) > 0);
  const conjPorNivel = {};
  for (const c of f.conjuros || []) (conjPorNivel[c.nivel || 1] = conjPorNivel[c.nivel || 1] || []).push(c);
  const datos = [f.raza, [f.clase, f.subclase].filter(Boolean).join(' · '), f.nivel ? `Nivel ${f.nivel}` : '', f.edad, f.alineamiento].filter(Boolean).join(' · ');
  const t = turnoDe();
  const mio = !!t && t.tipo === 'pj' && t.ref === id;
  const banner = C().activo ? `<div class="ancho banner-turno${mio ? ' mio' : ''}" role="status">${icono('espadas')}<span>${mio ? '¡Es tu turno!' : `Ronda ${C().ronda} · Turno de ${esc(!t ? '—' : ocultoP(t) && !esDM() ? 'alguien más' : nombreP(t))}`}</span></div>` : '';
  return `<div class="hoja" style="--c:${f.color}">
    ${banner}
    <section class="panel ancho cabeza">
      ${avatar(id, 'cabeza-avatar')}
      <div>
        ${f.epiteto ? `<div class="epiteto">${esc(f.epiteto)}</div>` : ''}
        <h1>${esc(f.nombre)}</h1>
        ${datos ? `<div class="datos">${esc(datos)}</div>` : ''}
        <div class="cabeza-acciones">
          <button type="button" class="btn btn-peq" data-accion="pj-editar" data-id="${esc(id)}">Editar ficha</button>
          <button type="button" class="btn btn-peq" data-accion="cambiar">Cambiar de personaje</button>
          ${abierto(id) ? `<button type="button" class="btn btn-peq" data-accion="bloquear" data-id="${esc(id)}">Bloquear</button>` : ''}
        </div>
      </div>
    </section>
    ${htmlCombateJugador(id)}

    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Puntos de vida</h2>
        ${tienePv(id) ? `<div class="pv-grande">
          <div class="pv-cifra num">${pv}<small> / ${f.pvMax}</small></div>
          <div class="pv-ajuste">
            <button type="button" class="btn btn-red btn-peligro" data-accion="pv" data-id="${esc(id)}" data-d="-1" aria-label="Restar 1 PV">−</button>
            <button type="button" class="btn btn-red btn-bien" data-accion="pv" data-id="${esc(id)}" data-d="1" aria-label="Sumar 1 PV">+</button>
          </div>
        </div>
        <div class="barra-pv ${nivelPv(pv, f.pvMax)}" style="height:12px;margin:12px 0"><span style="width:${pct(pv, f.pvMax)}%"></span></div>
        <div class="pv-ajuste">
          <label class="sr" for="pv-cant">Cantidad</label>
          <input id="pv-cant" type="number" inputmode="numeric" min="1" max="999" placeholder="0" data-borrador value="${esc(ui.borradores['pv-cant'] ?? '')}">
          <button type="button" class="btn btn-peligro" data-accion="pv-cant" data-id="${esc(id)}" data-tipo="dano">Recibir daño</button>
          <button type="button" class="btn btn-bien" data-accion="pv-cant" data-id="${esc(id)}" data-tipo="cura">Curar</button>
        </div>` : '<p class="tenue" style="margin:0">Los PV máximos están por definir. Agrégalos con «Editar ficha».</p>'}
        <div class="vitales" style="margin-top:14px">
          <div class="vital"><b class="num">${esc(dato(caDe(id).valor))}</b><span>CA</span>${caDe(id).nota ? `<small>${esc(caDe(id).nota)}</small>` : ''}</div>
          <div class="vital"><b class="num">${esc(dato(f.iniciativa))}</b><span>Iniciativa</span></div>
          <div class="vital"><b>${esc(f.velocidad || '—')}</b><span>Velocidad</span></div>
          <div class="vital"><b class="num">${esc(f.cd || f.competencia || '+2')}</b><span>${f.cd ? 'CD conjuros' : 'Competencia'}</span></div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Recursos y estados</h2>
        ${niveles.map((n) => `<div class="recurso"><div><div class="recurso-nombre">Espacios de nivel ${n}</div>${n === niveles[0] ? `<div class="recurso-det">Toca para gastar o recuperar.${f.ataqueConjuro ? ` Ataque de conjuro ${esc(f.ataqueConjuro)}.` : ''}</div>` : ''}</div>${pips(espDe(id, n), +f.espacios['n' + n], 'esp', `data-id="${esc(id)}" data-n="${n}"`, 'conjuro')}</div>`).join('')}
        ${(niveles.length || s.concentra) ? `<div class="recurso"><div style="min-width:0;flex:1"><div class="recurso-nombre">Concentración</div>${s.concentra ? `<span class="chip conc" style="margin-top:4px">◈ ${esc(s.concentra)}</span>` : `<div class="agregar" style="margin-top:6px"><label class="sr" for="conc-in">Conjuro en concentración</label><input id="conc-in" placeholder="Conjuro" data-borrador data-enter="conc-poner" data-id="${esc(id)}" value="${esc(ui.borradores['conc-in'] ?? '')}"><button type="button" class="btn btn-peq" data-accion="conc-poner" data-id="${esc(id)}">Concentrar</button></div>`}</div>${s.concentra ? `<button type="button" class="btn btn-peq" data-accion="conc-fin" data-id="${esc(id)}">Terminar</button>` : ''}</div>` : ''}
        ${(f.recursos || []).map((r) => {
          const v = recDe(id, r);
          const control = r.max > 5
            ? `<div class="contador"><button type="button" class="btn btn-red btn-peq" data-accion="rec-delta" data-id="${esc(id)}" data-k="${esc(r.id)}" data-d="-1" aria-label="Restar">−</button><b class="num">${v}</b><button type="button" class="btn btn-red btn-peq" data-accion="rec-delta" data-id="${esc(id)}" data-k="${esc(r.id)}" data-d="1" aria-label="Sumar">+</button></div>`
            : pips(v, r.max, 'rec', `data-id="${esc(id)}" data-k="${esc(r.id)}"`);
          const recarga = r.recarga === 'corto' ? 'Se recupera con descanso corto o largo.' : r.recarga === 'largo' ? 'Se recupera con descanso largo.' : '';
          return `<div class="recurso"><div><div class="recurso-nombre">${esc(r.nombre)}${r.max > 5 ? ` <span class="tenue num">(máx. ${r.max})</span>` : ''}</div>${r.detalle || recarga ? `<div class="recurso-det">${esc([r.detalle && !/[.!?]$/.test(r.detalle) ? r.detalle + '.' : r.detalle, recarga].filter(Boolean).join(' '))}</div>` : ''}</div>${control}</div>`;
        }).join('')}
        <div class="recurso"><div style="min-width:0;flex:1"><div class="recurso-nombre">Estados</div>
          <div class="pj-chips">${est.length ? est.map((x) => `<span class="chip est">${esc(x)}<button type="button" data-accion="estado-quitar" data-id="${esc(id)}" data-k="${esc(x)}" aria-label="Quitar ${esc(x)}">×</button></span>`).join('') : '<span class="tenue" style="font-size:15px">Ninguno</span>'}</div>
          <div class="agregar"><label class="sr" for="estado-in">Nuevo estado</label><input id="estado-in" placeholder="Ej. Envenenado, Derribado" data-borrador data-enter="estado-poner" data-id="${esc(id)}" value="${esc(ui.borradores['estado-in'] ?? '')}"><button type="button" class="btn btn-peq" data-accion="estado-poner" data-id="${esc(id)}">Añadir</button></div>
        </div></div>
      </section>

      ${ataquesPj(id).length ? `<section class="panel">
        <h2 class="panel-titulo">Ataques</h2>
        ${htmlListaAtaques(id, false)}
        ${!C().activo && ui.borradores['ja-detalle'] ? `<p class="tenue num" style="margin:8px 0 0;font-size:14px">${esc(ui.borradores['ja-detalle'])}</p>` : ''}
        ${C().activo ? '<p class="tenue" style="margin:8px 0 0;font-size:14px">Lo que tires aquí queda listo en el panel Atacar para enviárselo al DM.</p>' : ''}
      </section>` : ''}

      ${htmlLibro(id)}
    </div>

    <div class="columna">
      <section class="pergamino">
        <h2 class="panel-titulo">Solo tú lo sabes</h2>
        <div class="pistas">${pistas.length ? pistas.map(htmlPista).join('') : '<p style="margin:0">Todavía nada. Aquí aparecen las pistas privadas que te mande el DM.</p>'}</div>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Mis notas</h2>
        <label class="sr" for="${notasId}">Notas personales</label>
        <textarea class="campo" id="${notasId}" data-borrador data-notas="${esc(id)}" placeholder="Apuntes, sospechas, nombres…">${esc(ui.borradores[notasId] ?? s.notas ?? '')}</textarea>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Atributos</h2>
        <div class="atributos">${ATRIBUTOS.map((k) => { const raw = (f.atributos || {})[k]; const ok = raw !== '' && raw != null; return `<div class="atr"><span>${k}</span><b class="num">${ok ? +raw : '—'}</b><small class="num">${ok ? mod(+raw) : '?'}</small></div>`; }).join('')}</div>
        ${((f.salvaciones || []).length || (f.habilidades || []).length) ? `<div class="dos-col" style="margin-top:16px">
          ${(f.salvaciones || []).length ? `<div><p class="sub">Tiradas de salvación</p><ul class="lista">${f.salvaciones.map((x) => `<li><span>${esc(x.nombre)}</span><span class="val">${esc(x.valor)}</span></li>`).join('')}</ul></div>` : ''}
          ${(f.habilidades || []).length ? `<div><p class="sub">Habilidades</p><ul class="lista">${f.habilidades.map((x) => `<li><span>${esc(x.nombre)}</span><span class="val">${esc(x.valor)}</span></li>`).join('')}</ul></div>` : ''}
        </div>` : ''}
      </section>

      ${(f.rasgos || []).length ? `<section class="panel">
        <h2 class="panel-titulo">Rasgos</h2>
        ${f.rasgos.map((r) => `<div class="rasgo"><b>${esc(r.nombre)}</b>${r.texto ? `<p>${esc(r.texto)}</p>` : ''}</div>`).join('')}
      </section>` : ''}

      ${htmlInventario(id)}

      ${(f.personalidad || f.objetivo || f.origen || f.apariencia || f.historia || (f.hitos || []).length) ? `<section class="panel">
        <h2 class="panel-titulo">Quién es</h2>
        ${f.origen ? `<div class="rasgo"><b>Origen</b><p>${esc(f.origen)}</p></div>` : ''}
        ${f.apariencia ? `<div class="rasgo"><b>Apariencia</b><p>${esc(f.apariencia)}</p></div>` : ''}
        ${f.personalidad ? `<div class="rasgo"><b>Personalidad</b><p>${esc(f.personalidad)}</p></div>` : ''}
        ${f.historia ? `<div class="rasgo"><b>Historia</b><p class="pre">${esc(f.historia)}</p></div>` : ''}
        ${f.objetivo ? `<div class="rasgo"><b>Objetivo</b><p>${esc(f.objetivo)}</p></div>` : ''}
        ${(f.hitos || []).length ? `<div class="rasgo"><b>Momentos importantes</b><ul class="vinetas">${f.hitos.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
      </section>` : ''}
      ${f.cita ? `<p class="cita">«${esc(f.cita)}»</p>` : ''}
    </div>
  </div>`;
}

/* ---------- Creador / editor de personajes ---------- */
const LISTAS = {
  salvaciones: { etq: 'Tiradas de salvación', ayuda: 'Una por línea: Nombre +bono', ej: 'Fuerza +4\nConstitución +4' },
  habilidades: { etq: 'Habilidades', ayuda: 'Una por línea: Nombre +bono', ej: 'Atletismo +4\nPercepción +2' },
  ataques: { etq: 'Ataques extra', ayuda: 'Las armas equipadas en el Inventario ya salen solas. Aquí van otros (conjuros de ataque, ataques especiales), una por línea: Nombre | bono | daño', ej: 'Rayo de fuego | +5 | 1d10 fuego' },
  trucos: { etq: 'Trucos (mejor usa el Libro de conjuros de la ficha)', ayuda: 'Uno por línea: Nombre: descripción', ej: 'Luz: Un objeto brilla como una antorcha.' },
  conjuros: { etq: 'Conjuros (mejor usa el Libro de conjuros de la ficha)', ayuda: 'Uno por línea: nivel | Nombre | descripción', ej: '1 | Curar heridas | Recupera 1d8 + mod PV al tocar.' },
  rasgos: { etq: 'Rasgos', ayuda: 'Uno por línea: Nombre: descripción', ej: 'Visión en la oscuridad: Ves hasta 18 m sin luz.' },
  recursos: { etq: 'Recursos con usos', ayuda: 'Uno por línea: Nombre | máximo | recarga (corto, largo o ninguna) | detalle opcional', ej: 'Segundo aliento | 1 | corto | Recuperas 1d10 + nivel PV\nFlechas | 20 | ninguna' },
  equipo: { etq: 'Equipo base', ayuda: 'Uno por línea. Mejor usa el Inventario de la ficha: ahí las armas y armaduras calculan sus bonos.', ej: 'Cota de malla\nMochila de explorador' },
  hitos: { etq: 'Momentos importantes', ayuda: 'Uno por línea', ej: 'Encontró la llave del faro' },
};

function listaATexto(campo, arr) {
  return (arr || []).map((x) => {
    switch (campo) {
      case 'salvaciones': case 'habilidades': return `${x.nombre} ${x.valor}`.trim();
      case 'ataques': return [x.nombre, x.bono, x.dano].join(' | ');
      case 'trucos': case 'rasgos': return x.texto ? `${x.nombre}: ${x.texto}` : x.nombre;
      case 'conjuros': return [x.nivel, x.nombre, x.texto].join(' | ');
      case 'recursos': return [x.nombre, x.max, x.recarga, x.detalle].filter((v) => v !== '' && v != null).join(' | ');
      default: return String(x);
    }
  }).join('\n');
}

function textoALista(campo, texto) {
  return lineas(texto).map((l) => {
    const p = l.split('|').map((s) => s.trim());
    switch (campo) {
      case 'salvaciones': case 'habilidades': { const m = l.match(/^(.*?)\s*([+\-−]?\d+)$/); return m ? { nombre: m[1].trim(), valor: (m[2][0] === '-' || m[2][0] === '−' ? '-' : '+') + m[2].replace(/^[+\-−]/, '') } : { nombre: l, valor: '' }; }
      case 'ataques': return { nombre: p[0] || l, bono: p[1] || '', dano: p.slice(2).join(' | ') };
      case 'trucos': case 'rasgos': { const i = l.indexOf(':'); return i > 0 ? { nombre: l.slice(0, i).trim(), texto: l.slice(i + 1).trim() } : { nombre: l, texto: '' }; }
      case 'conjuros': { if (p.length >= 2 && /^\d$/.test(p[0])) return { nivel: +p[0], nombre: p[1], texto: p.slice(2).join(' | ') }; const i = l.indexOf(':'); return { nivel: 1, nombre: i > 0 ? l.slice(0, i).trim() : l, texto: i > 0 ? l.slice(i + 1).trim() : '' }; }
      case 'recursos': { const max = Math.max(1, parseInt(p[1], 10) || 1); const rc = norm(p[2] || 'largo'); return { id: claveSegura(norm(p[0]).replace(/ /g, '-')), nombre: p[0], max, recarga: /corto/.test(rc) ? 'corto' : /ninguna|no/.test(rc) ? 'ninguna' : 'largo', detalle: p.slice(3).join(' | ') }; }
      default: return l;
    }
  });
}

const CAMPOS_TEXTO = ['nombre', 'epiteto', 'raza', 'clase', 'subclase', 'genero', 'alineamiento', 'nivel', 'edad', 'origen', 'color', 'pin', 'retrato', 'pvMax', 'ca', 'caNota', 'caBase', 'velocidad', 'iniciativa', 'competencia', 'cd', 'ataqueConjuro', 'apariencia', 'personalidad', 'historia', 'objetivo', 'cita'];

function cargarEditor(id) {
  for (const k of Object.keys(ui.borradores)) if (k.startsWith('pj-')) delete ui.borradores[k];
  const usados = listaPj().map(([, p]) => p.ficha.color);
  const f = id === 'nuevo' ? fichaVacia(COLORES.find((c) => !usados.includes(c)) || COLORES[0]) : { ...fichaVacia(), ...F(id) };
  const b = ui.borradores;
  for (const k of CAMPOS_TEXTO) b['pj-' + k] = f[k] ?? '';
  b['pj-secretos'] = id === 'nuevo' ? '' : secretosDe(id);
  for (const a of ATRIBUTOS) b['pj-atr-' + a] = (f.atributos || {})[a] ?? '';
  for (let n = 1; n <= 9; n++) b['pj-esp-' + n] = (f.espacios || {})['n' + n] || '';
  for (const k of Object.keys(LISTAS)) b['pj-' + k] = listaATexto(k, f[k]);
  ui.editandoPj = id;
}

function vistaEditor() {
  const nuevo = ui.editandoPj === 'nuevo';
  const b = (k) => esc(ui.borradores['pj-' + k] ?? '');
  const campo = (k, etq, extra = '') => `<div><label class="etq" for="pj-${k}">${etq}</label><input class="campo" id="pj-${k}" data-borrador value="${b(k)}" ${extra}></div>`;
  return `<section class="panel editor">
    <h2 class="panel-titulo">${nuevo ? 'Crear personaje' : `Editar a ${esc(F(ui.editandoPj).nombre)}`}</h2>
    <p class="sub">Identidad</p>
    <div class="form-grid">
      ${campo('nombre', 'Nombre *')}
      ${campo('epiteto', 'Epíteto (ej. El sabio ancestral)')}
      ${campo('raza', 'Raza')}
      ${campo('clase', 'Clase')}
      ${campo('subclase', 'Subclase')}
      ${campo('nivel', 'Nivel', 'type="number" min="1" max="20" inputmode="numeric"')}
      ${campo('edad', 'Edad')}
      ${campo('genero', 'Género')}
      ${campo('alineamiento', 'Alineamiento')}
      ${campo('pin', 'PIN de 4 dígitos *', 'inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off"')}
    </div>
    <div class="form-fila">
      <div><span class="etq">Color</span><div class="colores" role="radiogroup" aria-label="Color del personaje">${COLORES.map((c) => `<button type="button" class="color${(ui.borradores['pj-color'] || '') === c ? ' activo' : ''}" style="--c:${c}" role="radio" aria-checked="${(ui.borradores['pj-color'] || '') === c}" aria-label="Color ${c}" data-accion="pj-color" data-c="${c}"></button>`).join('')}</div></div>
      <div style="flex:1;min-width:220px"><label class="etq" for="pj-retrato-archivo">Retrato (se recorta cuadrado)</label><input class="campo" type="file" id="pj-retrato-archivo" accept="image/*">
        ${retratos().length ? `<label class="sr" for="pj-retrato">O elige uno de la Biblioteca</label><select class="campo campo-peq" id="pj-retrato" data-borrador><option value="">${ui.borradores['pj-retrato'] ? 'Quitar retrato' : 'O elige uno de la Biblioteca'}</option>${retratos().map(([k, i]) => `<option value="${esc(k)}"${ui.borradores['pj-retrato'] === k ? ' selected' : ''}>${esc(i.nombre)}</option>`).join('')}</select>` : ''}</div>
    </div>

    <p class="sub">Combate</p>
    <div class="form-grid">
      ${campo('pvMax', 'PV máximos', 'type="number" min="1" inputmode="numeric"')}
      ${campo('ca', 'CA (si no usa el inventario)', 'type="number" min="0" inputmode="numeric"')}
      ${campo('caNota', 'Nota de la CA (ej. cota + escudo)')}
      ${campo('caBase', 'CA sin armadura (solo si su clase la cambia)', 'type="number" min="0" inputmode="numeric" placeholder="10 + DES"')}
      ${campo('velocidad', 'Velocidad')}
      ${campo('iniciativa', 'Iniciativa')}
      ${campo('competencia', 'Bono de competencia')}
      ${campo('cd', 'CD de conjuros (si lanza)')}
      ${campo('ataqueConjuro', 'Ataque de conjuro (si lanza)')}
    </div>

    <p class="sub">Atributos <span class="tenue" style="font-family:var(--f-cuerpo);letter-spacing:0">(deja vacío lo que no esté definido)</span></p>
    <div class="form-grid seis">${ATRIBUTOS.map((a) => `<div><label class="etq" for="pj-atr-${a}" title="${NOMBRE_ATRIBUTO[a]}">${a}</label><input class="campo num" id="pj-atr-${a}" type="number" min="1" max="30" inputmode="numeric" data-borrador value="${b('atr-' + a)}"></div>`).join('')}</div>

    <p class="sub">Espacios de conjuro por nivel <span class="tenue" style="font-family:var(--f-cuerpo);letter-spacing:0">(deja vacío si no tiene)</span></p>
    <div class="form-grid nueve">${Array.from({ length: 9 }, (_, i) => i + 1).map((n) => `<div><label class="etq" for="pj-esp-${n}">Nv ${n}</label><input class="campo num" id="pj-esp-${n}" type="number" min="0" max="9" inputmode="numeric" data-borrador value="${b('esp-' + n)}"></div>`).join('')}</div>

    ${Object.entries(LISTAS).filter(([k]) => !['equipo', 'trucos', 'conjuros'].includes(k) || esDM()).map(([k, l]) => `<div class="lista-campo"><label class="etq" for="pj-${k}">${l.etq}</label><p class="ayuda">${esc(l.ayuda)}</p><textarea class="campo" id="pj-${k}" data-borrador placeholder="${esc(l.ej)}">${b(k)}</textarea></div>`).join('')}

    <p class="sub">Quién es</p>
    <div class="form-grid dos">
      ${campo('origen', 'Origen')}
      ${campo('objetivo', 'Objetivo')}
    </div>
    ${['apariencia', 'personalidad', 'historia'].map((k) => `<div class="lista-campo"><label class="etq" for="pj-${k}">${{ apariencia: 'Apariencia', personalidad: 'Personalidad', historia: 'Historia' }[k]}</label><textarea class="campo" id="pj-${k}" data-borrador style="min-height:${k === 'historia' ? 110 : 70}px">${b(k)}</textarea></div>`).join('')}
    ${campo('cita', 'Frase o cita')}
    ${esDM() ? `<div class="lista-campo secreto"><label class="etq" for="pj-secretos">Secretos del DM</label><p class="ayuda">Solo se ven en el panel del DM. El jugador no los ve en su ficha.</p><textarea class="campo" id="pj-secretos" data-borrador style="min-height:90px">${b('secretos')}</textarea></div>` : ''}

    <div class="fila" style="margin-top:16px">
      <button type="button" class="btn btn-oro" data-accion="pj-guardar" ${ui.ocupado ? 'disabled' : ''}>${ui.ocupado ? 'Guardando…' : nuevo ? 'Crear personaje' : 'Guardar ficha'}</button>
      <button type="button" class="btn" data-accion="pj-cancelar">Cancelar</button>
    </div>
  </section>`;
}

function vistaFicha() {
  if (ui.editandoPj && (ui.editandoPj === 'nuevo' || puedeVer(ui.editandoPj))) return vistaEditor();
  if (!ui.ver || !F(ui.ver).nombre) return vistaElegir();
  if (!puedeVer(ui.ver)) return vistaPin(ui.ver);
  return vistaHoja(ui.ver);
}

/* ================= HISTORIA ================= */
const visibles = (cat) => porOrden(((E.enciclopedia || {})[cat]) || {}).filter(([, x]) => !x.oculto);
const listasVistoDicho = (x, etiquetaVisto = 'Lo vimos') => `
  ${(x.visto || []).length ? `<p class="sub"><span class="tag hecho">${etiquetaVisto}</span></p><ul class="vinetas">${x.visto.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
  ${(x.dicho || []).length ? `<p class="sub"><span class="tag dicho">Lo dijeron · puede ser falso</span></p><ul class="vinetas">${x.dicho.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
  ${x.misterio ? `<p class="sub"><span class="tag misterio">Por descubrir</span></p><p style="margin:0">${esc(x.misterio)}</p>` : ''}`;
const imgClic = (id, clase = '') => (srcDe(id) ? `<img class="${clase}" src="${srcDe(id)}" alt="${esc(imgs()[id].nombre)}" data-accion="ver-imagen" data-src="${esc(srcDe(id))}" loading="lazy">` : '');

/* ---------- diario de cada jugador (lo ven él y el DM) ---------- */
const entradasDiario = (id) => porOrden(S(id).diario, (x) => -(x.ts || 0));
const contextoDiario = (x) => [x.dia ? `Día ${x.dia}` : '', x.momento && MOMENTOS[x.momento] ? MOMENTOS[x.momento].nombre : ''].filter(Boolean).join(' · ');
const htmlEntradaDiario = (id, k, x, borrable) => `<div class="entrada"><time class="num" style="color:var(--tinta-suave)">${esc(contextoDiario(x) || hora(x.ts))}</time><p class="pre">${esc(x.texto)}</p>${borrable ? `<button type="button" class="borrar-entrada" data-accion="diario-borrar" data-id="${esc(id)}" data-k="${esc(k)}" aria-label="Borrar esta entrada">×</button>` : ''}</div>`;

function htmlDiario() {
  if (esDM()) {
    const pjs = listaPj();
    const sel = pjs.find(([id]) => id === ui.diarioDe) ? ui.diarioDe : (pjs[0] || [])[0];
    return `<section class="pergamino" id="h-diario">
      <h2 class="panel-titulo">Diarios del grupo</h2>
      ${pjs.length ? `<div class="pj-chips" style="margin:0 0 10px">${pjs.map(([id]) => `<button type="button" class="chip chip-btn${id === sel ? ' activo' : ''}" style="--c:${F(id).color}" data-accion="diario-ver" data-id="${esc(id)}" aria-pressed="${id === sel}">${esc(F(id).nombre)} <span class="num">${entradasDiario(id).length}</span></button>`).join('')}</div>
      <div class="bitacora">${entradasDiario(sel).map(([k, x]) => htmlEntradaDiario(sel, k, x, false)).join('') || `<p style="margin:0">${esc(F(sel).nombre)} todavía no ha escrito nada.</p>`}</div>` : '<p style="margin:0">Todavía no hay personajes.</p>'}
    </section>`;
  }
  const yo = ui.yo && abierto(ui.yo) ? ui.yo : null;
  if (!yo) return `<section class="pergamino" id="h-diario"><h2 class="panel-titulo">Mi diario</h2><p style="margin:0">Abre tu personaje en <a href="#ficha">Mi personaje</a> para escribir tu diario. Solo lo ven tú y el DM.</p></section>`;
  return `<section class="pergamino" id="h-diario">
    <h2 class="panel-titulo">Diario de ${esc(F(yo).nombre)}</h2>
    <p style="margin:0 0 8px;font-size:15px;color:var(--tinta-suave)">Lo que escribas aquí solo lo ven tú y el DM.</p>
    <label class="sr" for="diario-txt">Nueva entrada del diario</label>
    <textarea class="campo campo-claro" id="diario-txt" data-borrador placeholder="Lo que viste, lo que sospechas, lo que planeas…">${val('diario-txt')}</textarea>
    <div class="fila" style="margin:8px 0 12px"><button type="button" class="btn btn-oro" data-accion="diario-guardar">Guardar en mi diario</button></div>
    <div class="bitacora">${entradasDiario(yo).map(([k, x]) => htmlEntradaDiario(yo, k, x, true)).join('') || '<p style="margin:0">Todavía no hay entradas.</p>'}</div>
  </section>`;
}

function vistaHistoria() {
  const e = E.escena || {};
  const pistas = porOrden(E.pistas, (p) => p.ts || 0).map(([, p]) => p);
  const galeria = Object.entries(imgs()).filter(([, i]) => i.tipo !== 'mapa' && i.visible);
  const bloques = (vis) => [
    ['h-mundo', 'El mundo', vis('mundo').length && `<div class="enciclopedia">${vis('mundo').map(([, m]) => `<article class="entrada-mundo">${imgClic(m.img, 'banda')}<div class="fila-sep"><h3>${esc(m.titulo)}</h3>${m.tipo ? `<span class="tag ${m.tipo}">${TIPO[m.tipo] || ''}</span>` : ''}</div>${m.texto ? `<p>${esc(m.texto)}</p>` : ''}${listasVistoDicho(m, 'Novedades')}</article>`).join('')}</div>`],
    ['h-pnj', 'Personajes no jugadores', vis('pnj').length && `<div class="pnjs">${vis('pnj').map(([, p]) => `<article class="pnj">${srcDe(p.img) ? imgClic(p.img) : '<div class="sin-retrato" aria-hidden="true">?</div>'}<div class="pnj-txt"><h3>${esc(p.titulo)}</h3>${p.sub ? `<div class="tenue" style="font-size:14px">${esc(p.sub)}</div>` : ''}${p.texto ? `<p>${esc(p.texto)}</p>` : ''}${listasVistoDicho(p)}</div></article>`).join('')}</div>`],
    ['h-lugares', 'Lugares', vis('lugares').length && `<div class="tarjetas">${vis('lugares').map(([, l]) => `<article class="tarjeta">${imgClic(l.img)}<div class="tarjeta-txt"><div class="fila-sep"><h3>${esc(l.titulo)}</h3>${l.sub ? `<span class="chip">${esc(l.sub)}</span>` : ''}</div>${l.texto ? `<p>${esc(l.texto)}</p>` : ''}${listasVistoDicho(l, 'Novedades')}</div></article>`).join('')}</div>`],
    ['h-objetos', 'Objetos', vis('objetos').length && `<div class="objetos">${vis('objetos').map(([, o]) => `<article class="objeto">${srcDe(o.img) ? imgClic(o.img) : ''}<div><h3>${esc(o.titulo)}</h3>${o.sub ? `<div class="tenue" style="font-size:14px">${esc(o.sub)}</div>` : ''}${o.texto ? `<p>${esc(o.texto)}</p>` : ''}${listasVistoDicho(o, 'Novedades')}</div></article>`).join('')}</div>`],
    ['h-insc', 'Inscripciones', vis('inscripciones').length && `<div class="inscripciones">${vis('inscripciones').map(([, i]) => `<div class="inscripcion">${srcDe(i.img) ? imgClic(i.img, 'insc-img') : ''}<div class="insc-texto">${esc(i.titulo)}</div>${i.sub ? `<div class="tenue" style="font-size:14px">${esc(i.sub)}</div>` : ''}${i.texto ? `<div style="font-size:15px">${esc(i.texto)}</div>` : ''}</div>`).join('')}</div>`],
    ['h-misterios', 'Misterios', vis('misterios').length && `<div class="pj-chips">${vis('misterios').filter(([, m]) => !m.resuelto).map(([, m]) => `<span class="chip conc">${esc(m.titulo)}</span>`).join('') || '<span class="tenue">Ninguno abierto.</span>'}</div>${vis('misterios').some(([, m]) => m.resuelto) ? `<p class="sub" style="margin-top:12px">Resueltos</p><div class="pj-chips">${vis('misterios').filter(([, m]) => m.resuelto).map(([, m]) => `<span class="chip resuelto">✓ ${esc(m.titulo)}</span>`).join('')}</div>` : ''}`],
  ].filter((x) => x[2]);
  const grupos = listaGrupos();
  const enGrupo = (gid) => (cat) => visibles(cat).filter(([, x]) => grupoDe(x) === gid);
  const conGrupos = grupos.length && grupos.some(([gid]) => bloques(enGrupo(gid)).length);
  const secciones = conGrupos
    ? [...grupos, ['', { nombre: 'Otros' }]].map(([gid, g]) => [`hg-${gid || 'otros'}`, esc(g.nombre), bloques(enGrupo(gid)).map(([, t, h]) => `<p class="sub hg-sub">${t}</p>${h}`).join(''), `h:${gid || 'otros'}`]).filter((x) => x[2])
    : bloques(visibles);
  secciones.push(...[
    ['h-galeria', 'Galería', galeria.length && `<div class="galeria">${galeria.map(([, i]) => `<figure><img src="${i.src}" alt="${esc(i.nombre)}" data-accion="ver-imagen" data-src="${esc(i.src)}" loading="lazy"><figcaption>${esc(i.nombre)}</figcaption></figure>`).join('')}</div>`],
  ].filter((x) => x[2]));
  return `${secciones.length ? `<nav class="indice" aria-label="Secciones de la historia">${[['h-escena', 'Dónde estamos'], ...secciones.map(([id, t]) => [id, t]), ['h-diario', esDM() ? 'Diarios' : 'Mi diario']].map(([id, t]) => `<button type="button" class="chip" data-accion="ir-seccion" data-id="${id}">${t}</button>`).join('')}</nav>` : ''}
  <div class="historia">
    <div class="columna">
      <section class="panel" id="h-escena">
        <h2 class="panel-titulo">Dónde estamos</h2>
        <h1 style="font-size:24px;color:var(--oro-claro)">${esc(e.lugar || 'Sin lugar definido')}</h1>
        ${e.alerta ? `<div class="alerta" style="margin-top:10px"><span class="alerta-icono" aria-hidden="true"></span><span>${esc(e.alerta)}</span></div>` : ''}
        ${e.texto ? `<p style="margin:10px 0 0">${esc(e.texto)}</p>` : ''}
      </section>
      ${secciones.map(([id, t, html, plegable]) => (plegable
        ? `<details class="panel plegable" id="${id}" data-plegar="${esc(plegable)}"${abiertoAttr(plegable)}><summary><h2 class="panel-titulo">${t}</h2></summary>${html}</details>`
        : `<section class="panel" id="${id}"><h2 class="panel-titulo">${t}</h2>${html}</section>`)).join('')}
      ${secciones.length ? '' : '<div class="vacio">La historia está vacía. El DM la va llenando desde DM → Biblioteca.</div>'}
    </div>
    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Pistas del grupo</h2>
        <div class="pistas">${pistas.length ? pistas.map(htmlPista).join('') : '<p class="tenue" style="margin:0">Todavía no hay pistas.</p>'}</div>
      </section>
      ${htmlDiario()}
    </div>
  </div>`;
}

/* ================= DM ================= */
function botonConfirmar(clave, etiqueta, accion, datos, clase = 'btn') {
  if (ui.confirmar === clave) return `<span class="confirmar"><span>¿Seguro?</span><button type="button" class="btn btn-oro btn-peq" data-accion="${accion}" ${datos}>Sí, ${esc(etiqueta.toLowerCase())}</button><button type="button" class="btn btn-peq" data-accion="no-confirmar">No</button></span>`;
  return `<button type="button" class="${clase}" data-accion="pedir" data-que="${esc(clave)}">${esc(etiqueta)}</button>`;
}
const val = (id, def) => esc(ui.borradores[id] ?? def ?? '');
const opcionesImg = (sel, filtro = (i) => i.tipo !== 'mapa', vacio = 'Sin imagen') => `<option value="">${vacio}</option>${Object.entries(imgs()).filter(([, i]) => filtro(i)).map(([k, i]) => `<option value="${esc(k)}"${sel === k ? ' selected' : ''}>${esc(i.nombre)} (${TIPOS_IMG[i.tipo]})</option>`).join('')}`;

function vistaConfigDM() {
  return `<section class="panel" style="max-width:520px;margin:0 auto">
    <h2 class="panel-titulo">Configura tu campaña</h2>
    <p style="margin:0 0 12px">Eres el primer DM en entrar. Ponle nombre a la campaña y crea el PIN del DM: solo quien lo tenga podrá llevar la mesa, editar la Historia y ver todas las fichas.</p>
    <div class="columna" style="gap:10px">
      <div><label class="etq" for="cfg-nombre">Nombre de la campaña</label><input class="campo" style="width:100%" id="cfg-nombre" data-borrador value="${val('cfg-nombre', (E.campana || {}).nombre)}"></div>
      <div><label class="etq" for="cfg-pin">PIN del DM (4 dígitos)</label><input class="campo" style="width:100%" id="cfg-pin" data-borrador inputmode="numeric" maxlength="4" autocomplete="off" value="${val('cfg-pin')}"></div>
      <div><label class="etq" for="cfg-pin2">Repite el PIN</label><input class="campo" style="width:100%" id="cfg-pin2" data-borrador inputmode="numeric" maxlength="4" autocomplete="off" value="${val('cfg-pin2')}"></div>
      <div class="fila"><button type="button" class="btn btn-oro" data-accion="cfg-guardar">Empezar la campaña</button></div>
    </div>
  </section>`;
}

function vistaDM() {
  if (!(E.campana || {}).pinDM) return vistaConfigDM();
  if (!esDM()) return vistaPin('dm');
  const tabs = [['mesa', 'Mesa'], ['personajes', 'Personajes'], ['banco', 'Banco PNJ'], ['biblioteca', 'Biblioteca'], ['reglas', 'Reglas'], ['ajustes', 'Ajustes']];
  const cuerpo = { mesa: dmMesa, personajes: dmPersonajes, banco: dmBanco, biblioteca: dmBiblioteca, reglas: () => vistaReglasSRD('dm', ui.reglas.dm, render), ajustes: dmAjustes }[ui.dmTab]();
  return `<div class="seg" role="tablist" aria-label="Secciones del DM">${tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${ui.dmTab === k}" data-accion="dm-tab" data-tab="${k}">${t}</button>`).join('')}</div>${cuerpo}`;
}

function dmCombate() {
  const c = C();
  if (c.activo) {
    const lista = participantes();
    const dentro = new Set(lista.map(([, p]) => `${p.tipo}:${p.ref}`));
    const fuera = [...listaPj().map(([id]) => [`pj:${id}`, F(id).nombre]), ...porOrden(E.presencias).map(([k, p]) => [`pr:${k}`, p.nombre])].filter(([v]) => !dentro.has(v));
    return `<section class="panel">
      <h2 class="panel-titulo">${icono('espadas')} Combate <span class="extra">Ronda ${c.ronda}</span></h2>
      ${htmlAccionesDM()}
      <div class="fila" style="margin-bottom:12px"><button type="button" class="btn" data-accion="turno" data-d="-1">◀ Anterior</button><button type="button" class="btn btn-oro" data-accion="turno" data-d="1">Siguiente turno ▶</button></div>
      <ol class="orden dm">${lista.map(([pid, p]) => `<li class="${pid === c.turno ? 'actual' : ''}${derrotadoP(p) ? ' caido' : ''}" style="--c:${colorP(p)}">
        <label class="sr" for="cini-${pid}">Iniciativa de ${esc(nombreP(p))}</label><input class="campo num ini-in" id="cini-${pid}" type="number" inputmode="numeric" value="${esc(p.ini ?? '')}" data-cambio="ini" data-pid="${pid}">
        <span class="quien">${esc(nombreP(p))}${derrotadoP(p) ? ' <span class="tenue">(derrotado, se salta)</span>' : ocultoP(p) ? ' <span class="tenue">(oculto en la mesa)</span>' : ''}</span>
        ${pid === c.turno ? '<span class="su-turno">Su turno</span>' : `<button type="button" class="btn btn-peq" data-accion="turno-a" data-pid="${pid}">Darle el turno</button>`}
        <button type="button" class="btn btn-peq btn-peligro" data-accion="cb-quitar" data-pid="${pid}" aria-label="Quitar a ${esc(nombreP(p))} del combate">×</button></li>`).join('')}</ol>
      ${htmlBancoCombate()}
      <p class="sub" style="margin-top:14px">Sumar a alguien que ya está en escena u otro</p>
      <p class="tenue" style="margin:0 0 6px;font-size:14px">Si dejas la iniciativa vacía y es un PNJ del banco, se tira sola.</p>
      <div class="form-grid tres">
        <div><label class="etq" for="cb-add">Quién</label><select class="campo" id="cb-add" data-borrador><option value="">Otro (escribe el nombre)</option>${fuera.map(([v, n]) => `<option value="${esc(v)}"${ui.borradores['cb-add'] === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        <div><label class="etq" for="cb-add-nombre">Nombre (si es otro)</label><input class="campo" id="cb-add-nombre" data-borrador value="${val('cb-add-nombre')}"></div>
        <div><label class="etq" for="cb-add-ini">Iniciativa</label><input class="campo num" id="cb-add-ini" type="number" inputmode="numeric" data-borrador data-enter="cb-add" value="${val('cb-add-ini')}"></div>
      </div>
      <div class="fila" style="margin-top:10px"><button type="button" class="btn btn-peq" data-accion="cb-add">Sumar</button></div>
      <div style="margin-top:16px">${botonConfirmar('fin-combate', 'Terminar combate', 'fin-combate', '', 'btn btn-peligro')}</div>
    </section>`;
  }
  if (!ui.prepCombate) {
    return `<section class="panel">
      <h2 class="panel-titulo">${icono('espadas')} Combate</h2>
      <p class="tenue" style="margin:0 0 10px;font-size:15px">Cada jugador tira su d20 de iniciativa y te dice el total. La mesa muestra el orden, la ronda y a quién le toca; cada jugador ve en su celular cuando es su turno.</p>
      <button type="button" class="btn btn-oro" data-accion="prep-combate">Preparar combate</button>
    </section>`;
  }
  const cands = [
    ...listaPj().map(([id]) => ({ k: `pj-${id}`, nombre: F(id).nombre, mod: F(id).iniciativa || '', def: true, color: F(id).color })),
    ...porOrden(E.presencias).filter(([, p]) => !p.derrotado).map(([k, p]) => ({ k: `pr-${k}`, nombre: p.nombre + (p.oculto ? ' (oculto)' : ''), mod: p.ini || '', def: p.tipo !== 'neutral', color: COLOR_TIPO[p.tipo] || COLOR_TIPO.enemigo })),
  ];
  return `<section class="panel">
    <h2 class="panel-titulo">${icono('espadas')} Preparar combate</h2>
    <p class="tenue" style="margin:0 0 10px;font-size:15px">Marca quién pelea y escribe su iniciativa. «Tirar» lanza un d20 digital y le suma el modificador, útil para los enemigos.</p>
    ${cands.length ? `<ul class="prep">${cands.map((x) => { const marcado = ui.borradores['cb-' + x.k] ?? x.def; return `<li style="--c:${x.color}">
      <label class="check"><input type="checkbox" id="cb-${x.k}" data-borrador-check${marcado ? ' checked' : ''}> ${esc(x.nombre)}${x.mod ? ` <span class="tenue num">(${esc(x.mod)})</span>` : ''}</label>
      <label class="sr" for="ini-${x.k}">Iniciativa de ${esc(x.nombre)}</label><input class="campo num ini-in" id="ini-${x.k}" type="number" inputmode="numeric" placeholder="—" data-borrador value="${val('ini-' + x.k)}">
      <button type="button" class="btn btn-peq" data-accion="tirar" data-k="${x.k}" data-mod="${esc(x.mod)}">Tirar</button></li>`; }).join('')}</ul>` : '<p class="tenue">No hay personajes ni presencias en escena todavía.</p>'}
    ${cands.some((x) => x.k.startsWith('pr-')) ? '<div class="fila" style="margin-top:10px"><button type="button" class="btn btn-peq" data-accion="tirar-pnj">Tirar la iniciativa de todos los PNJ</button></div>' : ''}
    ${htmlBancoCombate()}
    <p class="sub" style="margin-top:12px">Otro combatiente (opcional)</p>
    <div class="form-grid dos"><div><label class="etq" for="cb-extra-nombre">Nombre</label><input class="campo" id="cb-extra-nombre" data-borrador value="${val('cb-extra-nombre')}"></div><div><label class="etq" for="cb-extra-ini">Iniciativa</label><input class="campo num" id="cb-extra-ini" type="number" inputmode="numeric" data-borrador value="${val('cb-extra-ini')}"></div></div>
    <div class="fila" style="margin-top:14px"><button type="button" class="btn btn-oro" data-accion="empezar-combate">Empezar combate</button><button type="button" class="btn" data-accion="cancelar-combate">Cancelar</button></div>
  </section>`;
}

function dmAmbiente() {
  const { a } = ambienteActual();
  const sel = (id, campo, lista, actual) => `<div><label class="etq" for="${id}">${{ momento: 'Momento del día', luz: 'Luz', clima: 'Clima', temperatura: 'Temperatura' }[campo]}</label><select class="campo" id="${id}" data-cambio="amb" data-campo="${campo}">${Object.entries(lista).map(([k, x]) => `<option value="${k}"${k === actual ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>`;
  return `<section class="panel">
    <h2 class="panel-titulo">Ambiente</h2>
    <div class="fila-sep" style="margin-bottom:10px">
      <div class="contador"><span class="recurso-nombre">Día</span><button type="button" class="btn btn-red btn-peq" data-accion="dia" data-d="-1" aria-label="Día anterior">−</button><b class="num">${esc(a.dia || 1)}</b><button type="button" class="btn btn-red btn-peq" data-accion="dia" data-d="1" aria-label="Día siguiente">+</button></div>
      <button type="button" class="btn btn-oro" data-accion="avanzar-tiempo">Avanzar el tiempo ▶</button>
    </div>
    <div class="form-grid dos">
      ${sel('amb-momento', 'momento', MOMENTOS, a.momento || 'manana')}
      ${sel('amb-luz', 'luz', LUCES, a.luz || 'brillante')}
      ${sel('amb-clima', 'clima', CLIMAS, a.clima || 'despejado')}
      ${sel('amb-temp', 'temperatura', TEMPERATURAS, a.temperatura || 'templado')}
    </div>
    <div class="agregar"><label class="sr" for="amb-sens">Sensación del lugar</label><input id="amb-sens" placeholder="Sensación del lugar (ej. Huele a azufre y se oye agua goteando)" data-borrador data-enter="amb-sens" value="${val('amb-sens', a.sensacion)}"><button type="button" class="btn btn-peq" data-accion="amb-sens">Mostrar</button></div>
  </section>`;
}

function dmRelojes() {
  const lista = porOrden(E.relojes);
  return `<section class="panel">
    <h2 class="panel-titulo">Relojes</h2>
    <p class="tenue" style="margin:0 0 10px;font-size:15px">Cuentas regresivas para lo que avanza mientras el grupo actúa: refuerzos que llegan, un ritual que se completa, una marea que sube.</p>
    <div class="agregar" style="margin-top:0"><label class="sr" for="rl-nombre">Nombre del reloj</label><input id="rl-nombre" placeholder="Ej. Los guardias dan la alarma" data-borrador data-enter="rl-crear" value="${val('rl-nombre')}">
      <label class="sr" for="rl-seg">Segmentos</label><select class="campo campo-peq" id="rl-seg" data-borrador style="margin:0;width:auto">${[4, 6, 8].map((n) => `<option value="${n}"${(ui.borradores['rl-seg'] || '6') == n ? ' selected' : ''}>${n} partes</option>`).join('')}</select>
      <button type="button" class="btn btn-peq" data-accion="rl-crear">Crear</button></div>
    ${lista.map(([k, r]) => `<div class="recurso"><div class="fila" style="gap:12px;flex-wrap:nowrap;min-width:0">${svgReloj(r.llenos || 0, r.segmentos, 40)}<div style="min-width:0"><div class="recurso-nombre">${esc(r.nombre)}</div><div class="recurso-det num">${r.llenos || 0} de ${r.segmentos}</div></div></div>
      <div class="fila" style="flex:none">${pips(r.llenos || 0, r.segmentos, 'reloj', `data-k="${esc(k)}"`, 'reloj-pip')}<button type="button" class="btn btn-peq btn-peligro" data-accion="rl-borrar" data-k="${esc(k)}" aria-label="Borrar reloj ${esc(r.nombre)}">×</button></div></div>`).join('')}
  </section>`;
}

function filaPresenciaDM(k, p) {
  const est = Object.keys(p.estados || {});
  const conPv = +p.pvMax > 0; const pv = pvPr(p);
  const salud = conPv && !p.derrotado ? saludAprox(pv, +p.pvMax) : null;
  const t = plantillaDe(p);
  const ataques = (p.ataques || []).filter((a) => a && a.nombre);
  return `<div class="recurso pr-dm${p.oculto ? ' oculta' : ''}${esTurnoDe('pr', k) ? ' turno' : ''}"><div style="min-width:0;flex:1">
    <div class="recurso-nombre">${esc(p.nombre)} <span class="tenue">· ${esc(TIPOS_PRESENCIA[p.tipo] || 'Enemigo')}${p.oculto ? ' · oculto en la mesa' : ''}</span></div>
    ${conPv ? `<div class="recurso-det num">${p.derrotado ? 'Derrotado · ' : ''}PV <b style="color:var(--texto)">${pv}</b>/${p.pvMax}${p.ca !== '' && p.ca != null ? ` · CA ${esc(p.ca)}` : ''}${salud ? ` · la mesa ve «${salud.texto}»` : ''}</div><div class="barra-pv ${nivelPv(pv, +p.pvMax)}" style="margin:5px 0 2px"><span style="width:${pct(pv, +p.pvMax)}%"></span></div>`
      : `<div class="recurso-det">${p.derrotado ? 'Derrotado' : `${p.dano || 0} de daño recibido`}${p.ca !== '' && p.ca != null ? ` · CA ${esc(p.ca)}` : ''}</div>`}
    <div class="pj-chips">${est.map((x) => `<span class="chip est">${esc(x)}<button type="button" data-accion="pr-estado-quitar" data-k="${esc(k)}" data-e="${esc(x)}" aria-label="Quitar ${esc(x)}">×</button></span>`).join('')}</div>
    ${conPv ? `<div class="agregar"><label class="sr" for="pr-cant-${esc(k)}">Cantidad de PV para ${esc(p.nombre)}</label><input id="pr-cant-${esc(k)}" type="number" min="1" inputmode="numeric" placeholder="PV" data-borrador data-enter="pr-cant" data-k="${esc(k)}" data-tipo="dano" value="${val('pr-cant-' + k)}"><button type="button" class="btn btn-peq btn-peligro" data-accion="pr-cant" data-k="${esc(k)}" data-tipo="dano">Daño</button><button type="button" class="btn btn-peq btn-bien" data-accion="pr-cant" data-k="${esc(k)}" data-tipo="cura">Curar</button></div>` : ''}
    <div class="agregar"><label class="sr" for="pr-est-${esc(k)}">Estado</label><input id="pr-est-${esc(k)}" placeholder="Estado" data-borrador data-enter="pr-estado" data-k="${esc(k)}" value="${val('pr-est-' + k)}"><button type="button" class="btn btn-peq" data-accion="pr-estado" data-k="${esc(k)}">Añadir</button></div>
    ${ataques.length ? `<div class="atq-lista">${ataques.map((a, i) => { const bono = bonoNum(a.bono); const conDado = !!tirarExpr(a.dano); return `<div class="atq"><span class="atq-nombre">${esc(a.nombre)}</span><span class="fila" style="gap:6px">${bono != null ? `<button type="button" class="btn btn-peq" data-accion="pr-atacar" data-k="${esc(k)}" data-i="${i}">Atacar ${bono >= 0 ? '+' : '−'}${Math.abs(bono)}</button>` : a.bono ? `<span class="chip">${esc(a.bono)}</span>` : ''}${conDado ? `<button type="button" class="btn btn-peq" data-accion="pr-dano-tirar" data-k="${esc(k)}" data-i="${i}" title="${esc(a.dano)}">Daño</button><button type="button" class="btn btn-peq" data-accion="pr-dano-tirar" data-k="${esc(k)}" data-i="${i}" data-crit="1" title="Crítico: dobla los dados">Crít.</button>` : ''}</span></div>`; }).join('')}</div>` : ''}
    ${t ? `<details class="pl-perfil" data-abrir="m:${esc(k)}"${ui.abiertos.has('m:' + k) ? ' open' : ''}><summary>Perfil de ${esc(t.nombre)}</summary>${htmlPerfil(t)}</details>` : ''}
  </div>
  <div class="fila" style="flex:none;justify-content:flex-end;max-width:200px">${conPv ? '' : `<button type="button" class="btn btn-red btn-peq" data-accion="pr-dano" data-k="${esc(k)}" data-d="-1" aria-label="Quitar daño">−</button><button type="button" class="btn btn-red btn-peq" data-accion="pr-dano" data-k="${esc(k)}" data-d="1" aria-label="Sumar daño">+</button>`}<button type="button" class="btn btn-peq" data-accion="pr-derrotado" data-k="${esc(k)}">${p.derrotado ? 'Revivir' : 'Derrotado'}</button><button type="button" class="btn btn-peq${p.oculto ? ' btn-oro' : ''}" data-accion="pr-oculto" data-k="${esc(k)}">${p.oculto ? 'Mostrar' : 'Ocultar'}</button><button type="button" class="btn btn-peq btn-peligro" data-accion="pr-quitar" data-k="${esc(k)}">Quitar</button></div></div>`;
}

function dmMesa() {
  const e = E.escena || {};
  const clave = mapaActual();
  const ilu = e.ilustracion && imgs()[e.ilustracion];
  const pistas = porOrden(E.pistas, (p) => p.ts || 0);
  return `<div class="narrador">
    <div class="columna">
      ${dmCombate()}
      ${dmTiradas()}
      <section class="panel">
        <h2 class="panel-titulo">En escena</h2>
        <p class="tenue" style="font-size:15px;margin:0 0 8px">Enemigos, aliados y personajes no jugadores que aparecen en el mapa y en la mesa.</p>
        ${listaBanco().length ? `<p class="sub" style="margin-top:4px">Desde el banco</p>
        <div class="fila" style="flex-wrap:nowrap;gap:8px"><label class="sr" for="pl-rapido">Plantilla del banco</label><select class="campo" id="pl-rapido" data-borrador style="flex:1;min-width:0">${opcionesBanco(ui.borradores['pl-rapido'] || '')}</select>
          <label class="sr" for="pl-rapido-cant">Cuántos</label><input class="campo num campo-cant" id="pl-rapido-cant" type="number" min="1" max="20" inputmode="numeric" data-borrador value="${val('pl-rapido-cant', '1')}"></div>
        ${opcionesEscena()}
        <div class="fila" style="margin:8px 0 4px"><button type="button" class="btn btn-peq btn-oro" data-accion="pl-escena" data-desde="rapido">Poner en escena</button></div>
        <p class="sub" style="margin-top:12px">O uno a mano</p>` : `<p class="tenue" style="font-size:14px;margin:0 0 8px">Crea plantillas en DM → Banco PNJ para ponerlas aquí con sus PV, CA y ataques.</p>`}
        <div class="form-grid tres">
          <div><label class="etq" for="pr-nombre">Nombre</label><input class="campo" id="pr-nombre" data-borrador data-enter="pr-agregar" value="${val('pr-nombre')}"></div>
          <div><label class="etq" for="pr-tipo">Tipo</label><select class="campo" id="pr-tipo" data-borrador>${Object.entries(TIPOS_PRESENCIA).map(([k, t]) => `<option value="${k}"${(ui.borradores['pr-tipo'] || 'enemigo') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label class="etq" for="pr-img">Retrato</label><select class="campo" id="pr-img" data-borrador>${opcionesImg(ui.borradores['pr-img'] || '', (i) => i.tipo === 'retrato', 'Sin retrato')}</select></div>
        </div>
        <div class="fila" style="margin:10px 0 4px"><button type="button" class="btn btn-peq btn-oro" data-accion="pr-agregar">Poner en escena</button></div>
        ${porOrden(E.presencias).map(([k, p]) => filaPresenciaDM(k, p)).join('')}
      </section>
      <section class="panel">
        <h2 class="panel-titulo">Pistas del grupo</h2>
        <div class="agregar" style="margin-top:0"><label class="sr" for="pista-grupo">Nueva pista para todos</label><input id="pista-grupo" placeholder="Algo que descubrió todo el grupo" data-borrador data-enter="pista-grupo" value="${val('pista-grupo')}"><button type="button" class="btn btn-peq" data-accion="pista-grupo">Añadir</button></div>
        <ul class="lista inv" style="margin-top:8px">${pistas.map(([k, p]) => `<li><span>${esc(typeof p === 'string' ? p : p.texto)}</span><button type="button" data-accion="pista-grupo-quitar" data-k="${esc(k)}" aria-label="Quitar pista">×</button></li>`).join('') || '<li class="tenue">Ninguna.</li>'}</ul>
        <p class="tenue" style="font-size:14px;margin:8px 0 0">Las pistas privadas se mandan desde la pestaña Personajes.</p>
      </section>

    </div>

    <div class="columna">
      ${dmAmbiente()}
      ${dmRelojes()}
      <section class="panel">
        <h2 class="panel-titulo">Mapa</h2>
        ${ilu ? `<div class="aviso-ilu"><span>En la mesa se ve la imagen <b>${esc(ilu.nombre)}</b>.</span><button type="button" class="btn btn-peq btn-oro" data-accion="mostrar" data-id="">Volver al mapa</button></div>` : ''}
        ${mapas().length ? `<div class="fila-sep" style="margin-bottom:10px">
          <div class="fila">${mapas().map(([k, m]) => `<button type="button" class="btn btn-peq${k === clave ? ' btn-oro' : ''}" data-accion="mapa" data-k="${esc(k)}" aria-pressed="${k === clave}">${esc(m.nombre)}</button>`).join('')}</div>
          <button type="button" class="btn btn-peq${ui.moverFichas ? ' btn-oro' : ''}" data-accion="mover" aria-pressed="${ui.moverFichas}">${ui.moverFichas ? 'Listo' : 'Mover fichas'}</button>
        </div>` : ''}
        ${htmlMapa(ui.moverFichas)}
        ${ui.moverFichas ? '<p class="tenue" style="font-size:14px;margin:8px 0 0">Arrastra las fichas. Se mueven en todas las pantallas al soltarlas.</p>' : ''}
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Escena</h2>
        <div class="columna" style="gap:10px">
          <div><label class="etq" for="esc-lugar">Lugar</label><input class="campo" style="width:100%" id="esc-lugar" data-borrador value="${val('esc-lugar', e.lugar)}"></div>
          <div><label class="etq" for="esc-alerta">Alerta (vacía para quitarla)</label><input class="campo" style="width:100%" id="esc-alerta" data-borrador value="${val('esc-alerta', e.alerta)}"></div>
          <div><label class="etq" for="esc-texto">Situación</label><textarea class="campo" id="esc-texto" data-borrador style="min-height:90px">${val('esc-texto', e.texto)}</textarea></div>
          <div class="fila"><button type="button" class="btn btn-oro" data-accion="escena-guardar">Guardar escena</button></div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Descansos</h2>
        <p class="tenue" style="font-size:15px;margin:0 0 10px">El corto recupera los recursos de descanso corto. El largo recupera además PV, espacios de conjuro y recursos de descanso largo, y termina la concentración.</p>
        <div class="fila">
          ${botonConfirmar('descanso-corto', 'Descanso corto', 'descanso', 'data-tipo="corto"')}
          ${botonConfirmar('descanso-largo', 'Descanso largo', 'descanso', 'data-tipo="largo"')}
        </div>
      </section>
    </div>
  </div>`;
}

function dmPersonajes() {
  if (ui.editandoPj) return vistaEditor();
  const pjs = listaPj();
  return `<div class="columna">
    <div class="fila-sep"><p class="tenue" style="margin:0">Crea las fichas aquí o deja que cada jugador cree la suya desde Mi personaje.</p>
      <div class="fila">
        <label class="btn" for="imp-archivo">Importar fichas</label><input type="file" id="imp-archivo" class="sr" accept=".json,application/json" data-cambio="importar">
        ${pjs.length ? '<button type="button" class="btn" data-accion="exportar">Exportar fichas</button>' : ''}
        <button type="button" class="btn btn-oro" data-accion="pj-nuevo">Crear personaje</button>
      </div></div>
    ${pjs.length ? '' : '<div class="vacio">Todavía no hay personajes.</div>'}
    <div class="dm-pjs">${pjs.map(([id]) => {
      const f = F(id); const pv = pvDe(id);
      return `<section class="panel dm-pj" style="--c:${f.color}">
        <div class="dm-pj-cab">${avatar(id)}<div style="min-width:0;flex:1"><div class="pj-nombre">${esc(f.nombre)}</div><div class="pj-clase">${esc([f.raza, f.clase, f.nivel ? 'Nivel ' + f.nivel : ''].filter(Boolean).join(' · '))}</div>
          ${tienePv(id) ? `<div class="barra-pv ${nivelPv(pv, f.pvMax)}"><span style="width:${pct(pv, f.pvMax)}%"></span></div>` : ''}<div class="pj-clase num" style="margin-top:4px">${tienePv(id) ? `${pv}/${f.pvMax} PV` : 'PV por definir'} · CA ${esc(dato(caDe(id).valor))} · PIN <b class="num" style="color:var(--oro-claro)">${esc(f.pin)}</b></div></div></div>
        <div class="fila" style="margin-top:10px">
          <button type="button" class="btn btn-peq" data-accion="pj-ver" data-id="${esc(id)}">Ver ficha</button>
          <button type="button" class="btn btn-peq" data-accion="pj-editar" data-id="${esc(id)}">Editar</button>
          <button type="button" class="btn btn-peq" data-accion="pista-abrir" data-id="${esc(id)}">Pista privada</button>
          ${botonConfirmar('borrar-pj-' + id, 'Borrar', 'pj-borrar', `data-id="${esc(id)}"`, 'btn btn-peq btn-peligro')}
        </div>
        ${secretosDe(id) ? `<details class="secretos"><summary>Secretos del DM</summary><p class="pre">${esc(secretosDe(id))}</p></details>` : ''}
        ${ui.pistaPara === id ? `<div class="columna" style="gap:8px;margin-top:10px">
          <label class="etq" for="pista-txt">Pista que solo verá ${esc(f.nombre)}</label>
          <textarea class="campo" id="pista-txt" data-borrador style="min-height:70px">${val('pista-txt')}</textarea>
          <label class="sr" for="pista-img">Imagen</label><select class="campo campo-peq" id="pista-img" data-borrador>${opcionesImg(ui.borradores['pista-img'] || '')}</select>
          <div class="fila"><button type="button" class="btn btn-oro btn-peq" data-accion="pista-enviar" data-id="${esc(id)}">Enviar</button><button type="button" class="btn btn-peq" data-accion="pista-cerrar">Cancelar</button></div>
        </div>` : ''}
      </section>`;
    }).join('')}</div>
  </div>`;
}

/* ---------- Combate compartido: ataques de los jugadores, curaciones y registro ----------
   combate/acciones/<id> = { ts, de (pj), objetivo (presencia), ataque, golpe, nat, dano, tipoDano, critico }: esperan al DM.
   combate/registro/<id> = { ts, texto }: lo que pasó, sin números de vida; se ve en la mesa. Ambos se borran al terminar el combate. */
const accionesPend = () => porOrden(C().acciones, (a) => a.ts);
const registroCombate = () => porOrden(C().registro, (r) => r.ts);
const tipoDeDano = (t) => String(t || '').replace(/\d*\s*[dD]\d+|[+\-−–]|\d+/g, ' ').replace(/\s+/g, ' ').trim();
const nombreVisiblePr = (k) => { const p = presencia(k); return !p ? 'Alguien' : p.oculto ? 'Alguien oculto' : p.nombre; };
function anotar(u, texto) {
  if (!C().activo) return;
  const l = registroCombate();
  if (l.length >= 30) u[`combate/registro/${l[0][0]}`] = null;
  u[`combate/registro/${nuevoId('r')}`] = { texto, ts: Date.now() };
}

function htmlRegistro() {
  const l = registroCombate().slice(-6).reverse();
  if (!C().activo || !l.length) return '';
  return `<section class="panel"><h2 class="panel-titulo">Lo que pasó</h2><ul class="registro">${l.map(([, r], i) => `<li${i === 0 ? ' class="nuevo"' : ''}>${esc(r.texto)}</li>`).join('')}</ul></section>`;
}

function sugerencia(x, p) {
  if (x.golpe === '' || x.golpe == null) return { clase: '', texto: 'Sin tirada para golpear: decide tú (¿una salvación?)' };
  if (+x.nat === 20) return { clase: 'si', texto: '¡20 natural! Crítico: acierta' };
  if (+x.nat === 1) return { clase: 'no', texto: '1 natural: falla' };
  if (!p || p.ca === '' || p.ca == null) return { clase: '', texto: 'No tiene CA anotada: decide tú' };
  return +x.golpe >= +p.ca ? { clase: 'si', texto: `Acierta (CA ${p.ca})` } : { clase: 'no', texto: `Falla (CA ${p.ca})` };
}
const textoAccion = (x) => `${(presencia(x.objetivo) || {}).nombre || '¿?'} · ${x.ataque}${x.golpe !== '' && x.golpe != null ? ` · ${x.golpe} para golpear` : ''}${x.dano !== '' && x.dano != null ? ` · ${x.dano} de daño` : ''}`;

function htmlAccionesDM() {
  const l = accionesPend(); if (!l.length) return '';
  return `<div class="acciones-dm"><p class="sub" style="margin-top:0">Ataques de los jugadores</p>${l.map(([k, x]) => {
    const p = presencia(x.objetivo);
    const sv = x.salva ? String(ui.borradores['sv-' + k] || '').split('|') : null;
    const s = !x.salva ? sugerencia(x, p) : !sv[0] ? { clase: '', texto: `Tira su salvación de ${NOMBRE_SALVA[x.salva.attr] || x.salva.attr} contra CD ${x.salva.cd}` }
      : +sv[0] >= +x.salva.cd ? { clase: 'no', texto: `Supera (${sv[0]}): ${x.salva.mitad ? 'recibe la mitad' : 'no le pasa nada'}` } : { clase: 'si', texto: `Falla (${sv[0]}): recibe todo el daño` };
    const golpe = x.salva ? `salvación de ${NOMBRE_SALVA[x.salva.attr] || x.salva.attr} CD ${x.salva.cd}${x.salva.mitad ? ' (mitad si supera)' : ''}` : x.golpe !== '' && x.golpe != null ? `${x.golpe} para golpear${x.nat ? ` (d20: ${x.nat})` : ''}` : 'sin tirada para golpear';
    const dano = x.dano !== '' && x.dano != null ? `${x.dano} de daño${x.tipoDano ? ' ' + x.tipoDano : ''}${x.critico ? ' (crítico)' : ''}` : 'sin daño';
    return `<div class="accion ${s.clase}" style="--c:${F(x.de).color || 'var(--oro)'}">
      <div style="min-width:0;flex:1"><div><b>${esc(F(x.de).nombre || 'Jugador')}</b> → <b>${esc(p ? p.nombre : 'alguien que ya no está')}</b> · ${esc(x.ataque)}</div>
        <div class="recurso-det">${esc(golpe)} · ${esc(dano)}${p && +p.pvMax > 0 ? ` · le quedan ${pvPr(p)} PV` : ''}</div>
        <div class="accion-sug">${esc(s.texto)}</div></div>
      <div class="fila accion-botones">${p ? `<label class="sr" for="ad-${esc(k)}">Daño a aplicar</label><input class="campo num campo-cant" id="ad-${esc(k)}" type="number" min="0" inputmode="numeric" data-borrador value="${val('ad-' + k, x.dano)}">
        ${x.salva ? `<button type="button" class="btn btn-peq" data-accion="acc-salva" data-k="${esc(k)}">Tirar su salvación</button>
        <button type="button" class="btn btn-peq btn-oro" data-accion="acc-aplicar" data-k="${esc(k)}" data-f="1">Todo el daño</button>
        <button type="button" class="btn btn-peq" data-accion="acc-aplicar" data-k="${esc(k)}" data-f="0.5">Mitad</button>
        <button type="button" class="btn btn-peq btn-peligro" data-accion="acc-fallo" data-k="${esc(k)}">Sin daño</button>` : `<button type="button" class="btn btn-peq btn-oro" data-accion="acc-aplicar" data-k="${esc(k)}" data-f="1">Acierta</button>
        <button type="button" class="btn btn-peq" data-accion="acc-aplicar" data-k="${esc(k)}" data-f="0.5" title="Resistencia: la mitad del daño">Mitad</button>
        <button type="button" class="btn btn-peq btn-peligro" data-accion="acc-fallo" data-k="${esc(k)}">Falla</button>`}` : `<button type="button" class="btn btn-peq" data-accion="acc-fallo" data-k="${esc(k)}">Descartar</button>`}</div>
    </div>`;
  }).join('')}</div>`;
}

// Panel de combate en la ficha del jugador
function htmlCombateJugador(id) {
  if (!C().activo) return '';
  const b = ui.borradores;
  const objetivos = porOrden(E.presencias).filter(([, p]) => !p.oculto && !p.derrotado);
  const ataques = ataquesPj(id, true);
  const sel = b['ja-atq'] ?? (ataques.length ? '0' : 'otro');
  const elegido = sel === 'otro' ? null : ataques[+sel];
  const multi = !!(elegido && elegido.salva);
  const modo = b['ja-modo'] || 'normal';
  const mias = accionesPend().filter(([, x]) => x.de === id);
  const compas = listaPj().filter(([oid]) => oid !== id && tienePv(oid));
  return `<section class="panel ancho combate-jugador">
    <h2 class="panel-titulo">${icono('espadas')} Atacar</h2>
    ${objetivos.length ? `${multi ? `<div><span class="etq">A quiénes alcanza (cada uno hace su salvación)</span><div class="multi-obj">${objetivos.map(([k, p]) => `<label class="check"><input type="checkbox" id="jm-${esc(k)}" data-borrador-check${b['jm-' + k] ?? (b['ja-obj'] ? b['ja-obj'] === k : false) ? ' checked' : ''}> ${esc(p.nombre)}</label>`).join('')}</div></div>` : `<div><label class="etq" for="ja-obj">A quién</label><select class="campo" style="width:100%" id="ja-obj" data-borrador>${objetivos.map(([k, p]) => `<option value="${esc(k)}"${b['ja-obj'] === k ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>`}
    <p class="etq" style="margin:12px 0 4px">Con qué <span class="tenue" style="font-family:var(--f-cuerpo);letter-spacing:0">(toca el nombre para elegirlo, o tira directo)</span></p>
    <div class="seg seg-peq" role="group" aria-label="Modo de la tirada">${[['normal', 'Normal'], ['ventaja', 'Ventaja'], ['desventaja', 'Desventaja']].map(([k, t]) => `<button type="button" aria-pressed="${modo === k}" data-accion="ja-modo" data-m="${k}">${t}</button>`).join('')}</div>
    ${htmlListaAtaques(id, true)}
    ${sel === 'otro' ? `<div style="margin-top:8px"><label class="etq" for="ja-otro">¿Qué usas?</label><input class="campo" style="width:100%" id="ja-otro" data-borrador placeholder="Ej. Rayo de escarcha" value="${val('ja-otro')}"></div>` : ''}
    <div class="form-grid dos" style="margin-top:10px">
      <div><label class="etq" for="ja-golpe">Tirada para golpear (total)</label><input class="campo num" style="width:100%" id="ja-golpe" type="number" inputmode="numeric" placeholder="—" data-borrador value="${val('ja-golpe')}">
        <p class="ayuda" style="margin:4px 0 0">Con dados físicos, escribe el total. Vacía si el enemigo hace una salvación.</p></div>
      <div><label class="etq" for="ja-dano">Daño (total)</label><input class="campo num" style="width:100%" id="ja-dano" type="number" min="0" inputmode="numeric" placeholder="—" data-borrador value="${val('ja-dano')}">
        <label class="check" style="margin-top:6px"><input type="checkbox" id="ja-crit" data-borrador-check${b['ja-crit'] ? ' checked' : ''}> ¡20 natural! Crítico</label></div>
    </div>
    ${b['ja-detalle'] ? `<p class="tenue num" style="margin:8px 0 0;font-size:14px">${esc(b['ja-detalle'])}</p>` : ''}
    <div class="fila" style="margin-top:10px"><button type="button" class="btn btn-oro" data-accion="ja-enviar" data-id="${esc(id)}">Enviar al DM</button></div>`
    : '<p class="tenue" style="margin:0">No hay enemigos a la vista.</p>'}
    ${mias.length ? `<p class="sub" style="margin-top:12px">Esperando al DM</p><ul class="lista inv">${mias.map(([k, x]) => `<li><span>${esc(textoAccion(x))}</span><button type="button" data-accion="ja-cancelar" data-k="${esc(k)}" data-id="${esc(id)}" aria-label="Cancelar">×</button></li>`).join('')}</ul>` : ''}
    ${compas.length ? `<details class="pl-perfil" data-abrir="cura"${ui.abiertos.has('cura') ? ' open' : ''}><summary>Curar a un compañero</summary>
      <div class="fila" style="margin-top:8px;flex-wrap:nowrap;gap:6px"><label class="sr" for="ja-cura-obj">A quién</label><select class="campo" id="ja-cura-obj" data-borrador style="flex:1;min-width:0">${compas.map(([oid]) => `<option value="${esc(oid)}"${b['ja-cura-obj'] === oid ? ' selected' : ''}>${esc(F(oid).nombre)}</option>`).join('')}</select>
        <label class="sr" for="ja-cura-cant">Cuántos PV</label><input class="campo num campo-cant" id="ja-cura-cant" type="number" min="1" inputmode="numeric" placeholder="PV" data-borrador data-enter="ja-curar" data-id="${esc(id)}" value="${val('ja-cura-cant')}">
        <button type="button" class="btn btn-peq btn-bien" data-accion="ja-curar" data-id="${esc(id)}">Curar</button></div></details>` : ''}
  </section>`;
}

/* ---------- Banco de PNJ ---------- */
// Borradores del banco que se conservan al limpiar el formulario
const PL_PERSISTE = ['pl-buscar', 'pl-opt-oculto', 'pl-opt-tirarpv', 'pl-opt-combate', 'pl-rapido', 'pl-rapido-cant'];
const CAMPOS_PL = ['nombre', 'grupo', 'tipo', 'img', 'vd', 'desc', 'ca', 'caNota', 'pv', 'dadosPv', 'velocidad', 'ini', 'notas'];
const LISTAS_PL = {
  otros: { etq: 'Salvaciones, habilidades, sentidos, idiomas, resistencias…', ayuda: 'Uno por línea', ej: 'Habilidades: Sigilo +6\nSentidos: Visión en la oscuridad 18 m; Percepción pasiva 9\nIdiomas: Común, Goblin' },
  ataques: { etq: 'Ataques (con botones para tirar)', ayuda: 'Uno por línea: Nombre | bono | daño', ej: 'Cimitarra | +4 | 1d6 + 2 cortante\nArco corto | +4 | 1d6 + 2 perforante' },
  rasgos: { etq: 'Rasgos', ayuda: 'Uno por línea: Nombre: descripción', ej: 'Escapada ágil: Puede Destrabarse o Esconderse como acción adicional.' },
  acciones: { etq: 'Otras acciones y reacciones', ayuda: 'Una por línea: Nombre: descripción', ej: 'Multiataque: Hace dos ataques con la cimitarra.' },
};
const gruposBanco = () => [...new Set(listaBanco().map(([, t]) => (t.grupo || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
const lineaStats = (t) => [t.ca !== '' && t.ca != null ? `CA ${t.ca}` : '', +t.pv > 0 ? `PV ${t.pv}${t.dadosPv ? ` (${t.dadosPv})` : ''}` : t.dadosPv ? `PV ${t.dadosPv}` : '', t.ini ? `Ini ${t.ini}` : '', t.vd ? `VD ${t.vd}` : ''].filter(Boolean).join(' · ');
const avatarPl = (t, clase = 'pl-avatar') => (srcDe(t.img) ? `<img class="${clase}" src="${srcDe(t.img)}" alt="">` : `<span class="${clase} avatar-ini ${esc(t.tipo || 'enemigo')}" aria-hidden="true">${esc((t.nombre || '?').slice(0, 2).replace(/^./, (c) => c.toUpperCase()))}</span>`);

function htmlPerfil(t) {
  const atr = ATRIBUTOS.filter((a) => (t.atributos || {})[a] !== '' && (t.atributos || {})[a] != null);
  const bloque = (titulo, lista) => ((lista || []).length ? `<p class="sub">${titulo}</p>${lista.map((r) => `<div class="rasgo"><b>${esc(r.nombre)}</b>${r.texto ? `<p>${esc(r.texto)}</p>` : ''}</div>`).join('')}` : '');
  return `<div class="perfil">
    ${t.desc ? `<p class="perfil-desc">${esc(t.desc)}</p>` : ''}
    <ul class="lista perfil-datos">
      <li><span>Clase de armadura</span><span class="val">${esc(dato(t.ca))}${t.caNota ? ` <span class="tenue">(${esc(t.caNota)})</span>` : ''}</span></li>
      <li><span>Puntos de golpe</span><span class="val">${esc(+t.pv > 0 ? t.pv : '—')}${t.dadosPv ? ` <span class="tenue">(${esc(t.dadosPv)})</span>` : ''}</span></li>
      ${t.velocidad ? `<li><span>Velocidad</span><span class="val">${esc(t.velocidad)}</span></li>` : ''}
      ${t.ini ? `<li><span>Iniciativa</span><span class="val">${esc(t.ini)}</span></li>` : ''}
      ${t.vd ? `<li><span>Valor de desafío</span><span class="val">${esc(t.vd)}</span></li>` : ''}
    </ul>
    ${atr.length ? `<div class="perfil-atr">${atr.map((a) => `<div><span>${a}</span><b class="num">${esc(t.atributos[a])}</b><small class="num">${mod(+t.atributos[a])}</small></div>`).join('')}</div>` : ''}
    ${(t.otros || []).length ? `<ul class="vinetas perfil-otros">${t.otros.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${bloque('Rasgos', t.rasgos)}
    ${(t.ataques || []).length ? `<p class="sub">Ataques</p><ul class="lista">${t.ataques.map((a) => `<li><span>${esc(a.nombre)}</span><span class="val">${esc([a.bono, a.dano].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>` : ''}
    ${bloque('Otras acciones', t.acciones)}
    ${t.notas ? `<div class="lista-campo secreto" style="margin-top:10px"><span class="etq">Notas del DM</span><p class="pre" style="margin:4px 0 0">${esc(t.notas)}</p></div>` : ''}
  </div>`;
}

function cargarPlantilla(id, copia = false) {
  limpiar('pl-', PL_PERSISTE);
  const t = id === 'nuevo' ? { tipo: 'enemigo' } : (E.banco || {})[id] || {};
  const b = ui.borradores;
  for (const k of CAMPOS_PL) b['pl-' + k] = t[k] ?? '';
  if (copia) b['pl-nombre'] = `${t.nombre} (copia)`;
  for (const a of ATRIBUTOS) b['pl-atr-' + a] = (t.atributos || {})[a] ?? '';
  b['pl-otros'] = (t.otros || []).join('\n');
  b['pl-ataques'] = listaATexto('ataques', t.ataques);
  b['pl-rasgos'] = listaATexto('rasgos', t.rasgos);
  b['pl-acciones'] = listaATexto('rasgos', t.acciones);
  ui.editandoPl = copia ? 'nuevo' : id;
}

function formPlantilla() {
  const ed = ui.editandoPl && ui.editandoPl !== 'nuevo' ? (E.banco || {})[ui.editandoPl] : null;
  const campo = (k, etq, extra = '') => `<div><label class="etq" for="pl-${k}">${etq}</label><input class="campo" id="pl-${k}" data-borrador value="${val('pl-' + k)}" ${extra}></div>`;
  return `<section class="panel editor" id="form-plantilla">
    <h2 class="panel-titulo">${ed ? `Editar «${esc(ed.nombre)}»` : 'Nueva plantilla'}</h2>
    <p class="tenue" style="margin:0 0 6px;font-size:15px">Todo es opcional menos el nombre. Con PV la mesa muestra su salud aproximada; con ataques tendrás botones para tirarlos.</p>
    <p class="sub">Quién es</p>
    <div class="form-grid">
      ${campo('nombre', 'Nombre *', 'placeholder="Ej. Bandido"')}
      <div><label class="etq" for="pl-grupo">Grupo (bosque, arco 1, no muertos…)</label><input class="campo" id="pl-grupo" data-borrador list="pl-grupos" value="${val('pl-grupo')}"><datalist id="pl-grupos">${gruposBanco().map((g) => `<option value="${esc(g)}">`).join('')}</datalist></div>
      <div><label class="etq" for="pl-tipo">Llega a la escena como</label><select class="campo" id="pl-tipo" data-borrador>${Object.entries(TIPOS_PRESENCIA).map(([k, t]) => `<option value="${k}"${(ui.borradores['pl-tipo'] || 'enemigo') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label class="etq" for="pl-img">Retrato</label><select class="campo" id="pl-img" data-borrador>${opcionesImg(ui.borradores['pl-img'] || '', (i) => i.tipo === 'retrato', 'Sin retrato')}</select></div>
      ${campo('desc', 'Tamaño, tipo y alineamiento', 'placeholder="Ej. Humanoide mediano, neutral"')}
      ${campo('vd', 'Valor de desafío', 'placeholder="Ej. 1/8"')}
    </div>
    <p class="sub">Combate</p>
    <div class="form-grid">
      ${campo('ca', 'Clase de armadura', 'type="number" min="0" inputmode="numeric"')}
      ${campo('caNota', 'Nota de la CA (ej. armadura de cuero)')}
      ${campo('pv', 'PV (promedio)', 'type="number" min="1" inputmode="numeric"')}
      ${campo('dadosPv', 'Dados de golpe (ej. 2d8 + 2)')}
      ${campo('velocidad', 'Velocidad')}
      ${campo('ini', 'Modificador de iniciativa (ej. +2)')}
    </div>
    <p class="sub">Atributos</p>
    <div class="form-grid seis">${ATRIBUTOS.map((a) => `<div><label class="etq" for="pl-atr-${a}" title="${NOMBRE_ATRIBUTO[a]}">${a}</label><input class="campo num" id="pl-atr-${a}" type="number" min="1" max="30" inputmode="numeric" data-borrador value="${val('pl-atr-' + a)}"></div>`).join('')}</div>
    ${Object.entries(LISTAS_PL).map(([k, l]) => `<div class="lista-campo"><label class="etq" for="pl-${k}">${l.etq}</label><p class="ayuda">${esc(l.ayuda)}</p><textarea class="campo" id="pl-${k}" data-borrador placeholder="${esc(l.ej)}">${val('pl-' + k)}</textarea></div>`).join('')}
    <div class="lista-campo secreto"><label class="etq" for="pl-notas">Notas del DM</label><p class="ayuda">Táctica, botín, qué sabe… Nunca salen en la mesa.</p><textarea class="campo" id="pl-notas" data-borrador style="min-height:70px">${val('pl-notas')}</textarea></div>
    <div class="fila" style="margin-top:16px"><button type="button" class="btn btn-oro" data-accion="pl-guardar">${ed ? 'Guardar cambios' : 'Añadir al banco'}</button>${ui.editandoPl || ui.borradores['pl-nombre'] ? '<button type="button" class="btn" data-accion="pl-cancelar">Cancelar</button>' : ''}</div>
  </section>`;
}

// Opciones al poner copias en escena (compartidas entre el banco y la Mesa)
function opcionesEscena(pre = 'pl', conCombate = true) {
  const b = ui.borradores;
  return `<div class="pl-opciones">
    <label class="check"><input type="checkbox" id="${pre}-opt-oculto" data-borrador-check${b[pre + '-opt-oculto'] ? ' checked' : ''}> Llegan ocultos (no salen en la TV hasta que los muestres)</label>
    <label class="check"><input type="checkbox" id="${pre}-opt-tirarpv" data-borrador-check${b[pre + '-opt-tirarpv'] ? ' checked' : ''}> Tirar los PV de cada copia con sus dados de golpe</label>
    ${conCombate && C().activo ? `<label class="check"><input type="checkbox" id="${pre}-opt-combate" data-borrador-check${(b[pre + '-opt-combate'] ?? true) ? ' checked' : ''}> Sumarlos al combate en curso tirando su iniciativa</label>` : ''}
  </div>`;
}

// Bloque del panel de combate para traer PNJ del banco (al preparar o con el combate en curso)
function htmlBancoCombate() {
  if (!listaBanco().length) return `<p class="sub" style="margin-top:14px">Enemigos del banco</p><p class="tenue" style="margin:0;font-size:14px">Crea plantillas en DM → Banco PNJ para sumarlas aquí con sus PV, CA, ataques e iniciativa.</p>`;
  return `<div class="cb-banco">
    <p class="sub" style="margin-top:0">Sumar desde el banco</p>
    <div class="fila" style="flex-wrap:nowrap;gap:8px"><label class="sr" for="cbpl-sel">Plantilla del banco</label><select class="campo" id="cbpl-sel" data-borrador style="flex:1;min-width:0">${opcionesBanco(ui.borradores['cbpl-sel'] || '')}</select>
      <label class="sr" for="cbpl-cant">Cuántos</label><input class="campo num campo-cant" id="cbpl-cant" type="number" min="1" max="20" inputmode="numeric" data-borrador data-enter="cb-banco" value="${val('cbpl-cant', '1')}"></div>
    ${opcionesEscena('cbpl', false)}
    <div class="fila" style="margin-top:8px"><button type="button" class="btn btn-peq btn-oro" data-accion="cb-banco">Sumar al combate</button><span class="tenue" style="font-size:14px">Entran en escena con su iniciativa ya tirada.</span></div>
  </div>`;
}
const opcionesBanco = (sel) => {
  const grupos = new Map();
  for (const [k, t] of listaBanco()) { const g = (t.grupo || '').trim(); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push([k, t]); }
  const opt = ([k, t]) => `<option value="${esc(k)}"${sel === k ? ' selected' : ''}>${esc(t.nombre)}${lineaStats(t) ? ` · ${esc(lineaStats(t))}` : ''}</option>`;
  return [...grupos.entries()].sort(([a], [b]) => (!a) - (!b) || a.localeCompare(b, 'es')).map(([g, l]) => (grupos.size > 1 || g ? `<optgroup label="${esc(g || 'Sin grupo')}">${l.map(opt).join('')}</optgroup>` : l.map(opt).join(''))).join('');
};

function dmBanco() {
  const q = norm(ui.borradores['pl-buscar']);
  const todos = listaBanco();
  const lista = q ? todos.filter(([, t]) => norm(`${t.nombre} ${t.grupo || ''} ${t.desc || ''}`).includes(q)) : todos;
  const grupos = new Map();
  for (const [k, t] of lista) { const g = (t.grupo || '').trim(); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push([k, t]); }
  const orden = [...grupos.keys()].sort((a, b) => (!a) - (!b) || a.localeCompare(b, 'es'));
  const item = ([k, t]) => `<li class="pl-item">
    <div class="pl-cab">${avatarPl(t)}<div style="min-width:0;flex:1"><div class="pl-nombre">${esc(t.nombre)} <span class="tenue">· ${esc(TIPOS_PRESENCIA[t.tipo] || 'Enemigo')}</span></div>${t.desc ? `<div class="pl-desc">${esc(t.desc)}</div>` : ''}${lineaStats(t) ? `<div class="pl-desc num">${esc(lineaStats(t))}</div>` : ''}</div></div>
    <div class="fila pl-acc">
      <span class="fila" style="gap:6px;flex:none"><label class="sr" for="pl-cant-${esc(k)}">Cuántos</label><input class="campo num campo-cant" id="pl-cant-${esc(k)}" type="number" min="1" max="20" inputmode="numeric" data-borrador value="${val('pl-cant-' + k, '1')}"><button type="button" class="btn btn-peq btn-oro" data-accion="pl-escena" data-id="${esc(k)}">A escena</button></span>
      <button type="button" class="btn btn-peq" data-accion="pl-editar" data-id="${esc(k)}">Editar</button>
      <button type="button" class="btn btn-peq" data-accion="pl-duplicar" data-id="${esc(k)}">Duplicar</button>
      ${botonConfirmar('borrar-pl-' + k, 'Borrar', 'pl-borrar', `data-id="${esc(k)}"`, 'btn btn-peq btn-peligro')}
    </div>
    <details class="pl-perfil" data-abrir="b:${esc(k)}"${ui.abiertos.has('b:' + k) ? ' open' : ''}><summary>Ver perfil</summary>${htmlPerfil(t)}</details>
  </li>`;
  const cuerpo = !todos.length ? '<div class="vacio" style="margin-top:12px">El banco está vacío. Crea tu primera plantilla con el formulario o importa un archivo.</div>'
    : !lista.length ? '<p class="tenue" style="margin:12px 0 0">Ninguna plantilla coincide con la búsqueda.</p>'
    : orden.map((g) => {
      const clave = `p:${g || 'sin'}`; const l = grupos.get(g);
      const ul = `<ul class="pl-lista">${l.map(item).join('')}</ul>`;
      if (orden.length === 1 && !g) return ul;
      return `<details class="grupo-bib" data-plegar="${esc(clave)}"${q ? ' open' : abiertoAttr(clave)}><summary><span class="grupo-nombre">${esc(g || 'Sin grupo')} <span class="tenue">(${l.length})</span></span></summary>${ul}</details>`;
    }).join('');
  return `<div class="narrador">
    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Banco de PNJ <span class="extra">${todos.length} ${todos.length === 1 ? 'plantilla' : 'plantillas'}</span></h2>
        <p class="tenue" style="margin:0 0 10px;font-size:15px">Enemigos, aliados y personajes no jugadores que puedes usar una y otra vez. «A escena» crea copias numeradas (Bandido 1, Bandido 2…), cada una con sus propios PV y estados, en DM → Mesa.</p>
        <div class="fila" style="margin-bottom:10px">
          <button type="button" class="btn btn-peq btn-oro" data-accion="pl-nuevo">Nueva plantilla</button>
          <label class="btn btn-peq" for="imp-banco">Importar</label><input type="file" id="imp-banco" class="sr" accept=".json,application/json" data-cambio="importar-banco">
          ${todos.length ? '<button type="button" class="btn btn-peq" data-accion="exportar-banco">Exportar</button>' : ''}
        </div>
        ${todos.length ? `<label class="sr" for="pl-buscar">Buscar en el banco</label><input class="campo" style="width:100%" id="pl-buscar" type="search" placeholder="Buscar por nombre, grupo o tipo" data-borrador data-filtro value="${val('pl-buscar')}">${opcionesEscena()}` : ''}
        ${cuerpo}
      </section>
    </div>
    <div class="columna">${formPlantilla()}</div>
  </div>`;
}

function dmTiradas() {
  const modos = [['normal', 'Normal'], ['ventaja', 'Ventaja'], ['desventaja', 'Desventaja']];
  return `<section class="panel">
    <h2 class="panel-titulo">Tiradas del DM</h2>
    <p class="tenue" style="margin:0 0 8px;font-size:14px">Solo se ven en este dispositivo. La ventaja o desventaja se aplica a los ataques de los PNJ.</p>
    <div class="seg seg-peq" role="group" aria-label="Modo de los ataques">${modos.map(([k, t]) => `<button type="button" aria-pressed="${ui.modoTirada === k}" data-accion="modo-tirada" data-m="${k}">${t}</button>`).join('')}</div>
    <div class="agregar"><label class="sr" for="tl-expr">Tirada libre</label><input id="tl-expr" placeholder="Tirada libre, ej. 2d6 + 3 o d20" data-borrador data-enter="tirada-libre" value="${val('tl-expr')}"><button type="button" class="btn btn-peq" data-accion="tirada-libre">Tirar</button></div>
    ${ui.tiradas.length ? `<ul class="tiradas">${ui.tiradas.map((x) => `<li class="${esc(x.clase || '')}"><div style="min-width:0;flex:1"><b>${esc(x.texto)}</b><small>${esc(x.detalle || '')}</small>${x.aplicar ? (x.aplicado ? `<small class="aplicado">Aplicado a ${esc(x.aplicado)}</small>` : listaPj().some(([id]) => tienePv(id)) ? `<div class="fila aplicar"><label class="sr" for="ap-${x.id}">Aplicar a</label><select class="campo campo-peq" id="ap-${x.id}" data-borrador style="margin:0">${listaPj().filter(([id]) => tienePv(id)).map(([id]) => `<option value="${esc(id)}"${ui.borradores['ap-' + x.id] === id ? ' selected' : ''}>${esc(F(id).nombre)}</option>`).join('')}</select><button type="button" class="btn btn-peq btn-peligro" data-accion="tir-aplicar" data-t="${x.id}" data-f="1">Aplicar</button><button type="button" class="btn btn-peq" data-accion="tir-aplicar" data-t="${x.id}" data-f="0.5">Mitad</button></div>` : '') : ''}</div><span class="tenue num">${hora(x.ts)}</span></li>`).join('')}</ul><div class="fila" style="margin-top:8px"><button type="button" class="btn btn-peq" data-accion="tiradas-limpiar">Limpiar</button></div>` : ''}
  </section>`;
}

const ETIQUETA_SUB = { mundo: 'Subtítulo (opcional)', pnj: 'Quién es (ej. Herrero de la aldea)', lugares: 'Estado (ej. Sin explorar)', objetos: 'Detalle (ej. Lo tiene la guerrera)', inscripciones: 'Dónde está', misterios: '' };

function formEntrada() {
  const cat = ui.borradores['ent-cat'] || 'pnj';
  const ed = ui.editandoEnt;
  const esMist = cat === 'misterios';
  return `<section class="panel" id="form-entrada">
    <h2 class="panel-titulo">${ed ? 'Editar entrada' : 'Nueva entrada de la Historia'}</h2>
    <div class="columna" style="gap:10px">
      <div><label class="etq" for="ent-cat">Sección</label>
        <select class="campo" style="width:100%" id="ent-cat" data-borrador data-cambio="ent-cat" ${ed ? 'disabled' : ''}>${Object.entries(CATEGORIAS).map(([k, c]) => `<option value="${k}"${k === cat ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
      <div><label class="etq" for="ent-titulo">${esMist ? 'Pregunta o misterio' : cat === 'inscripciones' ? 'Texto de la inscripción' : 'Nombre o título'}</label><input class="campo" style="width:100%" id="ent-titulo" data-borrador value="${val('ent-titulo')}"></div>
      ${esMist ? `<label class="check"><input type="checkbox" id="ent-resuelto" data-borrador-check${ui.borradores['ent-resuelto'] ? ' checked' : ''}> Ya está resuelto</label>` : `
      <div><label class="etq" for="ent-sub">${ETIQUETA_SUB[cat]}</label><input class="campo" style="width:100%" id="ent-sub" data-borrador value="${val('ent-sub')}"></div>
      ${cat === 'mundo' ? `<div><label class="etq" for="ent-tipo">Etiqueta</label><select class="campo" style="width:100%" id="ent-tipo" data-borrador>${Object.entries(TIPO).map(([k, t]) => `<option value="${k}"${(ui.borradores['ent-tipo'] || 'hecho') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}
      <div><label class="etq" for="ent-texto">Descripción</label><textarea class="campo" id="ent-texto" data-borrador style="min-height:80px">${val('ent-texto')}</textarea></div>
      <div><label class="etq" for="ent-visto">Lo vimos (uno por línea)</label><textarea class="campo" id="ent-visto" data-borrador style="min-height:70px">${val('ent-visto')}</textarea></div>
      <div><label class="etq" for="ent-dicho">Lo dijeron, puede ser falso (uno por línea)</label><textarea class="campo" id="ent-dicho" data-borrador style="min-height:70px">${val('ent-dicho')}</textarea></div>
      <div><label class="etq" for="ent-misterio">Por descubrir</label><input class="campo" style="width:100%" id="ent-misterio" data-borrador value="${val('ent-misterio')}"></div>
      <div><label class="etq" for="ent-img">Imagen</label><select class="campo" style="width:100%" id="ent-img" data-borrador>${opcionesImg(ui.borradores['ent-img'] || '', () => true)}</select></div>`}
      <div><label class="etq" for="ent-grupo">Grupo o campaña</label><select class="campo" style="width:100%" id="ent-grupo" data-borrador data-cambio="ent-grupo-form">${opcionesGrupo(ui.borradores['ent-grupo'] || '')}<option value="__nuevo"${ui.borradores['ent-grupo'] === '__nuevo' ? ' selected' : ''}>＋ Crear un grupo nuevo…</option></select>
        ${ui.borradores['ent-grupo'] === '__nuevo' ? `<label class="sr" for="ent-grupo-nuevo">Nombre del grupo nuevo</label><input class="campo" style="width:100%;margin-top:6px" id="ent-grupo-nuevo" data-borrador placeholder="Nombre del grupo, p. ej. Arco 1: Karath Inu" value="${val('ent-grupo-nuevo')}">` : ''}</div>
      <div class="lista-campo secreto" style="margin-top:0"><label class="etq" for="ent-notas">Notas del DM</label><p class="ayuda">Nunca las ven los jugadores, aunque reveles la entrada.</p><textarea class="campo" id="ent-notas" data-borrador style="min-height:70px">${val('ent-notas')}</textarea></div>
      <label class="check"><input type="checkbox" id="ent-oculto" data-borrador-check${ui.borradores['ent-oculto'] ? ' checked' : ''}> Sin revelar (solo la ve el DM)</label>
      <div class="fila"><button type="button" class="btn btn-oro" data-accion="ent-guardar">${ed ? 'Guardar cambios' : 'Añadir a la Historia'}</button>${ed || ui.borradores['ent-titulo'] ? '<button type="button" class="btn" data-accion="ent-cancelar">Cancelar</button>' : ''}</div>
    </div>
  </section>`;
}

const opcionesGrupo = (sel) => `<option value="">Sin grupo</option>${listaGrupos().map(([k, g]) => `<option value="${esc(k)}"${sel === k ? ' selected' : ''}>${esc(g.nombre)}</option>`).join('')}`;

function filaEntrada(cat, id, x, lista, i) {
  return `<li class="${x.oculto ? 'oculta' : ''}">
    <span class="ent-nombre">${esc(x.titulo)}${x.oculto ? ' <span class="tenue">(sin revelar)</span>' : ''}${cat === 'misterios' && x.resuelto ? ' <span class="chip resuelto">Resuelto</span>' : ''}${!x.img && x.imgPendiente ? ` <span class="tenue" style="font-size:13px">· espera la imagen «${esc(x.imgPendiente)}»</span>` : ''}</span>
    <span class="fila" style="flex:none">
      <span class="flechas"><button type="button" class="btn btn-peq" data-accion="ent-mover" data-cat="${cat}" data-id="${esc(id)}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir ${esc(x.titulo)}">↑</button><button type="button" class="btn btn-peq" data-accion="ent-mover" data-cat="${cat}" data-id="${esc(id)}" data-d="1" ${i === lista.length - 1 ? 'disabled' : ''} aria-label="Bajar ${esc(x.titulo)}">↓</button></span>
      ${listaGrupos().length ? `<label class="sr" for="eg-${esc(id)}">Grupo de ${esc(x.titulo)}</label><select class="campo campo-peq" id="eg-${esc(id)}" data-cambio="ent-grupo" data-cat="${cat}" data-id="${esc(id)}">${opcionesGrupo(grupoDe(x))}</select>` : ''}
      <button type="button" class="btn btn-peq${x.oculto ? ' btn-oro' : ''}" data-accion="ent-revelar" data-cat="${cat}" data-id="${esc(id)}">${x.oculto ? 'Revelar' : 'Ocultar'}</button>
      <button type="button" class="btn btn-peq" data-accion="ent-editar" data-cat="${cat}" data-id="${esc(id)}">Editar</button>
      ${botonConfirmar(`borrar-ent-${cat}-${id}`, 'Borrar', 'ent-borrar', `data-cat="${cat}" data-id="${esc(id)}"`, 'btn btn-peq btn-peligro')}
    </span>${x.notasDM ? `<details class="secretos ancho-li"><summary>Notas del DM</summary><p class="pre">${esc(x.notasDM)}</p></details>` : ''}</li>`;
}

function htmlGruposBiblioteca(enc) {
  const grupos = listaGrupos();
  const todos = [...grupos, ['', { nombre: grupos.length ? 'Sin grupo' : '' }]];
  return todos.map(([gid, g], gi) => {
    const cats = Object.keys(CATEGORIAS).map((cat) => [cat, porOrden(enc[cat]).filter(([, x]) => grupoDe(x) === gid)]).filter(([, l]) => l.length);
    const total = cats.reduce((n, [, l]) => n + l.length, 0);
    const cuerpo = cats.map(([cat, l]) => `<p class="sub" style="margin-top:10px">${esc(CATEGORIAS[cat].nombre)}</p><ul class="lista entradas">${l.map(([id, x], i) => filaEntrada(cat, id, x, l, i)).join('')}</ul>`).join('') || '<p class="tenue" style="margin:8px 0 0;font-size:14px">Sin entradas. Asígnale entradas con el selector «Grupo» de cada una.</p>';
    if (!grupos.length) return total ? cuerpo : '<p class="tenue" style="margin:10px 0 0">Todavía no hay entradas.</p>';
    if (!gid && !total) return '';
    const renombrando = ui.renombrarGrupo === gid && gid;
    const cabeza = renombrando
      ? `<span class="fila" style="flex:1"><label class="sr" for="grupo-nombre">Nuevo nombre</label><input class="campo" id="grupo-nombre" data-borrador data-enter="grupo-renombrar" data-id="${esc(gid)}" value="${val('grupo-nombre', g.nombre)}" style="flex:1;min-width:140px"><button type="button" class="btn btn-peq btn-oro" data-accion="grupo-renombrar" data-id="${esc(gid)}">Guardar</button><button type="button" class="btn btn-peq" data-accion="grupo-renombrar-no">Cancelar</button></span>`
      : `<span class="grupo-nombre">${esc(g.nombre)} <span class="tenue">(${total})</span></span>
        ${gid ? `<span class="fila" style="flex:none">
          <button type="button" class="btn btn-peq" data-accion="grupo-mover" data-id="${esc(gid)}" data-d="-1" ${gi === 0 ? 'disabled' : ''} aria-label="Subir el grupo">↑</button><button type="button" class="btn btn-peq" data-accion="grupo-mover" data-id="${esc(gid)}" data-d="1" ${gi === grupos.length - 1 ? 'disabled' : ''} aria-label="Bajar el grupo">↓</button>
          <button type="button" class="btn btn-peq" data-accion="grupo-renombrar-si" data-id="${esc(gid)}">Renombrar</button>
          ${botonConfirmar(`borrar-grupo-${gid}`, 'Borrar', 'grupo-borrar', `data-id="${esc(gid)}"`, 'btn btn-peq btn-peligro')}
        </span>` : ''}`;
    const clave = `b:${gid || 'sin'}`;
    return `<details class="grupo-bib" data-plegar="${clave}"${abiertoAttr(clave)}><summary>${cabeza}</summary>${cuerpo}</details>`;
  }).join('');
}

function dmBiblioteca() {
  const enc = E.enciclopedia || {};
  const ilu = (E.escena || {}).ilustracion;
  return `<div class="narrador">
    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Subir imagen</h2>
        <div class="columna" style="gap:10px">
          <div><label class="etq" for="sub-archivo">Archivo</label><input class="campo" style="width:100%" type="file" id="sub-archivo" accept="image/*"></div>
          <div><label class="etq" for="sub-nombre">Nombre</label><input class="campo" style="width:100%" id="sub-nombre" data-borrador placeholder="Ej. Taberna del puerto" value="${val('sub-nombre')}"></div>
          <div><label class="etq" for="sub-tipo">Tipo</label><select class="campo" style="width:100%" id="sub-tipo" data-borrador>${Object.entries(TIPOS_IMG).map(([k, t]) => `<option value="${k}"${(ui.borradores['sub-tipo'] || 'ilustracion') === k ? ' selected' : ''}>${t}${k === 'mapa' ? ' (para mover fichas encima)' : k === 'retrato' ? ' (personajes y enemigos, se recorta cuadrado)' : ' (escenas y objetos)'}</option>`).join('')}</select></div>
          <label class="check"><input type="checkbox" id="sub-visible" data-borrador-check${ui.borradores['sub-visible'] ? ' checked' : ''}> Revelarla ya en la Galería de los jugadores</label>
          <div class="fila"><button type="button" class="btn btn-oro" data-accion="subir" ${ui.ocupado ? 'disabled' : ''}>${ui.ocupado ? 'Subiendo…' : 'Subir a la Biblioteca'}</button></div>
          ${sync.modo === 'demo' ? '<p class="tenue" style="font-size:14px;margin:0">En el modo de demostración el navegador guarda poco espacio: prueba con pocas imágenes.</p>' : ''}
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Imágenes</h2>
        ${Object.keys(TIPOS_IMG).map((t) => {
          const lista = Object.entries(imgs()).filter(([, i]) => i.tipo === t);
          return `<p class="sub" style="margin-top:6px">${PLURAL_IMG[t]}</p>
          <div class="biblio">${lista.map(([k, i]) => `<div class="biblio-item${i.visible || t === 'mapa' ? '' : ' oculta'}">
            <img src="${i.src}" alt="" data-accion="ver-imagen" data-src="${esc(i.src)}" loading="lazy">
            <div class="biblio-nombre">${esc(i.nombre)}${t !== 'mapa' ? (i.visible ? ' <span class="chip resuelto">Revelada</span>' : ' <span class="tenue">(sin revelar)</span>') : ''}</div>
            <div class="biblio-acc">
              ${t === 'mapa' ? `<button type="button" class="btn btn-peq" data-accion="mapa" data-k="${esc(k)}">Usar en la mesa</button>`
                : ilu === k ? '<button type="button" class="btn btn-peq btn-oro" data-accion="mostrar" data-id="">Quitar de la mesa</button>'
                : `<button type="button" class="btn btn-peq" data-accion="mostrar" data-id="${esc(k)}">Mostrar en la mesa</button>`}
              ${t !== 'mapa' ? `<button type="button" class="btn btn-peq" data-accion="img-visible" data-id="${esc(k)}">${i.visible ? 'Ocultar de la Galería' : 'Revelar en la Galería'}</button>` : ''}
              ${botonConfirmar('borrar-img-' + k, 'Borrar', 'img-borrar', `data-id="${esc(k)}"`, 'btn btn-peq btn-peligro')}
            </div>
          </div>`).join('') || '<p class="tenue" style="margin:0">Ninguna.</p>'}</div>`;
        }).join('')}
      </section>
    </div>

    <div class="columna">
      ${formEntrada()}
      <section class="panel">
        <h2 class="panel-titulo">Entradas de la Historia</h2>
        <div class="fila" style="margin-bottom:6px">
          <label class="btn btn-peq" for="imp-historia">Importar entradas</label><input type="file" id="imp-historia" class="sr" accept=".json,application/json" data-cambio="importar-historia">
          ${Object.values(enc).some((x) => Object.keys(x || {}).length) ? '<button type="button" class="btn btn-peq" data-accion="exportar-historia">Exportar entradas</button>' : ''}
        </div>
        <p class="tenue" style="font-size:14px;margin:0">Las entradas importadas llegan sin revelar. Revélalas cuando el grupo las descubra. Usa los grupos (arcos, capítulos, regiones…) para ordenarlas: los jugadores ven la Historia agrupada igual.</p>
        <div class="fila" style="margin-top:10px"><label class="sr" for="grupo-nuevo">Nombre del grupo nuevo</label><input class="campo" id="grupo-nuevo" data-borrador data-enter="grupo-crear" placeholder="Nuevo grupo, p. ej. Arco 1: Karath Inu" value="${val('grupo-nuevo')}" style="flex:1;min-width:180px"><button type="button" class="btn btn-peq" data-accion="grupo-crear">Crear grupo</button></div>
        ${htmlGruposBiblioteca(enc)}
      </section>
    </div>
  </div>`;
}

function dmAjustes() {
  const c = E.campana || {};
  return `<div class="narrador">
    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Campaña</h2>
        <div class="columna" style="gap:10px">
          <div><label class="etq" for="aj-nombre">Nombre de la campaña</label><input class="campo" style="width:100%" id="aj-nombre" data-borrador value="${val('aj-nombre', c.nombre)}"></div>
          <div><label class="etq" for="aj-cap">Capítulo o sesión (aparece bajo el nombre)</label><input class="campo" style="width:100%" id="aj-cap" data-borrador value="${val('aj-cap', c.capitulo)}"></div>
          <div class="fila"><button type="button" class="btn btn-oro" data-accion="aj-guardar">Guardar</button></div>
        </div>
      </section>
      <section class="panel">
        <h2 class="panel-titulo">PIN del DM</h2>
        <div class="columna" style="gap:10px">
          <div><label class="etq" for="aj-pin">PIN nuevo (4 dígitos)</label><input class="campo" style="width:100%" id="aj-pin" data-borrador inputmode="numeric" maxlength="4" autocomplete="off" value="${val('aj-pin')}"></div>
          <div><label class="etq" for="aj-pin2">Repite el PIN</label><input class="campo" style="width:100%" id="aj-pin2" data-borrador inputmode="numeric" maxlength="4" autocomplete="off" value="${val('aj-pin2')}"></div>
          <div class="fila"><button type="button" class="btn btn-oro" data-accion="aj-pin">Cambiar PIN</button><button type="button" class="btn" data-accion="bloquear" data-id="dm">Bloquear DM en este dispositivo</button></div>
        </div>
      </section>
    </div>
    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">PINs de los personajes</h2>
        <p class="tenue" style="margin:0 0 8px;font-size:15px">Pásale a cada jugador el suyo en privado.</p>
        <ul class="lista">${listaPj().map(([id]) => `<li><span>${esc(F(id).nombre)}</span><span class="val num">${esc(F(id).pin)}</span></li>`).join('') || '<li class="tenue">Todavía no hay personajes.</li>'}</ul>
      </section>
      <section class="panel zona-peligro">
        <h2 class="panel-titulo">Empezar de cero</h2>
        <p style="margin:0 0 10px">Borra toda la campaña: personajes, banco de PNJ, imágenes, Historia, escena y el PIN del DM. No se puede deshacer.</p>
        ${botonConfirmar('borrar-todo', 'Borrar toda la campaña', 'borrar-todo', '', 'btn btn-peligro')}
      </section>
    </div>
  </div>`;
}

/* ================= RENDER ================= */
const VISTAS = { mesa: vistaMesa, ficha: vistaFicha, historia: vistaHistoria, reglas: () => vistaReglasSRD('jugador', ui.reglas.jugador, render), dm: vistaDM };

function render() {
  if (!E || ui.arrastrando) return;
  const v = $('#vista');
  const act = document.activeElement;
  let foco = null;
  if (act && act.id && v.contains(act)) foco = { id: act.id, s: act.selectionStart, e: act.selectionEnd, scroll: act.scrollTop };
  const guardarArchivos = ['sub-archivo', 'pj-retrato-archivo'].map((id) => [id, $('#' + id) && $('#' + id).files && $('#' + id).files.length ? $('#' + id).files : null]);
  v.innerHTML = VISTAS[ui.ruta]();
  for (const [id, files] of guardarArchivos) if (files && $('#' + id)) try { $('#' + id).files = files; } catch (e) { /* no se puede conservar */ }
  if (foco) {
    const el = document.getElementById(foco.id);
    if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(foco.s, foco.e); } catch (e) { /* no aplica */ } el.scrollTop = foco.scroll || 0; }
  }
  document.querySelectorAll('[data-ruta]').forEach((a) => { if (a.dataset.ruta === ui.ruta) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const c = E.campana || {};
  $('#titulo-campana').textContent = c.nombre || 'Mesa del DM';
  $('#sub-capitulo').textContent = c.capitulo || '';
  document.title = c.nombre ? `${c.nombre} · Mesa del DM` : 'Mesa del DM';
  document.body.classList.toggle('tv', ui.tv);
  const s = $('#sync');
  s.classList.toggle('vivo', sync.modo === 'vivo' && sync.conectado);
  s.classList.toggle('caido', sync.modo === 'vivo' && !sync.conectado);
  $('.sync-texto', s).textContent = sync.modo === 'demo' ? 'Demostración' : sync.conectado ? 'En vivo' : 'Sin conexión';
  s.title = sync.modo === 'demo' ? (sync.error || 'Modo de demostración: sincroniza solo las pestañas de este dispositivo.') : 'Conectado a la campaña compartida.';
  montarMapa();
  const t = turnoDe();
  const clave = t ? `${C().ronda}:${C().turno}` : null;
  // Aviso al DM cuando llega un ataque nuevo de un jugador
  const pend = accionesPend().map(([k]) => k);
  if (ui.accionesVistas && esDM() && !ui.tv) {
    const nueva = pend.find((k) => !ui.accionesVistas.has(k));
    if (nueva) { const x = C().acciones[nueva]; aviso(`${F(x.de).nombre || 'Un jugador'} ataca a ${(presencia(x.objetivo) || {}).nombre || '¿?'}: revisa DM → Mesa`); try { navigator.vibrate && navigator.vibrate(120); } catch (e) { /* sin vibración */ } }
  }
  ui.accionesVistas = new Set(pend);
  if (clave !== ui.ultimoTurno) {
    if (ui.ultimoTurno !== 'inicio' && t && t.tipo === 'pj' && t.ref === ui.yo) { try { navigator.vibrate && navigator.vibrate([180, 80, 180]); } catch (e) { /* sin vibración */ } }
    ui.ultimoTurno = clave;
  }
}

function irA() {
  const h = (location.hash || '#mesa').slice(1);
  ui.tv = h === 'tv';
  ui.ruta = ui.tv ? 'mesa' : RUTAS.includes(h) ? h : 'mesa';
  ui.pin = ''; ui.pinError = false; ui.confirmar = null;
  render();
  window.scrollTo(0, 0);
}

/* ================= MAPA: arrastrar fichas ================= */
function montarMapa() {
  const m = $('#mapa.editable');
  if (!m) return;
  m.addEventListener('pointerdown', (ev) => {
    const f = ev.target.closest('.ficha-mapa');
    if (!f) return;
    ev.preventDefault();
    ui.arrastrando = true;
    f.classList.add('arrastrando');
    f.setPointerCapture(ev.pointerId);
    const caja = m.getBoundingClientRect();
    const mover = (e2) => {
      const x = Math.max(1, Math.min(99, ((e2.clientX - caja.left) / caja.width) * 100));
      const y = Math.max(1, Math.min(99, ((e2.clientY - caja.top) / caja.height) * 100));
      f.style.left = x + '%'; f.style.top = y + '%';
      f.dataset.x = x.toFixed(1); f.dataset.y = y.toFixed(1);
    };
    const soltar = () => {
      f.removeEventListener('pointermove', mover);
      f.removeEventListener('pointerup', soltar);
      f.removeEventListener('pointercancel', soltar);
      ui.arrastrando = false;
      if (f.dataset.x) sync.escribir({ [`fichas/${m.dataset.mapa}/${f.dataset.ficha}`]: { x: +f.dataset.x, y: +f.dataset.y } });
      else render();
    };
    f.addEventListener('pointermove', mover);
    f.addEventListener('pointerup', soltar);
    f.addEventListener('pointercancel', soltar);
  });
}

/* ================= IMÁGENES ================= */
// Reduce la imagen en el navegador antes de guardarla (los retratos se recortan cuadrados)
async function comprimir(file, tipo) {
  const max = tipo === 'mapa' ? 1600 : tipo === 'retrato' ? 512 : 1400;
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    await new Promise((ok, mal) => { im.onload = ok; im.onerror = mal; im.src = url; });
    let sx = 0, sy = 0, sw = im.naturalWidth, sh = im.naturalHeight;
    if (tipo === 'retrato') { const lado = Math.min(sw, sh); sx = (sw - lado) / 2; sy = Math.max(0, (sh - lado) / 4); sw = sh = lado; }
    const r = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * r); c.height = Math.round(sh * r);
    c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', tipo === 'mapa' ? 0.82 : 0.8);
  } finally { URL.revokeObjectURL(url); }
}
function avisarEspacio() { if (sync.sinEspacio) aviso('El modo de demostración se quedó sin espacio: se verá hasta que recargues.'); }

/* ================= ACCIONES ================= */
const escribirEstado = (id, ruta, valor) => sync.escribir({ [`personajes/${id}/estado/${ruta}`]: valor });
const pin4 = (p) => /^\d{4}$/.test(p);

function pinTecla(d) {
  if (ui.pin.length >= 4) return;
  ui.pin += d; ui.pinError = false;
  if (ui.pin.length === 4) {
    const id = ui.ruta === 'dm' ? 'dm' : ui.ver;
    if (pinDe(id) === ui.pin) {
      ui.desbloqueos[id] = ui.pin; guardarDesbloqueos();
      if (id !== 'dm') { ui.yo = id; ls.set('mesa-yo', id); }
      ui.pin = '';
      aviso(id === 'dm' ? 'Panel del DM abierto' : `Hola, ${F(id).nombre}`);
    } else { ui.pin = ''; ui.pinError = true; }
  }
  render();
}

function limpiar(prefijo, excepto = []) { for (const k of Object.keys(ui.borradores)) if (k.startsWith(prefijo) && !excepto.includes(k)) delete ui.borradores[k]; }

function descansoUpdates(tipo) {
  const u = {};
  for (const [id, p] of Object.entries(E.personajes || {})) {
    const f = p.ficha || {}; const b = `personajes/${id}/estado`;
    if (tipo === 'largo') {
      if (+f.pvMax > 0) u[`${b}/pv`] = +f.pvMax;
      for (let n = 1; n <= 9; n++) if (+((f.espacios || {})['n' + n] || 0) > 0) u[`${b}/espacios/n${n}`] = +f.espacios['n' + n];
      u[`${b}/concentra`] = '';
    }
    for (const r of f.recursos || []) if (r.recarga === 'corto' || (tipo === 'largo' && r.recarga === 'largo')) u[`${b}/recursos/${r.id}`] = r.max;
  }
  return u;
}

const ACCIONES = {
  elegir(d) { ui.ver = d.id; ui.pin = ''; ui.pinError = false; ui.editandoPj = null; if (ui.ruta !== 'ficha') location.hash = 'ficha'; else render(); },
  'pin-tecla'(d) { pinTecla(d.d); },
  'pin-borrar'() { ui.pin = ui.pin.slice(0, -1); ui.pinError = false; render(); },
  'pin-volver'() { if (ui.ruta === 'dm') location.hash = 'mesa'; else { ui.ver = null; render(); } },
  cambiar() { ui.ver = null; ui.editandoPj = null; render(); },
  bloquear(d) {
    delete ui.desbloqueos[d.id]; guardarDesbloqueos();
    if (ui.yo === d.id) { ui.yo = null; ls.set('mesa-yo', ''); }
    if (d.id !== 'dm') ui.ver = null;
    aviso('Bloqueado en este dispositivo'); render();
  },
  'ver-imagen'(d) { const c = $('#capa'); c.innerHTML = `<button type="button" class="btn cerrar" data-accion="cerrar-capa">Cerrar</button><img src="${esc(d.src)}" alt="">`; c.hidden = false; },
  'cerrar-capa'() { const c = $('#capa'); c.hidden = true; c.innerHTML = ''; },

  /* ficha */
  pv(d) { const f = F(d.id); if (!tienePv(d.id)) return; escribirEstado(d.id, 'pv', Math.max(0, Math.min(+f.pvMax, pvDe(d.id) + +d.d))); },
  'pv-cant'(d) {
    const n = parseInt($('#pv-cant').value, 10);
    if (!n || n < 0) { aviso('Escribe una cantidad primero'); $('#pv-cant').focus(); return; }
    const f = F(d.id); const actual = pvDe(d.id);
    const v = d.tipo === 'dano' ? Math.max(0, actual - n) : Math.min(+f.pvMax, actual + n);
    delete ui.borradores['pv-cant'];
    escribirEstado(d.id, 'pv', v);
    aviso(d.tipo === 'dano' ? `−${n} PV` : `+${v - actual} PV`);
  },
  esp(d) { const i = +d.i; const actual = espDe(d.id, d.n); escribirEstado(d.id, `espacios/n${d.n}`, i < actual ? i : i + 1); },
  rec(d) { const r = (F(d.id).recursos || []).find((x) => x.id === d.k); if (!r) return; const i = +d.i; const actual = recDe(d.id, r); escribirEstado(d.id, `recursos/${d.k}`, i < actual ? i : i + 1); },
  'rec-delta'(d) { const r = (F(d.id).recursos || []).find((x) => x.id === d.k); if (!r) return; escribirEstado(d.id, `recursos/${d.k}`, Math.max(0, Math.min(r.max, recDe(d.id, r) + +d.d))); },
  'conc-fin'(d) { escribirEstado(d.id, 'concentra', ''); },
  'conc-poner'(d) { const t = ($('#conc-in').value || '').trim(); if (!t) { aviso('Escribe el nombre del conjuro'); return; } delete ui.borradores['conc-in']; escribirEstado(d.id, 'concentra', t); },
  'estado-quitar'(d) { escribirEstado(d.id, `estados/${claveSegura(d.k)}`, null); },
  'estado-poner'(d) { const t = ($('#estado-in').value || '').trim(); if (!t) { aviso('Escribe el estado'); return; } delete ui.borradores['estado-in']; escribirEstado(d.id, `estados/${claveSegura(t)}`, true); },
  oro(d) { escribirEstado(d.id, 'oro', Math.max(0, (S(d.id).oro || 0) + +d.d)); },
  'inv-quitar'(d) { if (!esDM()) return; escribirEstado(d.id, `inventario/${d.k}`, null); },
  'inv-poner'(d) { const t = ($('#inv-in').value || '').trim(); if (!t) { aviso('Escribe el objeto'); return; } delete ui.borradores['inv-in']; escribirEstado(d.id, `inventario/${nuevoId('i')}`, t); },

  /* creador de personajes */
  'pj-nuevo'() { cargarEditor('nuevo'); render(); window.scrollTo(0, 0); },
  'pj-editar'(d) { cargarEditor(d.id); render(); window.scrollTo(0, 0); },
  'pj-ver'(d) { ui.ver = d.id; ui.editandoPj = null; location.hash = 'ficha'; },
  'pj-color'(d) { ui.borradores['pj-color'] = d.c; render(); },
  exportar() { exportarFichas(); },
  'pj-cancelar'() { ui.editandoPj = null; limpiar('pj-'); render(); window.scrollTo(0, 0); },
  async 'pj-guardar'() {
    const b = ui.borradores;
    const g = (k) => String(b['pj-' + k] ?? '').trim();
    const nuevo = ui.editandoPj === 'nuevo';
    const id = nuevo ? nuevoId('pj') : ui.editandoPj;
    const nombre = g('nombre'); const pin = g('pin'); const pvMax = parseInt(g('pvMax'), 10);
    if (!nombre) { aviso('Ponle nombre al personaje'); $('#pj-nombre').focus(); return; }
    if (!pin4(pin)) { aviso('El PIN debe tener 4 números'); $('#pj-pin').focus(); return; }
    if (listaPj().some(([oid, p]) => oid !== id && p.ficha.pin === pin) || pin === (E.campana || {}).pinDM) { aviso('Ese PIN ya lo usa otro. Elige uno distinto.'); $('#pj-pin').focus(); return; }
    const previo = nuevo ? {} : F(id);
    const num = (k) => { const v = parseInt(g(k), 10); return Number.isFinite(v) ? v : ''; };
    const ficha = {
      nombre, epiteto: g('epiteto'), raza: g('raza'), clase: g('clase'), subclase: g('subclase'), genero: g('genero'), alineamiento: g('alineamiento'),
      nivel: num('nivel') || 1, edad: g('edad'), origen: g('origen'),
      color: g('color') || COLORES[0], pin, retrato: g('retrato'),
      pvMax: pvMax > 0 ? pvMax : '', ca: num('ca'), caNota: g('caNota'), caBase: num('caBase'), velocidad: g('velocidad'), iniciativa: g('iniciativa'), competencia: g('competencia'),
      cd: g('cd'), ataqueConjuro: g('ataqueConjuro'),
      atributos: Object.fromEntries(ATRIBUTOS.map((a) => { const v = parseInt(b['pj-atr-' + a], 10); return [a, Number.isFinite(v) ? v : '']; })),
      espacios: Object.fromEntries(Array.from({ length: 9 }, (_, i) => i + 1).map((n) => ['n' + n, parseInt(b['pj-esp-' + n], 10) || 0]).filter(([, v]) => v > 0)),
      apariencia: g('apariencia'), personalidad: g('personalidad'), historia: g('historia'), objetivo: g('objetivo'), cita: g('cita'),
      orden: previo.orden || Date.now(),
    };
    for (const k of Object.keys(LISTAS)) ficha[k] = textoALista(k, b['pj-' + k]);
    const u = {};
    const archivo = $('#pj-retrato-archivo');
    const file = archivo && archivo.files && archivo.files[0];
    ui.ocupado = true; render();
    try {
      if (file) {
        if (!/^image\//.test(file.type)) { aviso('El retrato tiene que ser una imagen'); return; }
        const rid = 'rt' + id;
        u[`imagenes/${rid}`] = { nombre: `Retrato de ${nombre}`, tipo: 'retrato', src: await comprimir(file, 'retrato'), visible: false };
        ficha.retrato = rid;
      }
      u[`personajes/${id}/ficha`] = ficha;
      if (nuevo) u[`personajes/${id}/estado`] = { pv: pvMax > 0 ? pvMax : 0, oro: 0, notas: '' };
      if (esDM()) u[`personajes/${id}/dm`] = { secretos: g('secretos') };
      await sync.escribir(u);
      avisarEspacio();
      if (nuevo && !esDM()) { ui.desbloqueos[id] = pin; guardarDesbloqueos(); ui.yo = id; ls.set('mesa-yo', id); }
      if (ui.ruta === 'ficha') ui.ver = id;
      ui.editandoPj = null; limpiar('pj-');
      aviso(nuevo ? `${nombre} está en la mesa` : 'Ficha guardada');
      window.scrollTo(0, 0);
    } catch (e) { console.error(e); aviso('No se pudo guardar. Revisa el retrato e inténtalo otra vez.'); }
    finally { ui.ocupado = false; render(); }
  },
  'pj-borrar'(d) {
    const u = { [`personajes/${d.id}`]: null };
    const f = F(d.id);
    if (f.retrato && f.retrato === 'rt' + d.id) u[`imagenes/${f.retrato}`] = null;
    for (const m of Object.keys(E.fichas || {})) if ((E.fichas[m] || {})[d.id]) u[`fichas/${m}/${d.id}`] = null;
    ui.confirmar = null; if (ui.yo === d.id) { ui.yo = null; ls.set('mesa-yo', ''); }
    sync.escribir(u); aviso(`${f.nombre} ya no está en la campaña`);
  },
  'pista-abrir'(d) { ui.pistaPara = d.id; limpiar('pista-'); render(); },
  'pista-cerrar'() { ui.pistaPara = null; render(); },
  'pista-enviar'(d) {
    const texto = ($('#pista-txt').value || '').trim();
    if (!texto) { aviso('Escribe la pista'); $('#pista-txt').focus(); return; }
    const img = $('#pista-img') ? $('#pista-img').value : '';
    sync.escribir({ [`personajes/${d.id}/estado/pistas/${nuevoId('p')}`]: { texto, img, ts: Date.now() } });
    ui.pistaPara = null; limpiar('pista-'); aviso(`Pista enviada a ${F(d.id).nombre}`);
  },

  /* DM: mesa */
  'regla-ir'(d) {
    const est = ui.reglas[ui.ruta === 'dm' ? 'dm' : 'jugador'];
    if (d.desdeBusqueda) est.qPrevia = est.q;
    else if (!d.id) est.qPrevia = '';
    est.q = ''; est.sec = d.id || null;
    requestAnimationFrame(() => { const p = $('#rg-panel'); if (p) window.scrollTo(0, Math.max(0, p.getBoundingClientRect().top + window.scrollY - ($('.cabecera') ? $('.cabecera').offsetHeight : 0) - 8)); });
  },
  'regla-volver-busqueda'() {
    const est = ui.reglas[ui.ruta === 'dm' ? 'dm' : 'jugador'];
    est.q = est.qPrevia; est.qPrevia = ''; est.sec = null;
  },
  'dm-tab'(d) { ui.dmTab = d.tab; ui.confirmar = null; ui.editandoPj = null; render(); },
  'cfg-guardar'() {
    const nombre = (ui.borradores['cfg-nombre'] ?? '').trim() || 'Mi campaña';
    const p1 = (ui.borradores['cfg-pin'] || '').trim(); const p2 = (ui.borradores['cfg-pin2'] || '').trim();
    if (!pin4(p1)) { aviso('El PIN debe tener 4 números'); $('#cfg-pin').focus(); return; }
    if (p1 !== p2) { aviso('Los dos PIN no coinciden'); $('#cfg-pin2').focus(); return; }
    ui.desbloqueos.dm = p1; guardarDesbloqueos(); limpiar('cfg-');
    sync.escribir({ 'campana/nombre': nombre, 'campana/pinDM': p1 });
    aviso('Campaña lista. Ya eres el DM.');
  },
  /* combate */
  'prep-combate'() { ui.prepCombate = true; limpiar('cb-'); limpiar('ini-'); render(); },
  'cancelar-combate'() { ui.prepCombate = false; render(); },
  tirar(d) {
    const m = parseInt(String(d.mod || '0').replace('−', '-'), 10) || 0;
    const dado = 1 + Math.floor(Math.random() * 20);
    ui.borradores['ini-' + d.k] = String(dado + m);
    aviso(`d20: ${dado}${m ? ` ${m > 0 ? '+' : '−'} ${Math.abs(m)}` : ''} = ${dado + m}`); render();
  },
  'empezar-combate'() {
    const part = {};
    const add = (tipo, ref, nombre, ini, desempate) => { part[nuevoId('c')] = { tipo, ref, nombre, ini, desempate }; };
    const ini = (k) => { const v = parseInt(ui.borradores['ini-' + k], 10); return Number.isFinite(v) ? v : ''; };
    for (const [id] of listaPj()) if (ui.borradores['cb-pj-' + id] ?? true) { const des = (F(id).atributos || {}).DES; add('pj', id, F(id).nombre, ini('pj-' + id), des === '' || des == null ? 0 : Math.floor((+des - 10) / 2)); }
    for (const [k, p] of porOrden(E.presencias)) if (!p.derrotado && (ui.borradores['cb-pr-' + k] ?? p.tipo !== 'neutral')) add('pr', k, p.nombre, ini('pr-' + k), modDe(p.ini));
    const extra = (ui.borradores['cb-extra-nombre'] || '').trim();
    if (extra) { const v = parseInt(ui.borradores['cb-extra-ini'], 10); add('otro', '', extra, Number.isFinite(v) ? v : '', 0); }
    if (!Object.keys(part).length) { aviso('Marca al menos a un combatiente'); return; }
    E.combate = { ...C(), participantes: part };
    const primero = participantes()[0][0];
    sync.escribir({ combate: { activo: true, ronda: 1, turno: primero, participantes: part } });
    ui.prepCombate = false; limpiar('cb-'); limpiar('ini-'); aviso('¡Combate! Ronda 1');
  },
  turno(d) {
    const lista = participantes(); if (!lista.length) return;
    const c = C(); let i = lista.findIndex(([pid]) => pid === c.turno); let ronda = c.ronda || 1;
    for (let paso = 0; paso < lista.length; paso++) {
      i += +d.d;
      if (i >= lista.length) { i = 0; ronda++; }
      if (i < 0) { i = lista.length - 1; ronda = Math.max(1, ronda - 1); }
      if (!derrotadoP(lista[i][1])) break;
    }
    sync.escribir({ 'combate/turno': lista[i][0], 'combate/ronda': ronda });
  },
  'turno-a'(d) { sync.escribir({ 'combate/turno': d.pid }); },
  'cb-quitar'(d) {
    const u = { [`combate/participantes/${d.pid}`]: null };
    if (C().turno === d.pid) { const lista = participantes().filter(([pid]) => pid !== d.pid); const i = participantes().findIndex(([pid]) => pid === d.pid); u['combate/turno'] = lista.length ? lista[Math.min(i, lista.length - 1)][0] : ''; }
    sync.escribir(u);
  },
  'cb-add'() {
    const sel = $('#cb-add').value; const v = parseInt($('#cb-add-ini').value, 10); const ini = Number.isFinite(v) ? v : '';
    let tipo = 'otro', ref = '', nombre = ($('#cb-add-nombre').value || '').trim();
    if (sel) { [tipo, ref] = sel.split(':'); nombre = tipo === 'pj' ? F(ref).nombre : (presencia(ref) || {}).nombre; }
    if (!nombre) { aviso('Elige a alguien o escribe un nombre'); return; }
    let iniFinal = ini; const m = tipo === 'pr' ? modDe((presencia(ref) || {}).ini) : 0;
    if (iniFinal === '' && tipo === 'pr' && (presencia(ref) || {}).ini) { iniFinal = tirarD20().nat + m; registrar(`Iniciativa de ${nombre}: ${iniFinal}`, `d20 ${m >= 0 ? '+' : '−'} ${Math.abs(m)}`); }
    sync.escribir({ [`combate/participantes/${nuevoId('c')}`]: { tipo, ref, nombre, ini: iniFinal, desempate: m } });
    limpiar('cb-add'); aviso(`${nombre} entra al combate`);
  },
  'fin-combate'() {
    sync.escribir({ combate: { activo: false, ronda: 0, turno: '' } });
    ui.confirmar = null; aviso('Combate terminado');
  },

  /* ambiente */
  dia(d) { sync.escribir({ 'ambiente/dia': Math.max(1, (+((E.ambiente || {}).dia) || 1) + +d.d) }); },
  'avanzar-tiempo'() {
    const orden = Object.keys(MOMENTOS); const a = E.ambiente || {};
    let i = orden.indexOf(a.momento || 'manana') + 1; let dia = +a.dia || 1;
    const u = {};
    if (i >= orden.length) { i = 0; dia++; }
    u['ambiente/momento'] = orden[i]; u['ambiente/dia'] = dia;
    sync.escribir(u); aviso(`${MOMENTOS[orden[i]].nombre}${i === 0 ? ` del día ${dia}` : ''}`);
  },
  'amb-sens'() { sync.escribir({ 'ambiente/sensacion': ($('#amb-sens').value || '').trim() }); delete ui.borradores['amb-sens']; aviso('Se muestra en la mesa'); },

  /* relojes */
  'rl-crear'() {
    const nombre = ($('#rl-nombre').value || '').trim(); if (!nombre) { aviso('Ponle nombre al reloj'); $('#rl-nombre').focus(); return; }
    sync.escribir({ [`relojes/${nuevoId('rl')}`]: { nombre, segmentos: +($('#rl-seg').value || 6), llenos: 0, orden: Date.now() } });
    delete ui.borradores['rl-nombre'];
  },
  reloj(d) {
    const r = (E.relojes || {})[d.k]; if (!r) return;
    const i = +d.i; const nuevo = i < (r.llenos || 0) ? i : i + 1;
    const u = { [`relojes/${d.k}/llenos`]: nuevo };
    if (nuevo >= r.segmentos && (r.llenos || 0) < r.segmentos) aviso(`¡${r.nombre}!`);
    sync.escribir(u);
  },
  'rl-borrar'(d) { sync.escribir({ [`relojes/${d.k}`]: null }); },

  /* diario */
  'diario-guardar'() {
    const yo = ui.yo && abierto(ui.yo) ? ui.yo : null; if (!yo) return;
    const texto = ($('#diario-txt').value || '').trim();
    if (!texto) { aviso('Escribe algo primero'); $('#diario-txt').focus(); return; }
    const a = E.ambiente || {}; const ts = Date.now();
    sync.escribir({ [`personajes/${yo}/estado/diario/${nuevoId('d')}`]: { texto, ts, dia: a.dia || 1, momento: a.momento || '' } });
    delete ui.borradores['diario-txt']; aviso('Guardado en tu diario');
  },
  'diario-borrar'(d) { if (!abierto(d.id)) return; sync.escribir({ [`personajes/${d.id}/estado/diario/${d.k}`]: null }); },
  'diario-ver'(d) { ui.diarioDe = d.id; render(); },

  'pista-grupo'() { const t = ($('#pista-grupo').value || '').trim(); if (!t) { aviso('Escribe la pista'); return; } delete ui.borradores['pista-grupo']; sync.escribir({ [`pistas/${nuevoId('g')}`]: { texto: t, ts: Date.now() } }); },
  'pista-grupo-quitar'(d) { sync.escribir({ [`pistas/${d.k}`]: null }); },
  'pr-agregar'() {
    const nombre = ($('#pr-nombre').value || '').trim();
    if (!nombre) { aviso('Escribe el nombre'); $('#pr-nombre').focus(); return; }
    sync.escribir({ [`presencias/${nuevoId('pr')}`]: { nombre, tipo: $('#pr-tipo').value || 'enemigo', img: $('#pr-img').value || '', dano: 0, derrotado: false, orden: Date.now() } });
    delete ui.borradores['pr-nombre']; aviso(`${nombre} está en escena`);
  },
  'pr-dano'(d) { const p = E.presencias[d.k]; sync.escribir({ [`presencias/${d.k}/dano`]: Math.max(0, (p.dano || 0) + +d.d) }); },
  'pr-derrotado'(d) { const p = E.presencias[d.k]; const u = { [`presencias/${d.k}/derrotado`]: !p.derrotado }; if (!p.derrotado && !p.oculto) anotar(u, `${p.nombre} cae`); sync.escribir(u); },
  'pr-estado'(d) { const el = $('#pr-est-' + d.k); const t = ((el && el.value) || '').trim(); if (!t) { aviso('Escribe el estado'); return; } delete ui.borradores['pr-est-' + d.k]; sync.escribir({ [`presencias/${d.k}/estados/${claveSegura(t)}`]: true }); },
  'pr-estado-quitar'(d) { sync.escribir({ [`presencias/${d.k}/estados/${claveSegura(d.e)}`]: null }); },
  'pr-quitar'(d) {
    const u = { [`presencias/${d.k}`]: null };
    for (const [pid, x] of Object.entries(C().participantes || {})) if (x.tipo === 'pr' && x.ref === d.k) { u[`combate/participantes/${pid}`] = null; if (C().turno === pid) { const l = participantes().filter(([q]) => q !== pid); const i = participantes().findIndex(([q]) => q === pid); u['combate/turno'] = l.length ? l[Math.min(i, l.length - 1)][0] : ''; } }
    for (const m of Object.keys(E.fichas || {})) if ((E.fichas[m] || {})[d.k]) u[`fichas/${m}/${d.k}`] = null;
    sync.escribir(u);
  },
  mapa(d) {
    const u = { 'escena/mapa': d.k, 'escena/ilustracion': '' };
    const ent = entradaDeImagen(d.k);
    if (ent && ent[2].oculto) u[`enciclopedia/${ent[0]}/${ent[1]}/oculto`] = false; // su texto sale en la mesa, así que también queda revelado
    sync.escribir(u);
    aviso(ent ? `La mesa muestra el mapa con el texto de «${ent[2].titulo}»` : 'La mesa muestra el mapa');
  },
  mostrar(d) {
    const u = { 'escena/ilustracion': d.id || '' };
    if (d.id && imgs()[d.id] && !imgs()[d.id].visible) u[`imagenes/${d.id}/visible`] = true; // lo que se muestra en la mesa ya quedó revelado
    const ent = d.id ? entradaDeImagen(d.id) : null;
    if (ent && ent[2].oculto) u[`enciclopedia/${ent[0]}/${ent[1]}/oculto`] = false; // su texto sale en la mesa, así que también queda revelado
    sync.escribir(u);
    aviso(!d.id ? 'La mesa vuelve al mapa' : ent ? `Se muestra en la mesa con el texto de «${ent[2].titulo}»` : 'Se muestra en la mesa y queda revelada en la Galería');
  },
  mover() { ui.moverFichas = !ui.moverFichas; render(); },
  'escena-guardar'() {
    const g = (id) => ($('#' + id).value || '').trim();
    sync.escribir({ 'escena/lugar': g('esc-lugar'), 'escena/alerta': g('esc-alerta'), 'escena/texto': g('esc-texto') });
    limpiar('esc-'); aviso('Escena guardada');
  },
  pedir(d) { ui.confirmar = d.que; render(); },
  'no-confirmar'() { ui.confirmar = null; render(); },
  descanso(d) {
    const u = descansoUpdates(d.tipo);
    const texto = d.tipo === 'largo' ? 'Descanso largo: PV, espacios y rasgos recuperados.' : 'Descanso corto: rasgos de descanso corto recuperados.';
    ui.confirmar = null; sync.escribir(u); aviso(texto);
  },
  'ir-seccion'(d) { const el = document.getElementById(d.id); if (el && el.tagName === 'DETAILS' && !el.open) el.open = true; if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); },

  /* DM: biblioteca */
  async subir() {
    const archivo = $('#sub-archivo');
    const file = archivo && archivo.files && archivo.files[0];
    const nombre = ($('#sub-nombre').value || '').trim() || (file ? file.name.replace(/\.[^.]+$/, '') : '');
    const tipo = $('#sub-tipo').value;
    if (!file) { aviso('Elige primero un archivo de imagen'); return; }
    if (!/^image\//.test(file.type)) { aviso('Ese archivo no es una imagen'); return; }
    ui.ocupado = true; render();
    try {
      const src = await comprimir(file, tipo);
      const visible = $('#sub-visible') ? $('#sub-visible').checked : false;
      const imId = nuevoId('im');
      const u = { [`imagenes/${imId}`]: { nombre, tipo, src, visible } };
      // Entradas importadas que esperaban una imagen con este nombre
      let enlazadas = 0;
      for (const [cat, lista] of Object.entries(E.enciclopedia || {})) for (const [id, x] of Object.entries(lista || {})) if (!x.img && x.imgPendiente && norm(x.imgPendiente) === norm(nombre)) { u[`enciclopedia/${cat}/${id}/img`] = imId; u[`enciclopedia/${cat}/${id}/imgPendiente`] = null; enlazadas++; }
      await sync.escribir(u);
      if (enlazadas) setTimeout(() => aviso(`Se asignó a ${enlazadas} entrada${enlazadas === 1 ? '' : 's'} de la Historia`), 2700);
      delete ui.borradores['sub-nombre'];
      const a = $('#sub-archivo'); if (a) a.value = '';
      aviso(`«${nombre}» quedó en la Biblioteca`); avisarEspacio();
    } catch (e) { console.error(e); aviso('No se pudo leer la imagen. Prueba con un JPG o PNG.'); }
    finally { ui.ocupado = false; render(); }
  },
  'img-visible'(d) { const i = imgs()[d.id]; if (i) sync.escribir({ [`imagenes/${d.id}/visible`]: !i.visible }); },
  'img-borrar'(d) {
    const u = { [`imagenes/${d.id}`]: null };
    if ((E.escena || {}).ilustracion === d.id) u['escena/ilustracion'] = '';
    if ((E.escena || {}).mapa === d.id) { u['escena/mapa'] = ''; u[`fichas/${d.id}`] = null; }
    for (const [id, p] of Object.entries(E.personajes || {})) if ((p.ficha || {}).retrato === d.id) u[`personajes/${id}/ficha/retrato`] = '';
    for (const [k, p] of Object.entries(E.presencias || {})) if (p.img === d.id) u[`presencias/${k}/img`] = '';
    for (const [k, t] of Object.entries(E.banco || {})) if (t && t.img === d.id) u[`banco/${k}/img`] = '';
    ui.confirmar = null; sync.escribir(u); aviso('Imagen borrada');
  },
  'ent-editar'(d) {
    const x = ((E.enciclopedia || {})[d.cat] || {})[d.id]; if (!x) return;
    limpiar('ent-'); ui.editandoEnt = { cat: d.cat, id: d.id };
    Object.assign(ui.borradores, {
      'ent-cat': d.cat, 'ent-titulo': x.titulo || '', 'ent-sub': x.sub || '', 'ent-texto': x.texto || '', 'ent-tipo': x.tipo || 'hecho',
      'ent-visto': (x.visto || []).join('\n'), 'ent-dicho': (x.dicho || []).join('\n'), 'ent-misterio': x.misterio || '', 'ent-img': x.img || '',
      'ent-oculto': !!x.oculto, 'ent-resuelto': !!x.resuelto, 'ent-notas': x.notasDM || '', 'ent-grupo': grupoDe(x),
    });
    render(); const f = $('#form-entrada'); if (f) f.scrollIntoView({ block: 'start' });
  },
  'ent-cancelar'() { limpiar('ent-', ['ent-cat', 'ent-grupo']); ui.editandoEnt = null; render(); },
  'ent-guardar'() {
    const cat = ui.editandoEnt ? ui.editandoEnt.cat : (ui.borradores['ent-cat'] || 'pnj');
    const g = (id) => { const el = $('#' + id); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };
    const titulo = g('ent-titulo');
    if (!titulo) { aviso('Escribe el nombre o título'); $('#ent-titulo').focus(); return; }
    const previo = ui.editandoEnt ? E.enciclopedia[cat][ui.editandoEnt.id] : null;
    const entrada = cat === 'misterios'
      ? { titulo, resuelto: !!g('ent-resuelto'), oculto: !!g('ent-oculto') }
      : { titulo, sub: g('ent-sub'), texto: g('ent-texto'), visto: lineas(g('ent-visto')), dicho: lineas(g('ent-dicho')), misterio: g('ent-misterio'), img: g('ent-img'), oculto: !!g('ent-oculto'), ...(cat === 'mundo' ? { tipo: g('ent-tipo') || 'hecho' } : {}) };
    entrada.notasDM = g('ent-notas');
    let grupoNuevo = null;
    entrada.grupo = $('#ent-grupo') ? g('ent-grupo') : (previo ? grupoDe(previo) : '');
    if (entrada.grupo === '__nuevo') {
      const nombreG = g('ent-grupo-nuevo');
      if (!nombreG) { aviso('Escribe el nombre del grupo nuevo'); $('#ent-grupo-nuevo').focus(); return; }
      const existe = listaGrupos().find(([, x]) => norm(x.nombre) === norm(nombreG));
      if (existe) entrada.grupo = existe[0];
      else { entrada.grupo = nuevoId('gr'); grupoNuevo = { nombre: nombreG, orden: Math.max(0, ...listaGrupos().map(([, x]) => x.orden || 0)) + 1 }; }
    }
    entrada.orden = previo ? (previo.orden || Date.now()) : Date.now();
    if (previo && previo.imgPendiente && !entrada.img && cat !== 'misterios') entrada.imgPendiente = previo.imgPendiente;
    const id = ui.editandoEnt ? ui.editandoEnt.id : nuevoId(cat.slice(0, 2));
    sync.escribir({ [`enciclopedia/${cat}/${id}`]: entrada, ...(grupoNuevo ? { [`grupos/${entrada.grupo}`]: grupoNuevo } : {}) });
    limpiar('ent-', ['ent-cat', 'ent-grupo']); ui.editandoEnt = null;
    if (grupoNuevo) ui.borradores['ent-grupo'] = entrada.grupo;
    aviso(previo ? 'Entrada actualizada' : `Añadido a ${CATEGORIAS[cat].nombre}`);
  },
  'ent-revelar'(d) { const x = ((E.enciclopedia || {})[d.cat] || {})[d.id]; if (x) sync.escribir({ [`enciclopedia/${d.cat}/${d.id}/oculto`]: !x.oculto }); },
  'exportar-historia'() { exportarHistoria(); },
  'ent-mover'(d) {
    const enc = E.enciclopedia || {};
    const x = (enc[d.cat] || {})[d.id]; if (!x) return;
    const lista = porOrden(enc[d.cat]).filter(([, y]) => grupoDe(y) === grupoDe(x));
    const i = lista.findIndex(([k]) => k === d.id); const j = i + Number(d.d);
    if (i < 0 || j < 0 || j >= lista.length) return;
    // renumera la lista con el cambio, así no hay órdenes repetidos
    const [a] = lista.splice(i, 1); lista.splice(j, 0, a);
    const base = Math.min(...lista.map(([, y]) => y.orden || 0)) || Date.now();
    const u = {}; lista.forEach(([k], n) => { u[`enciclopedia/${d.cat}/${k}/orden`] = base + n; });
    sync.escribir(u);
  },
  'grupo-crear'() {
    const nombre = (ui.borradores['grupo-nuevo'] || '').trim();
    if (!nombre) { aviso('Escribe el nombre del grupo'); const el = $('#grupo-nuevo'); if (el) el.focus(); return; }
    if (listaGrupos().some(([, g]) => norm(g.nombre) === norm(nombre))) { aviso('Ya hay un grupo con ese nombre'); return; }
    const orden = Math.max(0, ...listaGrupos().map(([, g]) => g.orden || 0)) + 1;
    sync.escribir({ [`grupos/${nuevoId('gr')}`]: { nombre, orden } });
    delete ui.borradores['grupo-nuevo']; aviso(`Grupo «${nombre}» creado`);
  },
  'grupo-mover'(d) {
    const l = listaGrupos(); const i = l.findIndex(([k]) => k === d.id); const j = i + Number(d.d);
    if (i < 0 || j < 0 || j >= l.length) return;
    const [a] = l.splice(i, 1); l.splice(j, 0, a);
    const u = {}; l.forEach(([k], n) => { u[`grupos/${k}/orden`] = n + 1; }); sync.escribir(u);
  },
  'grupo-renombrar-si'(d) { ui.renombrarGrupo = d.id; delete ui.borradores['grupo-nombre']; },
  'grupo-renombrar-no'() { ui.renombrarGrupo = null; delete ui.borradores['grupo-nombre']; },
  'grupo-renombrar'(d) {
    const nombre = ((ui.borradores['grupo-nombre'] ?? (E.grupos[d.id] || {}).nombre) || '').trim();
    if (!nombre) { aviso('Escribe el nombre del grupo'); return; }
    sync.escribir({ [`grupos/${d.id}/nombre`]: nombre }); ui.renombrarGrupo = null; delete ui.borradores['grupo-nombre'];
  },
  'grupo-borrar'(d) {
    ui.confirmar = null;
    const u = { [`grupos/${d.id}`]: null };
    for (const [cat, lista] of Object.entries(E.enciclopedia || {})) for (const [k, x] of Object.entries(lista || {})) if (x && x.grupo === d.id) u[`enciclopedia/${cat}/${k}/grupo`] = null;
    sync.escribir(u); aviso('Grupo borrado; sus entradas quedaron sin grupo');
  },
  'ent-borrar'(d) { ui.confirmar = null; if (ui.editandoEnt && ui.editandoEnt.id === d.id) { limpiar('ent-', ['ent-cat', 'ent-grupo']); ui.editandoEnt = null; } sync.escribir({ [`enciclopedia/${d.cat}/${d.id}`]: null }); aviso('Entrada borrada'); },

  /* DM: banco de PNJ */
  'pl-nuevo'() { cargarPlantilla('nuevo'); render(); const f = $('#form-plantilla'); if (f) f.scrollIntoView({ block: 'start' }); const n = $('#pl-nombre'); if (n) n.focus({ preventScroll: true }); },
  'pl-editar'(d) { cargarPlantilla(d.id); render(); const f = $('#form-plantilla'); if (f) f.scrollIntoView({ block: 'start' }); },
  'pl-duplicar'(d) { cargarPlantilla(d.id, true); render(); const f = $('#form-plantilla'); if (f) f.scrollIntoView({ block: 'start' }); aviso('Cambia lo que quieras y guárdala como plantilla nueva'); },
  'pl-cancelar'() { ui.editandoPl = null; limpiar('pl-', PL_PERSISTE); },
  'pl-guardar'() {
    const b = ui.borradores;
    const g = (k) => String(b['pl-' + k] ?? '').trim();
    const nombre = g('nombre');
    if (!nombre) { aviso('Ponle nombre a la plantilla'); $('#pl-nombre').focus(); return; }
    const nuevo = !ui.editandoPl || ui.editandoPl === 'nuevo';
    const id = nuevo ? nuevoId('pl') : ui.editandoPl;
    const previo = nuevo ? {} : (E.banco || {})[id] || {};
    const num = (k) => { const v = parseInt(g(k), 10); return Number.isFinite(v) ? v : ''; };
    const t = {
      nombre, grupo: g('grupo'), tipo: g('tipo') || 'enemigo', img: g('img'), vd: g('vd'), desc: g('desc'),
      ca: num('ca'), caNota: g('caNota'), pv: num('pv') || promedio(g('dadosPv')) || '', dadosPv: g('dadosPv'), velocidad: g('velocidad'), ini: g('ini'),
      atributos: Object.fromEntries(ATRIBUTOS.map((a) => { const v = parseInt(b['pl-atr-' + a], 10); return [a, Number.isFinite(v) ? v : '']; })),
      otros: lineas(g('otros')), ataques: textoALista('ataques', g('ataques')), rasgos: textoALista('rasgos', g('rasgos')), acciones: textoALista('rasgos', g('acciones')),
      notas: g('notas'), orden: previo.orden || Date.now(),
    };
    if (t.ini && /^\d/.test(t.ini)) t.ini = '+' + t.ini; // "2" → "+2"
    sync.escribir({ [`banco/${id}`]: t });
    ui.editandoPl = null; limpiar('pl-', PL_PERSISTE);
    if (t.grupo) { plegados.delete(`p:${t.grupo}`); ls.set('mesa-plegados', JSON.stringify([...plegados])); }
    aviso(nuevo ? `«${nombre}» quedó en el banco` : 'Plantilla guardada');
  },
  'pl-borrar'(d) {
    ui.confirmar = null;
    const t = (E.banco || {})[d.id]; if (!t) return;
    if (ui.editandoPl === d.id) { ui.editandoPl = null; limpiar('pl-', PL_PERSISTE); }
    sync.escribir({ [`banco/${d.id}`]: null }); aviso(`«${t.nombre}» salió del banco (lo que ya está en escena se queda)`);
  },
  'pl-escena'(d) {
    const rapido = d.desde === 'rapido';
    const id = rapido ? (($('#pl-rapido') || {}).value || '') : d.id;
    const el = $(rapido ? '#pl-rapido-cant' : `#pl-cant-${id}`);
    ponerEnEscena(id, parseInt(el && el.value, 10) || 1);
    if (!rapido) delete ui.borradores['pl-cant-' + id];
  },
  'exportar-banco'() { exportarBanco(); },
  'cb-banco'() {
    const id = (($('#cbpl-sel') || {}).value || '');
    const el = $('#cbpl-cant');
    ponerEnEscena(id, parseInt(el && el.value, 10) || 1, 'cbpl', C().activo ? 'combate' : 'prep');
    delete ui.borradores['cbpl-cant'];
  },

  /* PNJ en escena: PV, ataques y tiradas */
  'pr-cant'(d) {
    const p = presencia(d.k); if (!p) return;
    const el = $('#pr-cant-' + d.k); const n = parseInt(el && el.value, 10);
    if (!n || n < 0) { aviso('Escribe una cantidad primero'); if (el) el.focus(); return; }
    const antes = pvPr(p);
    const dano = d.tipo === 'cura' ? Math.max(0, (+p.dano || 0) - n) : Math.min(+p.pvMax, (+p.dano || 0) + n);
    const u = { [`presencias/${d.k}/dano`]: dano };
    const despues = Math.max(0, +p.pvMax - dano);
    if (despues <= 0 && !p.derrotado) { u[`presencias/${d.k}/derrotado`] = true; if (!p.oculto) anotar(u, `${p.nombre} cae`); }
    if (despues > 0 && p.derrotado && d.tipo === 'cura') u[`presencias/${d.k}/derrotado`] = false;
    delete ui.borradores['pr-cant-' + d.k];
    sync.escribir(u);
    aviso(despues <= 0 ? `${p.nombre} cae (0 PV)` : `${p.nombre}: ${despues - antes > 0 ? '+' : '−'}${Math.abs(despues - antes)} PV → ${despues}/${p.pvMax}`);
  },
  'pr-oculto'(d) { const p = presencia(d.k); if (!p) return; sync.escribir({ [`presencias/${d.k}/oculto`]: !p.oculto }); aviso(p.oculto ? `${p.nombre} ya se ve en la mesa` : `${p.nombre} quedó oculto en la mesa`); },
  'pr-atacar'(d) {
    const p = presencia(d.k); const a = p && (p.ataques || [])[+d.i]; if (!a) return;
    const bono = bonoNum(a.bono) ?? 0;
    const r = tirarD20(ui.modoTirada); const total = r.nat + bono;
    const extra = r.nat === 20 ? ' ¡Crítico!' : r.nat === 1 ? ' · 1 natural, falla' : '';
    const dados = r.dados.length > 1 ? `d20 [${r.dados.join(', ')}] con ${ui.modoTirada}` : `d20 [${r.nat}]`;
    registrar(`${p.nombre} · ${a.nombre}: ${total}${extra}`, `${dados} ${bono >= 0 ? '+' : '−'} ${Math.abs(bono)}${r.nat !== 1 ? ` · acierta contra CA ${total} o menos` : ''}`, r.nat === 20 ? 'critico' : r.nat === 1 ? 'pifia' : '');
  },
  'pr-dano-tirar'(d) {
    const p = presencia(d.k); const a = p && (p.ataques || [])[+d.i]; if (!a) return;
    const crit = !!d.crit; const r = tirarExpr(a.dano, crit); if (!r) { aviso('Ese daño no tiene dados'); return; }
    const tipoDano = tipoDeDano(a.dano);
    registrar(`${p.nombre} · ${a.nombre}: ${r.total} de daño${tipoDano ? ' ' + tipoDano : ''}${crit ? ' (crítico)' : ''}`, r.detalle, crit ? 'critico' : '', { total: r.total, k: d.k });
  },
  'modo-tirada'(d) { ui.modoTirada = d.m; },
  'tirada-libre'() {
    const el = $('#tl-expr'); const t = ((el && el.value) || '').trim();
    if (!t) { aviso('Escribe una tirada, por ejemplo 2d6 + 3'); if (el) el.focus(); return; }
    const r = tirarExpr(t); if (!r) { aviso('No entendí la tirada. Prueba con algo como 1d20 + 5'); return; }
    registrar(`${t}: ${r.total}`, r.detalle);
  },
  'tiradas-limpiar'() { ui.tiradas = []; },
  'tirar-pnj'() {
    const hechas = [];
    for (const [k, p] of porOrden(E.presencias)) {
      if (p.derrotado) continue;
      const m = modDe(p.ini); const v = tirarD20().nat + m;
      ui.borradores['ini-pr-' + k] = String(v); hechas.push(`${p.nombre} ${v}`);
    }
    if (hechas.length) registrar('Iniciativa de los PNJ', hechas.join(' · '));
  },

  /* combate compartido */
  'ja-modo'(d) { ui.borradores['ja-modo'] = d.m; },
  'ja-elegir'(d) { ui.borradores['ja-atq'] = String(d.i); for (const k of ['ja-golpe', 'ja-dano', 'ja-crit', 'ja-nat', 'ja-detalle']) delete ui.borradores[k]; },
  'ja-tirar-golpe'(d) {
    const b = ui.borradores; const id = d.id || ui.ver;
    if (d.i != null && b['ja-atq'] !== String(d.i)) { b['ja-atq'] = String(d.i); for (const k of ['ja-dano', 'ja-crit', 'ja-detalle']) delete b[k]; }
    const a = ataquesPj(id, true)[+(b['ja-atq'] ?? 0)]; const bono = a ? bonoNum(a.bono) : null; if (bono == null) return;
    const modo = b['ja-modo'] || 'normal'; const r = tirarD20(modo); const total = r.nat + bono;
    b['ja-golpe'] = String(total); b['ja-nat'] = r.nat;
    if (r.nat === 20) b['ja-crit'] = true; else delete b['ja-crit'];
    b['ja-detalle'] = `${a.nombre}: d20 ${r.dados.length > 1 ? `[${r.dados.join(', ')}] con ${modo}` : `[${r.nat}]`} ${bono >= 0 ? '+' : '−'} ${Math.abs(bono)} = ${total}${r.nat === 20 ? ' · ¡Crítico!' : r.nat === 1 ? ' · 1 natural' : ''}`;
    aviso(`${a.nombre}: ${total} para golpear${r.nat === 20 ? ' ¡Crítico!' : r.nat === 1 ? ' (1 natural)' : ''}`);
  },
  'ja-tirar-dano'(d) {
    const b = ui.borradores; const id = d.id || ui.ver;
    if (d.i != null && b['ja-atq'] !== String(d.i)) { b['ja-atq'] = String(d.i); for (const k of ['ja-golpe', 'ja-nat', 'ja-crit', 'ja-detalle']) delete b[k]; }
    const a = ataquesPj(id, true)[+(b['ja-atq'] ?? 0)]; if (!a) return;
    const crit = !!d.crit || !!b['ja-crit']; const r = tirarExpr(a.dano, crit); if (!r) return;
    b['ja-dano'] = String(r.total); if (crit) b['ja-crit'] = true;
    const previo = b['ja-detalle'] && b['ja-detalle'].startsWith(a.nombre + ':') ? b['ja-detalle'].replace(/ · Daño .*$/, '') : `${a.nombre}:`;
    b['ja-detalle'] = `${previo} · Daño ${r.detalle} = ${r.total}${crit ? ' (crítico)' : ''}`;
    aviso(`${a.nombre}: ${r.total} de daño${crit ? ' (crítico)' : ''}`);
  },
  'ja-enviar'(d) {
    const b = ui.borradores; const f = F(d.id);
    const sel = b['ja-atq'] ?? (ataquesPj(d.id, true).length ? '0' : 'otro');
    const a = sel === 'otro' ? null : ataquesPj(d.id, true)[+sel];
    let objetivos;
    if (a && a.salva) objetivos = porOrden(E.presencias).filter(([k, p]) => !p.oculto && !p.derrotado && ($('#jm-' + k) || {}).checked).map(([k]) => k);
    else { const o = ($('#ja-obj') || {}).value || ''; objetivos = presencia(o) ? [o] : []; }
    if (!objetivos.length) { aviso(a && a.salva ? 'Marca a quiénes alcanza' : 'Elige a quién atacas'); return; }
    const nombreAtq = a ? a.nombre : (($('#ja-otro') || {}).value || '').trim() || 'Ataque';
    const golpe = parseInt(($('#ja-golpe') || {}).value, 10); const dano = parseInt(($('#ja-dano') || {}).value, 10);
    if (!Number.isFinite(golpe) && !Number.isFinite(dano) && !(a && a.salva)) { aviso('Escribe tu tirada para golpear o el daño'); $('#ja-golpe').focus(); return; }
    const critico = !!(($('#ja-crit') || {}).checked);
    const nat = b['ja-nat'] ? +b['ja-nat'] : critico ? 20 : '';
    const u = {};
    // Un conjuro con nivel gasta su espacio al enviarse; si es de concentración, la reemplaza
    if (a && a.conjuro) {
      const c = (S(d.id).libro || {})[a.conjuro] || {};
      if (a.nivel) {
        const n = a.nivelEsp; if (espDe(d.id, n) <= 0) { aviso(`No te quedan espacios de nivel ${n}`); return; }
        u[`personajes/${d.id}/estado/espacios/n${n}`] = espDe(d.id, n) - 1;
      }
      if (c.conc) u[`personajes/${d.id}/estado/concentra`] = c.nombre;
    }
    objetivos.forEach((obj, i) => {
      u[`combate/acciones/${nuevoId('a')}${i}`] = { ts: Date.now() + i, de: d.id, objetivo: obj, ataque: nombreAtq, golpe: Number.isFinite(golpe) ? golpe : '', nat, dano: Number.isFinite(dano) ? dano : '', tipoDano: a ? tipoDeDano(a.dano) : '', critico, ...(a && a.salva ? { salva: a.salva } : {}), ...(a && a.conjuro ? { conjuro: true } : {}) };
    });
    sync.escribir(u);
    for (const k of ['ja-golpe', 'ja-dano', 'ja-crit', 'ja-nat', 'ja-detalle', 'ja-otro']) delete b[k];
    for (const k of Object.keys(b)) if (k.startsWith('jm-')) delete b[k];
    aviso(a && a.conjuro && a.nivel ? `Enviado al DM · gastaste un espacio de nivel ${a.nivelEsp}` : 'Enviado al DM');
  },
  /* libro de conjuros */
  'cj-lanzar'(d) {
    const c = (S(d.id).libro || {})[d.c]; if (!c) return;
    const b = ui.borradores; const n = nivelConj(d.id, d.c, c);
    const contraEnemigos = !c.cura && (c.tirada || c.dano);
    if (C().activo && contraEnemigos) {
      // En combate se lanza desde el panel Atacar: el espacio se gasta al enviarlo al DM
      const i = ataquesPj(d.id, true).findIndex((x) => x.conjuro === d.c);
      if (i >= 0) { b['ja-atq'] = String(i); for (const k of ['ja-golpe', 'ja-dano', 'ja-crit', 'ja-nat', 'ja-detalle']) delete b[k]; }
      requestAnimationFrame(() => { const p = $('.combate-jugador'); if (p) p.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
      aviso('Elige a quién en el panel Atacar y envíalo al DM');
      return;
    }
    const u = {}; const partes = [];
    if (c.nivel) {
      if (espDe(d.id, n) <= 0) { aviso(`No te quedan espacios de nivel ${n}`); return; }
      u[`personajes/${d.id}/estado/espacios/n${n}`] = espDe(d.id, n) - 1; partes.push(`espacio de nivel ${n}`);
    }
    const previa = S(d.id).concentra;
    if (c.conc) { u[`personajes/${d.id}/estado/concentra`] = c.nombre; if (previa && previa !== c.nombre) partes.push(`dejas de concentrarte en ${previa}`); }
    const expr = exprConj(d.id, c, n); let res = '';
    if (expr) { const r = tirarExpr(expr); if (r) { res = `${c.cura ? 'Curación' : 'Daño'}: ${r.total}`; b['ja-detalle'] = `${c.nombre}: ${r.detalle} = ${r.total}`; if (c.cura && C().activo) { b['ja-cura-cant'] = String(r.total); ui.abiertos.add('cura'); } } }
    if (Object.keys(u).length) sync.escribir(u);
    aviso(`Lanzas ${c.nombre}${partes.length ? ` (${partes.join(', ')})` : ''}${res ? ` · ${res}` : ''}`);
  },
  'cj-atacar'(d) {
    const i = ataquesPj(d.id, true).findIndex((x) => x.conjuro === d.c); if (i < 0) return;
    ACCIONES['ja-tirar-golpe']({ id: d.id, i: String(i) });
  },
  'cj-tirar'(d) {
    const c = (S(d.id).libro || {})[d.c]; if (!c) return;
    const i = ataquesPj(d.id, true).findIndex((x) => x.conjuro === d.c);
    if (i >= 0 && C().activo) { ACCIONES['ja-tirar-dano']({ id: d.id, i: String(i) }); return; }
    const r = tirarExpr(exprConj(d.id, c, nivelConj(d.id, d.c, c))); if (!r) return;
    ui.borradores['ja-detalle'] = `${c.nombre}: ${r.detalle} = ${r.total}`;
    if (c.cura && C().activo) { ui.borradores['ja-cura-cant'] = String(r.total); ui.abiertos.add('cura'); }
    aviso(`${c.nombre}: ${r.total}${c.cura ? ' de curación' : ' de daño'}`);
  },
  'cj-dar'(d) {
    if (!esDM()) return;
    const c = (catalogoConj || []).find((x) => x.nombre === d.n); if (!c) return;
    const { clases, ...copia } = c;
    escribirEstado(d.id, `libro/${nuevoId('cj')}`, { ...copia, orden: Date.now() });
    aviso(`${F(d.id).nombre} aprende ${c.nombre}`);
  },
  'cj-propio'(d) {
    if (!esDM()) return;
    const b = ui.borradores; const g = (k) => String(b[k] ?? '').trim();
    const nombre = g('cjp-nombre'); if (!nombre) { aviso('Ponle nombre al conjuro'); $('#cjp-nombre').focus(); return; }
    const [tiempo = '', alcance = '', duracion = ''] = g('cjp-meta').split('·').map((x) => x.trim());
    const nivel = Math.max(0, Math.min(9, parseInt(g('cjp-nivel'), 10) || 0));
    escribirEstado(d.id, `libro/${nuevoId('cj')}`, { nombre, nivel, escuela: 'Propio', ritual: false, tiempo, alcance, componentes: '', duracion, conc: !!b['cjp-conc'], texto: g('cjp-texto'), mejora: '', tirada: g('cjp-tirada'), salva: g('cjp-salva') || 'DES', dano: g('cjp-dano'), tipo: g('cjp-tipo'), cura: '', sumaMod: false, masNivel: '', mitad: false, propio: true, orden: Date.now() });
    for (const k of Object.keys(b)) if (k.startsWith('cjp-')) delete b[k];
    aviso(`${F(d.id).nombre} aprende ${nombre}`);
  },
  'cj-ajustar'(d) {
    if (!esDM()) return;
    const c = (S(d.id).libro || {})[d.c]; if (!c) return;
    const v = (k) => (($(`#cja-${k}-${d.c}`) || {}).value || '').trim(); const ch = (k) => !!(($(`#cja-${k}-${d.c}`) || {}).checked);
    const dados = v('dano');
    escribirEstado(d.id, `libro/${d.c}`, { ...c, tirada: v('tir'), salva: v('sal') || 'DES', ...(c.cura ? { cura: dados } : { dano: dados }), tipo: v('tipo'), masNivel: v('mas'), mitad: ch('mitad'), sumaMod: ch('mod') });
    aviso('Conjuro ajustado');
  },
  'cj-quitar'(d) { if (!esDM()) return; ui.confirmar = null; const c = (S(d.id).libro || {})[d.c]; escribirEstado(d.id, `libro/${d.c}`, null); if (c) aviso(`${c.nombre} salió del libro`); },
  'cj-migrar'(d) {
    if (!esDM() || !catalogoConj) return;
    const f = F(d.id); const u = {}; const hechos = []; let i = 0;
    const tiene = new Set(libroDe(d.id).map(([, c]) => norm(c.nombre)));
    for (const x of [...(f.trucos || []).map((c) => ({ ...c, nivel: 0 })), ...(f.conjuros || [])]) {
      if (!x || !x.nombre || tiene.has(norm(x.nombre))) continue;
      const c = catalogoConj.find((y) => norm(y.nombre) === norm(x.nombre));
      let copia;
      if (c) { const { clases, ...resto } = c; copia = resto; } else copia = { nombre: x.nombre, nivel: +x.nivel || 0, escuela: 'Propio', ritual: false, tiempo: '', alcance: '', componentes: '', duracion: '', conc: false, texto: x.texto || '', mejora: '', tirada: '', salva: 'DES', dano: '', tipo: '', cura: '', sumaMod: false, masNivel: '', mitad: false, propio: true };
      u[`personajes/${d.id}/estado/libro/${nuevoId('cj')}${i++}`] = { ...copia, orden: Date.now() + i };
      hechos.push(x.nombre + (c ? '' : ' (propio)'));
    }
    u[`personajes/${d.id}/ficha/trucos`] = []; u[`personajes/${d.id}/ficha/conjuros`] = [];
    sync.escribir(u); aviso(hechos.length ? `Al libro: ${hechos.join(', ')}` : 'Ya estaban en el libro');
  },
  'acc-salva'(d) {
    const x = (C().acciones || {})[d.k]; if (!x || !x.salva) return;
    const p = presencia(x.objetivo); const t = plantillaDe(p) || {};
    const v = (t.atributos || {})[x.salva.attr]; const m = v === '' || v == null ? 0 : Math.floor((+v - 10) / 2);
    const r = tirarD20(); const total = r.nat + m;
    ui.borradores['sv-' + d.k] = `${total}|${r.nat}|${m}`;
    registrar(`${p ? p.nombre : '¿?'} · salvación de ${NOMBRE_SALVA[x.salva.attr]}: ${total}`, `d20 [${r.nat}] ${m >= 0 ? '+' : '−'} ${Math.abs(m)} contra CD ${x.salva.cd}`);
  },
  'inv-clase'(d) { ui.borradores['inv-clase'] = d.c; },
  'inv-anadir'(d) {
if (!esDM()) return;
        const b = ui.borradores; const clase = b['inv-clase'] || 'arma'; const g = (k) => String(b[k] ?? '').trim();
    const magia = Math.max(0, Math.min(5, parseInt(g('inv-magia'), 10) || 0));
    const equipado = clase !== 'objeto' && (b['inv-equipar'] ?? true);
    const orden = Date.now(); let o;
    if (clase === 'arma') {
      const a = ARMAS.find((x) => x.nombre === (g('inv-arma') || ARMAS[0].nombre)) || ARMAS[0];
      const base = g('inv-nombre') || a.nombre;
      o = { nombre: magia ? `${base} ${conSigno(magia)}` : base, clase, cantidad: 1, equipado, magia, orden, ref: a.nombre, dado: a.dado, tipo: a.tipo, dist: a.dist, sutil: a.sutil, ligera: a.ligera, versatil: a.versatil, arrojadiza: a.arrojadiza, props: a.props, maestria: a.maestria, competente: !!(b['inv-comp'] ?? competenteCon(F(d.id).clase, a)), extra: g('inv-extra') };
    } else if (clase === 'armadura') {
      const a = ARMADURAS.find((x) => x.nombre === g('inv-armadura')) || ARMADURAS.find((x) => x.tipo !== 'escudo');
      const base = g('inv-nombre') || a.nombre;
      o = { nombre: magia ? `${base} ${conSigno(magia)}` : base, clase, cantidad: 1, equipado, magia, orden, ref: a.nombre, base: a.base, des: a.des, tipoArm: a.tipo, sigilo: !!a.sigilo, fuerza: a.fuerza || '' };
    } else if (clase === 'escudo') {
      const base = g('inv-nombre') || 'Escudo';
      o = { nombre: magia ? `${base} ${conSigno(magia)}` : base, clase, cantidad: 1, equipado, magia, orden, ref: 'Escudo' };
    } else {
      const nombre = g('inv-onombre'); if (!nombre) { aviso('Escribe el nombre del objeto'); $('#inv-onombre').focus(); return; }
      o = { nombre, clase, cantidad: Math.max(1, parseInt(g('inv-ocant'), 10) || 1), equipado: false, magia: 0, orden, bonoCA: Math.max(0, parseInt(g('inv-oca'), 10) || 0), nota: g('inv-onota') };
    }
    const u = { [`personajes/${d.id}/estado/objetos/${nuevoId('o')}`]: o };
    if (equipado) Object.assign(u, desequiparIncompatibles(d.id, o));
    sync.escribir(u);
    for (const k of ['inv-nombre', 'inv-magia', 'inv-extra', 'inv-comp', 'inv-onombre', 'inv-ocant', 'inv-oca', 'inv-onota']) delete b[k];
    aviso(`${o.nombre} ${equipado ? 'equipado' : 'en la mochila'}`);
  },
  'obj-equipar'(d) {
if (!esDM()) return;
        const o = (S(d.id).objetos || {})[d.k]; if (!o) return;
    const u = { [`personajes/${d.id}/estado/objetos/${d.k}/equipado`]: !o.equipado };
    if (!o.equipado) Object.assign(u, desequiparIncompatibles(d.id, o, d.k));
    sync.escribir(u);
  },
  'obj-comp'(d) { if (!esDM()) return; const o = (S(d.id).objetos || {})[d.k]; if (o) escribirEstado(d.id, `objetos/${d.k}/competente`, !o.competente); },
  'obj-cant'(d) {
if (!esDM()) return;
        const o = (S(d.id).objetos || {})[d.k]; if (!o) return;
    const n = (+o.cantidad || 1) + +d.d;
    if (n <= 0) { ui.confirmar = `borrar-obj-${d.k}`; return; }
    escribirEstado(d.id, `objetos/${d.k}/cantidad`, n);
  },
  'obj-borrar'(d) { if (!esDM()) return; ui.confirmar = null; escribirEstado(d.id, `objetos/${d.k}`, null); },
  'inv-migrar'(d) {
if (!esDM()) return;
        const f = F(d.id); const u = {}; let n = 0; const base = Date.now();
    const armas = [...ARMAS].sort((a, b) => b.nombre.length - a.nombre.length);
    const armaduras = [...ARMADURAS].sort((a, b) => b.nombre.length - a.nombre.length);
    for (const linea of f.equipo || []) {
      const m = String(linea).match(/^\s*(\d+)\s*(?:x|×)?\s*(.*)$/i);
      const cant = m ? Math.max(1, +m[1]) : 1; const texto = (m ? m[2] : String(linea)).trim(); const t = norm(texto);
      const arma = armas.find((a) => t.startsWith(norm(a.nombre)));
      const armd = armaduras.find((a) => t.startsWith(norm(a.nombre)));
      let o;
      if (arma) o = { nombre: arma.nombre, clase: 'arma', cantidad: cant, equipado: false, magia: 0, ref: arma.nombre, dado: arma.dado, tipo: arma.tipo, dist: arma.dist, sutil: arma.sutil, ligera: arma.ligera, versatil: arma.versatil, arrojadiza: arma.arrojadiza, props: arma.props, maestria: arma.maestria, competente: competenteCon(f.clase, arma), extra: '' };
      else if (armd && armd.tipo === 'escudo') o = { nombre: 'Escudo', clase: 'escudo', cantidad: 1, equipado: false, magia: 0, ref: 'Escudo' };
      else if (armd) o = { nombre: armd.nombre, clase: 'armadura', cantidad: 1, equipado: false, magia: 0, ref: armd.nombre, base: armd.base, des: armd.des, tipoArm: armd.tipo, sigilo: !!armd.sigilo, fuerza: armd.fuerza || '' };
      else o = { nombre: texto || String(linea), clase: 'objeto', cantidad: cant, equipado: false, magia: 0, bonoCA: 0, nota: '' };
      o.orden = base + n;
      u[`personajes/${d.id}/estado/objetos/${nuevoId('o')}${n}`] = o; n++;
    }
    u[`personajes/${d.id}/ficha/equipo`] = [];
    sync.escribir(u);
    aviso(`${n} objeto${n === 1 ? '' : 's'} en la mochila. Equipa lo que lleve puesto.`);
  },
  'ja-cancelar'(d) { const x = (C().acciones || {})[d.k]; if (x && x.de === d.id) sync.escribir({ [`combate/acciones/${d.k}`]: null }); },
  'ja-curar'(d) {
    const obj = ($('#ja-cura-obj') || {}).value; const n = parseInt(($('#ja-cura-cant') || {}).value, 10);
    if (!obj || !tienePv(obj)) { aviso('Elige a quién curas'); return; }
    if (!n || n < 0) { aviso('Escribe cuántos PV'); $('#ja-cura-cant').focus(); return; }
    const antes = pvDe(obj); const v = Math.min(+F(obj).pvMax, antes + n);
    const u = { [`personajes/${obj}/estado/pv`]: v };
    anotar(u, `${F(d.id).nombre} cura a ${F(obj).nombre}`);
    delete ui.borradores['ja-cura-cant'];
    sync.escribir(u); aviso(`${F(obj).nombre}: +${v - antes} PV`);
  },
  'acc-aplicar'(d) {
    const x = (C().acciones || {})[d.k]; if (!x) return;
    const p = presencia(x.objetivo); const quien = F(x.de).nombre || 'Alguien';
    const u = { [`combate/acciones/${d.k}`]: null };
    if (!p) { sync.escribir(u); return; }
    const base = parseInt(($('#ad-' + d.k) || {}).value, 10);
    const n = Math.floor((Number.isFinite(base) ? base : 0) * +d.f);
    const dano = +p.pvMax > 0 ? Math.min(+p.pvMax, (+p.dano || 0) + n) : (+p.dano || 0) + n;
    u[`presencias/${x.objetivo}/dano`] = dano;
    const cae = +p.pvMax > 0 && +p.pvMax - dano <= 0;
    if (cae) u[`presencias/${x.objetivo}/derrotado`] = true;
    anotar(u, `${x.conjuro || x.salva ? `${x.ataque} de ${quien} alcanza a ${p.nombre}` : `${quien} golpea a ${p.nombre}`}${x.critico ? ' con un crítico' : ''}${cae ? ` y ${p.nombre} cae` : ''}`);
    delete ui.borradores['ad-' + d.k]; delete ui.borradores['sv-' + d.k];
    sync.escribir(u);
    aviso(cae ? `${p.nombre} cae` : +p.pvMax > 0 ? `${p.nombre}: −${n} PV → ${Math.max(0, +p.pvMax - dano)}/${p.pvMax}` : `${p.nombre}: +${n} de daño`);
  },
  'acc-fallo'(d) {
    const x = (C().acciones || {})[d.k]; if (!x) return;
    const p = presencia(x.objetivo);
    const u = { [`combate/acciones/${d.k}`]: null };
    if (p) anotar(u, x.salva ? `${p.nombre} resiste ${x.ataque} de ${F(x.de).nombre || 'alguien'}` : `${F(x.de).nombre || 'Alguien'} falla contra ${p.nombre}`);
    delete ui.borradores['ad-' + d.k]; delete ui.borradores['sv-' + d.k];
    sync.escribir(u);
  },
  'tir-aplicar'(d) {
    const x = ui.tiradas.find((t) => t.id === d.t); if (!x || !x.aplicar) return;
    const pj = ($('#ap-' + d.t) || {}).value; if (!pj || !tienePv(pj)) { aviso('Elige a qué personaje'); return; }
    const n = Math.floor(x.aplicar.total * +d.f);
    const antes = pvDe(pj); const v = Math.max(0, antes - n);
    const u = { [`personajes/${pj}/estado/pv`]: v };
    anotar(u, `${nombreVisiblePr(x.aplicar.k)} golpea a ${F(pj).nombre}${v <= 0 ? ` y ${F(pj).nombre} cae inconsciente` : ''}`);
    sync.escribir(u);
    x.aplicado = `${F(pj).nombre} (−${n})`;
    const conc = S(pj).concentra;
    aviso(`${F(pj).nombre}: −${n} PV → ${v}/${F(pj).pvMax}${conc && n > 0 ? ` · salvación de CON CD ${Math.max(10, Math.floor(n / 2))} para mantener ${conc}` : ''}`);
  },
  /* DM: ajustes */
  'aj-guardar'() {
    sync.escribir({ 'campana/nombre': ($('#aj-nombre').value || '').trim() || 'Mi campaña', 'campana/capitulo': ($('#aj-cap').value || '').trim() });
    limpiar('aj-'); aviso('Campaña guardada');
  },
  'aj-pin'() {
    const p1 = ($('#aj-pin').value || '').trim(); const p2 = ($('#aj-pin2').value || '').trim();
    if (!pin4(p1)) { aviso('El PIN debe tener 4 números'); $('#aj-pin').focus(); return; }
    if (p1 !== p2) { aviso('Los dos PIN no coinciden'); $('#aj-pin2').focus(); return; }
    if (listaPj().some(([, p]) => p.ficha.pin === p1)) { aviso('Ese PIN ya lo usa un personaje'); return; }
    ui.desbloqueos.dm = p1; guardarDesbloqueos(); limpiar('aj-pin'); sync.escribir({ 'campana/pinDM': p1 }); aviso('PIN del DM cambiado');
  },
  async 'borrar-todo'() { ui.confirmar = null; ui.desbloqueos = {}; guardarDesbloqueos(); ui.yo = null; ui.ver = null; ls.set('mesa-yo', ''); ui.borradores = {}; await sync.reiniciar(); location.hash = 'mesa'; aviso('La campaña se borró'); },
};

// Importar y exportar fichas (.json)
const FORMATO = 'mesa-del-dm/personajes';
function pinLibre(usados) {
  for (let i = 0; i < 200; i++) { const p = String(1000 + Math.floor(Math.random() * 9000)); if (!usados.has(p)) return p; }
  return '0000';
}
async function importarFichas(file) {
  let datos;
  try { datos = JSON.parse(await file.text()); } catch (e) { aviso('Ese archivo no es un JSON válido'); return; }
  const lista = Array.isArray(datos) ? datos : datos && datos.personajes;
  if (!Array.isArray(lista) || !lista.length) { aviso('El archivo no trae personajes'); return; }
  const usados = new Set([...listaPj().map(([, p]) => String(p.ficha.pin)), String((E.campana || {}).pinDM || '')]);
  const nombres = new Set(listaPj().map(([, p]) => norm(p.ficha.nombre)));
  const colores = listaPj().map(([, p]) => p.ficha.color);
  const u = {}; const creados = []; const saltados = []; const pinesNuevos = [];
  lista.forEach((x, i) => {
    const base = (x && x.ficha) || x || {};
    if (!base.nombre) return;
    if (nombres.has(norm(base.nombre))) { saltados.push(base.nombre); return; }
    const id = nuevoId('pj');
    const color = base.color || COLORES.find((c) => !colores.includes(c)) || COLORES[i % COLORES.length];
    colores.push(color);
    const ficha = { ...fichaVacia(color), ...base, color, retrato: '', orden: Date.now() + i };
    ficha.recursos = (ficha.recursos || []).map((r) => ({ ...r, id: r.id || claveSegura(norm(r.nombre).replace(/ /g, '-')), max: +r.max || 1 }));
    let pin = String(ficha.pin || '');
    if (!pin4(pin) || usados.has(pin)) { pin = pinLibre(usados); pinesNuevos.push(ficha.nombre); }
    ficha.pin = pin; usados.add(pin); nombres.add(norm(ficha.nombre));
    if (x.retratoSrc && /^data:image\//.test(x.retratoSrc)) { const rid = 'rt' + id; u[`imagenes/${rid}`] = { nombre: `Retrato de ${ficha.nombre}`, tipo: 'retrato', src: x.retratoSrc, visible: false }; ficha.retrato = rid; }
    const pvMax = +ficha.pvMax || 0;
    u[`personajes/${id}`] = { ficha, estado: x.estado || { pv: pvMax, oro: 0, notas: '' }, dm: { secretos: x.secretos || '' } };
    creados.push(ficha.nombre);
  });
  if (!creados.length) { aviso(saltados.length ? `Ya existían: ${saltados.join(', ')}` : 'No se encontró ningún personaje con nombre'); return; }
  await sync.escribir(u);
  avisarEspacio();
  aviso(`Importados: ${creados.join(', ')}${saltados.length ? `. Ya existían: ${saltados.join(', ')}` : ''}${pinesNuevos.length ? '. Revisa sus PIN en cada tarjeta.' : ''}`);
}
function descargar(nombre, texto) {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  } catch (e) { aviso('Este navegador no dejó descargar el archivo'); return false; }
}
const slugCampana = () => norm((E.campana || {}).nombre || 'campana').replace(/[^a-z0-9]+/g, '-');

// Entradas de Historia en lote
const FORMATO_HISTORIA = 'mesa-del-dm/historia';
const SECCIONES_ALIAS = { mundo: 'mundo', 'el mundo': 'mundo', pnj: 'pnj', npc: 'pnj', npcs: 'pnj', personaje: 'pnj', personajes: 'pnj', 'personajes no jugadores': 'pnj', 'personaje no jugador': 'pnj', lugar: 'lugares', lugares: 'lugares', objeto: 'objetos', objetos: 'objetos', inscripcion: 'inscripciones', inscripciones: 'inscripciones', misterio: 'misterios', misterios: 'misterios' };
const comoLista = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : lineas(v));
const primero = (o, ...ks) => { for (const k of ks) if (o[k] != null && o[k] !== '') return o[k]; return ''; };

async function importarHistoria(file) {
  let datos;
  try { datos = JSON.parse(await file.text()); } catch (e) { aviso('Ese archivo no es un JSON válido'); return; }
  let lista = [];
  if (Array.isArray(datos)) lista = datos;
  else if (datos && Array.isArray(datos.entradas)) lista = datos.entradas;
  else if (datos && typeof datos === 'object') for (const [k, v] of Object.entries(datos)) if (Array.isArray(v) && SECCIONES_ALIAS[norm(k)]) lista.push(...v.map((x) => ({ seccion: k, ...x })));
  if (!lista.length) { aviso('El archivo no trae entradas'); return; }
  const enc = E.enciclopedia || {};
  const u = {}; let nuevas = 0, actualizadas = 0, conImagen = 0, pendientes = 0; const malas = [];
  // grupos por nombre: usa los que existen y crea los que falten
  const gruposPorNombre = new Map(listaGrupos().map(([k, g]) => [norm(g.nombre), k]));
  let ordenGrupo = Math.max(0, ...listaGrupos().map(([, g]) => g.orden || 0));
  const grupoPorNombre = (n) => {
    const nn = norm(n); if (!nn) return '';
    if (!gruposPorNombre.has(nn)) { const k = nuevoId('gr'); gruposPorNombre.set(nn, k); u[`grupos/${k}`] = { nombre: String(n).trim(), orden: ++ordenGrupo }; }
    return gruposPorNombre.get(nn);
  };
  const imagenPorNombre = (n) => (Object.entries(imgs()).find(([, i]) => norm(i.nombre) === norm(n)) || [])[0] || '';
  lista.forEach((x, i) => {
    const cat = SECCIONES_ALIAS[norm(x.seccion || x.section || x.categoria || '')];
    const titulo = String(primero(x, 'titulo', 'nombre', 'title', 'texto_inscripcion')).trim();
    if (!cat || !titulo) { malas.push(titulo || `fila ${i + 1}`); return; }
    const nombreImg = String(primero(x, 'imagen', 'image', 'img')).trim();
    const img = nombreImg ? imagenPorNombre(nombreImg) : '';
    const ent = cat === 'misterios'
      ? { titulo, resuelto: !!x.resuelto }
      : { titulo, sub: String(primero(x, 'sub', 'subtitulo', 'rol', 'estado', 'lugar', 'detalle')), texto: String(primero(x, 'texto', 'descripcion', 'description')), visto: comoLista(x.visto || x.vimos || []), dicho: comoLista(x.dicho || x.dijeron || []), misterio: String(primero(x, 'misterio', 'por_descubrir', 'porDescubrir')), ...(cat === 'mundo' ? { tipo: ['hecho', 'dicho', 'misterio'].includes(x.tipo) ? x.tipo : 'hecho' } : {}) };
    const notas = String(primero(x, 'notasDM', 'notas_dm', 'notasDm', 'notas_del_dm')).trim();
    if (notas) ent.notasDM = notas;
    const nombreGrupo = String(primero(x, 'grupo', 'arco', 'capitulo', 'campana')).trim();
    if (nombreGrupo) ent.grupo = grupoPorNombre(nombreGrupo);
    if (cat !== 'misterios') { if (img) { ent.img = img; conImagen++; } else if (nombreImg) { ent.imgPendiente = nombreImg; pendientes++; } }
    const revelada = x.revelada === true || x.oculto === false;
    const existe = Object.entries(enc[cat] || {}).find(([, y]) => norm(y.titulo) === norm(titulo));
    if (existe) {
      const [id, prev] = existe;
      u[`enciclopedia/${cat}/${id}`] = { ...prev, ...ent, img: ent.img || prev.img || '', oculto: revelada ? false : !!prev.oculto, orden: prev.orden || Date.now() + i };
      if (!ent.imgPendiente && !prev.img && prev.imgPendiente) u[`enciclopedia/${cat}/${id}`].imgPendiente = prev.imgPendiente;
      actualizadas++;
    } else {
      u[`enciclopedia/${cat}/${nuevoId(cat.slice(0, 2))}`] = { img: '', ...ent, oculto: !revelada, orden: Date.now() + i };
      nuevas++;
    }
  });
  if (!nuevas && !actualizadas) { aviso('No se reconoció ninguna entrada. Revisa la «seccion» y el «titulo» de cada una.'); return; }
  await sync.escribir(u);
  const partes = [`${nuevas} nueva${nuevas === 1 ? '' : 's'}`];
  if (actualizadas) partes.push(`${actualizadas} actualizada${actualizadas === 1 ? '' : 's'}`);
  if (pendientes) partes.push(`${pendientes} esperando imagen`);
  if (malas.length) partes.push(`${malas.length} sin sección o título`);
  aviso(`Entradas importadas: ${partes.join(', ')}`);
}

function exportarHistoria() {
  const entradas = [];
  for (const cat of Object.keys(CATEGORIAS)) for (const [, x] of porOrden((E.enciclopedia || {})[cat])) {
    const e = { seccion: cat, titulo: x.titulo };
    if (cat === 'misterios') e.resuelto = !!x.resuelto;
    else Object.assign(e, { sub: x.sub || '', texto: x.texto || '', visto: x.visto || [], dicho: x.dicho || [], misterio: x.misterio || '', imagen: (imgs()[x.img] || {}).nombre || x.imgPendiente || '', ...(cat === 'mundo' ? { tipo: x.tipo || 'hecho' } : {}) });
    if (x.notasDM) e.notasDM = x.notasDM;
    if (grupoDe(x)) e.grupo = E.grupos[x.grupo].nombre;
    e.revelada = !x.oculto;
    entradas.push(e);
  }
  if (descargar(`historia-${slugCampana()}.json`, JSON.stringify({ formato: FORMATO_HISTORIA, version: 1, entradas }, null, 2))) aviso('Entradas exportadas');
}

function exportarFichas() {
  const personajes = listaPj().map(([id, p]) => ({ ficha: p.ficha, estado: p.estado || {}, secretos: secretosDe(id), retratoSrc: srcDe(p.ficha.retrato) || undefined }));
  const texto = JSON.stringify({ formato: FORMATO, version: 1, campana: (E.campana || {}).nombre || '', personajes }, null, 2);
  if (descargar(`personajes-${slugCampana()}.json`, texto)) aviso('Fichas exportadas');
}

/* ---------- Banco de PNJ: tiradas, copias, importar y exportar ---------- */
function registrar(texto, detalle = '', clase = '', aplicar = null) {
  ui.tiradas.unshift({ id: nuevoId('t'), texto, detalle, clase, ts: Date.now(), aplicar });
  ui.tiradas = ui.tiradas.slice(0, 12);
  aviso(texto);
}

// Nombres para n copias: «Bandido» si es el único; si no, «Bandido 1», «Bandido 2»… siguiendo los que ya estén en escena
function nombresCopias(base, n) {
  const re = new RegExp('^' + norm(base).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?: (\\d+))?$');
  let max = 0; let hay = false;
  for (const p of Object.values(E.presencias || {})) { const m = norm(p.nombre).match(re); if (m) { hay = true; max = Math.max(max, m[1] ? +m[1] : 1); } }
  if (!hay && n === 1) return [base];
  return Array.from({ length: n }, (_, i) => `${base} ${max + i + 1}`);
}

// modo: 'escena' (según la casilla de combate), 'prep' (deja su iniciativa tirada en Preparar combate) o 'combate' (entran al combate en curso)
function ponerEnEscena(tid, cant, pre = 'pl', modo = 'escena') {
  const t = (E.banco || {})[tid];
  if (!t) { aviso('Elige una plantilla del banco'); return; }
  cant = Math.max(1, Math.min(20, cant || 1));
  const b = ui.borradores;
  const oculto = !!b[pre + '-opt-oculto'];
  const tirarPv = !!b[pre + '-opt-tirarpv'] && !!t.dadosPv;
  const alCombate = !!C().activo && (modo === 'combate' || (modo === 'escena' && (b[pre + '-opt-combate'] ?? true)));
  const mod = modDe(t.ini);
  const u = {}; const base = Date.now(); const inis = [];
  nombresCopias(t.nombre, cant).forEach((nombre, i) => {
    let pvMax = +t.pv || 0;
    if (tirarPv) { const r = tirarExpr(t.dadosPv); if (r) pvMax = Math.max(1, r.total); }
    const k = nuevoId('pr') + i;
    u[`presencias/${k}`] = { nombre, tipo: t.tipo || 'enemigo', img: t.img || '', dano: 0, derrotado: false, orden: base + i, plantilla: tid, pvMax: pvMax || '', ca: t.ca ?? '', ini: t.ini || '', ataques: (t.ataques || []).map((a) => ({ nombre: a.nombre || '', bono: a.bono || '', dano: a.dano || '' })), oculto };
    if (alCombate) { const v = tirarD20().nat + mod; u[`combate/participantes/${nuevoId('c')}${i}`] = { tipo: 'pr', ref: k, nombre, ini: v, desempate: mod }; inis.push(`${nombre} ${v}`); }
    else if (modo === 'prep') { const v = tirarD20().nat + mod; b['ini-pr-' + k] = String(v); b['cb-pr-' + k] = true; inis.push(`${nombre} ${v}`); }
  });
  sync.escribir(u);
  if (inis.length) registrar(`Iniciativa: ${inis.join(' · ')}`, `d20 ${mod >= 0 ? '+' : '−'} ${Math.abs(mod)}`);
  aviso(`${cant === 1 ? `${t.nombre} está` : `${cant} × ${t.nombre} están`} en escena${oculto ? ' (ocultos en la mesa)' : ''}${alCombate ? ' y en el combate' : modo === 'prep' ? ', listos para el combate' : ''}`);
}

const FORMATO_BANCO = 'mesa-del-dm/banco';
function exportarBanco() {
  const plantillas = listaBanco().map(([, t]) => {
    const x = { ...t, retrato: (imgs()[t.img] || {}).nombre || '' };
    delete x.img; delete x.orden;
    return x;
  });
  if (descargar(`banco-pnj-${slugCampana()}.json`, JSON.stringify({ formato: FORMATO_BANCO, version: 1, plantillas }, null, 2))) aviso('Banco exportado');
}

async function importarBanco(file) {
  let datos;
  try { datos = JSON.parse(await file.text()); } catch (e) { aviso('Ese archivo no es un JSON válido'); return; }
  const lista = Array.isArray(datos) ? datos : datos && (datos.plantillas || datos.pnj || datos.monstruos);
  if (!Array.isArray(lista) || !lista.length) { aviso('El archivo no trae plantillas'); return; }
  const comoTexto = (v, campo) => (Array.isArray(v) ? (campo === 'otros' ? v.map(String) : v) : textoALista(campo === 'acciones' ? 'rasgos' : campo, String(v || '')));
  const imagenPorNombre = (n) => (Object.entries(imgs()).find(([, i]) => norm(i.nombre) === norm(n)) || [])[0] || '';
  const u = {}; let nuevas = 0, actualizadas = 0;
  lista.forEach((x, i) => {
    const nombre = String((x && (x.nombre || x.name)) || '').trim(); if (!nombre) return;
    const existe = listaBanco().find(([, t]) => norm(t.nombre) === norm(nombre));
    const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : ''; };
    const t = {
      nombre, grupo: String(x.grupo || '').trim(), tipo: TIPOS_PRESENCIA[x.tipo] ? x.tipo : 'enemigo', vd: String(x.vd ?? ''), desc: String(x.desc || x.descripcion || ''),
      ca: num(x.ca), caNota: String(x.caNota || ''), dadosPv: String(x.dadosPv || ''), velocidad: String(x.velocidad || ''), ini: String(x.ini ?? x.iniciativa ?? ''),
      atributos: Object.fromEntries(ATRIBUTOS.map((a) => [a, num((x.atributos || {})[a])])),
      otros: Array.isArray(x.otros) ? x.otros.map(String) : lineas(x.otros), ataques: comoTexto(x.ataques, 'ataques'), rasgos: comoTexto(x.rasgos, 'rasgos'), acciones: comoTexto(x.acciones, 'acciones'),
      notas: String(x.notas || x.notasDM || ''),
    };
    t.pv = num(x.pv) || promedio(t.dadosPv) || '';
    const ret = String(x.retrato || x.imagen || '').trim();
    t.img = ret ? imagenPorNombre(ret) : '';
    if (existe) { u[`banco/${existe[0]}`] = { ...existe[1], ...t, img: t.img || existe[1].img || '' }; actualizadas++; }
    else { u[`banco/${nuevoId('pl')}${i}`] = { ...t, orden: Date.now() + i }; nuevas++; }
  });
  if (!nuevas && !actualizadas) { aviso('Ninguna plantilla tenía nombre'); return; }
  await sync.escribir(u);
  aviso(`Banco: ${nuevas} nueva${nuevas === 1 ? '' : 's'}${actualizadas ? `, ${actualizadas} actualizada${actualizadas === 1 ? '' : 's'}` : ''}`);
}

const CAMBIOS = {
  'ent-cat'() { render(); },
  redibujar() { render(); },
  'nivel-conj'(t) { ui.borradores['lz-' + t.dataset.c] = t.value; for (const k of ['ja-dano', 'ja-detalle']) delete ui.borradores[k]; render(); },
  moneda(t) { if (!esDM()) return; const v = Math.max(0, parseInt(t.value, 10) || 0); const u = { [`personajes/${t.dataset.id}/estado/monedas/${t.dataset.k}`]: v }; if (t.dataset.k === 'po') u[`personajes/${t.dataset.id}/estado/oro`] = v; sync.escribir(u); },
  ini(t) { const v = parseInt(t.value, 10); sync.escribir({ [`combate/participantes/${t.dataset.pid}/ini`]: Number.isFinite(v) ? v : '' }); },
  'ent-grupo-form'(t) { ui.borradores['ent-grupo'] = t.value; render(); if (t.value === '__nuevo') { const el = $('#ent-grupo-nuevo'); if (el) el.focus(); } },
  'ent-grupo'(t) { sync.escribir({ [`enciclopedia/${t.dataset.cat}/${t.dataset.id}/grupo`]: t.value || null }); },
  amb(t) { sync.escribir({ [`ambiente/${t.dataset.campo}`]: t.value }); },
  async importar(t) { const f = t.files && t.files[0]; t.value = ''; if (f) await importarFichas(f); },
  async 'importar-historia'(t) { const f = t.files && t.files[0]; t.value = ''; if (f) await importarHistoria(f); },
  async 'importar-banco'(t) { const f = t.files && t.files[0]; t.value = ''; if (f) await importarBanco(f); },
};

// Ejecuta una acción y vuelve a dibujar al final, para que los formularios se limpien
// aunque la escritura haya redibujado antes de borrar el borrador.
function ejecutar(fn, datos) {
  let r;
  try { r = fn(datos); } finally { if (!(r && typeof r.then === 'function')) render(); }
  if (r && typeof r.then === 'function') r.finally(() => render());
}

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-accion]');
  if (!b) { if (ev.target.id === 'capa') ACCIONES['cerrar-capa'](); return; }
  const fn = ACCIONES[b.dataset.accion];
  if (fn) { ev.preventDefault(); ejecutar(fn, { ...b.dataset }); }
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset && 'borrador' in t.dataset && t.id) ui.borradores[t.id] = t.value;
  if (t.id === 'ja-golpe') { delete ui.borradores['ja-nat']; delete ui.borradores['ja-detalle']; }
  if (t.dataset && 'filtro' in t.dataset) { clearTimeout(render.f); render.f = setTimeout(render, 160); }
  if (t.dataset && t.dataset.buscar) { ui.reglas[t.dataset.buscar].q = t.value; clearTimeout(render.t); render.t = setTimeout(render, 140); }
  if (t.dataset && t.dataset.notas) { clearTimeout(guardarNotas.t); guardarNotas.t = setTimeout(() => guardarNotas(t.dataset.notas, t.value), 700); }
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.dataset && 'borrador' in t.dataset && t.id) ui.borradores[t.id] = t.value;
  if (t.dataset && 'borradorCheck' in t.dataset && t.id) ui.borradores[t.id] = t.checked;
  if (t.dataset && t.dataset.cambio && CAMBIOS[t.dataset.cambio]) CAMBIOS[t.dataset.cambio](t);
});
document.addEventListener('toggle', (ev) => {
  const t = ev.target;
  if (t && t.dataset && t.dataset.abrir) { if (t.open) ui.abiertos.add(t.dataset.abrir); else ui.abiertos.delete(t.dataset.abrir); return; }
  if (!t || !t.dataset || !t.dataset.plegar) return;
  if (t.open) plegados.delete(t.dataset.plegar); else plegados.add(t.dataset.plegar);
  ls.set('mesa-plegados', JSON.stringify([...plegados]));
}, true);
function guardarNotas(id, valor) { escribirEstado(id, 'notas', valor); }
document.addEventListener('focusout', (ev) => {
  const t = ev.target;
  if (t.dataset && t.dataset.notas) { clearTimeout(guardarNotas.t); guardarNotas(t.dataset.notas, t.value); delete ui.borradores[t.id]; }
});
document.addEventListener('keydown', (ev) => {
  const t = ev.target;
  if (ev.key === 'Enter' && t.dataset && t.dataset.enter) { ev.preventDefault(); ejecutar(ACCIONES[t.dataset.enter], { ...t.dataset }); return; }
  if (ev.key === 'Escape' && !$('#capa').hidden) { ACCIONES['cerrar-capa'](); return; }
  const enPin = (ui.ruta === 'ficha' && ui.ver && F(ui.ver).nombre && !puedeVer(ui.ver) && !ui.editandoPj) || (ui.ruta === 'dm' && (E.campana || {}).pinDM && !esDM());
  if (enPin && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
    if (/^\d$/.test(ev.key)) pinTecla(ev.key);
    else if (ev.key === 'Backspace') ACCIONES['pin-borrar']();
  }
});
window.addEventListener('hashchange', irA);

(async function iniciar() {
  sync = await crearSync();
  sync.on((estado) => { E = estado; render(); });
  E = sync.estado;
  irA();
})();
