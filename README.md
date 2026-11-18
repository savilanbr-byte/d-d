# Mesa del DM

Plataforma para llevar una campaña de D&D en la misma mesa: una pantalla central (TV) con el mapa y la narración, el celular de cada jugador con su ficha, y un panel para el Dungeon Master. Todo se sincroniza en vivo con Firebase.

Dirección de la app: https://savilanbr-byte.github.io/d-d/

## Primeros pasos

1. **DM:** entra a **DM**. La primera vez pide el nombre de la campaña y crea el PIN del DM.
2. **Personajes:** el DM los crea en **DM → Personajes**, o cada jugador crea el suyo en **Mi personaje → Crear personaje**. Cada ficha tiene su propio PIN.
3. **Imágenes:** el DM sube mapas, retratos e ilustraciones en **DM → Biblioteca**.
4. **A jugar:** la pantalla central va en **Mesa → Modo TV**. Cada jugador abre su ficha en el celular; cuando le toca en combate, su ficha lo avisa (y el celular vibra si lo permite).

## Qué hace cada parte

| Sección | Para qué |
|---|---|
| **Mesa** | Lugar, alerta, mapa con fichas (o una ilustración), iniciativa con la ronda y a quién le toca, ambiente (día, momento, luz, clima, temperatura y sus reglas), relojes de amenaza, el texto de la entrada de Historia cuya imagen se muestra (a la derecha), quién está en escena, y el grupo con PV y estados a lo ancho abajo. |
| **Mi personaje** | Ficha viva: PV, espacios de conjuro, concentración, recursos con usos, estados, ataques, conjuros, pistas privadas, notas, atributos, rasgos y equipo. Se edita con **Editar ficha**. |
| **Historia** | Enciclopedia de la campaña (mundo, personajes no jugadores, lugares, objetos, inscripciones, misterios), galería con las imágenes que el DM ya reveló, pistas del grupo y el diario de cada jugador (lo ven solo él y el DM; el DM ve todos los diarios). |
| **Reglas** | Las reglas de jugador del SRD 5.2.1 en español (cómo jugar, creación de personajes, clases, orígenes, dotes, equipo, conjuros y glosario), con índice y buscador. |
| **DM → Mesa** | Combate (preparar iniciativa, tirar d20 para enemigos, siguiente turno, rondas), tiradas del DM (ataques con ventaja o desventaja, daño, críticos y tiradas libres; solo las ve el DM), enemigos y aliados en escena (desde el banco o a mano, con PV, daño y curación, ataques para tirar, perfil y opción de ocultarlos de la mesa), ambiente, relojes, pistas del grupo, mapa y fichas, escena y descansos. |
| **DM → Banco PNJ** | Plantillas reutilizables de enemigos, aliados y personajes no jugadores (CA, PV, dados de golpe, iniciativa, atributos, ataques, rasgos, acciones y notas del DM), ordenadas por grupo y con buscador. «A escena» crea copias numeradas (Bandido 1, Bandido 2…) con sus propios PV y estados; pueden llegar ocultas, con PV tirados y, si hay combate, con su iniciativa ya tirada. La mesa y los celulares solo ven su salud aproximada: Ileso, Herido, Malherido o A punto de caer. Importar y exportar en `.json`. |
| **DM → Personajes** | Crear, editar y borrar fichas, ver cualquier ficha, mandar pistas privadas, anotar secretos del DM (no los ve el jugador) e importar o exportar fichas en un archivo `.json`. |
| **DM → Biblioteca** | Subir imágenes (llegan sin revelar), revelarlas en la Galería o mostrarlas en la mesa (eso también las revela), llenar la Historia una por una o importando un archivo, organizarla en grupos plegables (y ordenar sus entradas con ↑ ↓), y revelar cada entrada cuando el grupo la descubra. |
| **DM → Reglas** | Las reglas del DM del SRD 5.2.1 (herramientas del juego, objetos mágicos, monstruos y animales). Su buscador encuentra también las reglas de jugador. |
| **DM → Ajustes** | Nombre de la campaña, PIN del DM, PINs de los personajes y borrar la campaña. |

## Inventario y equipo

