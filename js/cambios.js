// Lee el bloque [CAMBIOS] de una respuesta de ChatGPT y lo convierte en actualizaciones.
import { FICHAS, ORDEN, CATEGORIAS } from './datos.js';
import { aplicarRutas, clonar, claveSegura } from './sync.js';

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

const MARCA_INICIO = /^\s*[#>*\-\s]*\[?\s*cambios\s*\]?\s*:?\s*\**\s*$/i;
const MARCA_FIN = /^\s*\[?\s*(fin|\/cambios)\s*\]?\s*$/i;

function mapaPorNombre(t, estado) {
  const n = norm(t);
  const mapas = Object.entries(estado.imagenes || {}).filter(([, i]) => i.tipo === 'mapa');
  let hit = mapas.find(([, i]) => norm(i.nombre) === n);
  if (!hit) {
    const palabras = n.split(/[^a-z0-9ñ]+/).filter((p) => p.length >= 4).map((p) => p.slice(0, 6));
    let mejor = 0;
    for (const m of mapas) { const nn = norm(m[1].nombre); const pts = palabras.filter((p) => nn.includes(p)).length; if (pts > mejor) { mejor = pts; hit = m; } }
  }
  if (hit) return hit;
  if (/bosque/.test(n)) return mapas.find(([k]) => k === 'bosque') || null;
  if (/camara/.test(n)) return mapas.find(([k]) => k === 'camara') || null;
  return null;
}

// Crea una entrada de la enciclopedia o, si ya existe con ese título, le suma un dato nuevo
function entrada(cat, titulo, texto, w, u, extra = {}) {
  w.enciclopedia = w.enciclopedia || {};
  const lista = (w.enciclopedia[cat] = w.enciclopedia[cat] || {});
  const id0 = Object.keys(lista).find((k) => norm(lista[k].titulo) === norm(titulo));
  if (id0) {
    const base = `enciclopedia/${cat}/${id0}`;
    const ent = lista[id0];
    if (!texto) return null;
    const visto = [...(ent.visto || []), texto];
    ent.visto = visto;
    if (u[base]) u[base].visto = visto; else u[`${base}/visto`] = visto;
    return `${CATEGORIAS[cat].singular}: ${ent.titulo} (dato nuevo)`;
  }
  const id = cat.slice(0, 2) + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nueva = { titulo, sub: '', texto: texto || '', visto: [], dicho: [], misterio: '', img: '', oculto: false, orden: Date.now(), ...extra };
  u[`enciclopedia/${cat}/${id}`] = nueva;
  lista[id] = clonar(nueva);
  return `Nuevo en ${CATEGORIAS[cat].nombre}: ${titulo}`;
}

function personajePorNombre(t) {
  const n = norm(t);
  for (const id of ORDEN) {
    const f = FICHAS[id];
    if ([f.nombre, ...f.alias].some((a) => norm(a) === n)) return id;
  }
  return null;
}

function enemigoPorNombre(t, estado) {
  const n = norm(t).replace(/^(enemigo|guardian)\s*(de la|del|de)?\s*/, '');
  for (const k of ['espada', 'martillo', 'lanza']) if (norm(t).includes(k)) return { id: k, nuevo: false };
  for (const [id, e] of Object.entries(estado.enemigos || {})) {
    if (norm(e.nombre) === norm(t) || norm(e.nombre).includes(n)) return { id, nuevo: false };
  }
  const titulo = String(t).replace(/^\s*enemigo\s*:?\s*/i, '').trim();
  return { id: claveSegura(norm(titulo).replace(/ /g, '-')), nuevo: true, nombre: titulo };
}

function recursoPorNombre(id, t) {
  const n = norm(t).replace(/^(el|la|los|las|su|un|una)\s+/, '');
  if (!n) return null;
  for (const [k, r] of Object.entries(FICHAS[id].recursos)) {
    const rn = norm(r.nombre);
    if (rn.includes(n) || n.includes(rn.split(' ')[0]) && rn.split(' ')[0].length >= 4) return k;
  }
  return null;
}

const signo = (s) => (s === '−' || s === '–' ? '-' : s);
const limpiar = (s) => String(s).replace(/\*\*|__|`/g, '').replace(/^\s*[-•*·]\s*/, '').trim();

// Separa "PV -4, espacio -1" en partes; "pista ..." y "concentra ..." se quedan con el resto de la línea
function partir(resto) {
  const out = [];
  let actual = '';
  for (const trozo of resto.split(/([,;])/)) {
    if (trozo === ',' || trozo === ';') {
      if (/^\s*(pista|recuerdo|secreto|nota)/i.test(actual)) { actual += trozo; continue; }
      out.push(actual); actual = ''; continue;
    }
    actual += trozo;
  }
  out.push(actual);
  return out.map((s) => s.trim()).filter(Boolean);
}

function opPersonaje(id, texto, w, u) {
  const f = FICHAS[id];
  const p = w.personajes[id];
  const t = texto.trim();
  const n = norm(t);
  const nombre = f.nombre;
  let m;
  const pon = (ruta, valor) => { u[`personajes/${id}/${ruta}`] = valor; aplicarRutas(p, { [ruta]: valor }); };

  // PV
  if ((m = n.match(/^(?:pv|puntos de vida|vida)\s*(?:a\s+)?([+\-−=]?)\s*(\d+)(?:\s*\/\s*\d+)?$/))) {
    const s = signo(m[1]); const v = +m[2]; const antes = p.pv;
    const nuevo = s === '-' ? Math.max(0, antes - v) : s === '+' ? Math.min(f.pvMax, antes + v) : Math.max(0, Math.min(f.pvMax, v));
    pon('pv', nuevo); return `${nombre}: PV ${antes} → ${nuevo}`;
  }
  if ((m = n.match(/^(?:recibe\s+)?(\d+)\s+(?:de\s+|puntos de\s+)?dano\b/)) || (m = n.match(/^dano\s*[+\-−]?\s*(\d+)/))) {
    const antes = p.pv; const nuevo = Math.max(0, antes - +m[1]); pon('pv', nuevo); return `${nombre}: ${m[1]} de daño, PV ${antes} → ${nuevo}`;
  }
  if ((m = n.match(/^(?:cura(?:cion)?|se cura|recupera)\s*\+?\s*(\d+)\s*(?:pv|puntos de vida)?$/))) {
    const antes = p.pv; const nuevo = Math.min(f.pvMax, antes + +m[1]); pon('pv', nuevo); return `${nombre}: cura ${m[1]}, PV ${antes} → ${nuevo}`;
  }
  // Espacios de conjuro
  if ((m = n.match(/^(?:espacios?|esp\.?)(?:\s+de\s+conjuro)?(?:\s+(?:de\s+)?nivel\s*1)?\s*([+\-−=])\s*(\d+)/)) || (m = n.match(/^gasta\s+(un|1|\d+)\s+espacios?/))) {
    if (!f.esp1Max) return null;
    let s, v;
    if (m[0].startsWith('gasta')) { s = '-'; v = m[1] === 'un' ? 1 : +m[1]; } else { s = signo(m[1]); v = +m[2]; }
    const antes = p.esp1 || 0;
    const nuevo = s === '-' ? Math.max(0, antes - v) : s === '+' ? Math.min(f.esp1Max, antes + v) : Math.min(f.esp1Max, v);
    pon('esp1', nuevo); return `${nombre}: espacios de nivel 1 ${antes} → ${nuevo} de ${f.esp1Max}`;
  }
  // Concentración
  if (/^pierde (la )?concentracion/.test(n) || /^termina (la )?concentracion/.test(n)) { pon('concentra', ''); return `${nombre}: deja de concentrarse`; }
  if ((m = t.match(/^concentra(?:ci[oó]n|ndo)?\s*:?\s*(.*)$/i))) {
    const v = m[1].trim();
    if (!v || /^(nada|ninguna|ninguno|termina|terminada|fin|-|no)$/i.test(norm(v))) { pon('concentra', ''); return `${nombre}: deja de concentrarse`; }
    pon('concentra', v); return `${nombre}: se concentra en ${v}`;
  }
  // Estados
  if ((m = t.match(/^estados?\s*:?\s*([+\-−]?)\s*(.+)$/i))) {
    const s = signo(m[1]) || '+'; const k = claveSegura(m[2]);
    if (s === '-') { pon(`estados/${k}`, null); return `${nombre}: ya no está ${m[2]}`; }
    pon(`estados/${k}`, true); return `${nombre}: queda ${m[2]}`;
  }
  // Oro
  if ((m = n.match(/^(?:oro|mo|monedas(?: de oro)?)\s*([+\-−=])\s*(\d+)/))) {
    const s = signo(m[1]); const v = +m[2]; const antes = p.oro || 0;
    const nuevo = s === '-' ? Math.max(0, antes - v) : s === '+' ? antes + v : v;
    pon('oro', nuevo); return `${nombre}: oro ${antes} → ${nuevo}`;
  }
  // Inventario
  if ((m = t.match(/^(?:objeto|[ií]tem|inventario)\s*:?\s*([+\-−])\s*(.+)$/i))) {
    const s = signo(m[1]); const cosa = m[2].trim();
    if (s === '+') { pon(`inventario/i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, cosa); return `${nombre}: recibe ${cosa}`; }
    const inv = p.inventario || {};
    const k = Object.keys(inv).find((k) => norm(inv[k]).includes(norm(cosa)) || norm(cosa).includes(norm(inv[k])));
    if (!k) return `${nombre}: no tenía «${cosa}» (sin cambios)`;
    const cual = inv[k]; pon(`inventario/${k}`, null); return `${nombre}: pierde ${cual}`;
  }
  // Pistas privadas
  if ((m = t.match(/^(?:pista|recuerdo|secreto|nota)\s*\+?\s*:?\s*(.+)$/i))) {
    pon(`pistas/q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, m[1].trim());
    return `${nombre}: nueva pista privada`;
  }
  // Inspiración bárdica
  if ((m = n.match(/^inspiracion(?: bardica)?\s*([+\-−])\s*(\d*)/))) {
    const s = signo(m[1]); const v = +(m[2] || 1);
    if (f.recursos.inspiracion) {
      const antes = (p.recursos || {}).inspiracion ?? 0;
      const nuevo = s === '-' ? Math.max(0, antes - v) : Math.min(f.recursos.inspiracion.max, antes + v);
      pon('recursos/inspiracion', nuevo); return `${nombre}: inspiración bárdica ${antes} → ${nuevo}`;
    }
    if (s === '+') { pon('estados/Inspiración bárdica (d6)', true); return `${nombre}: recibe Inspiración bárdica (d6)`; }
    pon('estados/Inspiración bárdica (d6)', null); return `${nombre}: usa su Inspiración bárdica`;
  }
  // Usar o recuperar un recurso
  if ((m = t.match(/^(usa|gasta|recupera|recarga)\s+(.+?)(?:\s+(\d+))?$/i))) {
    const verbo = norm(m[1]); const k = recursoPorNombre(id, m[2]);
    if (!k) {
      if (/inspiraci/i.test(m[2]) && !f.recursos.inspiracion) { pon('estados/Inspiración bárdica (d6)', null); return `${nombre}: usa su Inspiración bárdica`; }
      return null;
    }
    const r = f.recursos[k]; const antes = (p.recursos || {})[k] ?? 0;
    const v = m[3] ? +m[3] : null;
    const nuevo = (verbo === 'usa' || verbo === 'gasta') ? Math.max(0, antes - (v ?? 1)) : Math.min(r.max, v == null ? r.max : antes + v);
    pon(`recursos/${k}`, nuevo); return `${nombre}: ${r.nombre} ${antes} → ${nuevo}`;
  }
  // Recurso con número: "jabalinas -1", "flechas =18"
  if ((m = t.match(/^(.+?)\s*([+\-−=])\s*(\d+)$/))) {
    const k = recursoPorNombre(id, m[1]);
    if (k) {
      const r = f.recursos[k]; const s = signo(m[2]); const v = +m[3]; const antes = (p.recursos || {})[k] ?? 0;
      const nuevo = s === '-' ? Math.max(0, antes - v) : s === '+' ? Math.min(r.max, antes + v) : Math.min(r.max, v);
      pon(`recursos/${k}`, nuevo); return `${nombre}: ${r.nombre} ${antes} → ${nuevo}`;
    }
  }
  return null;
}

function opEnemigo(sujeto, texto, w, u) {
  const e = enemigoPorNombre(sujeto, w);
  const base = `enemigos/${e.id}`;
  if (e.nuevo && !w.enemigos?.[e.id]) {
    const nuevo = { nombre: e.nombre, dano: 0, actitud: 'Hostil', estados: {}, derrotado: false };
    u[base] = nuevo; aplicarRutas(w, { [base]: nuevo });
  }
  const en = w.enemigos[e.id];
  const pon = (ruta, valor) => {
    if (u[base]) { aplicarRutas(u[base], { [ruta]: valor }); } else { u[`${base}/${ruta}`] = valor; }
    aplicarRutas(en, { [ruta]: valor });
  };
  const t = texto.trim(); const n = norm(t); let m;
  if ((m = n.match(/^(?:dano|recibe)\s*\+?\s*(\d+)/)) || (m = n.match(/^(\d+)\s+(?:de\s+)?dano/))) {
    const antes = en.dano || 0; pon('dano', antes + +m[1]); return `${en.nombre}: daño recibido ${antes} → ${antes + +m[1]}`;
  }
  if (/^(derrotad|muert|muere|destruid|cae\b|vencid)/.test(n)) { pon('derrotado', true); return `${en.nombre}: derrotado`; }
  if ((m = t.match(/^estados?\s*:?\s*([+\-−]?)\s*(.+)$/i))) {
    const s = signo(m[1]) || '+'; const k = claveSegura(m[2]);
    pon(`estados/${k}`, s === '-' ? null : true); return `${en.nombre}: ${s === '-' ? 'ya no está' : 'queda'} ${m[2]}`;
  }
  if ((m = t.match(/^actitud\s*:?\s*(.+)$/i))) { pon('actitud', m[1].trim()); return `${en.nombre}: ${m[1].trim()}`; }
  if (/^(hostil|ataca)/.test(n)) { pon('actitud', 'Hostil'); return `${en.nombre}: hostil`; }
  if (e.nuevo) return `Nuevo enemigo: ${en.nombre}`;
  return null;
}

function descanso(tipo, w, u) {
  for (const id of ORDEN) {
    const f = FICHAS[id]; const p = w.personajes[id];
    const pon = (ruta, valor) => { u[`personajes/${id}/${ruta}`] = valor; aplicarRutas(p, { [ruta]: valor }); };
    if (tipo === 'largo') { pon('pv', f.pvMax); if (f.esp1Max) pon('esp1', f.esp1Max); pon('concentra', ''); }
    for (const [k, r] of Object.entries(f.recursos)) {
      if (r.recarga === 'corto' || (tipo === 'largo' && r.recarga === 'largo')) pon(`recursos/${k}`, r.max);
    }
  }
  return tipo === 'largo' ? 'Descanso largo: PV, espacios y rasgos recuperados' : 'Descanso corto: rasgos de descanso corto recuperados';
}

// Devuelve { narracion, cambios: [texto], noEntendidas: [línea], updates }
export function interpretar(texto, estado) {
  const lineas = String(texto || '').replace(/\r/g, '').split('\n');
  const i = lineas.findIndex((l) => MARCA_INICIO.test(l));
  const narracion = (i === -1 ? lineas : lineas.slice(0, i)).join('\n').trim();
  const bloque = [];
  if (i !== -1) {
    for (const l of lineas.slice(i + 1)) { if (MARCA_FIN.test(l)) break; const c = limpiar(l); if (c) bloque.push(c); }
  }
  const w = clonar(estado);
  const u = {};
  const cambios = [];
  const noEntendidas = [];
  for (const linea of bloque) {
    if (/^(ninguno|ninguna|sin cambios|nada)\.?$/i.test(norm(linea))) continue;
    const dp = linea.indexOf(':');
    if (dp === -1) { noEntendidas.push(linea); continue; }
    const sujeto = linea.slice(0, dp).trim();
    const resto = linea.slice(dp + 1).trim();
    const ns = norm(sujeto);
    const id = personajePorNombre(sujeto);
    let ids = id ? [id] : /^(todos|grupo|todo el grupo|el grupo|los cinco)$/.test(ns) ? ORDEN : null;
    if (ids) {
      for (const parte of partir(resto)) {
        let algun = false;
        for (const pid of ids) { const r = opPersonaje(pid, parte, w, u); if (r) { cambios.push(r); algun = true; } }
        if (!algun) noEntendidas.push(`${sujeto}: ${parte}`);
      }
      continue;
    }
    const pon = (ruta, valor, desc) => { u[ruta] = valor; aplicarRutas(w, { [ruta]: valor }); cambios.push(desc); };
    if (ns === 'escena') { pon('escena/texto', resto, `Escena: ${resto}`); continue; }
    if (ns === 'lugar') {
      pon('escena/lugar', resto, `Lugar: ${resto}`);
      const m = mapaPorNombre(resto, w);
      if (m && m[0] !== (w.escena || {}).mapa) pon('escena/mapa', m[0], `Mapa: ${m[1].nombre}`);
      continue;
    }
    if (ns === 'mapa') {
      const m = mapaPorNombre(resto, w);
      if (m) pon('escena/mapa', m[0], `Mapa: ${m[1].nombre}`); else noEntendidas.push(linea);
      continue;
    }
    if (/^(pnj|personaje no jugador|lugar|objeto|mundo) .+/.test(ns)) {
      const cat = /^lugar/.test(ns) ? 'lugares' : /^objeto/.test(ns) ? 'objetos' : /^mundo/.test(ns) ? 'mundo' : 'pnj';
      const titulo = sujeto.replace(/^\s*(pnj|personaje no jugador|lugar|objeto|mundo)\s+/i, '').trim();
      const r = entrada(cat, titulo, resto, w, u, cat === 'mundo' ? { tipo: 'hecho' } : {});
      if (r) cambios.push(r); else noEntendidas.push(linea);
      continue;
    }
    if (ns === 'inscripcion') {
      const m = resto.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      const r = entrada('inscripciones', m ? m[1].trim() : resto, '', w, u, { sub: m ? m[2].trim() : '' });
      if (r) cambios.push(r);
      continue;
    }
    if (ns === 'misterio' || ns === 'misterio resuelto') {
      if (ns === 'misterio') { const r = entrada('misterios', resto, '', w, u, { resuelto: false }); if (r) cambios.push(r); continue; }
      const lista = (w.enciclopedia || {}).misterios || {};
      const k = Object.keys(lista).find((k) => norm(lista[k].titulo) === norm(resto)) || Object.keys(lista).find((k) => norm(lista[k].titulo).includes(norm(resto)) || norm(resto).includes(norm(lista[k].titulo)));
      if (k) { const base = `enciclopedia/misterios/${k}`; if (u[base]) u[base].resuelto = true; else u[`${base}/resuelto`] = true; lista[k].resuelto = true; cambios.push(`Misterio resuelto: ${lista[k].titulo}`); }
      else { const r = entrada('misterios', resto, '', w, u, { resuelto: true }); if (r) cambios.push(`Misterio resuelto: ${resto}`); }
      continue;
    }
    if (ns === 'alerta') {
      const quitar = /^(ninguna|nada|sin alerta|-|no)$/i.test(norm(resto));
      pon('escena/alerta', quitar ? '' : resto, quitar ? 'Se quita la alerta' : `Alerta: ${resto}`); continue;
    }
    if (ns === 'capitulo') { pon('escena/capitulo', resto, `Capítulo: ${resto}`); continue; }
    if (/^pista( publica)?s?$/.test(ns)) { pon(`pistas/a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, resto, `Nueva pista del grupo: ${resto}`); continue; }
    if (ns === 'descanso') {
      const tipo = /largo/i.test(resto) ? 'largo' : /corto/i.test(resto) ? 'corto' : null;
      if (tipo) cambios.push(descanso(tipo, w, u)); else noEntendidas.push(linea);
      continue;
    }
    if (/^(guardian|enemigo)/.test(ns) || Object.values(w.enemigos || {}).some((e) => norm(e.nombre) === ns)) {
      for (const parte of partir(resto)) { const r = opEnemigo(sujeto, parte, w, u); if (r) cambios.push(r); else noEntendidas.push(`${sujeto}: ${parte}`); }
      continue;
    }
    noEntendidas.push(linea);
  }
  return { narracion, cambios, noEntendidas, updates: u, tieneBloque: i !== -1 };
}

