# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

No hay `package.json`, build, linter ni suite de tests. No inventes comandos de lint o test.

- Ejecutar: abrir `index.html` directamente en el navegador, o servir la carpeta de forma estática, por ejemplo `python3 -m http.server 8000` y luego `http://localhost:8000`.
- Tests de una sola prueba: no aplica (no hay tests).

## Arquitectura

Juego de Tetris en JavaScript vanilla con Canvas 2D. Sin módulos ni bundler: `index.html` carga `style.css` y `game.js` con `<script>` clásico al final del `<body>`, así que todas las `const`/`let`/`function` de `game.js` son globales de la página.

- **Estado**: variables globales `let` en `game.js` (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, `combo`, `maxCombo`, `started`, `pendingEntry`…). `init()` las reinicia por completo y es también el handler del botón de reinicio, así que cualquier estado nuevo debe inicializarse ahí.
- **Tablero**: matriz `ROWS × COLS` de enteros; `0` vacío, `1–8` índice en `COLORS` / `PIECES` (el 8 es la tuerca 3×3 con hueco central). Las piezas son matrices cuadradas en `PIECES`; `randomPiece()` copia la forma para que las rotaciones no muten la plantilla.
- **Flujo de caída**: `loop(ts)` (vía `requestAnimationFrame`) acumula `dt` en `dropAccum`; al superar `dropInterval` mueve la pieza una fila o llama a `lockPiece()`. `lockPiece()` encadena `merge()` → `clearLines()` → `spawn()`. `spawn()` promueve `next` a `current` y, si colisiona, llama a `endGame()`.
- **Colisiones y rotación**: `collide(shape, ox, oy)` es la única fuente de verdad para choques (bordes, suelo y bloques fijados). `tryRotate()` prueba kicks horizontales `[0, -1, 1, -2, 2]`; no hay kicks verticales, así que una rotación de la pieza I junto al suelo puede fallar.
- **Puntuación y nivel**: `clearLines()` suma `LINE_SCORES[n] × level`, recalcula `level = baseLevel + floor(lines/10)` y `dropInterval = intervalForLevel(level) = max(100, 1000 − (level−1)×90)`. `baseLevel` es el nivel con el que empezó la partida (`init()` lo toma de `startLevel`, elegido en el menú de pausa, 1–`MAX_START_LEVEL`). Soft drop suma 1 punto por fila; hard drop suma 2 por celda (en `hardDrop()`).
- **Render**: `draw()` se ejecuta en cada frame y repinta todo: cuadrícula, tablero fijado, ghost piece (`ghostY()` con `globalAlpha` 0.2) y pieza actual. `drawNext()` pinta la vista previa en `#next-canvas` solo al hacer spawn.
- **Skins**: `SKINS` (retro, neon, pastel, pixel) define por skin `colors {dark, light}`, `grid {dark, light}` y `draw(context, px, py, size, color)`. `drawBlock()` elige paleta según `skin` + `theme` y delega el pintado (también para ghost y `#next-canvas`). `applySkin()` actualiza `data-skin` en `<html>`, los botones `#skin-picker` y llama a `refreshColors()` (repinta sin recargar); la preferencia se guarda en `localStorage['skin']`. Es independiente del toggle claro/oscuro (`theme`). Una skin nueva solo necesita su entrada en `SKINS` y un botón con `data-skin`.
- **Pausa**: `togglePause()` cancela o reanuda el rAF y abre/cierra el menú `#pause-menu` (Reanudar, Reiniciar, Ver controles, Nivel inicial). `P` y `Escape` alternan la pausa (ignoran `e.repeat`); con `gameOver` no hacen nada y con `started === false` (pantalla de inicio) el `keydown` ignora todas las teclas. Con `paused`, el `keydown` desvía todo a `handleMenuKey()` (↑/↓ navegar, ←/→ cambia el nivel inicial, Enter activa; `Space` se consume sin efecto), así que ninguna tecla de juego llega a la pieza. El ratón usa clic y hover delegados en `#pause-menu`. `startLevel`, `menuView` y `menuIndex` son estado del menú: `startLevel` NO se reinicia en `init()` (persiste entre partidas). `#overlay` se usa solo para inicio y GAME OVER (la pausa usa `#pause-menu`).
- **Valores de UI en sincronía**: `updateHUD()` debe llamarse tras cualquier cambio de `score`, `lines`, `level` o `combo`. El `keydown` handler ya lo llama al final, pero `clearLines()` y `softDrop()` también lo hacen por su cuenta.

## Records

Tabla de records local persistida en `localStorage` (siempre dentro de `try/catch`, el juego funciona sin almacenamiento).

- **Claves**: `tetris-records` guarda `{ top, bestCombo, maxLines }` (`top` = hasta `MAX_RECORDS` = 5 entradas `{ name, score, lines, combo }` ordenadas por puntuación); `tetris-player` recuerda el último nombre escrito. `loadRecords()` valida y sanea lo leído; `records` es el estado en memoria (se carga una vez al arrancar, no en `init()`).
- **Combo**: número de piezas consecutivas que, al fijarse, limpian al menos una línea. `clearLines()` lo incrementa si `cleared > 0` y lo pone a 0 si no; `maxCombo` guarda el máximo de la partida. Ambos se reinician en `init()`. El HUD muestra el combo actual.
- **Estadísticas globales**: `updateStats()` (llamada en `endGame()`) actualiza `bestCombo` y `maxLines` aunque la partida no entre en el top.
- **Game over**: `rankFor(score)` devuelve la posición (0-based) o `-1`; las puntuaciones iguales quedan por debajo y `0` nunca entra. Si entra, `pendingEntry` guarda la entrada, se muestra el formulario de nombre y la fila se resalta (`.highlight`) como vista previa. `commitPending(name)` la inserta y guarda (nombre vacío → `Anónimo`); se llama al enviar el formulario y también al pulsar Reiniciar, para no perder el record.
- **Pantalla de inicio**: al cargar, `init()` crea el estado y `showStart()` lo congela (`started = false`) mostrando el overlay con el top y el botón «Jugar»; mientras `started` es `false` el `keydown` ignora todas las teclas. `init()` pone `started = true`.
- **Overlay compartido**: `showOverlay({...})` configura el mismo `#overlay` para inicio y game over (título, mensaje, formulario, tabla de records, texto del botón). Las filas se construyen con `textContent` (nunca `innerHTML`) porque el nombre lo escribe el usuario.
- **Reset**: el botón `#reset-records-btn` (con `confirm`) vacía `records`; si se pulsa tras un game over, la partida recién terminada se sigue contando en las estadísticas.

## Dimensiones acopladas

`COLS`/`ROWS`/`BLOCK` en `game.js` deben coincidir con `width`/`height` del `<canvas id="board">` en `index.html` (`COLS×BLOCK` por `ROWS×BLOCK`, hoy 300×600) y con el tamaño del `#next-canvas` (120×120, donde `NB = 30` y la rejilla de 4×4 vista previa). Cambiar uno sin el otro produce recortes o deformaciones.
