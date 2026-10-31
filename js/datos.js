// Datos de El Mundo Fracturado.
// FICHAS: lo que no cambia en la partida (atributos, rasgos, conjuros...).
// ESTADO_INICIAL: lo que sí cambia y se comparte entre dispositivos.
// Partida guardada del 31 de octubre de 2026 (Capítulo 1).

export const PINES = {
  klastan: '4817',
  laila: '2950',
  victoria: '7362',
  larry: '1584',
  cayo: '6203',
  narrador: '9046'
};

export const ORDEN = ['klastan', 'laila', 'victoria', 'larry', 'cayo'];

export const FICHAS = {
  klastan: {
    nombre: 'Klastan', epiteto: 'El sabio ancestral', alias: ['clastan', 'clarkson'],
    raza: 'Elfo', clase: 'Druida', nivel: 1, edad: '297 años', estatura: '1,80 m',
    origen: 'Bosque ancestral', alineamiento: 'Por definir',
    personalidad: 'Sabio, tranquilo, protector de la naturaleza.',
    objetivo: 'Preservar el equilibrio de la naturaleza.',
    cita: 'La naturaleza siempre recuerda lo que los mortales intentan olvidar.',
    color: '#7dbb57',
    pvMax: 7, ca: 15, caNota: 'cuero + escudo', velocidad: '9 m', iniciativa: '+1',
    cd: 12, ataqueConjuro: '+4', esp1Max: 2,
    atributos: { FUE: 10, DES: 12, CON: 8, INT: 15, SAB: 14, CAR: 13 },
    salvaciones: [['Inteligencia', '+4'], ['Sabiduría', '+4']],
    habilidades: [['Supervivencia', '+4'], ['Naturaleza', '+4'], ['Percepción', '+4'], ['Medicina', '+4'], ['Persuasión', '+3'], ['Trato con animales', '+4']],
    ataques: [
      ['Bastón de madera ancestral', '+2', '1d6 contundente (1d8 a dos manos)'],
      ['Producir llama (truco)', '+4', '1d8 fuego, alcance 9 m']
    ],
    trucos: [['Druidismo', 'Pequeños efectos naturales.'], ['Producir llama', 'Creas una llama que puedes lanzar contra enemigos.']],
    conjuros1: [
      ['Curar heridas', 'Recupera 1d8 + 2 PV al tocar.'],
      ['Enmarañar', 'Las plantas atrapan a los enemigos. Concentración.'],
      ['Nube de niebla', 'Nube que dificulta la visión. Concentración.'],
      ['Onda atronadora', 'Explosión sonora que daña y empuja.']
    ],
    rasgos: [
      ['Visión en la oscuridad', 'Ves hasta 18 metros en la oscuridad.'],
      ['Trance élfico', 'Descansas meditando.'],
      ['Lengua druídica', 'Conoces el lenguaje secreto de los druidas.'],
      ['Magia druídica', 'Usas la energía de la naturaleza para lanzar conjuros.'],
      ['Preparación de conjuros', 'Cada día puedes preparar nuevos conjuros.']
    ],
    recursos: {},
    equipo: ['Bastón de madera ancestral', 'Armadura de cuero', 'Escudo de madera', 'Foco druídico', 'Mochila de explorador']
  },

  laila: {
    nombre: 'Laila', epiteto: 'La guerrera de las realidades rotas', alias: ['layla', 'leila'],
    raza: 'Mutada', clase: 'Guerrera', nivel: 1, edad: '428 años', estatura: '1,70 m',
    origen: 'Realidades fracturadas, producto del Choque de Mundos',
    personalidad: 'Segura de sí misma, coqueta, valiente y directa. Siempre protege a quienes considera suyos.',
    objetivo: 'Encontrar su lugar en un mundo que no la entiende y usar su fuerza para marcar su propio destino.',
    cita: 'No soy un error de este mundo. Soy la prueba de que incluso la fractura puede crear algo hermoso.',
    color: '#e0605a',
    pvMax: 12, ca: 16, caNota: 'cota de malla', velocidad: '9 m', iniciativa: '+1',
    cd: null, ataqueConjuro: null, esp1Max: 0,
    atributos: { FUE: 15, DES: 13, CON: 14, INT: 12, SAB: 10, CAR: 8 },
    salvaciones: [['Fuerza', '+4'], ['Constitución', '+4']],
    habilidades: [['Atletismo', '+4'], ['Acrobacias', '+3'], ['Intimidación', '+3'], ['Persuasión', '+1'], ['Investigación', '+1'], ['Percepción', '+0'], ['Supervivencia', '+0'], ['Trato con animales', '+0']],
    ataques: [
      ['Espadón dimensional', '+4', '2d6 + 2 cortante (a dos manos)'],
      ['Hacha de mano (×2)', '+4', '1d6 + 2 cortante, puedes usar las dos']
    ],
    trucos: [], conjuros1: [],
    rasgos: [
      ['Estilo de combate: armas a dos manos', 'Si sacas 1 o 2 en un dado de daño de tu arma a dos manos, puedes volver a tirarlo.'],
      ['Adaptación dimensional', 'Tu cuerpo se adapta parcialmente a distintos entornos.'],
      ['Resiliencia mutada', 'Mayor resistencia física y mental.'],
      ['Reflejos alterados', 'Reaccionas rápido a los cambios del entorno.'],
      ['Encanto peligroso', 'Usas tu presencia para distraer, provocar o manipular. Tirada de Persuasión, Engaño o Interpretación.'],
      ['Mutación dimensional (elige una)', 'Fuerza alterada: ventaja en una prueba de Fuerza. Reflejos dimensionales: +3 m de velocidad un turno. Piel cristalizada: +2 a la CA hasta tu siguiente turno.']
    ],
    recursos: {
      segundoAliento: { nombre: 'Segundo aliento', max: 1, recarga: 'corto', detalle: 'Recuperas 1d10 + 1 PV.' },
      mutacion: { nombre: 'Mutación dimensional', max: 1, recarga: 'largo', detalle: 'Fuerza alterada, Reflejos dimensionales o Piel cristalizada.' }
    },
    equipo: ['Espadón dimensional', 'Dos hachas de mano', 'Cota de malla', 'Mochila de explorador', 'Cuerda y antorchas']
  },

  victoria: {
    nombre: 'Victoria', epiteto: 'La sombra de Protógonos', alias: ['vicky'],
    raza: 'Astralina', clase: 'Pícara', nivel: 1, edad: '596 años', estatura: '1,68 m',
    origen: 'Protógonos (mundo de mujeres)',
    personalidad: 'Misteriosa, agradable, ensimismada e imponente.',
    objetivo: 'Venganza.',
    cita: 'Protógonos me enseñó que el poder también puede ser un refugio.',
    color: '#a87ce0',
    pvMax: 9, ca: 13, caNota: 'cuero', velocidad: '9 m', iniciativa: '+2',
    cd: null, ataqueConjuro: null, esp1Max: 0,
    atributos: { FUE: 8, DES: 15, CON: 13, INT: 12, SAB: 14, CAR: 13 },
    salvaciones: [['Destreza', '+4'], ['Inteligencia', '+3']],
    habilidades: [['Sigilo', '+6'], ['Percepción', '+6'], ['Acrobacias', '+4'], ['Engaño', '+3'], ['Persuasión', '+3'], ['Investigación', '+3'], ['Perspicacia', '+2']],
    ataques: [
      ['Estoque astral', '+4', '1d8 + 2 perforante'],
      ['Daga', '+4', '1d4 + 2 perforante, alcance 6/18 m'],
      ['Arco corto', '+4', '1d6 + 2 perforante']
    ],
    trucos: [], conjuros1: [],
    rasgos: [
      ['Ataque furtivo', '+1d6 de daño una vez por turno si tienes ventaja o un aliado junto al objetivo.'],
      ['Pericia', 'Dominio experto en dos habilidades.'],
      ['Acción astuta', 'Destrabarte, Ocultarte o Correr como acción adicional. Regla de la casa: disponible desde nivel 1.'],
      ['Herramientas de ladrón', 'Experta en infiltración, trampas y engaños.'],
      ['Visión en la oscuridad', 'Ves hasta 18 metros en la oscuridad.'],
      ['Sensibilidad dimensional', 'Percibes alteraciones en la energía de las dimensiones.']
    ],
    recursos: {
      saltoAstral: { nombre: 'Salto astral', max: 1, recarga: 'largo', detalle: 'Te teletransportas hasta 6 m a un lugar que puedas ver.' },
      ecoMemoria: { nombre: 'Eco de la memoria', max: 1, recarga: 'largo', detalle: 'Con contacto visual, intentas acceder a un recuerdo importante de una criatura.' },
      flechas: { nombre: 'Flechas', max: 20, recarga: 'ninguna', cantidad: true }
    },
    equipo: ['Estoque astral', 'Daga', 'Arco corto', 'Armadura de cuero', 'Herramientas de ladrón', 'Mochila de ladrón']
  },

  larry: {
    nombre: 'Larry', epiteto: 'El bardo de la Singularidad', alias: ['lari'],
    raza: 'Forjado', clase: 'Bardo', nivel: 1, edad: 'Desconocida', estatura: '1,70 m',
    origen: 'Ruinas de Karath Inu',
    personalidad: 'Serio, reservado, con muy buen sentido del humor y poco hablador.',
    objetivo: 'Unirse con la Singularidad.',
    cita: 'Todo sonido es un mensaje. Solo hay que aprender a escucharlo.',
    color: '#5aa8e0',
    pvMax: 8, ca: 13, caNota: 'cuero', velocidad: '9 m', iniciativa: '+1',
    cd: 12, ataqueConjuro: '+4', esp1Max: 2,
    atributos: { FUE: 8, DES: 12, CON: 10, INT: 15, SAB: 13, CAR: 14 },
    salvaciones: [['Destreza', '+3'], ['Carisma', '+4']],
    habilidades: [['Interpretación', '+4'], ['Persuasión', '+4'], ['Investigación', '+4'], ['Arcanos', '+4'], ['Historia', '+4'], ['Percepción', '+3'], ['Juego de manos', '+3'], ['Sigilo', '+3']],
    ataques: [
      ['Estoque mecánico', '+3', '1d8 + 1 perforante'],
      ['Daga', '+3', '1d4 + 1 perforante, alcance 6/18 m'],
      ['Burla cruel (truco)', 'Sab CD 12', '1d4 psíquico y desventaja en su siguiente ataque']
    ],
    trucos: [['Burla cruel', 'Daño psíquico y desventaja en el siguiente ataque del enemigo.'], ['Ilusión menor', 'Creas un sonido o una imagen ilusoria pequeña.']],
    conjuros1: [
      ['Palabra curativa', 'Un aliado a distancia recupera 1d4 + 2 PV. Acción adicional.'],
      ['Disfrazarse', 'Modificas tu apariencia.'],
      ['Onda atronadora', 'Daño sonoro que puede empujar.'],
      ['Fuego feérico', 'Iluminas criaturas y objetos: los ataques contra ellos tienen ventaja. Concentración.']
    ],
    rasgos: [
      ['Naturaleza artificial', 'No necesitas comer, beber ni respirar.'],
      ['Descanso de centinela', 'Permaneces consciente e inmóvil durante tu descanso largo.'],
      ['Resistencia constructo', 'Ventaja contra veneno y no puedes ser envenenado.'],
      ['Lanzamiento de conjuros', 'Usas el Carisma para tu magia.'],
      ['Conocimientos amplios', 'Competencia en más habilidades que la mayoría de clases.']
    ],
    recursos: {
      inspiracion: { nombre: 'Inspiración bárdica (d6)', max: 2, recarga: 'largo', detalle: 'Das un d6 a un aliado para una tirada de ataque, habilidad o salvación.' }
    },
    equipo: ['Estoque mecánico', 'Daga', 'Armadura de cuero', 'Instrumento musical mecánico integrado', 'Mochila de artista']
  },

  cayo: {
    nombre: 'Kayho', epiteto: 'Paladín sagrado tiefling', alias: ['cayo', 'caio', 'kayo', 'kaio', 'kaiho'],
    raza: 'Tiefling (alado)', clase: 'Paladín', nivel: 1, edad: '383 años (≈ 30 humanos)', estatura: '1,70 m',
    origen: 'Bosque antiguo y oculto del Choque de Mundos',
    personalidad: 'Amable, misterioso y solitario.',
    objetivo: 'Encontrar el equilibrio entre su naturaleza tiefling y los poderes sagrados.',
    cita: 'La luz y la oscuridad no son enemigas. Son parte del mismo equilibrio.',
    color: '#e8873f',
    pvMax: 12, ca: 18, caNota: 'cota de malla + escudo', velocidad: '9 m', iniciativa: '+1',
    cd: null, ataqueConjuro: null, esp1Max: 0,
    atributos: { FUE: 14, DES: 13, CON: 15, INT: 12, SAB: 8, CAR: 10 },
    salvaciones: [['Sabiduría', '+1'], ['Carisma', '+2']],
    habilidades: [['Atletismo', '+4'], ['Religión', '+3'], ['Historia', '+3'], ['Intimidación', '+2'], ['Perspicacia', '+1'], ['Medicina', '+1'], ['Supervivencia', '+1'], ['Persuasión', '+0']],
    ataques: [
      ['Espada larga sagrada', '+4', '1d8 + 2 cortante'],
      ['Jabalina', '+4', '1d6 + 2 perforante, alcance 9/36 m']
    ],
    trucos: [['Taumaturgia', 'Pequeños efectos sobrenaturales (Legado infernal).']],
    conjuros1: [],
    bloqueados: [
      ['Curar heridas', 'Recupera 1d8 PV al tocar.'],
      ['Favor divino', 'Tu arma causa 1d4 radiante adicional.'],
      ['Escudo de fe', 'Un aliado obtiene +2 a la CA durante 10 minutos.'],
      ['Castigo divino', 'Gastas un espacio para sumar daño radiante a un golpe.'],
      ['Llama sagrada (truco)', 'Con el estilo Guerrero bendito. Una llama radiante cae sobre un objetivo: salvación de Destreza CD 10 o 1d8 radiante.'],
      ['Luz (truco)', 'Con el estilo Guerrero bendito. Un objeto brilla como una antorcha durante una hora.']
    ],
    bloqueadosNota: 'En 5e (2014) el paladín no tiene trucos: en nivel 1 Kayho solo conoce Taumaturgia, por ser tiefling. En nivel 2 recibe conjuros, Castigo divino y un estilo de combate. Si elige el estilo opcional Guerrero bendito (Tasha), aprende dos trucos de clérigo; Llama sagrada y Luz encajan con su ficha.',
    rasgos: [
      ['Resistencia infernal', 'Recibes la mitad del daño de fuego.'],
      ['Visión en la oscuridad', 'Ves hasta 18 metros, sin distinguir colores.'],
      ['Legado infernal', 'Conoces el truco Taumaturgia.'],
      ['Entrenamiento de combate', 'Usas armaduras pesadas, escudos y muchas armas.']
    ],
    recursos: {
      imposicion: { nombre: 'Imposición de manos (PV)', max: 5, recarga: 'largo', cantidad: true, detalle: 'Reparte hasta 5 PV de curación al tocar.' },
      sentidoDivino: { nombre: 'Sentido divino', max: 1, recarga: 'largo', detalle: 'Detectas presencias celestiales, infernales y no muertas.' },
      jabalinas: { nombre: 'Jabalinas', max: 5, recarga: 'ninguna', cantidad: true }
    },
    equipo: ['Espada larga sagrada', 'Escudo', 'Cota de malla', 'Símbolo sagrado', 'Mochila de sacerdote']
  }
};

