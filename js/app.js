import { ATRIBUTOS, NOMBRE_ATRIBUTO, COLORES, CATEGORIAS, TIPOS_PRESENCIA, MOMENTOS, LUCES, CLIMAS, TEMPERATURAS, fichaVacia } from './datos.js';
import { crearSync, claveSegura } from './sync.js';

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
const RUTAS = ['mesa', 'ficha', 'historia', 'dm'];
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
  ultimoTurno: 'inicio',
  ocupado: false,
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
  porOrden(E.presencias).forEach(([k, pr], i) => {
    const p = pos[k] || { x: 92, y: 10 + i * 9 };
    const src = srcDe(pr.img);
    const letra = esc((pr.nombre || '?').slice(0, 2).replace(/^./, (c) => c.toUpperCase()));
    fichas.push(`<div class="ficha-mapa presencia ${esc(pr.tipo || 'enemigo')}${pr.derrotado ? ' caido' : ''}" data-ficha="${esc(k)}" style="left:${p.x}%;top:${p.y}%${src ? `;background-image:url(${src})` : ''}" role="img" aria-label="${esc(pr.nombre)}">${src ? '' : letra}<span class="etq">${esc(pr.nombre)}</span></div>`);
  });
  return `<div class="mapa${editable ? ' editable' : ''}" id="mapa" data-mapa="${esc(clave)}"><img src="${mapa.src}" alt="Mapa: ${esc(mapa.nombre)}" draggable="false">${fichas.join('')}</div>`;
}

function htmlEscenaVisual() {
  const ilu = (E.escena || {}).ilustracion;
  if (ilu && imgs()[ilu]) return `<figure class="ilustracion"><img src="${imgs()[ilu].src}" alt="${esc(imgs()[ilu].nombre)}" data-accion="ver-imagen" data-src="${esc(imgs()[ilu].src)}"><figcaption>${esc(imgs()[ilu].nombre)}</figcaption></figure>`;
  return htmlMapa(false);
}

function pjMini(id) {
  const f = F(id); const s = S(id); const pv = pvDe(id);
  const est = Object.keys(s.estados || {});
  return `<button type="button" class="pj${esTurnoDe('pj', id) ? ' turno' : ''}" style="--c:${f.color};text-align:left" data-accion="elegir" data-id="${esc(id)}">
    ${avatar(id)}
    <div>
      <div class="pj-fila"><span class="pj-nombre">${esc(f.nombre)}${ui.yo === id ? '<span class="tu">TÚ</span>' : ''}</span><span class="pv-num num">${tienePv(id) ? `<b>${pv}</b>/${f.pvMax} PV` : 'PV por definir'}</span></div>
      <div class="pj-fila"><span class="pj-clase">${esc([f.raza, f.clase].filter(Boolean).join(' · '))}</span><span class="pj-clase num">CA ${esc(dato(f.ca))}</span></div>
      ${tienePv(id) ? `<div class="barra-pv ${nivelPv(pv, f.pvMax)}"><span style="width:${pct(pv, f.pvMax)}%"></span></div>` : ''}
      ${(s.concentra || est.length || (tienePv(id) && pv <= 0)) ? `<div class="pj-chips">${tienePv(id) && pv <= 0 ? '<span class="chip malo">Inconsciente</span>' : ''}${s.concentra ? `<span class="chip conc">◈ ${esc(s.concentra)}</span>` : ''}${est.map((x) => `<span class="chip est">${esc(x)}</span>`).join('')}</div>` : ''}
    </div>
  </button>`;
}

