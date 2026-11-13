// Reglas: lector del SRD 5.2.1 en español (CC-BY-4.0), con índice y buscador.
// Los datos viven en reglas/reglas-jugador.json y reglas/reglas-dm.json y se cargan al abrir la pestaña.

export const ATRIBUCION = 'Esta obra incluye material procedente del documento de referencia del sistema 5.2.1 (“SRD 5.2.1”) de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd. La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia internacional de atribución/reconocimiento 4.0 de Creative Commons, disponible en https://creativecommons.org/licenses/by/4.0/legalcode.';

const datos = { jugador: null, dm: null };
const cargando = {};
const errores = {};
const entradas = new Map(); // id -> entrada (capítulo o encabezado)
const cache = new Map();

const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => quitarTildes(String(s || '').toLowerCase());
const plano = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function textoNodo(n) {
  switch (n[0]) {
    case 'p': case 'li': return plano(n[1]);
    case 's': case 'k': return n[1];
    case 't': return [n[1], ...n[2].map((f) => f.slice(1).map(plano).join(' '))].join(' ');
    case 'c': return [n[1], ...n[2].map(textoNodo)].join(' ');
    default: return '';
  }
}

function indexar(grupo, d) {
  d.capitulos.forEach((cap) => {
    const ns = cap.nodos;
    const primeraH = ns.findIndex((n) => n[0] === 'h');
    entradas.set(cap.id, { id: cap.id, grupo, cap, i: -1, fin: ns.length, propioFin: primeraH < 0 ? ns.length : primeraH, nivel: 1, titulo: cap.titulo, tn: norm(cap.titulo), txt: ns.slice(0, primeraH < 0 ? ns.length : primeraH).map(textoNodo).join(' ') });
    ns.forEach((n, i) => {
      if (n[0] !== 'h') return;
      let fin = ns.length, propioFin = ns.length;
      for (let j = i + 1; j < ns.length; j++) {
        if (ns[j][0] !== 'h') continue;
        if (propioFin === ns.length) propioFin = j;
        if (ns[j][1] <= n[1]) { fin = j; break; }
      }
      const txt = ns.slice(i + 1, propioFin).map(textoNodo).join(' ');
      entradas.set(n[3], { id: n[3], grupo, cap, i, fin, propioFin, nivel: n[1], titulo: n[2], tn: norm(n[2]), txt });
    });
  });
  for (const e of entradas.values()) if (!e.txtN) e.txtN = norm(e.txt);
}

export function cargar(grupo, alListo) {
  if (datos[grupo] || cargando[grupo]) return;
  cargando[grupo] = fetch(`reglas/reglas-${grupo}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => { datos[grupo] = d; indexar(grupo, d); })
    .catch(() => { errores[grupo] = true; })
    .finally(() => { delete cargando[grupo]; alListo(); });
}

/* ---------- dibujo de bloques ---------- */
function htmlTabla(n) {
  const [, titulo, filas, grupos] = n;
  const ncol = Math.max(...filas.map((f) => (f[0] === 2 ? 1 : f.length - 1)));
  let cab = '';
  if (grupos && grupos.length) {
    const [ini, ancho, et] = grupos[0];
    cab += `<tr>${ini ? `<th colspan="${ini}"></th>` : ''}<th colspan="${ancho}" class="rg-grupo">${esc(et)}</th>${ncol - ini - ancho > 0 ? `<th colspan="${ncol - ini - ancho}"></th>` : ''}</tr>`;
  }
  const cuerpo = filas.map((f) => {
    if (f[0] === 2) return `<tr class="rg-fila-grupo"><td colspan="${ncol}">${f[1]}</td></tr>`;
    const tag = f[0] === 1 ? 'th' : 'td';
    return `<tr>${f.slice(1).map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
  });
  const nCab = filas.findIndex((f) => f[0] !== 1);
  const cabFilas = cuerpo.slice(0, Math.max(0, nCab));
  const resto = cuerpo.slice(Math.max(0, nCab));
  return `<figure class="rg-tabla">${titulo ? `<figcaption>${esc(titulo)}</figcaption>` : ''}<div class="rg-desliza"><table>${cab || cabFilas.length ? `<thead>${cab}${cabFilas.join('')}</thead>` : ''}<tbody>${resto.join('')}</tbody></table></div></figure>`;
}

function htmlCar(n) {
  return `<table class="rg-car"><thead><tr><th></th><th>Punt.</th><th>Mod.</th><th>Salv.</th><th></th><th>Punt.</th><th>Mod.</th><th>Salv.</th></tr></thead><tbody>${[0, 1, 2].map((r) => `<tr>${[n[1][r], n[1][r + 3]].map((x) => (x ? `<th>${esc(x[0])}</th><td>${esc(x[1])}</td><td>${esc(x[2])}</td><td>${esc(x[3])}</td>` : '<td colspan="4"></td>')).join('')}</tr>`).join('')}</tbody></table>`;
}

