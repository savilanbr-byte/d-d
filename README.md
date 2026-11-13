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
| **Mesa** | Lugar, alerta, mapa con fichas (o una ilustración), iniciativa con la ronda y a quién le toca, ambiente (día, momento, luz, clima, temperatura y sus reglas), relojes de amenaza, el grupo con PV y estados, y quién está en escena. |
| **Mi personaje** | Ficha viva: PV, espacios de conjuro, concentración, recursos con usos, estados, ataques, conjuros, pistas privadas, notas, atributos, rasgos y equipo. Se edita con **Editar ficha**. |
| **Historia** | Enciclopedia de la campaña (mundo, personajes no jugadores, lugares, objetos, inscripciones, misterios), galería, pistas del grupo y bitácora. |
| **DM → Mesa** | Combate (preparar iniciativa, tirar d20 para enemigos, siguiente turno, rondas), ambiente, relojes, enemigos y aliados en escena, pistas del grupo, mapa y fichas, escena y descansos. |
| **DM → Personajes** | Crear, editar y borrar fichas, ver cualquier ficha, mandar pistas privadas, anotar secretos del DM (no los ve el jugador) e importar o exportar fichas en un archivo `.json`. |
| **DM → Biblioteca** | Subir imágenes, mostrarlas en la mesa y llenar la Historia. |
| **DM → Ajustes** | Nombre de la campaña, PIN del DM, PINs de los personajes y borrar la campaña. |

## Creador de personajes: formato de las listas

| Lista | Una línea por elemento |
|---|---|
| Salvaciones y habilidades | `Atletismo +4` |
| Ataques | `Espada larga \| +4 \| 1d8 + 2 cortante` |
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

## Archivos

| Archivo | Qué tiene |
|---|---|
| `index.html` | La página |
| `config.js` | Conexión con Firebase y nombre de la campaña en la base de datos (`partidas/mesa`) |
| `js/datos.js` | Listas fijas y la campaña vacía |
| `js/sync.js` | Sincronización en vivo (Firebase) o de demostración |
| `js/app.js` | Vistas, creador de personajes y panel del DM |
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