export const GUARDIANES = {
  espada: 'Guardián de la espada',
  martillo: 'Guardián del martillo',
  lanza: 'Guardián de la lanza'
};

// Textos fijos que no se editan desde la app
export const HISTORIA = {
  guardianes: 'Los tres guardianes son constructos mágicos y sus cristales azules parecen alimentarlos. Su creador no ha sido revelado: cuando Klastan preguntó, respondieron que era información restringida.',
  progresion: {
    texto: 'Los cinco están en nivel 1. No hay experiencia registrada. Propuesta de ChatGPT, por confirmar en la mesa: subir por hitos de la historia y llegar a nivel 2 al resolver la crisis de la Cámara de las Cinco Vidas, sea con combate, negociación, magia u otra solución.',
    nivel2: {
      klastan: 'Círculo druídico y Forma salvaje.',
      laila: 'Oleada de acción: una acción extra una vez por descanso.',
      victoria: 'Acción astuta (ya la tiene como regla de la casa).',
      larry: 'Aprendiz de todo y Canción de descanso.',
      cayo: 'Estilo de combate, conjuros de paladín y Castigo divino.'
    }
  }
};

// Categorías de la enciclopedia, en el orden en que se muestran
export const CATEGORIAS = {
  mundo: { nombre: 'El mundo', singular: 'Tema del mundo' },
  pnj: { nombre: 'Personajes no jugadores', singular: 'Personaje no jugador' },
  lugares: { nombre: 'Lugares', singular: 'Lugar' },
  objetos: { nombre: 'Objetos', singular: 'Objeto' },
  inscripciones: { nombre: 'Inscripciones', singular: 'Inscripción' },
  misterios: { nombre: 'Misterios', singular: 'Misterio' }
};

