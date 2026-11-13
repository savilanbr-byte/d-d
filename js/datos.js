// Datos base de la Mesa del DM.
// Todo lo de la campaña (personajes, escena, imágenes, historia) vive en el estado compartido;
// aquí solo están las listas fijas y la campaña vacía con la que se empieza.

// Si cambia, los navegadores en modo de demostración empiezan de nuevo
export const VERSION = 1;

export const ATRIBUTOS = ['FUE', 'DES', 'CON', 'INT', 'SAB', 'CAR'];
export const NOMBRE_ATRIBUTO = { FUE: 'Fuerza', DES: 'Destreza', CON: 'Constitución', INT: 'Inteligencia', SAB: 'Sabiduría', CAR: 'Carisma' };

// Colores para distinguir a cada personaje en el mapa y en la mesa
export const COLORES = ['#7dbb57', '#e0605a', '#a87ce0', '#5aa8e0', '#e8873f', '#d9b64a', '#4fc1b5', '#e07ab8'];

export const CATEGORIAS = {
  mundo: { nombre: 'El mundo', singular: 'Tema del mundo' },
  pnj: { nombre: 'Personajes no jugadores', singular: 'Personaje no jugador' },
  lugares: { nombre: 'Lugares', singular: 'Lugar' },
  objetos: { nombre: 'Objetos', singular: 'Objeto' },
  inscripciones: { nombre: 'Inscripciones', singular: 'Inscripción' },
  misterios: { nombre: 'Misterios', singular: 'Misterio' }
};

export const TIPOS_PRESENCIA = { enemigo: 'Enemigo', neutral: 'Neutral', aliado: 'Aliado' };

// Campaña vacía
export const ESTADO_VACIO = {
  version: VERSION,
  actualizado: 0,
  campana: { nombre: 'Mi campaña', capitulo: '', pinDM: '' },
  escena: { lugar: '', alerta: '', texto: '', mapa: '', ilustracion: '' },
  narracion: { texto: '', ts: 0 },
  personajes: {},
  presencias: {},
  imagenes: {},
  enciclopedia: {},
  pistas: {},
  fichas: {},
  bitacora: {}
};

// Ficha nueva para el creador de personajes
export function fichaVacia(color) {
  return {
    nombre: '', epiteto: '', raza: '', clase: '', nivel: 1, edad: '', origen: '',
    color: color || COLORES[0], pin: '', retrato: '',
    pvMax: 10, ca: 10, caNota: '', velocidad: '9 m', iniciativa: '+0', competencia: '+2',
    cd: '', ataqueConjuro: '',
    atributos: { FUE: 10, DES: 10, CON: 10, INT: 10, SAB: 10, CAR: 10 },
    espacios: {},
    salvaciones: [], habilidades: [], ataques: [], trucos: [], conjuros: [], rasgos: [], recursos: [], equipo: [],
    personalidad: '', objetivo: '', cita: '',
    orden: Date.now()
  };
}
