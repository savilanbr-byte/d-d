// Sincronización del estado compartido.
// Modo demostración: localStorage + BroadcastChannel (pestañas del mismo dispositivo).
// Modo en vivo: Firebase Realtime Database (todos los dispositivos).
import { ESTADO_VACIO, VERSION } from './datos.js?v=20261115d';
import { FIREBASE_CONFIG, PARTIDA_ID } from '../config.js?v=20261115d';

const CLAVE = 'mesa-estado-' + PARTIDA_ID;
const VERSION_FB = '10.12.2';

export const clonar = (o) => JSON.parse(JSON.stringify(o));

// Aplica actualizaciones con rutas tipo "personajes/abc/estado/pv" (null borra), igual que Firebase.
export function aplicarRutas(obj, updates) {
  for (const [ruta, valor] of Object.entries(updates)) {
    const partes = ruta.split('/');
    let o = obj;
    for (let i = 0; i < partes.length - 1; i++) {
      if (typeof o[partes[i]] !== 'object' || o[partes[i]] === null) o[partes[i]] = {};
      o = o[partes[i]];
    }
    const k = partes[partes.length - 1];
    if (valor === null || valor === undefined) delete o[k];
    else o[k] = typeof valor === 'object' ? clonar(valor) : valor;
  }
  return obj;
}

// Firebase no acepta . # $ [ ] / en las claves
export const claveSegura = (t) => String(t).replace(/[.#$\[\]\/]/g, '').trim().slice(0, 80) || 'x';

// Completa lo que Firebase no guarda (objetos vacíos) para que la app siempre encuentre la estructura
function completar(e) {
  const base = clonar(ESTADO_VACIO);
  const r = { ...base, ...(e || {}) };
  for (const k of Object.keys(base)) if (typeof base[k] === 'object' && !Array.isArray(base[k])) r[k] = { ...base[k], ...((e || {})[k] || {}) };
  return r;
}

// Limpia los datos que dejaron versiones anteriores de la app en este navegador
try { for (const k of Object.keys(localStorage)) if (k.startsWith('mf-')) localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ }

class Base {
  constructor() { this.oyentes = new Set(); this.estado = completar(); }
  on(fn) { this.oyentes.add(fn); return () => this.oyentes.delete(fn); }
  emitir() { for (const fn of this.oyentes) fn(this.estado); }
}

class SyncLocal extends Base {
  constructor() {
    super();
    this.modo = 'demo';
    this.conectado = true;
    try {
      const g = localStorage.getItem(CLAVE);
      const guardado = g && JSON.parse(g);
      if (guardado && guardado.version === VERSION) this.estado = completar(guardado);
    } catch (e) { /* sin almacenamiento */ }
    try {
      this.canal = new BroadcastChannel(CLAVE);
      this.canal.onmessage = (e) => { this.estado = completar(e.data); this.emitir(); };
    } catch (e) {
      window.addEventListener('storage', (e) => {
        if (e.key === CLAVE && e.newValue) { this.estado = completar(JSON.parse(e.newValue)); this.emitir(); }
      });
    }
  }
  async iniciar() { this.emitir(); }
  publicar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(this.estado)); this.sinEspacio = false; } catch (e) { this.sinEspacio = true; }
    try { this.canal && this.canal.postMessage(this.estado); } catch (e) { /* nada */ }
    this.emitir();
  }
  async escribir(updates) {
    aplicarRutas(this.estado, { ...updates, actualizado: Date.now() });
    this.publicar();
  }
  async reiniciar() { this.estado = completar({ ...clonar(ESTADO_VACIO), actualizado: Date.now() }); this.publicar(); }
}

class SyncFirebase extends Base {
  constructor() { super(); this.modo = 'vivo'; this.conectado = false; }
  async iniciar() {
    const base = `https://www.gstatic.com/firebasejs/${VERSION_FB}/`;
    const appMod = await import(base + 'firebase-app.js');
    const db = await import(base + 'firebase-database.js');
    this.db = db;
    const app = appMod.initializeApp(FIREBASE_CONFIG);
    this.base = db.getDatabase(app);
    this.raiz = db.ref(this.base, 'partidas/' + PARTIDA_ID);
    const inicial = await db.get(this.raiz);
    if (!inicial.exists()) await db.set(this.raiz, { ...ESTADO_VACIO, actualizado: Date.now() });
    db.onValue(this.raiz, (s) => { this.estado = completar(s.val()); this.emitir(); });
    db.onValue(db.ref(this.base, '.info/connected'), (s) => { this.conectado = !!s.val(); this.emitir(); });
  }
  async escribir(updates) {
    const u = { ...updates, actualizado: Date.now() };
    aplicarRutas(this.estado, clonar(u)); // se ve al instante; Firebase confirma después
    this.emitir();
    await this.db.update(this.raiz, u);
  }
  async reiniciar() { await this.db.set(this.raiz, { ...ESTADO_VACIO, actualizado: Date.now() }); }
}

export async function crearSync() {
  if (FIREBASE_CONFIG) {
    const s = new SyncFirebase();
    try { await s.iniciar(); return s; }
    catch (e) {
      console.error('No se pudo conectar con Firebase', e);
      const l = new SyncLocal();
      l.error = /permission/i.test(String(e && e.message)) ? 'Firebase rechazó la conexión: revisa las reglas de la base de datos. Se usa el modo de demostración.' : 'No se pudo conectar con Firebase. Se usa el modo de demostración.';
      await l.iniciar(); return l;
    }
  }
  const l = new SyncLocal();
  await l.iniciar();
  return l;
}
