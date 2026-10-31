import { FICHAS, ORDEN, PINES, HISTORIA, CATEGORIAS } from './datos.js';
import { crearSync, claveSegura } from './sync.js';
import { interpretar, INSTRUCCIONES_CHATGPT, estadoParaChatGPT, descanso } from './cambios.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } },
};
const RUTAS = ['mesa', 'ficha', 'historia', 'narrador'];
const retrato = (id) => `img/retrato-${id}.jpg`;
const TIPOS_IMG = { mapa: 'Mapa', retrato: 'Retrato', ilustracion: 'Ilustración' };
const PLURAL_IMG = { mapa: 'Mapas', retrato: 'Retratos', ilustracion: 'Ilustraciones' };

const ui = {
  ruta: 'mesa',
  tv: false,
  yo: ls.get('mf-yo'),
  desbloqueados: new Set(JSON.parse(ls.get('mf-desbloqueados') || '[]')),
  ver: null,
  pin: '',
  pinError: false,
  borradores: {},
  previa: null,
  confirmar: null,
  copia: null,
  moverFichas: false,
  arrastrando: false,
  narrTab: 'turno',
  editando: null, // { cat, id } de la entrada en edición
  subiendo: false,
};
ui.ver = ui.yo;
let sync;
let E;

function guardarDesbloqueos() { ls.set('mf-desbloqueados', JSON.stringify([...ui.desbloqueados])); }

function aviso(t) {
  const a = $('#aviso');
  a.textContent = t; a.classList.add('ver');
  clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove('ver'), 2600);
}

