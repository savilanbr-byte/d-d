// Sincronización del estado compartido.
// Modo demostración: localStorage + BroadcastChannel (pestañas del mismo dispositivo).
// Modo en vivo: Firebase Realtime Database (todos los dispositivos).
import { ESTADO_INICIAL } from './datos.js';
import { FIREBASE_CONFIG, PARTIDA_ID } from '../config.js';

const CLAVE = 'mf-estado-' + PARTIDA_ID;
const VERSION_FB = '10.12.2';

export const clonar = (o) => JSON.parse(JSON.stringify(o));

// Aplica actualizaciones con rutas tipo "personajes/cayo/pv" (null borra), igual que Firebase.
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

// Vuelve a la partida guardada, pero conserva las imágenes subidas desde la Biblioteca
function reinicio(actual) {
  const nuevo = clonar(ESTADO_INICIAL);
  for (const [k, i] of Object.entries((actual && actual.imagenes) || {})) if (!i.base) nuevo.imagenes[k] = i;
  nuevo.actualizado = Date.now();
  return nuevo;
}

class Base {
  constructor() { this.oyentes = new Set(); this.estado = clonar(ESTADO_INICIAL); }
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
      // Si cambió la versión de los datos iniciales, se empieza de nuevo
      if (guardado && guardado.version === ESTADO_INICIAL.version) this.estado = guardado;
    } catch (e) { /* sin almacenamiento */ }
    try {
      this.canal = new BroadcastChannel(CLAVE);
      this.canal.onmessage = (e) => { this.estado = e.data; this.emitir(); };
    } catch (e) {
      window.addEventListener('storage', (e) => {
        if (e.key === CLAVE && e.newValue) { this.estado = JSON.parse(e.newValue); this.emitir(); }
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
  async reiniciar() { this.estado = reinicio(this.estado); this.publicar(); }
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
    if (!inicial.exists()) await db.set(this.raiz, ESTADO_INICIAL);
    db.onValue(this.raiz, (s) => { this.estado = s.val() || clonar(ESTADO_INICIAL); this.emitir(); });
    db.onValue(db.ref(this.base, '.info/connected'), (s) => { this.conectado = !!s.val(); this.emitir(); });
  }
  async escribir(updates) {
    const u = { ...updates, actualizado: Date.now() };
    aplicarRutas(this.estado, clonar(u)); // se ve al instante; Firebase confirma después
    this.emitir();
    await this.db.update(this.raiz, u);
  }
  async reiniciar() { await this.db.set(this.raiz, reinicio(this.estado)); }
}

export async function crearSync() {
  if (FIREBASE_CONFIG) {
    const s = new SyncFirebase();
    try { await s.iniciar(); return s; }
    catch (e) { console.error('No se pudo conectar con Firebase', e); const l = new SyncLocal(); l.error = 'No se pudo conectar con Firebase. Se usa el modo de demostración.'; await l.iniciar(); return l; }
  }
  const l = new SyncLocal();
  await l.iniciar();
  return l;
}