export { descanso };

export const INSTRUCCIONES_CHATGPT = `Vamos a jugar con una app que muestra la partida en una pantalla compartida y en el celular de cada jugador. Para que la app se actualice sola, al final de CADA respuesta agrega un bloque que empiece con la línea [CAMBIOS] y liste solo lo que cambió, una línea por personaje o elemento. Si no cambió nada, escribe [CAMBIOS] y debajo «ninguno».

Nombres de los personajes: Klastan, Laila, Victoria, Larry y Kayho (antes lo escribíamos Cayo; desde ahora es Kayho).

Formato (puedes poner varias cosas en una línea separadas por comas):
[CAMBIOS]
Kayho: PV -4
Larry: espacio -1, concentra Fuego feérico
Klastan: concentra nada
Laila: usa Segundo aliento, PV +7
Victoria: usa Salto astral, flechas -1
Kayho: jabalinas -1, usa Imposición de manos 3
Larry: inspiración -1
Klastan: inspiración +1
Victoria: estado +Envenenada
Victoria: estado -Envenenada
Laila: objeto +Llave de cristal
Victoria: oro +5
Larry: pista +Oyes otra grabación: «...» (solo la ve ese jugador)
Pista: Texto de una pista que descubre todo el grupo
Guardián de la espada: daño +5, estado -Inmovilizado (Enmarañar)
Guardián del martillo: derrotado
Enemigo Sombra del bosque: daño +3   (si el enemigo es nuevo, la app lo crea)
Escena: Una o dos frases sobre la situación actual
Lugar: Cámara de las Cinco Vidas   (el lugar donde está el grupo ahora)
Alerta: Las raíces tocan el cristal   (o «Alerta: ninguna»)
Descanso: largo

Y para la enciclopedia del grupo (solo cosas que los jugadores descubran):
PNJ Nombre: descripción o dato nuevo   (si ya existe, se suma como dato nuevo)
Lugar Nombre del lugar: descripción
Objeto Nombre: descripción
Mundo Tema: explicación
Inscripción: «Texto exacto» (dónde está)
Misterio: Pregunta abierta
Misterio resuelto: Nombre del misterio

Escribe la narración normalmente arriba del bloque. Yo seguiré mandándote las acciones de los jugadores y sus tiradas de d20 físicos.`;