- En **Mi personaje → Inventario**: solo el DM lo modifica (desde DM → Personajes → Ver ficha); el jugador lo consulta. Monedas (cobre, plata, electro, oro y platino), lo **equipado** y la **mochila**, con cantidades.
- **Añadir al inventario:** armas y armaduras del SRD 5.2.1 (con nombre propio, bono mágico y daño extra opcionales), escudos y otros objetos (con bono a la CA si lo dan).
- **Las armas equipadas** salen solas en **Ataques** con su bono y daño calculados: FUE para cuerpo a cuerpo, DES a distancia, el mayor si es sutil, más la competencia si la tiene (la app la propone según la clase y se puede cambiar) y el bono mágico. Las versátiles agregan la línea a dos manos y las arrojadizas la línea lanzada.
- **La CA** se calcula con la armadura, el escudo y los objetos equipados (solo una armadura y un escudo a la vez). Sin nada equipado se usa la CA escrita en la ficha. «CA sin armadura» en el editor sirve para clases que la cambian.
- **Pasar al inventario** convierte el «Equipo base» de la ficha en objetos y reconoce las armas y armaduras del SRD.
- Cada ataque tiene **Atacar**, **Daño** y **Crít.**; en combate, lo que se tira queda listo en el panel **Atacar** para enviárselo al DM.

## Combate compartido

- **Jugadores:** durante un combate, su ficha muestra el panel **Atacar**. Eligen a quién y con qué ataque, escriben el total de sus dados físicos o pulsan **Tirar d20** y **Tirar daño** (normal, ventaja o desventaja; un 20 natural marca crítico y dobla los dados), y lo **envían al DM**. Pueden cancelar lo que aún no se revisa. También pueden **curar a un compañero**.
- **DM:** los ataques llegan arriba del panel de combate (con aviso en pantalla) y la app sugiere si acierta según la CA del enemigo. **Acierta** resta el daño (se puede corregir antes), **Mitad** es para resistencias, **Falla** lo descarta. A 0 PV el enemigo queda derrotado.
- **Daño de los PNJ:** después de tirar el daño de un enemigo en **Tiradas del DM**, se elige el personaje y **Aplicar** (o **Mitad**) le resta los PV. Si estaba concentrado, el aviso recuerda la salvación de CON.
- **Mesa:** el panel **Lo que pasó** muestra las últimas acciones («Laila golpea a Bandido 1», «Bandido 1 cae»), sin números de vida. Se borra al terminar el combate.

## Creador de personajes: formato de las listas

| Lista | Una línea por elemento |
|---|---|
| Salvaciones y habilidades | `Atletismo +4` |
| Ataques extra (conjuros de ataque y otros; las armas equipadas salen solas) | `Rayo de fuego \| +5 \| 1d10 fuego` |
| Trucos y rasgos | `Nombre: descripción` |
| Conjuros | `1 \| Curar heridas \| descripción` (el primer número es el nivel) |
| Recursos con usos | `Segundo aliento \| 1 \| corto \| detalle opcional` (recarga: corto, largo o ninguna) |
| Equipo | `Cota de malla` |

## Importar fichas

En **DM → Personajes → Importar fichas** se carga un archivo `.json` con este formato. Lo que no se sepa se deja vacío (`""`) y la app lo muestra como pendiente. Si el PIN falta o ya lo usa otro, la app asigna uno nuevo. Si ya existe un personaje con el mismo nombre, no se duplica.

```json
{
  "formato": "mesa-del-dm/personajes",
  "version": 1,
  "personajes": [
    {
      "ficha": { "nombre": "Nombre", "raza": "", "clase": "", "nivel": 1, "pin": "1234", "pvMax": 10,
                 "atributos": { "FUE": 10, "DES": 10, "CON": 10, "INT": 10, "SAB": 10, "CAR": 10 },
                 "rasgos": [{ "nombre": "Rasgo", "texto": "Descripción" }], "hitos": ["Algo que pasó"] },
      "secretos": "Lo que solo sabe el DM"
    }
  ]
}
```

**Exportar fichas** descarga ese mismo archivo con todos los personajes (incluye retratos y secretos), útil como respaldo.

## Importar entradas de Historia

En **DM → Biblioteca → Importar entradas** se carga un `.json` con muchas entradas a la vez. Llegan **sin revelar**, salvo las que digan `"revelada": true`. Si una entrada ya existe (misma sección y título), se actualiza en vez de duplicarse.