function htmlNodos(ns, nivelBase) {
  let h = '', enLista = false;
  for (const n of ns) {
    if (n[0] !== 'li' && enLista) { h += '</ul>'; enLista = false; }
    switch (n[0]) {
      case 'h': { const k = Math.min(6, 3 + n[1] - nivelBase); h += `<h${k} class="rg-h rg-n${n[1]}" id="rg-${esc(n[3])}">${esc(n[2])}</h${k}>`; break; }
      case 'p': h += `<p${n[2] ? ` class="rg-${n[2]}"` : ''}>${n[1]}</p>`; break;
      case 'li': if (!enLista) { h += '<ul class="rg-ul">'; enLista = true; } h += `<li>${n[1]}</li>`; break;
      case 's': h += `<p class="rg-s">${esc(n[1])}</p>`; break;
      case 'k': h += `<p class="rg-k">${esc(n[1])}</p>`; break;
      case 't': h += htmlTabla(n); break;
      case 'c': h += `<aside class="rg-caja">${n[1] ? `<p class="rg-caja-t">${esc(n[1])}</p>` : ''}${htmlNodos(n[2], nivelBase)}</aside>`; break;
      case 'car': h += htmlCar(n); break;
      default: break;
    }
  }
  if (enLista) h += '</ul>';
  return h;
}

function hijos(e) {
  const ns = e.cap.nodos;
  const desde = e.i + 1, hasta = e.fin;
  let min = 99;
  for (let j = desde; j < hasta; j++) if (ns[j][0] === 'h') min = Math.min(min, ns[j][1]);
  const out = [];
  for (let j = desde; j < hasta; j++) if (ns[j][0] === 'h' && ns[j][1] === min) out.push(entradas.get(ns[j][3]));
  return out;
}

function padres(e) {
  const out = [];
  if (e.i < 0) return out;
  out.push(entradas.get(e.cap.id));
  const ns = e.cap.nodos;
  let nivel = e.nivel;
  const cadena = [];
  for (let j = e.i - 1; j >= 0; j--) {
    if (ns[j][0] === 'h' && ns[j][1] < nivel) { cadena.unshift(entradas.get(ns[j][3])); nivel = ns[j][1]; }
  }
  return out.concat(cadena);
}

function hermanos(e) {
  if (e.i < 0) {
    const caps = datos[e.grupo].capitulos;
    const k = caps.indexOf(e.cap);
    return [caps[k - 1] && entradas.get(caps[k - 1].id), caps[k + 1] && entradas.get(caps[k + 1].id)];
  }
  const p = padres(e).pop();
  const lista = p ? hijos(p) : [];
  const k = lista.findIndex((x) => x.id === e.id);
  return [lista[k - 1], lista[k + 1]];
}

function htmlEntrada(e) {
  if (cache.has(e.id)) return cache.get(e.id);
  const ns = e.cap.nodos;
  let h;
  const sub = ns.slice(e.i + 1, e.fin);
  const peso = sub.reduce((s, n) => s + JSON.stringify(n).length, 0);
  const hs = hijos(e);
  if (e.i >= 0 && peso < 16000) {
    h = htmlNodos(sub, e.nivel);
  } else {
    h = htmlNodos(ns.slice(e.i + 1, e.propioFin), e.nivel);
    if (hs.length) {
      const muchos = hs.length > 14;
      h += `<nav class="rg-hijos${muchos ? ' rejilla' : ''}" aria-label="Contenido">${hs.map((x) => `<button type="button" class="rg-enlace" data-accion="regla-ir" data-id="${esc(x.id)}">${esc(x.titulo)}</button>`).join('')}</nav>`;
    }
  }
  cache.set(e.id, h);
  return h;
}

/* ---------- búsqueda ---------- */
function buscar(q, grupos) {
  const qn = norm(q).trim();
  if (qn.length < 2) return [];
  const toks = qn.split(/\s+/).filter(Boolean);
  const res = [];
  for (const e of entradas.values()) {
    if (!grupos.includes(e.grupo)) continue;
    let s = 0;
    if (e.tn === qn) s = 300;
    else if (e.tn.startsWith(qn)) s = 200;
    else if (e.tn.includes(qn)) s = 150;
    else if (toks.every((t) => e.tn.includes(t))) s = 100;
    else if (e.txtN.includes(qn)) s = 30;
    else if (toks.every((t) => e.txtN.includes(t) || e.tn.includes(t))) s = 10;
    if (s) res.push([s - e.nivel, e]);
  }
  res.sort((a, b) => b[0] - a[0]);
  return res.slice(0, 60).map(([s, e]) => {
    let frag = '';
    if (s < 100) {
      const k = e.txtN.indexOf(e.txtN.includes(qn) ? qn : toks.find((t) => e.txtN.includes(t)));
      if (k >= 0) {
        const a = Math.max(0, k - 50), b = Math.min(e.txt.length, k + qn.length + 70);
        frag = (a > 0 ? '…' : '') + esc(e.txt.slice(a, k)) + '<mark>' + esc(e.txt.slice(k, k + qn.length)) + '</mark>' + esc(e.txt.slice(k + qn.length, b)) + (b < e.txt.length ? '…' : '');
      }
    }
    return { e, frag };
  });
}