// Imágenes que vienen con la app. Las que suban desde la Biblioteca se guardan en el estado compartido.
const img = (nombre, tipo, src, visible = true) => ({ nombre, tipo, src, visible, base: true });
const IMAGENES = {
  camara: img('Cámara de las Cinco Vidas', 'mapa', 'img/mapa-camara-limpio.jpg'),
  camaraIlustrada: img('Cámara (mapa ilustrado)', 'mapa', 'img/mapa-camara.jpg'),
  bosque: img('Bosque de Karath Inu', 'mapa', 'img/mapa-bosque.jpg'),
  eva: img('Eva', 'retrato', 'img/pnj-eva.jpg'),
  enmascarada: img('La mujer enmascarada', 'retrato', 'img/pnj-enmascarada.jpg'),
  espada: img('Guardián de la espada', 'retrato', 'img/pnj-espada.jpg'),
  martillo: img('Guardián del martillo', 'retrato', 'img/pnj-martillo.jpg'),
  lanza: img('Guardián de la lanza', 'retrato', 'img/pnj-lanza.jpg'),
  sombra: img('La sombra del bosque', 'retrato', 'img/pnj-sombra.jpg'),
  espectral: img('La mujer espectral de blanco', 'retrato', 'img/pnj-espectral.jpg', false),
  iluFractura: img('La Fractura', 'ilustracion', 'img/ilu-fractura.jpg'),
  iluBosque: img('El bosque de Karath Inu', 'ilustracion', 'img/ilu-bosque.jpg'),
  iluRuinas: img('Las ruinas de Karath Inu', 'ilustracion', 'img/ilu-ruinas.jpg'),
  iluEstatua: img('La estatua de los cinco glifos', 'ilustracion', 'img/ilu-estatua.jpg'),
  iluCamara: img('La Cámara de las Cinco Vidas', 'ilustracion', 'img/ilu-camara.jpg'),
  objCorazon: img('El Corazón de Karath Inu', 'ilustracion', 'img/obj-corazon.jpg'),
  objSemilla: img('La semilla plateada', 'ilustracion', 'img/obj-semilla.jpg'),
  objLibro: img('El libro de Eva', 'ilustracion', 'img/obj-libro.jpg'),
  objCarta: img('Una carta negra', 'ilustracion', 'img/obj-carta.jpg'),
  objMedallon: img('El medallón de Laila', 'ilustracion', 'img/obj-medallon.jpg', false),
  iluSeisNombres: img('Los Seis Nombres', 'ilustracion', 'img/ilu-seis-nombres.jpg', false)
};