export function estadoParaChatGPT(estado) {
  const L = [];
  const e = estado.escena || {};
  L.push('EL MUNDO FRACTURADO — ESTADO ACTUAL DE LA PARTIDA');
  L.push(`${e.capitulo || ''}`);
  L.push('Sistema: D&D 5e (2014), nivel 1, con elementos caseros. Tú eres el Dungeon Master. Los jugadores tiran d20 físicos; tú resuelves daño y enemigos. Narración breve, ágil y divertida; resuelve acciones de varios personajes juntas. Mantén el misterio sobre el creador, el traidor, la mujer enmascarada y Eva.');
  L.push('');
  L.push(`LUGAR: ${e.lugar || '—'}`);
  if (e.alerta) L.push(`ALERTA: ${e.alerta}`);
  if (e.texto) L.push(`ESCENA: ${e.texto}`);
  L.push('');
  L.push('PERSONAJES');
  for (const id of ORDEN) {
    const f = FICHAS[id]; const p = (estado.personajes || {})[id] || {};
    const partes = [`PV ${p.pv}/${f.pvMax}`, `CA ${f.ca}`];
    if (f.esp1Max) partes.push(`espacios nivel 1 ${p.esp1 || 0}/${f.esp1Max}`);
    if (p.concentra) partes.push(`concentrando ${p.concentra}`);
    const est = Object.keys(p.estados || {}); if (est.length) partes.push(`estados: ${est.join(', ')}`);
    const rec = Object.entries(f.recursos).map(([k, r]) => `${r.nombre} ${(p.recursos || {})[k] ?? 0}/${r.max}`); if (rec.length) partes.push(rec.join(', '));
    partes.push(`oro ${p.oro ?? 0}`);
    const inv = Object.values(p.inventario || {}); if (inv.length) partes.push(`lleva: ${inv.join('; ')}`);
    L.push(`• ${f.nombre.toUpperCase()} (${f.raza} ${f.clase.toLowerCase()}): ${partes.join(' · ')}`);
    const pis = Object.values(p.pistas || {}); if (pis.length) L.push(`  Sabe: ${pis.join(' / ')}`);
  }
  L.push('');
  L.push('ENEMIGOS Y GUARDIANES');
  for (const en of Object.values(estado.enemigos || {})) {
    const est = Object.keys(en.estados || {});
    L.push(`• ${en.nombre}: ${en.derrotado ? 'derrotado' : `daño recibido ${en.dano || 0}`}${est.length ? `, ${est.join(', ')}` : ''}${en.actitud ? `. ${en.actitud}` : ''}`);
  }
  const pistas = Object.values(estado.pistas || {});
  if (pistas.length) { L.push(''); L.push('PISTAS DEL GRUPO'); pistas.forEach((p) => L.push(`• ${p}`)); }
  const bit = Object.values(estado.bitacora || {}).sort((a, b) => a.ts - b.ts).filter((b) => b.tipo === 'narracion').slice(-4);
  if (bit.length) { L.push(''); L.push('ÚLTIMOS SUCESOS'); bit.forEach((b) => L.push(`• ${b.texto}`)); }
  L.push('');
  L.push('Continúa la partida desde aquí. No la reinicies.');
  return L.join('\n');
}
