# El Mundo Fracturado

App para jugar nuestra campaña de D&D 5e en la misma mesa: una pantalla central (TV) con el mapa y la narración, y el celular de cada jugador con su ficha. ChatGPT hace de Dungeon Master y la app se actualiza con sus respuestas.

Dirección de la app (cuando GitHub Pages esté activo): https://savilanbr-byte.github.io/d-d/

## Cómo se usa en la mesa

1. **Pantalla central:** abre la app en el TV o computador y entra a **Mesa → Modo TV**.
2. **Cada jugador:** abre la app en su celular, entra a **Mi personaje**, elige su personaje y escribe su PIN (solo se pide una vez por celular).
3. **Narrador** (quien maneja ChatGPT): entra a **Narrador** con su PIN.
   - Al empezar una conversación nueva con ChatGPT, toca **Copiar instrucciones + estado** y pégalo en ChatGPT.
   - Los jugadores le dicen sus acciones a ChatGPT.
   - Copia cada respuesta de ChatGPT, pégala en **Respuesta de ChatGPT**, toca **Revisar cambios** y luego **Aplicar y mostrar en la mesa**.
4. Todo se sincroniza en vivo entre los dispositivos.

## Biblioteca (narrador)

- Subir imágenes nuevas: mapas, retratos e ilustraciones.
- Mostrar una ilustración en la mesa en lugar del mapa.
- Crear o editar entradas de la Historia: personajes no jugadores, lugares, objetos, inscripciones y misterios.

## Bloque [CAMBIOS] de ChatGPT

ChatGPT termina cada respuesta con un bloque como este, que la app aplica sola:

```
[CAMBIOS]
Kayho: PV -4, jabalinas -1
Larry: espacio -1, concentra Fuego feérico
Victoria: usa Salto astral, pista +Texto que solo ve Victoria
Guardián de la espada: daño +5
PNJ Nombre: descripción
Misterio: Pregunta abierta
Alerta: ninguna
```

La lista completa de líneas está en las instrucciones que se copian desde el panel del narrador.

## Archivos

| Archivo | Qué tiene |
|---|---|
| `index.html` | La página |
| `config.js` | Conexión con Firebase (Realtime Database) |
| `js/datos.js` | Fichas, PINs, enciclopedia e imágenes iniciales, estado de la partida guardada |
| `js/cambios.js` | Lectura del bloque [CAMBIOS] e instrucciones para ChatGPT |
| `js/sync.js` | Sincronización en vivo (Firebase) o de demostración |
| `js/app.js` | Las vistas y botones |
| `css/estilo.css` | La estética |
| `img/` | Retratos, fichas originales, mapas e ilustraciones |

## Notas

- Los PINs están en `js/datos.js`. Son una cortina entre amigos, no una contraseña: cualquiera que lea el código puede verlos.
- **Volver a la partida guardada** (en el narrador) reinicia la partida al estado inicial, pero conserva las imágenes subidas.
- Las reglas de Firebase permiten leer y escribir solo en `partidas/mundo-fracturado`.
