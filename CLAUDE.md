# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

No hay `package.json`, build, linter ni suite de tests. No inventes comandos de lint o test.

- Ejecutar: abrir `index.html` directamente en el navegador, o servir la carpeta de forma estática, por ejemplo `python3 -m http.server 8000` y luego `http://localhost:8000`.
- Tests de una sola prueba: no aplica (no hay tests).

## Arquitectura

Juego de Tetris en JavaScript vanilla con Canvas 2D. Sin módulos ni bundler: `index.html` carga `style.css` y `game.js` con `<script>` clásico al final del `<body>`, así que todas las `const`/`let`/`function` de `game.js` son globales de la página.

- **Estado**: variables globales `let` en `game.js` (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`…). `init()` las reinicia por completo y es también el handler del botón de reinicio, así que cualquier estado nuevo debe inicializarse ahí.
- **Tablero**: matriz `ROWS × COLS` de enteros; `0` vacío, `1–8` índice en `COLORS` / `PIECES` (el 8 es la tuerca 3×3 con hueco central). Las piezas son matrices cuadradas en `PIECES`; `randomPiece()` copia la forma para que las rotaciones no muten la plantilla.
- **Flujo de caída**: `loop(ts)` (vía `requestAnimationFrame`) acumula `dt` en `dropAccum`; al superar `dropInterval` mueve la pieza una fila o llama a `lockPiece()`. `lockPiece()` encadena `merge()` → `clearLines()` → `spawn()`. `spawn()` promueve `next` a `current` y, si colisiona, llama a `endGame()`.
- **Colisiones y rotación**: `collide(shape, ox, oy)` es la única fuente de verdad para choques (bordes, suelo y bloques fijados). `tryRotate()` prueba kicks horizontales `[0, -1, 1, -2, 2]`; no hay kicks verticales, así que una rotación de la pieza I junto al suelo puede fallar.
- **Puntuación y nivel**: `clearLines()` suma `LINE_SCORES[n] × level`, recalcula `level = startLevel + floor(lines/10)` y `dropInterval = intervalFor(level)` (`max(100, 1000 − (level−1)×90)`). `startLevel` (1–`MAX_START_LEVEL`) se elige en el menú de pausa, se guarda en `localStorage` y solo se aplica en `init()`. Soft drop suma 1 punto por fila; hard drop suma 2 por celda (en `hardDrop()`).
- **Render**: `draw()` se ejecuta en cada frame y repinta todo: cuadrícula, tablero fijado, ghost piece (`ghostY()` con `globalAlpha` 0.2) y pieza actual. `drawNext()` pinta la vista previa en `#next-canvas` solo al hacer spawn.
- **Pausa**: `P` o `Escape` llaman a `togglePause()`, que delega en `openPauseMenu()` / `closePauseMenu()` (cancelan o relanzan el rAF y muestran el overlay propio `#pause-menu`, separado del de GAME OVER). El menú tiene dos vistas (`#pause-main`, `#pause-controls`) que alterna `showMenuView()`; `Escape` en la vista de controles vuelve a la principal. El resto de teclas se ignoran si `paused || gameOver`.
- **Bloqueo de inputs**: `pressedKeys` registra las teclas pulsadas (keydown/keyup). Al cerrar el menú o en `init()`, `blockHeldKeys()` quita el foco y copia `pressedKeys` a `blockedKeys`; una tecla bloqueada no actúa hasta soltarse. Las repeticiones de `P`/`Escape` (`e.repeat`) se ignoran.
- **Valores de UI en sincronía**: `updateHUD()` debe llamarse tras cualquier cambio de `score`, `lines` o `level`. El `keydown` handler ya lo llama al final, pero `clearLines()` y `softDrop()` también lo hacen por su cuenta.

## Dimensiones acopladas

`COLS`/`ROWS`/`BLOCK` en `game.js` deben coincidir con `width`/`height` del `<canvas id="board">` en `index.html` (`COLS×BLOCK` por `ROWS×BLOCK`, hoy 300×600) y con el tamaño del `#next-canvas` (120×120, donde `NB = 30` y la rejilla de 4×4 vista previa). Cambiar uno sin el otro produce recortes o deformaciones.