// Enciclopedia inicial (fuente: ChatGPT, 31 oct 2026). Solo lo que el grupo descubrió.
// Campos: titulo, sub, texto, tipo (hecho | dicho | misterio), visto [], dicho [], misterio, img, oculto, orden
let n = 0;
const e = (o) => ({ sub: '', texto: '', visto: [], dicho: [], misterio: '', img: '', oculto: false, orden: ++n, ...o });
const ENCICLOPEDIA = {
  mundo: {
    fractura: e({ titulo: 'La Fractura', tipo: 'hecho', img: 'iluFractura', texto: 'Hace unos 300 años algo transformó el mundo. Desde entonces la realidad tiene anomalías: lugares que no deberían coexistir, recuerdos contradictorios y seres de otros mundos o épocas. El grupo sabe que está relacionada con las ruinas de Karath Inu, el cristal negro y quizá con ellos cinco. No saben qué la provocó.', dicho: ['«La Fractura no fue un accidente».'] }),
    choque: e({ titulo: 'El Choque de Mundos', tipo: 'hecho', texto: 'La colisión de dimensiones y líneas temporales asociada a la Fractura. Fragmentos de realidades distintas quedaron mezclados en un mismo mundo: por eso los cinco tienen orígenes tan diferentes y algunos seres parecen reconocerlos de hace siglos. No se sabe quién lo desencadenó ni si puede revertirse.' }),
    karath: e({ titulo: 'Karath Inu', tipo: 'hecho', texto: 'El bosque antiguo, las ruinas y la cámara subterránea que el grupo explora. Hay una estatua con cinco glifos, una entrada oculta y una construcción que parece guardar recuerdos de hace 300 años. Bajo las ruinas está la Cámara de las Cinco Vidas, donde flota el Corazón de Karath Inu.' }),
    protogonos: e({ titulo: 'Protógonos', tipo: 'hecho', texto: 'El mundo de origen de Victoria, habitado solo por mujeres. Dejó de existir.', dicho: ['La sombra del bosque dijo que Victoria es una «anomalía»: su mundo terminó, no debería existir en esta línea temporal y alguien la trajo hasta aquí.'] }),
    singularidad: e({ titulo: 'La Singularidad', tipo: 'misterio', texto: 'Está ligada al pasado de Larry, pero el grupo todavía no sabe qué es.' })
  },
  pnj: {
    eva: e({ titulo: 'Eva', sub: 'Niña de ojos plateados', img: 'eva', texto: 'Aparenta unos diez años. Ojos plateados, túnica gris y un libro antiguo. Estaba escondida detrás de una estatua de la cámara.',
      visto: ['Conoce los nombres de los cinco y parece reconocerlos.', 'Teme a la mujer enmascarada y pidió que no la entregaran.', 'Le dio su libro a Victoria por voluntad propia.'],
      dicho: ['Tenía diez años cuando ocurrió la Fractura y para ella casi no ha pasado el tiempo.', 'No destruyan el cristal; golpear las raíces empeora las cosas.', 'La sexta persona del libro tiene que ver con una traición.', 'A Larry: «Tú me prometiste que volverías».'],
      misterio: 'Su verdadera naturaleza, cómo sobrevivió tanto tiempo, qué recuerda y si dice la verdad.' }),
    enmascarada: e({ titulo: 'La mujer enmascarada', sub: 'Aparece en el cristal', img: 'enmascarada', texto: 'Figura femenina de ropa oscura y máscara, que se manifiesta a través del cristal de la cámara.',
      visto: ['Se sorprendió al saber que Eva estaba ahí y quiso saber dónde se escondía.', 'Laila vio por un instante que bajo la máscara había un rostro idéntico al suyo. Eso no prueba que sean la misma persona.'],
      dicho: ['Los cinco tardaron 300 años en volver.', 'Uno de ellos la mató.', 'La semilla es peligrosa.'],
      misterio: 'Su identidad, sus intenciones y si se le puede creer.' }),
    espada: e({ titulo: 'Guardián de la espada', sub: 'Constructo guardián', img: 'espada', texto: 'Constructo humanoide de piedra y metal, con armadura pesada, espada y un cristal azul en el pecho.',
      visto: ['Recibió 6 de daño por una jabalina de Kayho.', 'Está inmovilizado por Enmarañar y bajo Fuego feérico.'],
      dicho: ['Llamó a Kayho «portador de la llave».', 'Su misión es proteger el Corazón de los cinco.'] }),
    martillo: e({ titulo: 'Guardián del martillo', sub: 'Constructo guardián', img: 'martillo', texto: 'Constructo grande y muy blindado, con un martillo pesado; ojos y cristal pectoral de luz azul.',
      visto: ['Golpeó una raíz y la raíz se multiplicó.', 'Reaccionó ante la semilla como si amenazara el sello.', 'Está bajo Fuego feérico.'] }),
    lanza: e({ titulo: 'Guardián de la lanza', sub: 'Constructo guardián', img: 'lanza', texto: 'Constructo de piedra y metal con una lanza larga, ojos luminosos y cristal azul en el pecho.',
      visto: ['Hirió a Kayho; Larry lo curó después.', 'Intenta contener las raíces.'] }),
    sombra: e({ titulo: 'La sombra del bosque', sub: 'Presencia sobrenatural', img: 'sombra', texto: 'Presencia oscura del bosque de Karath Inu, hecha de sombras.',
      visto: ['Sabía cosas de los cinco que ellos mismos desconocían.'],
      dicho: ['Ya habían sido convocados antes, y uno de ellos conoce la verdad aunque no la recuerda.', 'Victoria es una «anomalía»; su mundo terminó.', 'Kayho es el «portador de la llave».', 'Advirtió del peligro de «abrir la herida» de las ruinas.'],
      misterio: 'Su identidad, sus motivos y su relación con el cristal. Los guardianes dicen: «La sombra no los trajo. La sombra intentó detenerlos».' }),
    espectral: e({ titulo: 'La mujer espectral de blanco', sub: 'Aparición', img: 'espectral', oculto: true, texto: 'Aparición de una mujer vestida de blanco. Solo Laila la ha visto.',
      dicho: ['Le dio a Laila un medallón: «Para que nunca olvides quién eres».', 'Busca a «la mujer que lleva tu rostro».', 'Mencionó el «Espejo de las Primeras Vidas».'],
      misterio: 'Quién es y qué relación tiene con Laila.' })
  },
  lugares: {
    bosque: e({ titulo: 'Bosque de Karath Inu', sub: 'Explorado en parte', img: 'iluBosque', texto: 'Bosque antiguo donde fueron convocados, con río, cascadas y un puente de madera. Hay ruinas y presencias sobrenaturales.' }),
    campamento: e({ titulo: 'Campamento del bosque', sub: 'Descubierto', texto: 'Tiendas, fogata y un carro cerca de las ruinas.' }),
    ruinas: e({ titulo: 'Ruinas de Karath Inu', sub: 'Investigado', img: 'iluRuinas', texto: 'Construcción antigua con estatuas, estandartes y antorchas de fuego azul. Oculta el acceso a las profundidades.' }),
    estatua: e({ titulo: 'Estatua de los cinco glifos', sub: 'Investigado', img: 'iluEstatua', texto: 'Monumento antiguo asociado a los cinco aventureros.' }),
    umbral: e({ titulo: 'Umbral subterráneo y escalera', sub: 'Atravesado', texto: 'Entrada bajo las ruinas; se cerró cuando el grupo bajó.' }),
    camara: e({ titulo: 'Cámara de las Cinco Vidas', sub: 'Aquí están', img: 'iluCamara', texto: 'Sala circular con estatuas, columnas, antorchas azules, guardianes y el cristal, que flota encadenado sobre un abismo.' }),
    abismo: e({ titulo: 'Abismo central', sub: 'Sin explorar', texto: 'La profundidad sobre la que flota el Corazón.' }),
    puertas: e({ titulo: 'Puertas laterales', sub: 'Sin explorar', texto: 'A los lados de la cámara. No se sabe qué hay detrás.' }),
    sellada: e({ titulo: 'Escalera sellada', sub: 'Sin explorar', texto: 'Bloqueada. Se desconoce adónde lleva y cómo se abre.' })
  },
  objetos: {
    corazon: e({ titulo: 'El Corazón de Karath Inu', sub: 'Cristal negro', img: 'objCorazon', texto: 'Enorme cristal negro que flota sobre el abismo de la cámara. Los guardianes lo protegen. Destruirlo parece peligroso.' }),
    semilla: e({ titulo: 'La semilla plateada', sub: 'De Klastan', img: 'objSemilla', texto: 'Klastan la plantó en la cámara y brotó una raíz negra que se dividió en tres. Las raíces se multiplican cuando las golpean.' }),
    libro: e({ titulo: 'El libro de Eva', sub: 'Lo tiene Victoria', img: 'objLibro', texto: 'Libro antiguo con los cinco nombres y una sexta línea tachada. Eva se lo dio a Victoria.' }),
    cartas: e({ titulo: 'Las cartas negras', sub: 'Una para cada uno', img: 'objCarta', texto: 'Cartas negras imposibles, cada una con el nombre de su destinatario, que los convocaron a las ruinas del bosque. El texto de cada carta está pendiente de recuperar.' })
  },
  inscripciones: {
    glifos: e({ titulo: 'Cinco glifos', sub: 'Estatua de las ruinas del bosque', img: 'iluEstatua', texto: 'Asociados a los cinco. Sin descifrar.' }),
    noDestruyan: e({ titulo: '«NO DESTRUYAN EL CRISTAL»', sub: 'Mensaje de Eva desde su escondite', texto: 'Laila lo vio primero.' }),
    semilla: e({ titulo: '«LA SEMILLA RECUERDA LO QUE LA PIEDRA OLVIDÓ»', sub: 'Losa del suelo de la cámara', texto: 'Apareció cuando la raíz rompió el pavimento.' }),
    nombres: e({ titulo: 'KLASTAN, LAILA, VICTORIA, LARRY, KAYHO', sub: 'Libro de Eva', texto: 'Los cinco nombres en una página, y una sexta línea tachada.' }),
    creador: e({ titulo: '«CREADOR»', sub: 'Libro de Eva, bajo la tinta de la sexta figura', texto: 'Lo descubrió Victoria. No prueba la identidad de nadie.' }),
    traidor: e({ titulo: '«El creador no es necesariamente el traidor»', sub: 'Margen del libro de Eva', texto: 'Escrito con otra letra.' }),
    sextaVida: e({ titulo: '«La sexta vida decidirá»', sub: 'Libro de Eva', texto: 'Entre dibujos del cristal entero y roto.' })
  },
  misterios: Object.fromEntries(['Origen de la Fractura', 'Identidad del creador', 'El sexto nombre', 'La mujer enmascarada', 'La naturaleza de Eva', 'Los recuerdos perdidos', 'La Singularidad', 'La llave de Kayho', 'El Espejo de las Primeras Vidas', 'La puerta que no deben abrir']
    .map((t, i) => [`m${i + 1}`, e({ titulo: t, resuelto: false })]))
};