function hora(ts) {
  if (!ts) return '';
  const d = new Date(ts); const hoy = new Date();
  const h = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === hoy.toDateString() ? h : `${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;
}
const mod = (v) => { const m = Math.floor((v - 10) / 2); return (m >= 0 ? '+' : '') + m; };
const pj = (id) => (E.personajes || {})[id] || {};
const nivelPv = (pv, max) => (pv / max <= 0.25 ? 'baja' : pv / max <= 0.5 ? 'media' : '');
const imgs = () => E.imagenes || {};
const srcDe = (id) => (id && imgs()[id] ? imgs()[id].src : '');
const mapas = () => Object.entries(imgs()).filter(([, i]) => i.tipo === 'mapa');
const porOrden = (obj) => Object.entries(obj || {}).sort((a, b) => (a[1].orden || 0) - (b[1].orden || 0));
const retratoEnemigo = (k, en) => srcDe(en.img) || (imgs()[k] && imgs()[k].tipo === 'retrato' ? srcDe(k) : '');
const lineas = (t) => String(t || '').split('\n').map((s) => s.trim()).filter(Boolean);

/* ================= MESA ================= */
function mapaActual() {
  const e = E.escena || {};
  if (imgs()[e.mapa] && imgs()[e.mapa].tipo === 'mapa') return e.mapa;
  const m = mapas(); return m.length ? m[0][0] : null;
}

function htmlMapa(editable) {
  const clave = mapaActual();
  if (!clave) return '<div class="vacio">No hay mapas. Súbelos desde la Biblioteca del narrador.</div>';
  const mapa = imgs()[clave];
  const pos = (E.fichas || {})[clave] || {};
  const fichas = [];
  ORDEN.forEach((id, i) => {
    const p = pos[id] || { x: 35 + i * 7.5, y: 90 };
    const f = FICHAS[id];
    fichas.push(`<div class="ficha-mapa" data-ficha="${id}" style="left:${p.x}%;top:${p.y}%;--c:${f.color};background-image:url(${retrato(id)})" role="img" aria-label="${esc(f.nombre)}"><span class="etq">${esc(f.nombre)}</span></div>`);
  });
  if (pos.eva) fichas.push(`<div class="ficha-mapa pnj" data-ficha="eva" style="left:${pos.eva.x}%;top:${pos.eva.y}%;background-image:url(${srcDe('eva')})" role="img" aria-label="Eva"><span class="etq">Eva</span></div>`);
  let extra = 0;
  for (const [k, en] of Object.entries(E.enemigos || {})) {
    let p = pos[k];
    if (!p) { if (['espada', 'martillo', 'lanza'].includes(k)) continue; p = { x: 93, y: 12 + (extra++ * 10) }; }
    const corto = en.nombre.replace(/^guardi[aá]n (de la |del |de )?/i, '') || '?';
    const letra = esc(corto.slice(0, 2).replace(/^./, (c) => c.toUpperCase()));
    const foto = retratoEnemigo(k, en);
    fichas.push(`<div class="ficha-mapa enemigo${en.derrotado ? ' caido' : ''}" data-ficha="${esc(k)}" style="left:${p.x}%;top:${p.y}%${foto ? `;background-image:url(${foto})` : ''}" role="img" aria-label="${esc(en.nombre)}">${foto ? '' : letra}<span class="etq">${esc(corto[0].toUpperCase() + corto.slice(1))}</span></div>`);
  }
  return `<div class="mapa${editable ? ' editable' : ''}" id="mapa" data-mapa="${esc(clave)}"><img src="${mapa.src}" alt="Mapa: ${esc(mapa.nombre)}" draggable="false">${fichas.join('')}</div>`;
}

function htmlEscenaVisual(editable = false) {
  const ilu = (E.escena || {}).ilustracion;
  if (ilu && imgs()[ilu] && !editable) {
    return `<figure class="ilustracion"><img src="${imgs()[ilu].src}" alt="${esc(imgs()[ilu].nombre)}" data-accion="ver-imagen" data-src="${esc(imgs()[ilu].src)}"><figcaption>${esc(imgs()[ilu].nombre)}</figcaption></figure>`;
  }
  return htmlMapa(editable);
}

function pjMini(id) {
  const f = FICHAS[id]; const p = pj(id);
  const est = Object.keys(p.estados || {});
  const caido = p.pv <= 0;
  return `<button type="button" class="pj" style="--c:${f.color};text-align:left" data-accion="elegir" data-id="${id}">
    <img class="pj-retrato" src="${retrato(id)}" alt="">
    <div>
      <div class="pj-fila"><span class="pj-nombre">${esc(f.nombre)}${ui.yo === id ? '<span class="tu">TÚ</span>' : ''}</span><span class="pv-num num"><b>${p.pv}</b>/${f.pvMax} PV</span></div>
      <div class="pj-fila"><span class="pj-clase">${esc(f.raza)} · ${esc(f.clase)}</span><span class="pj-clase num">CA ${f.ca}</span></div>
      <div class="barra-pv ${nivelPv(p.pv, f.pvMax)}"><span style="width:${Math.max(0, Math.min(100, (p.pv / f.pvMax) * 100))}%"></span></div>
      ${(p.concentra || est.length || caido) ? `<div class="pj-chips">${caido ? '<span class="chip malo">Inconsciente</span>' : ''}${p.concentra ? `<span class="chip conc">◈ ${esc(p.concentra)}</span>` : ''}${est.map((s) => `<span class="chip est">${esc(s)}</span>`).join('')}</div>` : ''}
    </div>
  </button>`;
}

function htmlGuardianes() {
  const lista = Object.entries(E.enemigos || {});
  return `<section class="panel">
    <h2 class="panel-titulo">Guardianes y presencias</h2>
    <div class="guardianes">
      ${lista.map(([k, en]) => {
        const est = Object.keys(en.estados || {});
        const foto = retratoEnemigo(k, en);
        return `<div class="guardian${en.derrotado ? ' caido' : ''}">${foto ? `<img class="guardian-foto" src="${foto}" alt="">` : ''}<div style="flex:1;min-width:0"><div class="guardian-nombre">${esc(en.nombre)}</div><div class="guardian-info">${en.derrotado ? 'Derrotado' : esc(en.actitud || '')}${en.dano ? ` · ${en.dano} de daño recibido` : ''}</div></div><div class="pj-chips" style="justify-content:flex-end;margin:0">${est.map((s) => `<span class="chip est">${esc(s)}</span>`).join('')}</div></div>`;
      }).join('')}
      <div class="guardian" style="background:rgba(216,219,232,.06);border-color:rgba(216,219,232,.25)">${srcDe('eva') ? `<img class="guardian-foto" src="${srcDe('eva')}" alt="">` : ''}<div style="flex:1"><div class="guardian-nombre">Eva</div><div class="guardian-info">Niña de ojos plateados. Está cerca del grupo.</div></div></div>
    </div>
  </section>`;
}

function vistaMesa() {
  const e = E.escena || {};
  const n = E.narracion || {};
  return `<div class="mesa">
    <div class="columna">
      ${e.alerta ? `<div class="alerta" role="alert"><span class="alerta-icono" aria-hidden="true"></span><span>${esc(e.alerta)}</span></div>` : ''}
      <section class="panel">
        <div class="lugar"><h1>${esc(e.lugar || '')}</h1>${ui.tv ? `<a class="btn btn-peq" href="#mesa">Salir del modo TV</a>` : `<a class="btn btn-peq solo-grande" href="#tv">Modo TV</a>`}</div>
        ${e.texto ? `<p class="escena-texto" style="margin-top:8px">${esc(e.texto)}</p>` : ''}
      </section>
      ${htmlEscenaVisual(false)}
    </div>
    <div class="columna">
      <section class="pergamino" aria-live="polite">
        <h2 class="panel-titulo">Habla el narrador</h2>
        <div class="narracion-texto">${esc(n.texto || 'Aún no hay narración.')}</div>
        ${n.ts ? `<div class="narracion-hora">${hora(n.ts)}</div>` : ''}
      </section>
      <section class="panel">
        <h2 class="panel-titulo">El grupo</h2>
        <div class="grupo">${ORDEN.map(pjMini).join('')}</div>
      </section>
      ${htmlGuardianes()}
    </div>
  </div>`;
}

/* ================= PIN ================= */
function vistaPin(id) {
  const esNarr = id === 'narrador';
  const f = FICHAS[id];
  return `<div class="panel pin" style="--c:${esNarr ? 'var(--cristal)' : f.color};max-width:420px">
    ${esNarr ? '<span class="marca-cristal" style="width:60px;height:82px" aria-hidden="true"></span>' : `<img src="${retrato(id)}" alt="">`}
    <h1 style="font-size:24px;color:var(--oro-claro)">${esNarr ? 'Narrador' : esc(f.nombre)}</h1>
    <p class="tenue" style="margin:0">Escribe el PIN de ${esNarr ? 'quien maneja ChatGPT' : 'este personaje'}.</p>
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

/* ================= FICHA ================= */
function vistaElegir() {
  return `<section class="columna">
    <div><h1 style="font-size:26px;color:var(--oro-claro)">¿Quién eres?</h1><p class="tenue" style="margin:4px 0 0">Elige tu personaje. Cada uno tiene su PIN; en este dispositivo solo se pide una vez.</p></div>
    <div class="elegir">${ORDEN.map((id) => {
      const f = FICHAS[id];
      return `<button type="button" class="carta" style="--c:${f.color}" data-accion="elegir" data-id="${id}"><img src="${retrato(id)}" alt=""><div class="carta-txt"><div class="carta-nombre">${esc(f.nombre)}</div><div class="carta-sub">${esc(f.raza)} · ${esc(f.clase)}</div><span class="candado">${ui.desbloqueados.has(id) ? 'Abierto en este dispositivo' : 'Pide PIN'}</span></div></button>`;
    }).join('')}</div>
  </section>`;
}

function pips(n, max, accion, id, extra = '', clase = '') {
  return `<div class="pips">${Array.from({ length: max }, (_, i) => `<button type="button" class="pip ${clase}${i < n ? ' lleno' : ''}" data-accion="${accion}" data-id="${id}" data-i="${i}" ${extra} aria-label="${i < n ? 'Disponible' : 'Gastado'} ${i + 1} de ${max}"></button>`).join('')}</div>`;
}

function htmlPista(p) {
  const texto = typeof p === 'string' ? p : p.texto;
  const im = typeof p === 'object' && p ? srcDe(p.img) : '';
  return `<div class="pista${im ? ' con-img' : ''}">${im ? `<img src="${im}" alt="" data-accion="ver-imagen" data-src="${esc(im)}">` : ''}<span>${esc(texto)}</span></div>`;
}

function vistaHoja(id) {
  const f = FICHAS[id]; const p = pj(id);
  const est = Object.keys(p.estados || {});
  const inv = Object.entries(p.inventario || {});
  const pistas = Object.values(p.pistas || {});
  const notasId = `notas-${id}`;
  const recursos = Object.entries(f.recursos);
  return `<div class="hoja" style="--c:${f.color}">
    <section class="panel ancho cabeza">
      <img src="${retrato(id)}" alt="">
      <div>
        <div class="epiteto">${esc(f.epiteto)}</div>
        <h1>${esc(f.nombre)}</h1>
        <div class="datos">${esc(f.raza)} · ${esc(f.clase)} · Nivel ${f.nivel} · ${esc(f.edad)}</div>
        <div class="cabeza-acciones">
          <button type="button" class="btn btn-peq" data-accion="ver-imagen" data-src="img/ficha-${id}.jpg">Ver ficha original</button>
          <button type="button" class="btn btn-peq" data-accion="cambiar">Cambiar de personaje</button>
          <button type="button" class="btn btn-peq" data-accion="bloquear" data-id="${id}">Bloquear</button>
        </div>
      </div>
    </section>

    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Puntos de vida</h2>
        <div class="pv-grande">
          <div class="pv-cifra num">${p.pv}<small> / ${f.pvMax}</small></div>
          <div class="pv-ajuste">
            <button type="button" class="btn btn-red btn-peligro" data-accion="pv" data-id="${id}" data-d="-1" aria-label="Restar 1 PV">−</button>
            <button type="button" class="btn btn-red btn-bien" data-accion="pv" data-id="${id}" data-d="1" aria-label="Sumar 1 PV">+</button>
          </div>
        </div>
        <div class="barra-pv ${nivelPv(p.pv, f.pvMax)}" style="height:12px;margin:12px 0"><span style="width:${Math.max(0, Math.min(100, (p.pv / f.pvMax) * 100))}%"></span></div>
        <div class="pv-ajuste">
          <label class="sr" for="pv-cant">Cantidad</label>
          <input id="pv-cant" type="number" inputmode="numeric" min="1" max="99" placeholder="0" data-borrador value="${esc(ui.borradores['pv-cant'] ?? '')}">
          <button type="button" class="btn btn-peligro" data-accion="pv-cant" data-id="${id}" data-tipo="dano">Recibir daño</button>
          <button type="button" class="btn btn-bien" data-accion="pv-cant" data-id="${id}" data-tipo="cura">Curar</button>
        </div>
        <div class="vitales" style="margin-top:14px">
          <div class="vital"><b class="num">${f.ca}</b><span>CA</span><small>${esc(f.caNota)}</small></div>
          <div class="vital"><b class="num">${f.iniciativa}</b><span>Iniciativa</span></div>
          <div class="vital"><b>${esc(f.velocidad)}</b><span>Velocidad</span></div>
          <div class="vital"><b class="num">${f.cd ?? '+2'}</b><span>${f.cd ? 'CD conjuros' : 'Competencia'}</span></div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Recursos y estados</h2>
        ${f.esp1Max ? `<div class="recurso"><div><div class="recurso-nombre">Espacios de conjuro de nivel 1</div><div class="recurso-det">Toca para gastar o recuperar. Ataque de conjuro ${esc(f.ataqueConjuro)}.</div></div>${pips(p.esp1 || 0, f.esp1Max, 'esp', id, '', 'conjuro')}</div>` : ''}
        ${(f.esp1Max || p.concentra) ? `<div class="recurso"><div style="min-width:0;flex:1"><div class="recurso-nombre">Concentración</div>${p.concentra ? `<span class="chip conc" style="margin-top:4px">◈ ${esc(p.concentra)}</span>` : `<div class="agregar" style="margin-top:6px"><label class="sr" for="conc-in">Conjuro en concentración</label><input id="conc-in" placeholder="Conjuro (ej. Enmarañar)" data-borrador data-enter="conc-poner" data-id="${id}" value="${esc(ui.borradores['conc-in'] ?? '')}"><button type="button" class="btn btn-peq" data-accion="conc-poner" data-id="${id}">Concentrar</button></div>`}</div>${p.concentra ? `<button type="button" class="btn btn-peq" data-accion="conc-fin" data-id="${id}">Terminar</button>` : ''}</div>` : ''}
        ${recursos.map(([k, r]) => {
          const v = (p.recursos || {})[k] ?? 0;
          const control = r.cantidad || r.max > 5
            ? `<div class="contador"><button type="button" class="btn btn-red btn-peq" data-accion="rec-delta" data-id="${id}" data-k="${k}" data-d="-1" aria-label="Restar">−</button><b class="num">${v}</b><button type="button" class="btn btn-red btn-peq" data-accion="rec-delta" data-id="${id}" data-k="${k}" data-d="1" aria-label="Sumar">+</button></div>`
            : pips(v, r.max, 'rec', id, `data-k="${k}"`);
          return `<div class="recurso"><div><div class="recurso-nombre">${esc(r.nombre)}${r.cantidad || r.max > 5 ? ` <span class="tenue num">(máx. ${r.max})</span>` : ''}</div>${r.detalle || r.recarga !== 'ninguna' ? `<div class="recurso-det">${esc(r.detalle || '')}${r.recarga === 'corto' ? ' Se recupera con descanso corto o largo.' : r.recarga === 'largo' ? ' Se recupera con descanso largo.' : ''}</div>` : ''}</div>${control}</div>`;
        }).join('')}
        <div class="recurso"><div style="min-width:0;flex:1"><div class="recurso-nombre">Estados</div>
          <div class="pj-chips">${est.length ? est.map((s) => `<span class="chip est">${esc(s)}<button type="button" data-accion="estado-quitar" data-id="${id}" data-k="${esc(s)}" aria-label="Quitar ${esc(s)}">×</button></span>`).join('') : '<span class="tenue" style="font-size:15px">Ninguno</span>'}</div>
          <div class="agregar"><label class="sr" for="estado-in">Nuevo estado</label><input id="estado-in" placeholder="Ej. Envenenado, Derribado" data-borrador data-enter="estado-poner" data-id="${id}" value="${esc(ui.borradores['estado-in'] ?? '')}"><button type="button" class="btn btn-peq" data-accion="estado-poner" data-id="${id}">Añadir</button></div>
        </div></div>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Ataques</h2>
        ${f.ataques.map(([n, b, d]) => `<div class="ataque"><b>${esc(n)}</b><span class="bono">${esc(b)}</span><span class="dano">${esc(d)}</span></div>`).join('')}
      </section>

      ${(f.trucos.length || f.conjuros1.length || f.bloqueados) ? `<section class="panel">
        <h2 class="panel-titulo">Conjuros</h2>
        ${f.trucos.length ? `<p class="sub">Trucos (ilimitados)</p>${f.trucos.map(([n, d]) => `<div class="conjuro"><b>${esc(n)}</b><p>${esc(d)}</p></div>`).join('')}` : ''}
        ${f.conjuros1.length ? `<p class="sub" style="margin-top:12px">Nivel 1 · gastan un espacio</p>${f.conjuros1.map(([n, d]) => `<div class="conjuro"><b>${esc(n)}</b><p>${esc(d)}</p></div>`).join('')}` : ''}
        ${f.bloqueados ? `<p class="sub" style="margin-top:12px">Se desbloquean en nivel 2</p>${f.bloqueados.map(([n, d]) => `<div class="conjuro bloqueado"><b>${esc(n)}</b><p>${esc(d)}</p></div>`).join('')}<p class="nota-regla">${esc(f.bloqueadosNota)}</p>` : ''}
      </section>` : ''}
    </div>

    <div class="columna">
      <section class="pergamino">
        <h2 class="panel-titulo">Solo tú lo sabes</h2>
        <div class="pistas">${pistas.length ? pistas.map(htmlPista).join('') : '<p style="margin:0">Todavía nada.</p>'}</div>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Mis notas</h2>
        <label class="sr" for="${notasId}">Notas personales</label>
        <textarea class="campo" id="${notasId}" data-borrador data-notas="${id}" placeholder="Apuntes, sospechas, nombres…">${esc(ui.borradores[notasId] ?? p.notas ?? '')}</textarea>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Atributos</h2>
        <div class="atributos">${Object.entries(f.atributos).map(([k, v]) => `<div class="atr"><span>${k}</span><b class="num">${v}</b><small class="num">${mod(v)}</small></div>`).join('')}</div>
        <div class="dos-col" style="margin-top:16px">
          <div><p class="sub">Tiradas de salvación</p><ul class="lista">${f.salvaciones.map(([n, v]) => `<li><span>${esc(n)}</span><span class="val">${esc(v)}</span></li>`).join('')}</ul></div>
          <div><p class="sub">Habilidades</p><ul class="lista">${f.habilidades.map(([n, v]) => `<li><span>${esc(n)}</span><span class="val">${esc(v)}</span></li>`).join('')}</ul></div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Rasgos</h2>
        ${f.rasgos.map(([n, d]) => `<div class="rasgo"><b>${esc(n)}</b><p>${esc(d)}</p></div>`).join('')}
        <p class="nota-regla" style="border-color:var(--cristal)"><b style="color:#dccfff">En nivel 2:</b> ${esc(HISTORIA.progresion.nivel2[id])} También subirán tus PV.</p>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Equipo</h2>
        <div class="recurso" style="padding-top:0"><div class="recurso-nombre">Monedas de oro</div><div class="contador"><button type="button" class="btn btn-red btn-peq" data-accion="oro" data-id="${id}" data-d="-1" aria-label="Restar una moneda">−</button><b class="num">${p.oro ?? 0}</b><button type="button" class="btn btn-red btn-peq" data-accion="oro" data-id="${id}" data-d="1" aria-label="Sumar una moneda">+</button></div></div>
        <p class="sub" style="margin-top:8px">Objetos especiales</p>
        <ul class="lista inv">${inv.length ? inv.map(([k, t]) => `<li><span>${esc(t)}</span><button type="button" data-accion="inv-quitar" data-id="${id}" data-k="${esc(k)}" aria-label="Quitar ${esc(t)}">×</button></li>`).join('') : '<li class="tenue">Ninguno</li>'}</ul>
        <div class="agregar"><label class="sr" for="inv-in">Nuevo objeto</label><input id="inv-in" placeholder="Añadir objeto" data-borrador data-enter="inv-poner" data-id="${id}" value="${esc(ui.borradores['inv-in'] ?? '')}"><button type="button" class="btn btn-peq" data-accion="inv-poner" data-id="${id}">Añadir</button></div>
        <p class="sub" style="margin-top:14px">Equipo base</p>
        <p style="margin:0;color:var(--tenue);font-size:15px">${f.equipo.map(esc).join(' · ')}</p>
      </section>

      <p class="cita">«${esc(f.cita)}»</p>
    </div>
  </div>`;
}

function vistaFicha() {
  if (!ui.ver) return vistaElegir();
  if (!ui.desbloqueados.has(ui.ver)) return vistaPin(ui.ver);
  return vistaHoja(ui.ver);
}

/* ================= HISTORIA ================= */
const TIPO = { hecho: 'Lo vimos', dicho: 'Lo dijeron', misterio: 'Misterio' };
const SECCIONES = [['h-escena', 'Dónde estamos'], ['h-mundo', 'El mundo'], ['h-pnj', 'Personajes'], ['h-lugares', 'Lugares'], ['h-objetos', 'Objetos'], ['h-insc', 'Inscripciones'], ['h-misterios', 'Misterios'], ['h-galeria', 'Galería'], ['h-nivel', 'Progresión'], ['h-bitacora', 'Bitácora']];

const visibles = (cat) => porOrden(((E.enciclopedia || {})[cat]) || {}).filter(([, x]) => !x.oculto);
const listasVistoDicho = (x, etiquetaVisto = 'Lo vimos') => `
  ${(x.visto || []).length ? `<p class="sub"><span class="tag hecho">${etiquetaVisto}</span></p><ul class="vinetas">${x.visto.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
  ${(x.dicho || []).length ? `<p class="sub"><span class="tag dicho">Lo dijeron · puede ser falso</span></p><ul class="vinetas">${x.dicho.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
  ${x.misterio ? `<p class="sub"><span class="tag misterio">Por descubrir</span></p><p style="margin:0">${esc(x.misterio)}</p>` : ''}`;
const imgClic = (id, clase = '') => (srcDe(id) ? `<img class="${clase}" src="${srcDe(id)}" alt="${esc(imgs()[id].nombre)}" data-accion="ver-imagen" data-src="${esc(srcDe(id))}" loading="lazy">` : '');

function vistaHistoria() {
  const e = E.escena || {};
  const pistas = Object.values(E.pistas || {});
  const bit = Object.values(E.bitacora || {}).sort((a, b) => b.ts - a.ts);
  const galeria = Object.entries(imgs()).filter(([, i]) => i.tipo !== 'mapa' && i.visible);
  const mist = visibles('misterios');
  return `<nav class="indice" aria-label="Secciones de la historia">${SECCIONES.map(([id, t]) => `<button type="button" class="chip" data-accion="ir-seccion" data-id="${id}">${t}</button>`).join('')}</nav>
  <div class="historia">
    <div class="columna">
      <section class="panel" id="h-escena">
        <h2 class="panel-titulo">Dónde estamos</h2>
        <h1 style="font-size:24px;color:var(--oro-claro)">${esc(e.lugar || '')}</h1>
        ${e.alerta ? `<div class="alerta" style="margin-top:10px"><span class="alerta-icono" aria-hidden="true"></span><span>${esc(e.alerta)}</span></div>` : ''}
        ${e.texto ? `<p style="margin:10px 0 0">${esc(e.texto)}</p>` : ''}
      </section>

      <section class="panel" id="h-mundo">
        <h2 class="panel-titulo">El mundo</h2>
        <div class="enciclopedia">${visibles('mundo').map(([, m]) => `<article class="entrada-mundo">
          ${imgClic(m.img, 'banda')}
          <div class="fila-sep"><h3>${esc(m.titulo)}</h3>${m.tipo ? `<span class="tag ${m.tipo}">${TIPO[m.tipo] || ''}</span>` : ''}</div>
          ${m.texto ? `<p>${esc(m.texto)}</p>` : ''}
          ${listasVistoDicho(m, 'Novedades')}
        </article>`).join('')}</div>
      </section>

      <section class="panel" id="h-pnj">
        <h2 class="panel-titulo">Personajes no jugadores</h2>
        <div class="pnjs">${visibles('pnj').map(([, p]) => `<article class="pnj">
          ${srcDe(p.img) ? imgClic(p.img) : '<div class="sin-retrato" aria-hidden="true">?</div>'}
          <div class="pnj-txt">
            <h3>${esc(p.titulo)}</h3>
            ${p.sub ? `<div class="tenue" style="font-size:14px">${esc(p.sub)}</div>` : ''}
            ${p.texto ? `<p>${esc(p.texto)}</p>` : ''}
            ${listasVistoDicho(p)}
          </div>
        </article>`).join('')}</div>
        <p class="nota-regla" style="border-color:var(--oro)">${esc(HISTORIA.guardianes)}</p>
      </section>

      <section class="panel" id="h-lugares">
        <h2 class="panel-titulo">Lugares</h2>
        <div class="tarjetas">${visibles('lugares').map(([, l]) => `<article class="tarjeta${srcDe(l.img) ? '' : ' sin-img'}">
          ${imgClic(l.img)}
          <div class="tarjeta-txt"><div class="fila-sep"><h3>${esc(l.titulo)}</h3>${l.sub ? `<span class="chip${l.sub === 'Aquí están' ? ' conc' : /sin explorar/i.test(l.sub) ? ' est' : ''}">${esc(l.sub)}</span>` : ''}</div>
          ${l.texto ? `<p>${esc(l.texto)}</p>` : ''}${listasVistoDicho(l, 'Novedades')}</div>
        </article>`).join('')}</div>
      </section>

      <section class="panel" id="h-objetos">
        <h2 class="panel-titulo">Objetos</h2>
        <div class="objetos">${visibles('objetos').map(([, o]) => `<article class="objeto">
          ${srcDe(o.img) ? imgClic(o.img) : ''}
          <div><h3>${esc(o.titulo)}</h3>${o.sub ? `<div class="tenue" style="font-size:14px">${esc(o.sub)}</div>` : ''}${o.texto ? `<p>${esc(o.texto)}</p>` : ''}${listasVistoDicho(o, 'Novedades')}</div>
        </article>`).join('')}</div>
      </section>

      <section class="panel" id="h-insc">
        <h2 class="panel-titulo">Inscripciones</h2>
        <div class="inscripciones">${visibles('inscripciones').map(([, i]) => `<div class="inscripcion">${srcDe(i.img) ? imgClic(i.img, 'insc-img') : ''}<div class="insc-texto">${esc(i.titulo)}</div>${i.sub ? `<div class="tenue" style="font-size:14px">${esc(i.sub)}</div>` : ''}${i.texto ? `<div style="font-size:15px">${esc(i.texto)}</div>` : ''}</div>`).join('')}</div>
      </section>

      <section class="panel" id="h-misterios">
        <h2 class="panel-titulo">Misterios</h2>
        <div class="pj-chips">${mist.filter(([, m]) => !m.resuelto).map(([, m]) => `<span class="chip conc">${esc(m.titulo)}</span>`).join('') || '<span class="tenue">Ninguno abierto.</span>'}</div>
        ${mist.some(([, m]) => m.resuelto) ? `<p class="sub" style="margin-top:12px">Resueltos</p><div class="pj-chips">${mist.filter(([, m]) => m.resuelto).map(([, m]) => `<span class="chip resuelto">✓ ${esc(m.titulo)}</span>`).join('')}</div>` : ''}
      </section>

      <section class="panel" id="h-galeria">
        <h2 class="panel-titulo">Galería</h2>
        <div class="galeria">${galeria.map(([, i]) => `<figure><img src="${i.src}" alt="${esc(i.nombre)}" data-accion="ver-imagen" data-src="${esc(i.src)}" loading="lazy"><figcaption>${esc(i.nombre)}</figcaption></figure>`).join('')}</div>
      </section>

      <section class="panel" id="h-nivel">
        <h2 class="panel-titulo">Progresión</h2>
        <p style="margin:0 0 10px">${esc(HISTORIA.progresion.texto)}</p>
        <ul class="lista">${ORDEN.map((id) => `<li><span><b>${esc(FICHAS[id].nombre)}</b></span><span class="tenue" style="text-align:right">${esc(HISTORIA.progresion.nivel2[id])}</span></li>`).join('')}</ul>
      </section>
    </div>

    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Pistas del grupo</h2>
        <div class="pistas">${pistas.map(htmlPista).join('')}</div>
      </section>
      <section class="pergamino" id="h-bitacora">
        <h2 class="panel-titulo">Bitácora</h2>
        <div class="bitacora">${bit.map((b) => `<div class="entrada${b.tipo === 'cambio' ? ' cambio' : ''}"><time class="num" style="color:var(--tinta-suave)">${hora(b.ts)}</time><p>${esc(b.texto)}</p></div>`).join('')}</div>
      </section>
      <section class="panel">
        <h2 class="panel-titulo">Sesión 1 en viñetas</h2>
        <img class="comic" src="img/comic-sesion1.jpg" alt="Resumen en viñetas de la sesión 1" data-accion="ver-imagen" data-src="img/comic-sesion1.jpg" loading="lazy">
      </section>
    </div>
  </div>`;
}

/* ================= NARRADOR ================= */
function botonConfirmar(clave, etiqueta, accion, datos, clase = 'btn') {
  if (ui.confirmar === clave) {
    return `<span class="confirmar"><span>¿Seguro?</span><button type="button" class="btn btn-oro btn-peq" data-accion="${accion}" ${datos}>Sí, ${esc(etiqueta.toLowerCase())}</button><button type="button" class="btn btn-peq" data-accion="no-confirmar">No</button></span>`;
  }
  return `<button type="button" class="${clase}" data-accion="pedir" data-que="${clave}">${esc(etiqueta)}</button>`;
}
const val = (id, def) => esc(ui.borradores[id] ?? def ?? '');

function vistaNarrador() {
  if (!ui.desbloqueados.has('narrador')) return vistaPin('narrador');
  return `<div class="seg" role="tablist" aria-label="Secciones del narrador">
      <button type="button" role="tab" aria-selected="${ui.narrTab === 'turno'}" data-accion="narr-tab" data-tab="turno">Turno</button>
      <button type="button" role="tab" aria-selected="${ui.narrTab === 'biblioteca'}" data-accion="narr-tab" data-tab="biblioteca">Biblioteca</button>
    </div>
    ${ui.narrTab === 'biblioteca' ? vistaBiblioteca() : vistaTurno()}`;
}

function vistaTurno() {
  const e = E.escena || {};
  const pr = ui.previa;
  const clave = mapaActual();
  const ilu = e.ilustracion && imgs()[e.ilustracion];
  const retratos = Object.entries(imgs()).filter(([, i]) => i.tipo === 'retrato');
  return `<div class="narrador">
    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Respuesta de ChatGPT</h2>
        <p class="paso"><b>1</b>Copia la respuesta completa de ChatGPT y pégala aquí. La app lee el bloque [CAMBIOS] del final.</p>
        <label class="sr" for="resp">Respuesta de ChatGPT</label>
        <textarea class="campo" id="resp" data-borrador style="min-height:200px" placeholder="Pega aquí la respuesta de ChatGPT…">${val('resp')}</textarea>
        <div class="fila" style="margin-top:10px">
          <button type="button" class="btn btn-oro" data-accion="revisar">Revisar cambios</button>
          ${pr ? '<button type="button" class="btn" data-accion="descartar">Descartar</button>' : ''}
        </div>
        ${pr ? `<div class="vista-previa">
          <p class="paso" style="margin:6px 0 0"><b>2</b>Revisa lo que va a cambiar. Si algo no cuadra, corrige el texto de arriba y vuelve a revisar.</p>
          ${pr.narracion ? `<div class="pergamino" style="padding:12px 14px"><div class="narracion-texto" style="font-size:16px">${esc(pr.narracion)}</div></div>` : ''}
          ${pr.cambios.map((c) => `<div class="cambio-item">✓ <span>${esc(c)}</span></div>`).join('')}
          ${pr.noEntendidas.map((c) => `<div class="cambio-item no">? <span>No entendí: «${esc(c)}». Esta línea no se aplica.</span></div>`).join('')}
          ${!pr.tieneBloque ? '<div class="cambio-item no">? <span>La respuesta no trae bloque [CAMBIOS]. Solo se mostrará la narración.</span></div>' : ''}
          <div class="fila"><button type="button" class="btn btn-oro" data-accion="aplicar">Aplicar y mostrar en la mesa</button></div>
        </div>` : ''}
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Para ChatGPT</h2>
        <p class="paso"><b>★</b>Al empezar una conversación nueva, copia las instrucciones y el estado y pégalos en ChatGPT. Durante la sesión, ustedes le escriben sus acciones directamente.</p>
        <div class="fila">
          <button type="button" class="btn btn-oro" data-accion="copiar" data-que="todo">Copiar instrucciones + estado</button>
          <button type="button" class="btn" data-accion="copiar" data-que="estado">Copiar solo el estado</button>
          <button type="button" class="btn" data-accion="copiar" data-que="instrucciones">Copiar solo las instrucciones</button>
        </div>
        <p class="tenue" style="font-size:14px;margin:10px 0 0">El estado incluye las pistas privadas de cada personaje, porque el DM necesita conocerlas.</p>
        ${ui.copia ? `<div class="copiado"><label class="etq" for="copia">Tu navegador no dejó copiar solo. Selecciona todo el texto y cópialo:</label><textarea class="campo" id="copia" readonly>${esc(ui.copia)}</textarea></div>` : ''}
      </section>
    </div>

    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Mapa</h2>
        ${ilu ? `<div class="aviso-ilu"><span>En la mesa se ve la ilustración <b>${esc(ilu.nombre)}</b>.</span><button type="button" class="btn btn-peq btn-oro" data-accion="mostrar" data-id="">Volver al mapa</button></div>` : ''}
        <div class="fila-sep" style="margin-bottom:10px">
          <div class="fila">${mapas().map(([k, m]) => `<button type="button" class="btn btn-peq${k === clave ? ' btn-oro' : ''}" data-accion="mapa" data-k="${esc(k)}" aria-pressed="${k === clave}">${esc(m.nombre)}</button>`).join('')}</div>
          <button type="button" class="btn btn-peq${ui.moverFichas ? ' btn-oro' : ''}" data-accion="mover" aria-pressed="${ui.moverFichas}">${ui.moverFichas ? 'Listo' : 'Mover fichas'}</button>
        </div>
        ${htmlMapa(ui.moverFichas)}
        ${ui.moverFichas ? '<p class="tenue" style="font-size:14px;margin:8px 0 0">Arrastra las fichas. Se mueven en todas las pantallas al soltarlas.</p>' : ''}
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Escena</h2>
        <div class="columna" style="gap:10px">
          <div><label class="etq" for="esc-lugar">Lugar</label><input class="campo" style="width:100%" id="esc-lugar" data-borrador value="${val('esc-lugar', e.lugar)}"></div>
          <div><label class="etq" for="esc-alerta">Alerta (vacía para quitarla)</label><input class="campo" style="width:100%" id="esc-alerta" data-borrador value="${val('esc-alerta', e.alerta)}"></div>
          <div><label class="etq" for="esc-texto">Situación</label><textarea class="campo" id="esc-texto" data-borrador style="min-height:90px">${val('esc-texto', e.texto)}</textarea></div>
          <div><label class="etq" for="esc-cap">Capítulo</label><input class="campo" style="width:100%" id="esc-cap" data-borrador value="${val('esc-cap', e.capitulo)}"></div>
          <div class="fila"><button type="button" class="btn btn-oro" data-accion="escena-guardar">Guardar escena</button></div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Guardianes y enemigos</h2>
        ${Object.entries(E.enemigos || {}).map(([k, en]) => {
          const actual = en.img || (imgs()[k] && imgs()[k].tipo === 'retrato' ? k : '');
          return `<div class="recurso"><div style="min-width:0;flex:1"><div class="recurso-nombre">${esc(en.nombre)}</div><div class="recurso-det">${en.derrotado ? 'Derrotado' : `${en.dano || 0} de daño recibido`}</div>
            <label class="sr" for="en-img-${esc(k)}">Retrato de ${esc(en.nombre)}</label>
            <select class="campo campo-peq" id="en-img-${esc(k)}" data-cambio="en-img" data-k="${esc(k)}"><option value="">Sin retrato</option>${retratos.map(([rk, r]) => `<option value="${esc(rk)}"${rk === actual ? ' selected' : ''}>${esc(r.nombre)}</option>`).join('')}</select></div>
            <div class="fila"><button type="button" class="btn btn-red btn-peq" data-accion="en-dano" data-k="${esc(k)}" data-d="-1" aria-label="Quitar daño">−</button><button type="button" class="btn btn-red btn-peq" data-accion="en-dano" data-k="${esc(k)}" data-d="1" aria-label="Sumar daño">+</button><button type="button" class="btn btn-peq" data-accion="en-derrotado" data-k="${esc(k)}">${en.derrotado ? 'Revivir' : 'Derrotado'}</button></div></div>`;
        }).join('')}
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Descansos y partida</h2>
        <div class="fila">
          ${botonConfirmar('descanso-corto', 'Descanso corto', 'descanso', 'data-tipo="corto"')}
          ${botonConfirmar('descanso-largo', 'Descanso largo', 'descanso', 'data-tipo="largo"')}
        </div>
        <div class="fila" style="margin-top:10px">
          ${botonConfirmar('reiniciar', 'Volver a la partida guardada', 'reiniciar', '', 'btn btn-peligro')}
          <button type="button" class="btn" data-accion="bloquear" data-id="narrador">Bloquear narrador</button>
        </div>
      </section>
    </div>
  </div>`;
}

/* ---------- Biblioteca ---------- */
const ETIQUETA_SUB = { mundo: 'Subtítulo (opcional)', pnj: 'Quién es (ej. Herrero de la aldea)', lugares: 'Estado (ej. Sin explorar, Aquí están)', objetos: 'Detalle (ej. Lo tiene Victoria)', inscripciones: 'Dónde está', misterios: '' };

function formEntrada() {
  const cat = ui.borradores['ent-cat'] || 'pnj';
  const editando = ui.editando;
  const opcionesImg = Object.entries(imgs()).filter(([, i]) => i.tipo !== 'mapa');
  const esMist = cat === 'misterios';
  return `<section class="panel" id="form-entrada">
    <h2 class="panel-titulo">${editando ? 'Editar entrada' : 'Nueva entrada'}</h2>
    <div class="columna" style="gap:10px">
      <div><label class="etq" for="ent-cat">Sección</label>
        <select class="campo" style="width:100%" id="ent-cat" data-borrador data-cambio="ent-cat" ${editando ? 'disabled' : ''}>${Object.entries(CATEGORIAS).map(([k, c]) => `<option value="${k}"${k === cat ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
      <div><label class="etq" for="ent-titulo">${esMist ? 'Pregunta o misterio' : cat === 'inscripciones' ? 'Texto de la inscripción' : 'Nombre o título'}</label><input class="campo" style="width:100%" id="ent-titulo" data-borrador value="${val('ent-titulo')}"></div>
      ${esMist ? `<label class="check"><input type="checkbox" id="ent-resuelto" data-borrador-check${ui.borradores['ent-resuelto'] ? ' checked' : ''}> Ya está resuelto</label>` : `
      <div><label class="etq" for="ent-sub">${ETIQUETA_SUB[cat]}</label><input class="campo" style="width:100%" id="ent-sub" data-borrador value="${val('ent-sub')}"></div>
      ${cat === 'mundo' ? `<div><label class="etq" for="ent-tipo">Etiqueta</label><select class="campo" style="width:100%" id="ent-tipo" data-borrador>${Object.entries(TIPO).map(([k, t]) => `<option value="${k}"${(ui.borradores['ent-tipo'] || 'hecho') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></div>` : ''}
      <div><label class="etq" for="ent-texto">Descripción</label><textarea class="campo" id="ent-texto" data-borrador style="min-height:80px">${val('ent-texto')}</textarea></div>
      <div><label class="etq" for="ent-visto">Lo vimos (uno por línea)</label><textarea class="campo" id="ent-visto" data-borrador style="min-height:70px">${val('ent-visto')}</textarea></div>
      <div><label class="etq" for="ent-dicho">Lo dijeron, puede ser falso (uno por línea)</label><textarea class="campo" id="ent-dicho" data-borrador style="min-height:70px">${val('ent-dicho')}</textarea></div>
      <div><label class="etq" for="ent-misterio">Por descubrir</label><input class="campo" style="width:100%" id="ent-misterio" data-borrador value="${val('ent-misterio')}"></div>
      <div><label class="etq" for="ent-img">Imagen</label><select class="campo" style="width:100%" id="ent-img" data-borrador><option value="">Sin imagen</option>${opcionesImg.map(([k, i]) => `<option value="${esc(k)}"${(ui.borradores['ent-img'] || '') === k ? ' selected' : ''}>${esc(i.nombre)} (${TIPOS_IMG[i.tipo]})</option>`).join('')}</select></div>`}
      <label class="check"><input type="checkbox" id="ent-oculto" data-borrador-check${ui.borradores['ent-oculto'] ? ' checked' : ''}> Solo la ve el narrador (oculta en Historia)</label>
      <div class="fila"><button type="button" class="btn btn-oro" data-accion="ent-guardar">${editando ? 'Guardar cambios' : 'Añadir a la Historia'}</button>${editando || ui.borradores['ent-titulo'] ? '<button type="button" class="btn" data-accion="ent-cancelar">Cancelar</button>' : ''}</div>
    </div>
  </section>`;
}

function vistaBiblioteca() {
  const enc = E.enciclopedia || {};
  const grupos = Object.entries(TIPOS_IMG).map(([t, nombre]) => [t, nombre, Object.entries(imgs()).filter(([, i]) => i.tipo === t)]);
  const ilu = (E.escena || {}).ilustracion;
  return `<div class="narrador">
    <div class="columna">
      <section class="panel">
        <h2 class="panel-titulo">Subir imagen</h2>
        <div class="columna" style="gap:10px">
          <div><label class="etq" for="sub-archivo">Archivo</label><input class="campo" style="width:100%" type="file" id="sub-archivo" accept="image/*"></div>
          <div><label class="etq" for="sub-nombre">Nombre</label><input class="campo" style="width:100%" id="sub-nombre" data-borrador placeholder="Ej. Puerta lateral oeste" value="${val('sub-nombre')}"></div>
          <div><label class="etq" for="sub-tipo">Tipo</label><select class="campo" style="width:100%" id="sub-tipo" data-borrador>${Object.entries(TIPOS_IMG).map(([k, t]) => `<option value="${k}"${(ui.borradores['sub-tipo'] || 'ilustracion') === k ? ' selected' : ''}>${t}${k === 'mapa' ? ' (para mover fichas encima)' : k === 'retrato' ? ' (personajes y enemigos, se recorta cuadrado)' : ' (escenas y objetos)'}</option>`).join('')}</select></div>
          <label class="check"><input type="checkbox" id="sub-visible" data-borrador-check${ui.borradores['sub-visible'] === false ? '' : ' checked'}> Mostrarla en la Galería de Historia</label>
          <div class="fila"><button type="button" class="btn btn-oro" data-accion="subir" ${ui.subiendo ? 'disabled' : ''}>${ui.subiendo ? 'Subiendo…' : 'Subir a la Biblioteca'}</button></div>
          ${sync.modo === 'demo' ? '<p class="tenue" style="font-size:14px;margin:0">En el modo de demostración el navegador guarda poco espacio: prueba con pocas imágenes. Con Firebase ya no hay ese problema.</p>' : ''}
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-titulo">Imágenes</h2>
        ${grupos.map(([t, , lista]) => `<p class="sub" style="margin-top:6px">${PLURAL_IMG[t]}</p>
          <div class="biblio">${lista.map(([k, i]) => `<div class="biblio-item${i.visible || t === 'mapa' ? '' : ' oculta'}">
            <img src="${i.src}" alt="" data-accion="ver-imagen" data-src="${esc(i.src)}" loading="lazy">
            <div class="biblio-nombre">${esc(i.nombre)}${t !== 'mapa' && !i.visible ? ' <span class="tenue">(oculta)</span>' : ''}</div>
            <div class="biblio-acc">
              ${t === 'mapa' ? `<button type="button" class="btn btn-peq" data-accion="mapa" data-k="${esc(k)}">Usar en la mesa</button>`
                : ilu === k ? '<button type="button" class="btn btn-peq btn-oro" data-accion="mostrar" data-id="">Quitar de la mesa</button>'
                : `<button type="button" class="btn btn-peq" data-accion="mostrar" data-id="${esc(k)}">Mostrar en la mesa</button>`}
              ${t !== 'mapa' ? `<button type="button" class="btn btn-peq" data-accion="img-visible" data-id="${esc(k)}">${i.visible ? 'Ocultar' : 'Mostrar en Galería'}</button>` : ''}
              ${i.base ? '' : botonConfirmar(`borrar-img-${k}`, 'Borrar', 'img-borrar', `data-id="${esc(k)}"`, 'btn btn-peq btn-peligro')}
            </div>
          </div>`).join('') || '<p class="tenue" style="margin:0">Ninguna.</p>'}</div>`).join('')}
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

      <section class="panel">
        <h2 class="panel-titulo">PINs de los personajes</h2>
        <p class="tenue" style="margin:0 0 8px;font-size:15px">Pásale a cada quien el suyo en privado.</p>
        <ul class="lista">${ORDEN.map((id) => `<li><span>${esc(FICHAS[id].nombre)}</span><span class="val num">${PINES[id]}</span></li>`).join('')}<li><span>Narrador</span><span class="val num">${PINES.narrador}</span></li></ul>
      </section>
    </div>
  </div>`;
}

/* ================= RENDER ================= */
const VISTAS = { mesa: vistaMesa, ficha: vistaFicha, historia: vistaHistoria, narrador: vistaNarrador };

function render() {
  if (!E || ui.arrastrando) return;
  const v = $('#vista');
  const act = document.activeElement;
  let foco = null;
  if (act && act.id && v.contains(act)) foco = { id: act.id, s: act.selectionStart, e: act.selectionEnd, scroll: act.scrollTop };
  const archivo = $('#sub-archivo');
  const archivos = archivo && archivo.files && archivo.files.length ? archivo.files : null;
  v.innerHTML = VISTAS[ui.ruta]();
  if (archivos) { const a = $('#sub-archivo'); if (a) try { a.files = archivos; } catch (e) { /* no se puede conservar */ } }
  if (foco) {
    const el = document.getElementById(foco.id);
    if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(foco.s, foco.e); } catch (e) { /* no aplica */ } el.scrollTop = foco.scroll || 0; }
  }
  document.querySelectorAll('[data-ruta]').forEach((a) => { if (a.dataset.ruta === ui.ruta) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#sub-capitulo').textContent = (E.escena && E.escena.capitulo) || '';
  document.body.classList.toggle('tv', ui.tv);
  const s = $('#sync');
  s.classList.toggle('vivo', sync.modo === 'vivo' && sync.conectado);
  s.classList.toggle('caido', sync.modo === 'vivo' && !sync.conectado);
  $('.sync-texto', s).textContent = sync.modo === 'demo' ? 'Demostración' : sync.conectado ? 'En vivo' : 'Sin conexión';
  s.title = sync.modo === 'demo' ? (sync.error || 'Modo de demostración: sincroniza solo las pestañas de este dispositivo.') : 'Conectado a la partida compartida.';
  montarMapa();
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

function avisarEspacio() {
  if (sync.sinEspacio) aviso('El modo de demostración se quedó sin espacio: se verá hasta que recargues. Con Firebase no pasa.');
}

/* ================= ACCIONES ================= */
const escribirPj = (id, ruta, valor) => sync.escribir({ [`personajes/${id}/${ruta}`]: valor });

function pinTecla(d) {
  if (ui.pin.length >= 4) return;
  ui.pin += d; ui.pinError = false;
  if (ui.pin.length === 4) {
    const id = ui.ruta === 'narrador' ? 'narrador' : ui.ver;
    if (PINES[id] === ui.pin) {
      ui.desbloqueados.add(id); guardarDesbloqueos();
      if (id !== 'narrador') { ui.yo = id; ls.set('mf-yo', id); }
      ui.pin = '';
      aviso(id === 'narrador' ? 'Modo narrador abierto' : `Hola, ${FICHAS[id].nombre}`);
    } else { ui.pin = ''; ui.pinError = true; }
  }
  render();
}

function limpiarFormEntrada() {
  for (const k of Object.keys(ui.borradores)) if (k.startsWith('ent-') && k !== 'ent-cat') delete ui.borradores[k];
  ui.editando = null;
}

const ACCIONES = {
  elegir(d) { ui.ver = d.id; ui.pin = ''; ui.pinError = false; if (ui.ruta !== 'ficha') location.hash = 'ficha'; else render(); },
  'pin-tecla'(d) { pinTecla(d.d); },
  'pin-borrar'() { ui.pin = ui.pin.slice(0, -1); ui.pinError = false; render(); },
  'pin-volver'() { if (ui.ruta === 'narrador') location.hash = 'mesa'; else { ui.ver = null; render(); } },
  cambiar() { ui.ver = null; render(); },
  bloquear(d) {
    ui.desbloqueados.delete(d.id); guardarDesbloqueos();
    if (ui.yo === d.id) { ui.yo = null; ls.set('mf-yo', ''); }
    if (d.id !== 'narrador') ui.ver = null;
    aviso('Bloqueado en este dispositivo'); render();
  },
  'ver-imagen'(d) {
    const c = $('#capa');
    c.innerHTML = `<button type="button" class="btn cerrar" data-accion="cerrar-capa">Cerrar</button><img src="${esc(d.src)}" alt="">`;
    c.hidden = false;
  },
  'cerrar-capa'() { const c = $('#capa'); c.hidden = true; c.innerHTML = ''; },
  pv(d) { const f = FICHAS[d.id]; const v = Math.max(0, Math.min(f.pvMax, pj(d.id).pv + +d.d)); escribirPj(d.id, 'pv', v); },
  'pv-cant'(d) {
    const n = parseInt($('#pv-cant').value, 10);
    if (!n || n < 0) { aviso('Escribe una cantidad primero'); $('#pv-cant').focus(); return; }
    const f = FICHAS[d.id]; const actual = pj(d.id).pv;
    const v = d.tipo === 'dano' ? Math.max(0, actual - n) : Math.min(f.pvMax, actual + n);
    delete ui.borradores['pv-cant'];
    escribirPj(d.id, 'pv', v);
    aviso(d.tipo === 'dano' ? `−${n} PV` : `+${Math.min(n, f.pvMax - actual)} PV`);
  },
  esp(d) { const i = +d.i; const actual = pj(d.id).esp1 || 0; escribirPj(d.id, 'esp1', i < actual ? i : i + 1); },
  rec(d) { const i = +d.i; const actual = (pj(d.id).recursos || {})[d.k] ?? 0; escribirPj(d.id, `recursos/${d.k}`, i < actual ? i : i + 1); },
  'rec-delta'(d) { const r = FICHAS[d.id].recursos[d.k]; const actual = (pj(d.id).recursos || {})[d.k] ?? 0; escribirPj(d.id, `recursos/${d.k}`, Math.max(0, Math.min(r.max, actual + +d.d))); },
  'conc-fin'(d) { escribirPj(d.id, 'concentra', ''); },
  'conc-poner'(d) { const t = ($('#conc-in').value || '').trim(); if (!t) { aviso('Escribe el nombre del conjuro'); return; } delete ui.borradores['conc-in']; escribirPj(d.id, 'concentra', t); },
  'estado-quitar'(d) { escribirPj(d.id, `estados/${claveSegura(d.k)}`, null); },
  'estado-poner'(d) { const t = ($('#estado-in').value || '').trim(); if (!t) { aviso('Escribe el estado'); return; } delete ui.borradores['estado-in']; escribirPj(d.id, `estados/${claveSegura(t)}`, true); },
  oro(d) { escribirPj(d.id, 'oro', Math.max(0, (pj(d.id).oro || 0) + +d.d)); },
  'inv-quitar'(d) { escribirPj(d.id, `inventario/${d.k}`, null); },
  'inv-poner'(d) { const t = ($('#inv-in').value || '').trim(); if (!t) { aviso('Escribe el objeto'); return; } delete ui.borradores['inv-in']; escribirPj(d.id, `inventario/i${Date.now().toString(36)}`, t); },

  revisar() {
    const t = ($('#resp').value || '').trim();
    if (!t) { aviso('Pega primero la respuesta de ChatGPT'); $('#resp').focus(); return; }
    ui.previa = interpretar(t, E); render();
  },
  descartar() { ui.previa = null; render(); },
  aplicar() {
    const pr = ui.previa; if (!pr) return;
    const ts = Date.now();
    const u = { ...pr.updates };
    if (pr.narracion) {
      u.narracion = { texto: pr.narracion, ts };
      u[`bitacora/n${ts}`] = { ts, tipo: 'narracion', texto: pr.narracion };
    }
    if (pr.cambios.length) u[`bitacora/c${ts}`] = { ts: ts + 1, tipo: 'cambio', texto: pr.cambios.join(' · ') };
    sync.escribir(u);
    ui.previa = null; delete ui.borradores.resp;
    aviso('La mesa está actualizada');
  },
  copiar(d) {
    const texto = d.que === 'todo' ? `${INSTRUCCIONES_CHATGPT}\n\n---\n\n${estadoParaChatGPT(E)}` : d.que === 'estado' ? estadoParaChatGPT(E) : INSTRUCCIONES_CHATGPT;
    const fallo = () => { ui.copia = texto; render(); const c = $('#copia'); if (c) { c.focus(); c.select(); } };
    try {
      navigator.clipboard.writeText(texto).then(() => { ui.copia = null; render(); aviso('Copiado. Pégalo en ChatGPT'); }, fallo);
    } catch (e) { fallo(); }
  },
  mapa(d) { sync.escribir({ 'escena/mapa': d.k, 'escena/ilustracion': '' }); aviso('La mesa muestra el mapa'); },
  mostrar(d) { sync.escribir({ 'escena/ilustracion': d.id || '' }); aviso(d.id ? 'Se muestra en la mesa' : 'La mesa vuelve al mapa'); },
  mover() { ui.moverFichas = !ui.moverFichas; render(); },
  'escena-guardar'() {
    const g = (id) => ($('#' + id).value || '').trim();
    sync.escribir({ 'escena/lugar': g('esc-lugar'), 'escena/alerta': g('esc-alerta'), 'escena/texto': g('esc-texto'), 'escena/capitulo': g('esc-cap') });
    for (const k of ['esc-lugar', 'esc-alerta', 'esc-texto', 'esc-cap']) delete ui.borradores[k];
    aviso('Escena guardada');
  },
  'en-dano'(d) { const en = E.enemigos[d.k]; sync.escribir({ [`enemigos/${d.k}/dano`]: Math.max(0, (en.dano || 0) + +d.d) }); },
  'en-derrotado'(d) { const en = E.enemigos[d.k]; sync.escribir({ [`enemigos/${d.k}/derrotado`]: !en.derrotado }); },
  pedir(d) { ui.confirmar = d.que; render(); },
  'no-confirmar'() { ui.confirmar = null; render(); },
  'ir-seccion'(d) { const el = document.getElementById(d.id); if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); },
  descanso(d) {
    const u = {}; const w = JSON.parse(JSON.stringify(E));
    const texto = descanso(d.tipo, w, u);
    const ts = Date.now();
    u[`bitacora/c${ts}`] = { ts, tipo: 'cambio', texto };
    ui.confirmar = null; sync.escribir(u); aviso(texto);
  },
  reiniciar() { ui.confirmar = null; ui.previa = null; sync.reiniciar(); aviso('Partida restaurada'); },

  'narr-tab'(d) { ui.narrTab = d.tab; ui.confirmar = null; render(); },
  async subir() {
    const archivo = $('#sub-archivo');
    const file = archivo && archivo.files && archivo.files[0];
    const nombre = ($('#sub-nombre').value || '').trim() || (file ? file.name.replace(/\.[^.]+$/, '') : '');
    const tipo = $('#sub-tipo').value;
    if (!file) { aviso('Elige primero un archivo de imagen'); return; }
    if (!/^image\//.test(file.type)) { aviso('Ese archivo no es una imagen'); return; }
    ui.subiendo = true; render();
    try {
      const src = await comprimir(file, tipo);
      const id = 'up' + Date.now().toString(36);
      const visible = $('#sub-visible') ? $('#sub-visible').checked : true;
      await sync.escribir({ [`imagenes/${id}`]: { nombre, tipo, src, visible, base: false } });
      delete ui.borradores['sub-nombre'];
      const a = $('#sub-archivo'); if (a) a.value = '';
      aviso(`«${nombre}» quedó en la Biblioteca`);
      avisarEspacio();
    } catch (e) {
      console.error(e); aviso('No se pudo leer la imagen. Prueba con un JPG o PNG.');
    } finally { ui.subiendo = false; render(); }
  },
  'img-visible'(d) { const i = imgs()[d.id]; if (i) sync.escribir({ [`imagenes/${d.id}/visible`]: !i.visible }); },
  'img-borrar'(d) {
    const u = { [`imagenes/${d.id}`]: null };
    if ((E.escena || {}).ilustracion === d.id) u['escena/ilustracion'] = '';
    if ((E.escena || {}).mapa === d.id) u['escena/mapa'] = 'camara';
    ui.confirmar = null; sync.escribir(u); aviso('Imagen borrada');
  },
  'ent-editar'(d) {
    const x = ((E.enciclopedia || {})[d.cat] || {})[d.id]; if (!x) return;
    limpiarFormEntrada();
    ui.editando = { cat: d.cat, id: d.id };
    Object.assign(ui.borradores, {
      'ent-cat': d.cat, 'ent-titulo': x.titulo || '', 'ent-sub': x.sub || '', 'ent-texto': x.texto || '', 'ent-tipo': x.tipo || 'hecho',
      'ent-visto': (x.visto || []).join('\n'), 'ent-dicho': (x.dicho || []).join('\n'), 'ent-misterio': x.misterio || '', 'ent-img': x.img || '',
      'ent-oculto': !!x.oculto, 'ent-resuelto': !!x.resuelto,
    });
    render();
    const f = $('#form-entrada'); if (f) f.scrollIntoView({ block: 'start' });
  },
  'ent-cancelar'() { limpiarFormEntrada(); render(); },
  'ent-guardar'() {
    const cat = ui.editando ? ui.editando.cat : (ui.borradores['ent-cat'] || 'pnj');
    const g = (id) => { const el = $('#' + id); return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; };
    const titulo = g('ent-titulo');
    if (!titulo) { aviso('Escribe el nombre o título'); $('#ent-titulo').focus(); return; }
    const previo = ui.editando ? E.enciclopedia[cat][ui.editando.id] : null;
    const entrada = cat === 'misterios'
      ? { titulo, resuelto: !!g('ent-resuelto'), oculto: !!g('ent-oculto') }
      : { titulo, sub: g('ent-sub'), texto: g('ent-texto'), visto: lineas(g('ent-visto')), dicho: lineas(g('ent-dicho')), misterio: g('ent-misterio'), img: g('ent-img'), oculto: !!g('ent-oculto'), ...(cat === 'mundo' ? { tipo: g('ent-tipo') || 'hecho' } : {}) };
    entrada.orden = previo ? (previo.orden || Date.now()) : Date.now();
    const id = ui.editando ? ui.editando.id : cat.slice(0, 2) + Date.now().toString(36);
    sync.escribir({ [`enciclopedia/${cat}/${id}`]: entrada });
    limpiarFormEntrada(); aviso(previo ? 'Entrada actualizada' : `Añadido a ${CATEGORIAS[cat].nombre}`);
  },
  'ent-borrar'(d) { ui.confirmar = null; if (ui.editando && ui.editando.id === d.id) limpiarFormEntrada(); sync.escribir({ [`enciclopedia/${d.cat}/${d.id}`]: null }); aviso('Entrada borrada'); },
};

const CAMBIOS = {
  'ent-cat'() { render(); },
  'en-img'(t) { sync.escribir({ [`enemigos/${t.dataset.k}/img`]: t.value }); },
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
  if (t.dataset && t.dataset.notas) {
    clearTimeout(guardarNotas.t);
    guardarNotas.t = setTimeout(() => guardarNotas(t.dataset.notas, t.value), 700);
  }
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.dataset && 'borrador' in t.dataset && t.id) ui.borradores[t.id] = t.value;
  if (t.dataset && 'borradorCheck' in t.dataset && t.id) ui.borradores[t.id] = t.checked;
  if (t.dataset && t.dataset.cambio && CAMBIOS[t.dataset.cambio]) CAMBIOS[t.dataset.cambio](t);
});
function guardarNotas(id, valor) { escribirPj(id, 'notas', valor); }
document.addEventListener('focusout', (ev) => {
  const t = ev.target;
  if (t.dataset && t.dataset.notas) { clearTimeout(guardarNotas.t); guardarNotas(t.dataset.notas, t.value); delete ui.borradores[t.id]; }
});

document.addEventListener('keydown', (ev) => {
  const t = ev.target;
  if (ev.key === 'Enter' && t.dataset && t.dataset.enter) { ev.preventDefault(); ACCIONES[t.dataset.enter]({ ...t.dataset }); return; }
  if (ev.key === 'Escape' && !$('#capa').hidden) { ACCIONES['cerrar-capa'](); return; }
  const enPin = (ui.ruta === 'ficha' && ui.ver && !ui.desbloqueados.has(ui.ver)) || (ui.ruta === 'narrador' && !ui.desbloqueados.has('narrador'));
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