/* ---------- vista ---------- */
export function vista(clave, est, alListo) {
  // clave: 'jugador' (todos) o 'dm' (panel del DM: capítulos del DM, busca en todo)
  const grupos = clave === 'dm' ? ['dm', 'jugador'] : ['jugador'];
  grupos.forEach((g) => cargar(g, alListo));
  const listos = grupos.every((g) => datos[g]);
  const pie = `<p class="rg-pie">${esc(ATRIBUCION)}</p>`;
  if (grupos.some((g) => errores[g])) return `<section class="panel"><p>No se pudieron cargar las reglas. Revisa la conexión y vuelve a abrir la pestaña.</p></section>`;
  if (!listos) return `<section class="panel rg"><p class="tenue">Cargando reglas…</p></section>`;
  const buscador = `<div class="rg-busca"><label class="sr" for="rq-${clave}">Buscar en las reglas</label>
    <input class="campo" id="rq-${clave}" type="search" placeholder="${clave === 'dm' ? 'Buscar monstruo, objeto, regla, conjuro…' : 'Buscar regla, estado, conjuro, clase…'}" autocomplete="off" data-buscar="${clave}" value="${esc(est.q || '')}"></div>`;
  let cuerpo;
  if ((est.q || '').trim().length >= 2) {
    const r = buscar(est.q, grupos);
    cuerpo = r.length
      ? `<p class="tenue rg-cuenta">${r.length === 60 ? 'Más de 60' : r.length} resultado${r.length === 1 ? '' : 's'}</p><ul class="rg-resultados">${r.map(({ e, frag }) => `<li><button type="button" data-accion="regla-ir" data-id="${esc(e.id)}" data-desde-busqueda="1"><span class="rg-r-t">${esc(e.titulo)}</span><span class="rg-r-c">${esc(padres(e).map((p) => p.titulo).join(' › ') || 'Capítulo')}${clave === 'dm' && e.grupo === 'jugador' ? ' · reglas de jugador' : ''}</span>${frag ? `<span class="rg-r-f">${frag}</span>` : ''}</button></li>`).join('')}</ul>`
      : '<p class="tenue">Nada coincide con esa búsqueda.</p>';
  } else if (est.sec && entradas.has(est.sec)) {
    const e = entradas.get(est.sec);
    const migas = padres(e);
    const [ant, sig] = hermanos(e);
    cuerpo = `<nav class="rg-migas" aria-label="Ubicación"><button type="button" data-accion="regla-ir" data-id="">Índice</button>${est.qPrevia ? `<button type="button" data-accion="regla-volver-busqueda">« ${esc(est.qPrevia)} »</button>` : ''}${migas.map((p) => `<button type="button" data-accion="regla-ir" data-id="${esc(p.id)}">${esc(p.titulo)}</button>`).join('')}</nav>
      <article class="rg-texto"><h2 class="rg-titulo">${esc(e.titulo)}</h2>${htmlEntrada(e)}</article>
      <nav class="rg-pasos">${ant ? `<button type="button" class="btn btn-peq" data-accion="regla-ir" data-id="${esc(ant.id)}">◀ ${esc(ant.titulo)}</button>` : '<span></span>'}${sig ? `<button type="button" class="btn btn-peq" data-accion="regla-ir" data-id="${esc(sig.id)}">${esc(sig.titulo)} ▶</button>` : ''}</nav>`;
  } else {
    const caps = datos[clave].capitulos;
    cuerpo = `<div class="rg-caps">${caps.map((c) => `<button type="button" class="rg-cap" data-accion="regla-ir" data-id="${esc(c.id)}"><span class="rg-cap-t">${esc(c.titulo)}</span><span class="rg-cap-n">${c.nodos.filter((n) => n[0] === 'h' && n[1] === 2).length || c.nodos.filter((n) => n[0] === 'h').length} apartados</span></button>`).join('')}</div>
      ${clave === 'dm' ? '<p class="tenue" style="font-size:14px">El buscador también encuentra las reglas de jugador.</p>' : ''}`;
  }
  return `<section class="panel rg" id="rg-panel">
    <h2 class="panel-titulo">${clave === 'dm' ? 'Reglas del DM' : 'Reglas'} <span class="extra">SRD 5.2.1</span></h2>
    ${buscador}${cuerpo}${pie}</section>`;
}