const ahora = Date.parse('2026-10-31T10:00:00-05:00');

export const ESTADO_INICIAL = {
  version: 3,
  actualizado: ahora,
  escena: {
    capitulo: 'Capítulo 1 · Los cinco nombres de la Fractura',
    lugar: 'Cámara de las Cinco Vidas',
    mapa: 'camara',
    alerta: 'Las tres raíces negras están a 2 metros del Corazón',
    texto: 'Los guardianes no atacan al grupo: intentan contener las raíces, que se multiplican cuando las golpean. El grupo debe decidir cómo detenerlas sin destruir el cristal.',
    ilustracion: ''
  },
  narracion: {
    ts: ahora,
    texto: '¡Tienen poco tiempo! Las raíces están a unos dos metros del cristal. Los guardianes no los atacan: están intentando contenerlas. Pueden actuar todos juntos. No hace falta que tiren dados todavía. ¿Qué deciden hacer?'
  },
  personajes: {
    klastan: {
      pv: 7, esp1: 1, concentra: 'Enmarañar (guardián de la espada)', oro: 7,
      estados: {}, recursos: {},
      inventario: { semilla: 'Semilla plateada (plantada en la cámara)' },
      pistas: {
        p1: 'Tu semilla plateada revela ecos de acontecimientos pasados cuando se planta en tierra. La plantaste en la cámara y brotó una raíz negra.',
        p2: 'Sentiste que la raíz respondía cuando intentabas comunicarte con ella.',
        p3: 'Intentaste purificarla y no funcionó: ahora son tres raíces que avanzan hacia el Corazón.',
        p4: 'La semilla parece conectada con el Corazón de Karath Inu.',
        p5: 'Gastaste la Inspiración bárdica de Larry en una negociación que no salió bien.'
      },
      notas: ''
    },
    laila: {
      pv: 12, esp1: 0, concentra: '', oro: 10,
      estados: {}, recursos: { segundoAliento: 1, mutacion: 1 },
      inventario: { medallon: 'Medallón de plata con media luna y la letra L' },
      pistas: {
        p1: { texto: 'Una mujer espectral vestida de blanco te dio un medallón de plata con una media luna y la letra L. Dice: «Para que nunca olvides quién eres».', img: 'objMedallon' },
        p2: { texto: 'La aparición te pidió buscar a «la mujer que lleva tu rostro» y mencionó el «Espejo de las Primeras Vidas».', img: 'espectral' },
        p3: 'Bajo la máscara de la mujer del cristal viste, por un instante, tu propio rostro.',
        p4: 'Descubriste que los guardianes funcionan con los cristales azules de su pecho.',
        p5: 'Fuiste la primera en ver a Eva escondida y su mensaje «NO DESTRUYAN EL CRISTAL» (ya se lo contaste al grupo).'
      },
      notas: ''
    },
    victoria: {
      pv: 9, esp1: 0, concentra: '', oro: 13,
      estados: {}, recursos: { saltoAstral: 1, ecoMemoria: 1, flechas: 20 },
      inventario: { libro: 'Libro antiguo de Eva', monedas: '3 monedas de oro tomadas a Klastan' },
      pistas: {
        p1: 'La sombra del bosque te llamó «anomalía»: Protógonos terminó y no deberías existir en esta línea temporal. Alguien te trajo hasta aquí.',
        p2: 'En el libro de Eva, bajo la tinta de la sexta figura, aparece «CREADOR», y en el margen, con otra letra: «El creador no es necesariamente el traidor».',
        p3: 'Entre dibujos del cristal entero y roto encontraste: «La sexta vida decidirá».',
        p4: 'El miedo de Eva te pareció auténtico, pero también notaste que oculta algo importante.'
      },
      notas: ''
    },
    larry: {
      pv: 8, esp1: 0, concentra: 'Fuego feérico (guardianes de espada y martillo)', oro: 10,
      estados: {}, recursos: { inspiracion: 1 },
      inventario: {},
      pistas: {
        p1: 'Oyes señales y códigos que los demás no perciben. Reconociste tu propia voz en mensajes que no recuerdas haber grabado.',
        p2: '«No debes permitir que abran la puerta.» «Tu memoria no fue borrada. Fue sellada.»',
        p3: 'Registro 006: tu voz dice que volvieron a fracasar y que Eva es la única que recuerda lo que pasó hace 300 años.',
        p4: 'Al tocar la mano de Eva sentiste un latido con un sonido mecánico y oíste «Protocolo EVA: preservar la última memoria».',
        p5: 'Junto al cristal oíste: «La raíz no es el enemigo».',
        p6: 'Último mensaje: «Para detener el crecimiento, devuelve la semilla a la tierra de donde vino».'
      },
      notas: ''
    },
    cayo: {
      pv: 12, esp1: 0, concentra: '', oro: 10,
      estados: {}, recursos: { imposicion: 5, sentidoDivino: 0, jabalinas: 4 },
      inventario: {},
      pistas: {
        p1: 'La sombra del bosque te llamó «portador de la llave», y uno de los guardianes usó el mismo título.',
        p2: 'Junto a la semilla sentiste dos pulsos sincronizados: el de la semilla y el del cristal.',
        p3: 'Al volver a investigar la semilla recibiste una descarga mágica y oíste varias voces: «¡NO ABRAN LA PUERTA!».',
        p4: 'Con Sentido divino notaste una presencia junto a Eva, sin poder identificarla.'
      },
      notas: ''
    }
  },
  enemigos: {
    espada: { nombre: 'Guardián de la espada', dano: 6, actitud: 'Contiene las raíces', estados: { 'Inmovilizado (Enmarañar)': true, 'Fuego feérico': true }, derrotado: false },
    martillo: { nombre: 'Guardián del martillo', dano: 0, actitud: 'Contiene las raíces', estados: { 'Fuego feérico': true }, derrotado: false },
    lanza: { nombre: 'Guardián de la lanza', dano: 0, actitud: 'Contiene las raíces', estados: {}, derrotado: false }
  },
  pistas: {
    a1: '«La Fractura no fue un accidente».',
    a2: 'Inscripción en el suelo de la cámara: «LA SEMILLA RECUERDA LO QUE LA PIEDRA OLVIDÓ».',
    a3: 'Las raíces negras se multiplican cuando las golpean.',
    a4: 'Los guardianes advierten: si la semilla y el Corazón se unen, el sello empezará a abrirse. Eva dice que, si no se unen, jamás recuperarán sus recuerdos.',
    a5: 'Los guardianes y Eva no están de acuerdo en cómo proteger el cristal.',
    a6: 'Los guardianes: «La sombra no los trajo. La sombra intentó detenerlos».',
    a7: 'Una proyección del cristal mostró a cinco figuras y a una de ellas con un martillo a punto de romperlo. No se ve quién es.'
  },
  imagenes: IMAGENES,
  enciclopedia: ENCICLOPEDIA,
  // Posición de las fichas en cada mapa, en % del ancho y alto de la imagen
  fichas: {
    camara: {
      klastan: { x: 41, y: 66 }, laila: { x: 44.5, y: 77 }, victoria: { x: 55.5, y: 77 },
      cayo: { x: 59, y: 66 }, larry: { x: 50, y: 84 },
      eva: { x: 36, y: 79 },
      espada: { x: 33, y: 55 }, martillo: { x: 67, y: 57 }, lanza: { x: 50, y: 50 }
    },
    camaraIlustrada: {
      klastan: { x: 50, y: 64 }, laila: { x: 44.8, y: 70 }, victoria: { x: 55.2, y: 70 },
      cayo: { x: 46.3, y: 79 }, larry: { x: 53.7, y: 79 },
      eva: { x: 60.5, y: 60 },
      espada: { x: 24.8, y: 20.7 }, martillo: { x: 79.6, y: 15.3 }, lanza: { x: 84.9, y: 66 }
    },
    bosque: {
      klastan: { x: 58, y: 52 }, laila: { x: 62, y: 56 }, victoria: { x: 66, y: 52 },
      larry: { x: 60, y: 61 }, cayo: { x: 64, y: 62 }
    }
  },
  bitacora: {
    b1: { ts: ahora - 3000, tipo: 'narracion', texto: 'El grupo desciende a la Cámara de las Cinco Vidas. La mujer enmascarada del cristal afirma que uno de ellos la mató.' },
    b2: { ts: ahora - 2000, tipo: 'narracion', texto: 'Combate breve con los guardianes: la jabalina de Kayho hiere al guardián de la espada (6 de daño), Klastan lo inmoviliza con Enmarañar y Larry ilumina a dos guardianes con Fuego feérico. El grupo decide dialogar.' },
    b3: { ts: ahora - 1000, tipo: 'narracion', texto: 'Aparece Eva. Klastan planta la semilla plateada, la raíz negra se divide en tres y avanza hacia el Corazón.' },
    b4: { ts: ahora, tipo: 'narracion', texto: '¡Tienen poco tiempo! Las raíces están a unos dos metros del cristal. ¿Qué deciden hacer?' }
  }
};
