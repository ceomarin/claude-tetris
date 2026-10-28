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
- **Puntuación y nivel**: `clearLines()` suma `LINE_SCORES[n] × level`, recalcula `level = floor(lines/10) + 1` y `dropInterval = max(100, 1000 − (level−1)×90)`. Soft drop suma 1 punto por fila; hard drop suma 2 por celda (en `hardDrop()`).
- **Render**: `draw()` se ejecuta en cada frame y repinta todo: cuadrícula, tablero fijado, ghost piece (`ghostY()` con `globalAlpha` 0.2) y pieza actual. `drawNext()` pinta la vista previa en `#next-canvas` solo al hacer spawn.
- **Skins**: `SKINS` (`retro`, `neon`, `pastel`, `pixel`) define por skin `colors[theme]`, `grid[theme]` y `drawCell(context, px, py, size, color)`. `drawBlock()` resuelve el color y delega en `skin.drawCell`, y después restaura `globalAlpha` y `shadowBlur`; un `drawCell` que toque otro estado del contexto debe restaurarlo él mismo. `applySkin()`/`applyTheme()` repintan con `draw()`/`drawNext()` para que el cambio se vea también en pausa o game over. El skin se guarda en `localStorage` (`skin`) y no se reinicia en `init()`; Neon fuerza fondo negro vía `[data-skin="neon"]` en `style.css`.
- **Pausa**: `togglePause()` cancela o reanuda el rAF; `P` funciona incluso con el juego pausado o terminado, el resto de teclas se ignoran si `paused || gameOver`.
- **Valores de UI en sincronía**: `updateHUD()` debe llamarse tras cualquier cambio de `score`, `lines` o `level`. El `keydown` handler ya lo llama al final, pero `clearLines()` y `softDrop()` también lo hacen por su cuenta.

## Dimensiones acopladas

`COLS`/`ROWS`/`BLOCK` en `game.js` deben coincidir con `width`/`height` del `<canvas id="board">` en `index.html` (`COLS×BLOCK` por `ROWS×BLOCK`, hoy 300×600) y con el tamaño del `#next-canvas` (120×120, donde `NB = 30` y la rejilla de 4×4 vista previa). Cambiar uno sin el otro produce recortes o deformaciones.