function htmlPresencias() {
  const lista = porOrden(E.presencias);
  if (!lista.length) return '';
  return `<section class="panel">
    <h2 class="panel-titulo">En escena</h2>
    <div class="guardianes">${lista.map(([k, p]) => {
      const est = Object.keys(p.estados || {});
      return `<div class="guardian ${esc(p.tipo || 'enemigo')}${p.derrotado ? ' caido' : ''}${esTurnoDe('pr', k) ? ' turno' : ''}">${srcDe(p.img) ? `<img class="guardian-foto" src="${srcDe(p.img)}" alt="">` : ''}<div style="flex:1;min-width:0"><div class="guardian-nombre">${esc(p.nombre)}</div><div class="guardian-info">${esc(TIPOS_PRESENCIA[p.tipo] || 'Enemigo')}${p.derrotado ? ' · Derrotado' : p.dano ? ` · ${p.dano} de daño recibido` : ''}</div></div><div class="pj-chips" style="justify-content:flex-end;margin:0">${est.map((x) => `<span class="chip est">${esc(x)}</span>`).join('')}</div></div>`;
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
const nombreP = (p) => (p.tipo === 'pj' ? F(p.ref).nombre : p.tipo === 'pr' ? (presencia(p.ref) || {}).nombre : '') || p.nombre;
const colorP = (p) => (p.tipo === 'pj' ? F(p.ref).color : p.tipo === 'pr' ? COLOR_TIPO[(presencia(p.ref) || {}).tipo] || COLOR_TIPO.enemigo : '#a89e8b');
const turnoDe = () => { const c = C(); return c.activo ? (c.participantes || {})[c.turno] || null : null; };
const esTurnoDe = (tipo, ref) => { const t = turnoDe(); return !!t && t.tipo === tipo && t.ref === ref; };

function htmlIniciativa() {
  const c = C(); if (!c.activo) return '';
  return `<section class="panel iniciativa">
    <h2 class="panel-titulo">${icono('espadas')} Iniciativa <span class="extra">Ronda ${c.ronda}</span></h2>
    <ol class="orden">${participantes().map(([pid, p]) => `<li class="${pid === c.turno ? 'actual' : ''}${derrotadoP(p) ? ' caido' : ''}" style="--c:${colorP(p)}"><span class="ini num">${p.ini === '' || p.ini == null ? '—' : esc(p.ini)}</span><span class="quien">${esc(nombreP(p))}</span>${pid === c.turno ? '<span class="su-turno">Su turno</span>' : ''}</li>`).join('')}</ol>
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
      ${htmlAmbiente()}
      ${htmlRelojes()}
      <section class="panel">
        <h2 class="panel-titulo">El grupo</h2>
        ${pjs.length ? `<div class="grupo">${pjs.map(([id]) => pjMini(id)).join('')}</div>` : '<p class="tenue" style="margin:0">Todavía no hay personajes.</p>'}
      </section>
      ${htmlPresencias()}
    </div>
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

function vistaHoja(id) {
  const f = F(id); const s = S(id); const pv = pvDe(id);
  const est = Object.keys(s.estados || {});
  const inv = Object.entries(s.inventario || {});
  const pistas = porOrden(s.pistas, (p) => p.ts || 0).map(([, p]) => p);
  const notasId = `notas-${id}`;
  const niveles = Array.from({ length: 9 }, (_, i) => i + 1).filter((n) => +((f.espacios || {})['n' + n] || 0) > 0);
  const conjPorNivel = {};
  for (const c of f.conjuros || []) (conjPorNivel[c.nivel || 1] = conjPorNivel[c.nivel || 1] || []).push(c);
  const datos = [f.raza, [f.clase, f.subclase].filter(Boolean).join(' · '), f.nivel ? `Nivel ${f.nivel}` : '', f.edad, f.alineamiento].filter(Boolean).join(' · ');
  const t = turnoDe();
  const mio = !!t && t.tipo === 'pj' && t.ref === id;
  const banner = C().activo ? `<div class="ancho banner-turno${mio ? ' mio' : ''}" role="status">${icono('espadas')}<span>${mio ? '¡Es tu turno!' : `Ronda ${C().ronda} · Turno de ${esc(t ? nombreP(t) : '—')}`}</span></div>` : '';
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
          <div class="vital"><b class="num">${esc(dato(f.ca))}</b><span>CA</span>${f.caNota ? `<small>${esc(f.caNota)}</small>` : ''}</div>
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

      ${(f.ataques || []).length ? `<section class="panel">
        <h2 class="panel-titulo">Ataques</h2>
        ${f.ataques.map((a) => `<div class="ataque"><b>${esc(a.nombre)}</b><span class="bono">${esc(a.bono)}</span>${a.dano ? `<span class="dano">${esc(a.dano)}</span>` : ''}</div>`).join('')}
      </section>` : ''}

      ${((f.trucos || []).length || (f.conjuros || []).length) ? `<section class="panel">
        <h2 class="panel-titulo">Conjuros</h2>
        ${(f.trucos || []).length ? `<p class="sub">Trucos (ilimitados)</p>${f.trucos.map((c) => `<div class="conjuro"><b>${esc(c.nombre)}</b>${c.texto ? `<p>${esc(c.texto)}</p>` : ''}</div>`).join('')}` : ''}
        ${Object.keys(conjPorNivel).sort((a, b) => a - b).map((n) => `<p class="sub" style="margin-top:12px">Nivel ${n}</p>${conjPorNivel[n].map((c) => `<div class="conjuro"><b>${esc(c.nombre)}</b>${c.texto ? `<p>${esc(c.texto)}</p>` : ''}</div>`).join('')}`).join('')}
      </section>` : ''}
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

      <section class="panel">
        <h2 class="panel-titulo">Equipo</h2>
        <div class="recurso" style="padding-top:0"><div class="recurso-nombre">Monedas de oro</div><div class="contador"><button type="button" class="btn btn-red btn-peq" data-accion="oro" data-id="${esc(id)}" data-d="-1" aria-label="Restar una moneda">−</button><b class="num">${s.oro ?? 0}</b><button type="button" class="btn btn-red btn-peq" data-accion="oro" data-id="${esc(id)}" data-d="1" aria-label="Sumar una moneda">+</button></div></div>
        <p class="sub" style="margin-top:8px">Objetos especiales</p>
        <ul class="lista inv">${inv.length ? inv.map(([k, t]) => `<li><span>${esc(t)}</span><button type="button" data-accion="inv-quitar" data-id="${esc(id)}" data-k="${esc(k)}" aria-label="Quitar ${esc(t)}">×</button></li>`).join('') : '<li class="tenue">Ninguno</li>'}</ul>
        <div class="agregar"><label class="sr" for="inv-in">Nuevo objeto</label><input id="inv-in" placeholder="Añadir objeto" data-borrador data-enter="inv-poner" data-id="${esc(id)}" value="${esc(ui.borradores['inv-in'] ?? '')}"><button type="button" class="btn btn-peq" data-accion="inv-poner" data-id="${esc(id)}">Añadir</button></div>
        ${(f.equipo || []).length ? `<p class="sub" style="margin-top:14px">Equipo base</p><p style="margin:0;color:var(--tenue);font-size:15px">${f.equipo.map(esc).join(' · ')}</p>` : ''}
      </section>

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
  ataques: { etq: 'Ataques', ayuda: 'Una por línea: Nombre | bono | daño', ej: 'Espada larga | +4 | 1d8 + 2 cortante' },
  trucos: { etq: 'Trucos', ayuda: 'Uno por línea: Nombre: descripción', ej: 'Luz: Un objeto brilla como una antorcha.' },
  conjuros: { etq: 'Conjuros', ayuda: 'Uno por línea: nivel | Nombre | descripción', ej: '1 | Curar heridas | Recupera 1d8 + mod PV al tocar.' },
  rasgos: { etq: 'Rasgos', ayuda: 'Uno por línea: Nombre: descripción', ej: 'Visión en la oscuridad: Ves hasta 18 m sin luz.' },
  recursos: { etq: 'Recursos con usos', ayuda: 'Uno por línea: Nombre | máximo | recarga (corto, largo o ninguna) | detalle opcional', ej: 'Segundo aliento | 1 | corto | Recuperas 1d10 + nivel PV\nFlechas | 20 | ninguna' },
  equipo: { etq: 'Equipo base', ayuda: 'Uno por línea', ej: 'Cota de malla\nMochila de explorador' },
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

const CAMPOS_TEXTO = ['nombre', 'epiteto', 'raza', 'clase', 'subclase', 'genero', 'alineamiento', 'nivel', 'edad', 'origen', 'color', 'pin', 'retrato', 'pvMax', 'ca', 'caNota', 'velocidad', 'iniciativa', 'competencia', 'cd', 'ataqueConjuro', 'apariencia', 'personalidad', 'historia', 'objetivo', 'cita'];

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
      ${campo('ca', 'Clase de armadura', 'type="number" min="0" inputmode="numeric"')}
      ${campo('caNota', 'Nota de la CA (ej. cota + escudo)')}
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

    ${Object.entries(LISTAS).map(([k, l]) => `<div class="lista-campo"><label class="etq" for="pj-${k}">${l.etq}</label><p class="ayuda">${esc(l.ayuda)}</p><textarea class="campo" id="pj-${k}" data-borrador placeholder="${esc(l.ej)}">${b(k)}</textarea></div>`).join('')}

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

function vistaHistoria() {
  const e = E.escena || {};
  const pistas = porOrden(E.pistas, (p) => p.ts || 0).map(([, p]) => p);
  const bit = Object.values(E.bitacora || {}).sort((a, b) => b.ts - a.ts);
  const galeria = Object.entries(imgs()).filter(([, i]) => i.tipo !== 'mapa' && i.visible);
  const mist = visibles('misterios');
  const secciones = [
    ['h-mundo', 'El mundo', visibles('mundo').length && `<div class="enciclopedia">${visibles('mundo').map(([, m]) => `<article class="entrada-mundo">${imgClic(m.img, 'banda')}<div class="fila-sep"><h3>${esc(m.titulo)}</h3>${m.tipo ? `<span class="tag ${m.tipo}">${TIPO[m.tipo] || ''}</span>` : ''}</div>${m.texto ? `<p>${esc(m.texto)}</p>` : ''}${listasVistoDicho(m, 'Novedades')}</article>`).join('')}</div>`],
    ['h-pnj', 'Personajes no jugadores', visibles('pnj').length && `<div class="pnjs">${visibles('pnj').map(([, p]) => `<article class="pnj">${srcDe(p.img) ? imgClic(p.img) : '<div class="sin-retrato" aria-hidden="true">?</div>'}<div class="pnj-txt"><h3>${esc(p.titulo)}</h3>${p.sub ? `<div class="tenue" style="font-size:14px">${esc(p.sub)}</div>` : ''}${p.texto ? `<p>${esc(p.texto)}</p>` : ''}${listasVistoDicho(p)}</div></article>`).join('')}</div>`],
    ['h-lugares', 'Lugares', visibles('lugares').length && `<div class="tarjetas">${visibles('lugares').map(([, l]) => `<article class="tarjeta">${imgClic(l.img)}<div class="tarjeta-txt"><div class="fila-sep"><h3>${esc(l.titulo)}</h3>${l.sub ? `<span class="chip">${esc(l.sub)}</span>` : ''}</div>${l.texto ? `<p>${esc(l.texto)}</p>` : ''}${listasVistoDicho(l, 'Novedades')}</div></article>`).join('')}</div>`],
    ['h-objetos', 'Objetos', visibles('objetos').length && `<div class="objetos">${visibles('objetos').map(([, o]) => `<article class="objeto">${srcDe(o.img) ? imgClic(o.img) : ''}<div><h3>${esc(o.titulo)}</h3>${o.sub ? `<div class="tenue" style="font-size:14px">${esc(o.sub)}</div>` : ''}${o.texto ? `<p>${esc(o.texto)}</p>` : ''}${listasVistoDicho(o, 'Novedades')}</div></article>`).join('')}</div>`],
    ['h-insc', 'Inscripciones', visibles('inscripciones').length && `<div class="inscripciones">${visibles('inscripciones').map(([, i]) => `<div class="inscripcion">${srcDe(i.img) ? imgClic(i.img, 'insc-img') : ''}<div class="insc-texto">${esc(i.titulo)}</div>${i.sub ? `<div class="tenue" style="font-size:14px">${esc(i.sub)}</div>` : ''}${i.texto ? `<div style="font-size:15px">${esc(i.texto)}</div>` : ''}</div>`).join('')}</div>`],
    ['h-misterios', 'Misterios', mist.length && `<div class="pj-chips">${mist.filter(([, m]) => !m.resuelto).map(([, m]) => `<span class="chip conc">${esc(m.titulo)}</span>`).join('') || '<span class="tenue">Ninguno abierto.</span>'}</div>${mist.some(([, m]) => m.resuelto) ? `<p class="sub" style="margin-top:12px">Resueltos</p><div class="pj-chips">${mist.filter(([, m]) => m.resuelto).map(([, m]) => `<span class="chip resuelto">✓ ${esc(m.titulo)}</span>`).join('')}</div>` : ''}`],
    ['h-galeria', 'Galería', galeria.length && `<div class="galeria">${galeria.map(([, i]) => `<figure><img src="${i.src}" alt="${esc(i.nombre)}" data-accion="ver-imagen" data-src="${esc(i.src)}" loading="lazy"><figcaption>${esc(i.nombre)}</figcaption></figure>`).join('')}</div>`],
  ].filter((s) => s[2]);
  return `${secciones.length ? `<nav class="indice" aria-label="Secciones de la historia">${[['h-escena', 'Dónde estamos'], ...secciones.map(([id, t]) => [id, t]), ['h-bitacora', 'Bitácora']].map(([id, t]) => `<button type="button" class="chip" data-accion="ir-seccion" data-id="${id}">${t}</button>`).join('')}</nav>` : ''}
  <div class="historia">
    <div class="columna">
      <section class="panel" id="h-escena">
        <h2 class="panel-titulo">Dónde estamos</h2>
        <h1 style="font-size:24px;color:var(--oro-claro)">${esc(e.lugar || 'Sin lugar definido')}</h1>
        ${e.alerta ? `<div class="alerta" style="margin-top:10px"><span class="alerta-icono" aria-hidden="true"></span><span>${esc(e.alerta)}</span></div>` : ''}
        ${e.texto ? `<p style="margin:10px 0 0">${esc(e.texto)}</p>` : ''}
      </section>
      ${secciones.map(([id, t, html]) => `<section class="panel" id="${id}"><h2 class="panel-titulo">${t}</h2>${html}</section>`).join('')}
      ${secciones.length ? '' : '<div class="vacio">La historia está vacía. El DM la va llenando desde DM → Biblioteca.</div>'}
    </div>
    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Pistas del grupo</h2>
        <div class="pistas">${pistas.length ? pistas.map(htmlPista).join('') : '<p class="tenue" style="margin:0">Todavía no hay pistas.</p>'}</div>
      </section>
      <section class="pergamino" id="h-bitacora">
        <h2 class="panel-titulo">Bitácora</h2>
        <div class="bitacora">${bit.length ? bit.map((x) => `<div class="entrada${x.tipo === 'cambio' ? ' cambio' : ''}"><time class="num" style="color:var(--tinta-suave)">${hora(x.ts)}</time><p>${esc(x.texto)}</p></div>`).join('') : '<p style="margin:0">Aquí queda lo que narre el DM.</p>'}</div>
      </section>
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
  const tabs = [['mesa', 'Mesa'], ['personajes', 'Personajes'], ['biblioteca', 'Biblioteca'], ['ajustes', 'Ajustes']];
  const cuerpo = { mesa: dmMesa, personajes: dmPersonajes, biblioteca: dmBiblioteca, ajustes: dmAjustes }[ui.dmTab]();
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
      <div class="fila" style="margin-bottom:12px"><button type="button" class="btn" data-accion="turno" data-d="-1">◀ Anterior</button><button type="button" class="btn btn-oro" data-accion="turno" data-d="1">Siguiente turno ▶</button></div>
      <ol class="orden dm">${lista.map(([pid, p]) => `<li class="${pid === c.turno ? 'actual' : ''}${derrotadoP(p) ? ' caido' : ''}" style="--c:${colorP(p)}">
        <label class="sr" for="cini-${pid}">Iniciativa de ${esc(nombreP(p))}</label><input class="campo num ini-in" id="cini-${pid}" type="number" inputmode="numeric" value="${esc(p.ini ?? '')}" data-cambio="ini" data-pid="${pid}">
        <span class="quien">${esc(nombreP(p))}${derrotadoP(p) ? ' <span class="tenue">(derrotado, se salta)</span>' : ''}</span>
        ${pid === c.turno ? '<span class="su-turno">Su turno</span>' : `<button type="button" class="btn btn-peq" data-accion="turno-a" data-pid="${pid}">Darle el turno</button>`}
        <button type="button" class="btn btn-peq btn-peligro" data-accion="cb-quitar" data-pid="${pid}" aria-label="Quitar a ${esc(nombreP(p))} del combate">×</button></li>`).join('')}</ol>
      <p class="sub" style="margin-top:14px">Sumar al combate</p>
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
    ...porOrden(E.presencias).filter(([, p]) => !p.derrotado).map(([k, p]) => ({ k: `pr-${k}`, nombre: p.nombre, mod: '', def: p.tipo !== 'neutral', color: COLOR_TIPO[p.tipo] || COLOR_TIPO.enemigo })),
  ];
  return `<section class="panel">
    <h2 class="panel-titulo">${icono('espadas')} Preparar combate</h2>
    <p class="tenue" style="margin:0 0 10px;font-size:15px">Marca quién pelea y escribe su iniciativa. «Tirar» lanza un d20 digital y le suma el modificador, útil para los enemigos.</p>
    ${cands.length ? `<ul class="prep">${cands.map((x) => { const marcado = ui.borradores['cb-' + x.k] ?? x.def; return `<li style="--c:${x.color}">
      <label class="check"><input type="checkbox" id="cb-${x.k}" data-borrador-check${marcado ? ' checked' : ''}> ${esc(x.nombre)}${x.mod ? ` <span class="tenue num">(${esc(x.mod)})</span>` : ''}</label>
      <label class="sr" for="ini-${x.k}">Iniciativa de ${esc(x.nombre)}</label><input class="campo num ini-in" id="ini-${x.k}" type="number" inputmode="numeric" placeholder="—" data-borrador value="${val('ini-' + x.k)}">
      <button type="button" class="btn btn-peq" data-accion="tirar" data-k="${x.k}" data-mod="${esc(x.mod)}">Tirar</button></li>`; }).join('')}</ul>` : '<p class="tenue">No hay personajes ni presencias en escena todavía.</p>'}
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

function dmMesa() {
  const e = E.escena || {};
  const clave = mapaActual();
  const ilu = e.ilustracion && imgs()[e.ilustracion];
  const pistas = porOrden(E.pistas, (p) => p.ts || 0);
  return `<div class="narrador">
    <div class="columna">
      ${dmCombate()}
      <section class="panel">
        <h2 class="panel-titulo">En escena</h2>
        <p class="tenue" style="font-size:15px;margin:0 0 8px">Enemigos, aliados y personajes no jugadores que aparecen en el mapa y en la mesa.</p>
        <div class="form-grid tres">
          <div><label class="etq" for="pr-nombre">Nombre</label><input class="campo" id="pr-nombre" data-borrador data-enter="pr-agregar" value="${val('pr-nombre')}"></div>
          <div><label class="etq" for="pr-tipo">Tipo</label><select class="campo" id="pr-tipo" data-borrador>${Object.entries(TIPOS_PRESENCIA).map(([k, t]) => `<option value="${k}"${(ui.borradores['pr-tipo'] || 'enemigo') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label class="etq" for="pr-img">Retrato</label><select class="campo" id="pr-img" data-borrador>${opcionesImg(ui.borradores['pr-img'] || '', (i) => i.tipo === 'retrato', 'Sin retrato')}</select></div>
        </div>
        <div class="fila" style="margin:10px 0 4px"><button type="button" class="btn btn-peq btn-oro" data-accion="pr-agregar">Poner en escena</button></div>
        ${porOrden(E.presencias).map(([k, p]) => {
          const est = Object.keys(p.estados || {});
          return `<div class="recurso"><div style="min-width:0;flex:1">
            <div class="recurso-nombre">${esc(p.nombre)} <span class="tenue">· ${esc(TIPOS_PRESENCIA[p.tipo] || 'Enemigo')}</span></div>
            <div class="recurso-det">${p.derrotado ? 'Derrotado' : `${p.dano || 0} de daño recibido`}</div>
            <div class="pj-chips">${est.map((x) => `<span class="chip est">${esc(x)}<button type="button" data-accion="pr-estado-quitar" data-k="${esc(k)}" data-e="${esc(x)}" aria-label="Quitar ${esc(x)}">×</button></span>`).join('')}</div>
            <div class="agregar"><label class="sr" for="pr-est-${esc(k)}">Estado</label><input id="pr-est-${esc(k)}" placeholder="Estado" data-borrador data-enter="pr-estado" data-k="${esc(k)}" value="${val('pr-est-' + k)}"><button type="button" class="btn btn-peq" data-accion="pr-estado" data-k="${esc(k)}">Añadir</button></div>
          </div>
          <div class="fila" style="flex:none;justify-content:flex-end;max-width:190px"><button type="button" class="btn btn-red btn-peq" data-accion="pr-dano" data-k="${esc(k)}" data-d="-1" aria-label="Quitar daño">−</button><button type="button" class="btn btn-red btn-peq" data-accion="pr-dano" data-k="${esc(k)}" data-d="1" aria-label="Sumar daño">+</button><button type="button" class="btn btn-peq" data-accion="pr-derrotado" data-k="${esc(k)}">${p.derrotado ? 'Revivir' : 'Derrotado'}</button><button type="button" class="btn btn-peq btn-peligro" data-accion="pr-quitar" data-k="${esc(k)}">Quitar</button></div></div>`;
        }).join('')}
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
          ${tienePv(id) ? `<div class="barra-pv ${nivelPv(pv, f.pvMax)}"><span style="width:${pct(pv, f.pvMax)}%"></span></div>` : ''}<div class="pj-clase num" style="margin-top:4px">${tienePv(id) ? `${pv}/${f.pvMax} PV` : 'PV por definir'} · CA ${esc(dato(f.ca))} · PIN <b class="num" style="color:var(--oro-claro)">${esc(f.pin)}</b></div></div></div>
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
      <div><label class="etq" for="ent-img">Imagen</label><select class="campo" style="width:100%" id="ent-img" data-borrador>${opcionesImg(ui.borradores['ent-img'] || '')}</select></div>`}
      <label class="check"><input type="checkbox" id="ent-oculto" data-borrador-check${ui.borradores['ent-oculto'] ? ' checked' : ''}> Solo la ve el DM (oculta en Historia)</label>
      <div class="fila"><button type="button" class="btn btn-oro" data-accion="ent-guardar">${ed ? 'Guardar cambios' : 'Añadir a la Historia'}</button>${ed || ui.borradores['ent-titulo'] ? '<button type="button" class="btn" data-accion="ent-cancelar">Cancelar</button>' : ''}</div>
    </div>
  </section>`;
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
          <label class="check"><input type="checkbox" id="sub-visible" data-borrador-check${ui.borradores['sub-visible'] === false ? '' : ' checked'}> Mostrarla en la Galería de Historia</label>
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
            <div class="biblio-nombre">${esc(i.nombre)}${t !== 'mapa' && !i.visible ? ' <span class="tenue">(oculta)</span>' : ''}</div>
            <div class="biblio-acc">
              ${t === 'mapa' ? `<button type="button" class="btn btn-peq" data-accion="mapa" data-k="${esc(k)}">Usar en la mesa</button>`
                : ilu === k ? '<button type="button" class="btn btn-peq btn-oro" data-accion="mostrar" data-id="">Quitar de la mesa</button>'
                : `<button type="button" class="btn btn-peq" data-accion="mostrar" data-id="${esc(k)}">Mostrar en la mesa</button>`}
              ${t !== 'mapa' ? `<button type="button" class="btn btn-peq" data-accion="img-visible" data-id="${esc(k)}">${i.visible ? 'Ocultar' : 'Mostrar en Galería'}</button>` : ''}
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
        ${Object.entries(CATEGORIAS).map(([cat, c]) => `<p class="sub" style="margin-top:10px">${esc(c.nombre)}</p>
          <ul class="lista entradas">${porOrden(enc[cat]).map(([id, x]) => `<li class="${x.oculto ? 'oculta' : ''}">
            <span>${esc(x.titulo)}${x.oculto ? ' <span class="tenue">(oculta)</span>' : ''}${cat === 'misterios' && x.resuelto ? ' <span class="chip resuelto">Resuelto</span>' : ''}</span>
            <span class="fila" style="flex:none">
              <button type="button" class="btn btn-peq" data-accion="ent-editar" data-cat="${cat}" data-id="${esc(id)}">Editar</button>
              ${botonConfirmar(`borrar-ent-${cat}-${id}`, 'Borrar', 'ent-borrar', `data-cat="${cat}" data-id="${esc(id)}"`, 'btn btn-peq btn-peligro')}
            </span></li>`).join('') || '<li class="tenue">Ninguna.</li>'}</ul>`).join('')}
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
        <p style="margin:0 0 10px">Borra toda la campaña: personajes, imágenes, Historia, escena y el PIN del DM. No se puede deshacer.</p>
        ${botonConfirmar('borrar-todo', 'Borrar toda la campaña', 'borrar-todo', '', 'btn btn-peligro')}
      </section>
    </div>
  </div>`;
}

/* ================= RENDER ================= */
const VISTAS = { mesa: vistaMesa, ficha: vistaFicha, historia: vistaHistoria, dm: vistaDM };

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
  'inv-quitar'(d) { escribirEstado(d.id, `inventario/${d.k}`, null); },
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
      pvMax: pvMax > 0 ? pvMax : '', ca: num('ca'), caNota: g('caNota'), velocidad: g('velocidad'), iniciativa: g('iniciativa'), competencia: g('competencia'),
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
    for (const [k, p] of porOrden(E.presencias)) if (!p.derrotado && (ui.borradores['cb-pr-' + k] ?? p.tipo !== 'neutral')) add('pr', k, p.nombre, ini('pr-' + k), 0);
    const extra = (ui.borradores['cb-extra-nombre'] || '').trim();
    if (extra) { const v = parseInt(ui.borradores['cb-extra-ini'], 10); add('otro', '', extra, Number.isFinite(v) ? v : '', 0); }
    if (!Object.keys(part).length) { aviso('Marca al menos a un combatiente'); return; }
    E.combate = { ...C(), participantes: part };
    const primero = participantes()[0][0];
    const ts = Date.now();
    sync.escribir({ combate: { activo: true, ronda: 1, turno: primero, participantes: part }, [`bitacora/c${ts}`]: { ts, tipo: 'cambio', texto: 'Comienza el combate.' } });
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
    sync.escribir({ [`combate/participantes/${nuevoId('c')}`]: { tipo, ref, nombre, ini, desempate: 0 } });
    limpiar('cb-add'); aviso(`${nombre} entra al combate`);
  },
  'fin-combate'() {
    const ts = Date.now();
    sync.escribir({ combate: { activo: false, ronda: 0, turno: '' }, [`bitacora/c${ts}`]: { ts, tipo: 'cambio', texto: `Fin del combate tras ${C().ronda || 1} ronda${(C().ronda || 1) === 1 ? '' : 's'}.` } });
    ui.confirmar = null; aviso('Combate terminado');
  },

  /* ambiente */
  dia(d) { sync.escribir({ 'ambiente/dia': Math.max(1, (+((E.ambiente || {}).dia) || 1) + +d.d) }); },
  'avanzar-tiempo'() {
    const orden = Object.keys(MOMENTOS); const a = E.ambiente || {};
    let i = orden.indexOf(a.momento || 'manana') + 1; let dia = +a.dia || 1;
    const u = {};
    if (i >= orden.length) { i = 0; dia++; const ts = Date.now(); u[`bitacora/c${ts}`] = { ts, tipo: 'cambio', texto: `Comienza el día ${dia}.` }; }
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
    if (nuevo >= r.segmentos && (r.llenos || 0) < r.segmentos) { const ts = Date.now(); u[`bitacora/c${ts}`] = { ts, tipo: 'cambio', texto: `Se cumplió el reloj: ${r.nombre}.` }; aviso(`¡${r.nombre}!`); }
    sync.escribir(u);
  },
  'rl-borrar'(d) { sync.escribir({ [`relojes/${d.k}`]: null }); },

  'pista-grupo'() { const t = ($('#pista-grupo').value || '').trim(); if (!t) { aviso('Escribe la pista'); return; } delete ui.borradores['pista-grupo']; sync.escribir({ [`pistas/${nuevoId('g')}`]: { texto: t, ts: Date.now() } }); },
  'pista-grupo-quitar'(d) { sync.escribir({ [`pistas/${d.k}`]: null }); },
  'pr-agregar'() {
    const nombre = ($('#pr-nombre').value || '').trim();
    if (!nombre) { aviso('Escribe el nombre'); $('#pr-nombre').focus(); return; }
    sync.escribir({ [`presencias/${nuevoId('pr')}`]: { nombre, tipo: $('#pr-tipo').value || 'enemigo', img: $('#pr-img').value || '', dano: 0, derrotado: false, orden: Date.now() } });
    delete ui.borradores['pr-nombre']; aviso(`${nombre} está en escena`);
  },
  'pr-dano'(d) { const p = E.presencias[d.k]; sync.escribir({ [`presencias/${d.k}/dano`]: Math.max(0, (p.dano || 0) + +d.d) }); },
  'pr-derrotado'(d) { const p = E.presencias[d.k]; sync.escribir({ [`presencias/${d.k}/derrotado`]: !p.derrotado }); },
  'pr-estado'(d) { const el = $('#pr-est-' + d.k); const t = ((el && el.value) || '').trim(); if (!t) { aviso('Escribe el estado'); return; } delete ui.borradores['pr-est-' + d.k]; sync.escribir({ [`presencias/${d.k}/estados/${claveSegura(t)}`]: true }); },
  'pr-estado-quitar'(d) { sync.escribir({ [`presencias/${d.k}/estados/${claveSegura(d.e)}`]: null }); },
  'pr-quitar'(d) {
    const u = { [`presencias/${d.k}`]: null };
    for (const m of Object.keys(E.fichas || {})) if ((E.fichas[m] || {})[d.k]) u[`fichas/${m}/${d.k}`] = null;
    sync.escribir(u);
  },
  mapa(d) { sync.escribir({ 'escena/mapa': d.k, 'escena/ilustracion': '' }); aviso('La mesa muestra el mapa'); },
  mostrar(d) { sync.escribir({ 'escena/ilustracion': d.id || '' }); aviso(d.id ? 'Se muestra en la mesa' : 'La mesa vuelve al mapa'); },
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
    const ts = Date.now();
    const texto = d.tipo === 'largo' ? 'Descanso largo: PV, espacios y rasgos recuperados.' : 'Descanso corto: rasgos de descanso corto recuperados.';
    u[`bitacora/c${ts}`] = { ts, tipo: 'cambio', texto };
    ui.confirmar = null; sync.escribir(u); aviso(texto);
  },
  'ir-seccion'(d) { const el = document.getElementById(d.id); if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); },

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
      const visible = $('#sub-visible') ? $('#sub-visible').checked : true;
      await sync.escribir({ [`imagenes/${nuevoId('im')}`]: { nombre, tipo, src, visible } });
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
    ui.confirmar = null; sync.escribir(u); aviso('Imagen borrada');
  },
  'ent-editar'(d) {
    const x = ((E.enciclopedia || {})[d.cat] || {})[d.id]; if (!x) return;
    limpiar('ent-'); ui.editandoEnt = { cat: d.cat, id: d.id };
    Object.assign(ui.borradores, {
      'ent-cat': d.cat, 'ent-titulo': x.titulo || '', 'ent-sub': x.sub || '', 'ent-texto': x.texto || '', 'ent-tipo': x.tipo || 'hecho',
      'ent-visto': (x.visto || []).join('\n'), 'ent-dicho': (x.dicho || []).join('\n'), 'ent-misterio': x.misterio || '', 'ent-img': x.img || '',
      'ent-oculto': !!x.oculto, 'ent-resuelto': !!x.resuelto,
    });
    render(); const f = $('#form-entrada'); if (f) f.scrollIntoView({ block: 'start' });
  },
  'ent-cancelar'() { limpiar('ent-', ['ent-cat']); ui.editandoEnt = null; render(); },
  'ent-guardar'() {
    const cat = ui.editandoEnt ? ui.editandoEnt.cat : (ui.borradores['ent-cat'] || 'pnj');
    const g = (id) => { const el = $('#' + id); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };
    const titulo = g('ent-titulo');
    if (!titulo) { aviso('Escribe el nombre o título'); $('#ent-titulo').focus(); return; }
    const previo = ui.editandoEnt ? E.enciclopedia[cat][ui.editandoEnt.id] : null;
    const entrada = cat === 'misterios'
      ? { titulo, resuelto: !!g('ent-resuelto'), oculto: !!g('ent-oculto') }
      : { titulo, sub: g('ent-sub'), texto: g('ent-texto'), visto: lineas(g('ent-visto')), dicho: lineas(g('ent-dicho')), misterio: g('ent-misterio'), img: g('ent-img'), oculto: !!g('ent-oculto'), ...(cat === 'mundo' ? { tipo: g('ent-tipo') || 'hecho' } : {}) };
    entrada.orden = previo ? (previo.orden || Date.now()) : Date.now();
    const id = ui.editandoEnt ? ui.editandoEnt.id : nuevoId(cat.slice(0, 2));
    sync.escribir({ [`enciclopedia/${cat}/${id}`]: entrada });
    limpiar('ent-', ['ent-cat']); ui.editandoEnt = null;
    aviso(previo ? 'Entrada actualizada' : `Añadido a ${CATEGORIAS[cat].nombre}`);
  },
  'ent-borrar'(d) { ui.confirmar = null; if (ui.editandoEnt && ui.editandoEnt.id === d.id) { limpiar('ent-', ['ent-cat']); ui.editandoEnt = null; } sync.escribir({ [`enciclopedia/${d.cat}/${d.id}`]: null }); aviso('Entrada borrada'); },

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
function exportarFichas() {
  const personajes = listaPj().map(([id, p]) => ({ ficha: p.ficha, estado: p.estado || {}, secretos: secretosDe(id), retratoSrc: srcDe(p.ficha.retrato) || undefined }));
  const texto = JSON.stringify({ formato: FORMATO, version: 1, campana: (E.campana || {}).nombre || '', personajes }, null, 2);
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    a.download = `personajes-${norm((E.campana || {}).nombre || 'campana').replace(/[^a-z0-9]+/g, '-')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    aviso('Fichas exportadas');
  } catch (e) { aviso('Este navegador no dejó descargar el archivo'); }
}

const CAMBIOS = {
  'ent-cat'() { render(); },
  ini(t) { const v = parseInt(t.value, 10); sync.escribir({ [`combate/participantes/${t.dataset.pid}/ini`]: Number.isFinite(v) ? v : '' }); },
  amb(t) { sync.escribir({ [`ambiente/${t.dataset.campo}`]: t.value }); },
  async importar(t) { const f = t.files && t.files[0]; t.value = ''; if (f) await importarFichas(f); },
};

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-accion]');
  if (!b) { if (ev.target.id === 'capa') ACCIONES['cerrar-capa'](); return; }
  const fn = ACCIONES[b.dataset.accion];
  if (fn) { ev.preventDefault(); fn({ ...b.dataset }); }
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset && 'borrador' in t.dataset && t.id) ui.borradores[t.id] = t.value;
  if (t.dataset && t.dataset.notas) { clearTimeout(guardarNotas.t); guardarNotas.t = setTimeout(() => guardarNotas(t.dataset.notas, t.value), 700); }
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.dataset && 'borrador' in t.dataset && t.id) ui.borradores[t.id] = t.value;
  if (t.dataset && 'borradorCheck' in t.dataset && t.id) ui.borradores[t.id] = t.checked;
  if (t.dataset && t.dataset.cambio && CAMBIOS[t.dataset.cambio]) CAMBIOS[t.dataset.cambio](t);
});
function guardarNotas(id, valor) { escribirEstado(id, 'notas', valor); }
document.addEventListener('focusout', (ev) => {
  const t = ev.target;
  if (t.dataset && t.dataset.notas) { clearTimeout(guardarNotas.t); guardarNotas(t.dataset.notas, t.value); delete ui.borradores[t.id]; }
});
document.addEventListener('keydown', (ev) => {
  const t = ev.target;
  if (ev.key === 'Enter' && t.dataset && t.dataset.enter) { ev.preventDefault(); ACCIONES[t.dataset.enter]({ ...t.dataset }); return; }
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
