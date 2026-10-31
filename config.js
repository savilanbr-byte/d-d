// Configuración de la conexión en vivo.
// Mientras FIREBASE_CONFIG sea null, la app funciona en modo de demostración:
// guarda la partida en este navegador y sincroniza solo las pestañas de este dispositivo.
// Proyecto de Firebase: mundo-fracturado (Realtime Database).

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB70rHXb3y-VSSKpY7jsUk6KWjYC4PEud0',
  authDomain: 'mundo-fracturado.firebaseapp.com',
  databaseURL: 'https://mundo-fracturado-default-rtdb.firebaseio.com',
  projectId: 'mundo-fracturado',
  storageBucket: 'mundo-fracturado.firebasestorage.app',
  messagingSenderId: '946978729367',
  appId: '1:946978729367:web:94d747caab84e2361328d2'
};

// Nombre de la partida dentro de la base de datos. Cambiarlo crea una partida nueva desde cero.
export const PARTIDA_ID = 'mundo-fracturado';
