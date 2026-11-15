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

// Ambiente de la escena. Las reglas son recordatorios de 5e (2014) que se muestran en la mesa.
export const MOMENTOS = {
  amanecer: { nombre: 'Amanecer', icono: 'sol-bajo' },
  manana: { nombre: 'Mañana', icono: 'sol' },
  mediodia: { nombre: 'Mediodía', icono: 'sol' },
  tarde: { nombre: 'Tarde', icono: 'sol' },
  atardecer: { nombre: 'Atardecer', icono: 'sol-bajo' },
  noche: { nombre: 'Noche', icono: 'luna' },
  medianoche: { nombre: 'Medianoche', icono: 'luna' }
};
export const LUCES = {
  brillante: { nombre: 'Luz brillante', regla: 'Se ve con normalidad.' },
  tenue: { nombre: 'Luz tenue', regla: 'Zona ligeramente oscurecida: desventaja en Percepción basada en la vista.' },
  oscuridad: { nombre: 'Oscuridad', regla: 'Zona muy oscurecida: en la práctica, cegado. Con visión en la oscuridad se ve como en luz tenue, sin colores.' },
  magica: { nombre: 'Oscuridad mágica', regla: 'Ni la visión en la oscuridad permite ver a través de ella.' }
};
export const CLIMAS = {
  despejado: { nombre: 'Despejado', icono: 'sol', regla: '' },
  nublado: { nombre: 'Nublado', icono: 'nube', regla: '' },
  niebla: { nombre: 'Niebla', icono: 'niebla', regla: 'Zona ligera o muy oscurecida, según lo espesa que sea.' },
  lluvia: { nombre: 'Lluvia ligera', icono: 'lluvia', regla: '' },
  lluviaFuerte: { nombre: 'Lluvia intensa', icono: 'lluvia', regla: 'Ligeramente oscurecido. Desventaja en Percepción por vista y oído. Apaga las llamas al aire libre.' },
  viento: { nombre: 'Viento fuerte', icono: 'viento', regla: 'Desventaja en ataques a distancia con armas y en Percepción por oído. Apaga las llamas al aire libre y dispersa la niebla.' },
  tormenta: { nombre: 'Tormenta', icono: 'rayo', regla: 'Lluvia intensa y viento fuerte: ligeramente oscurecido, desventaja en Percepción y en ataques a distancia con armas.' },
  nieve: { nombre: 'Nevada intensa', icono: 'nieve', regla: 'Ligeramente oscurecido. Desventaja en Percepción basada en la vista.' }
};
export const TEMPERATURAS = {
  templado: { nombre: 'Templado', regla: '' },
  calor: { nombre: 'Calor extremo', regla: 'Sin agua, cada hora salvación de Constitución (CD 5 +1 por hora) o un nivel de agotamiento. Armadura media o pesada: desventaja.' },
  frio: { nombre: 'Frío extremo', regla: 'Cada hora, salvación de Constitución CD 10 o un nivel de agotamiento, salvo ropa de abrigo o resistencia al frío.' }
};

// Campaña vacía
export const ESTADO_VACIO = {
  version: VERSION,
  actualizado: 0,
  campana: { nombre: 'Mi campaña', capitulo: '', pinDM: '' },
  escena: { lugar: '', alerta: '', texto: '', mapa: '', ilustracion: '' },
  grupos: {},
  ambiente: { dia: 1, momento: 'manana', luz: 'brillante', clima: 'despejado', temperatura: 'templado', sensacion: '' },
  combate: { activo: false, ronda: 0, turno: '', participantes: {} },
  relojes: {},
  personajes: {},
  presencias: {},
  imagenes: {},
  enciclopedia: {},
  pistas: {},
  fichas: {}
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