- `seccion`: `mundo`, `pnj`, `lugares`, `objetos`, `inscripciones` o `misterios`.
- `titulo` es obligatorio; lo demás es opcional: `sub`, `texto`, `visto` y `dicho` (listas), `misterio`, `tipo` (solo en mundo: `hecho`, `dicho` o `misterio`), `resuelto` (solo en misterios).
- `grupo`: nombre del grupo (arco, capítulo, región…). Si no existe, se crea. Los grupos se ven plegables en la Biblioteca y en la Historia de los jugadores.
- `notasDM`: notas privadas del DM (spoilers, estadísticas, ideas). Solo se ven en DM → Biblioteca, nunca en la Historia de los jugadores, aunque la entrada esté revelada.
- `imagen`: el nombre de una imagen de la Biblioteca. Si todavía no existe, la entrada la espera y se le asigna sola cuando subas una imagen con ese nombre.

```json
{
  "formato": "mesa-del-dm/historia",
  "version": 1,
  "entradas": [
    { "seccion": "pnj", "titulo": "Brolgar", "sub": "Herrero de la aldea", "texto": "Enano tuerto.",
      "visto": ["Tiene una cicatriz de quemadura"], "dicho": ["Dice que conoció al rey"], "imagen": "Brolgar" },
    { "seccion": "misterios", "titulo": "¿Quién apagó el faro?" }
  ]
}
```

**Exportar entradas** descarga ese mismo archivo con todo lo que hay en la Historia.

## Importar el banco de PNJ

En **DM → Banco PNJ → Importar** se carga un archivo `.json` con este formato. Solo el nombre es obligatorio. Si ya hay una plantilla con el mismo nombre, se actualiza. `ataques`, `rasgos` y `acciones` pueden ir como lista o como texto (una por línea, igual que en el formulario). `retrato` es el nombre de un retrato de la Biblioteca. **Exportar** descarga el mismo formato.

```json
{
  "formato": "mesa-del-dm/banco",
  "version": 1,
  "plantillas": [
    {
      "nombre": "Bandido", "grupo": "Caminos", "tipo": "enemigo", "desc": "Humanoide mediano, neutral", "vd": "1/8",
      "ca": 12, "caNota": "armadura de cuero", "pv": 11, "dadosPv": "2d8 + 2", "velocidad": "9 m", "ini": "+1",
      "atributos": { "FUE": 11, "DES": 12, "CON": 12, "INT": 10, "SAB": 10, "CAR": 10 },
      "otros": ["Idiomas: Común"],
      "ataques": [{ "nombre": "Cimitarra", "bono": "+3", "dano": "1d6 + 1 cortante" }],
      "rasgos": [], "acciones": [], "notas": "Huyen si cae el jefe", "retrato": ""
    }
  ]
}
```

## Archivos

| Archivo | Qué tiene |
|---|---|
| `index.html` | La página |
| `config.js` | Conexión con Firebase y nombre de la campaña en la base de datos (`partidas/mesa`) |
| `js/datos.js` | Listas fijas y la campaña vacía |
| `js/sync.js` | Sincronización en vivo (Firebase) o de demostración |
| `js/app.js` | Vistas, creador de personajes y panel del DM |
| `js/equipo.js` | Armas y armaduras del SRD 5.2.1 y competencias por clase |
| `js/dados.js` | Tiradas de dados y salud aproximada de los PNJ |
| `js/reglas.js` | Lector de reglas: índice, buscador y dibujo de tablas y perfiles |
| `reglas/reglas-jugador.json`, `reglas/reglas-dm.json` | El SRD 5.2.1 en español convertido a capítulos y secciones |
| `css/estilo.css` | La estética |

## Reglas de Firebase (Realtime Database → Reglas)

```json
{
  "rules": {
    "partidas": {
      "$partida": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## Notas

- Los PIN son una cortina entre amigos, no una contraseña: quien sepa usar las herramientas del navegador podría verlos.
- Un dispositivo con el PIN del DM puede abrir todas las fichas sin su PIN.
- **Borrar toda la campaña** (DM → Ajustes) deja la app vacía otra vez, incluido el PIN del DM.

## Reglas y licencia

Las pestañas de reglas usan el documento de referencia del sistema 5.2.1 en español. Esta obra incluye material procedente del documento de referencia del sistema 5.2.1 (“SRD 5.2.1”) de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd. La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia internacional de atribución/reconocimiento 4.0 de Creative Commons, disponible en https://creativecommons.org/licenses/by/4.0/legalcode.
