'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // Nut - steel gray
];

// Paleta con más contraste para el tema claro
const COLORS_LIGHT = [
  null,
  '#00acc1', // I
  '#f9a825', // O
  '#8e24aa', // T
  '#43a047', // S
  '#e53935', // Z
  '#1e88e5', // J
  '#fb8c00', // L
  '#607d8b', // Nut
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut (tuerca, hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');

let theme = 'dark';
let gridColor = '#22222e';
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ---- Skins ----
// Cada skin define su paleta (`colors`, índice 0 = null, 1–8 = I,O,T,S,Z,J,L,Tuerca)
// y su función `draw(context, x, y, colorIndex, size, alpha)`.

// Trazado de rectángulo redondeado con arcTo (compatible sin depender de roundRect)
function skinRoundRectPath(context, px, py, w, h, r) {
  context.beginPath();
  context.moveTo(px + r, py);
  context.arcTo(px + w, py, px + w, py + h, r);
  context.arcTo(px + w, py + h, px, py + h, r);
  context.arcTo(px, py + h, px, py, r);
  context.arcTo(px, py, px + w, py, r);
  context.closePath();
}

const SKINS = {
  // Retro: cuadrados planos con highlight; respeta el tema claro/oscuro
  // (`colors` es la paleta oscura; draw() elige COLORS_LIGHT según `theme`)
  retro: {
    colors: COLORS,
    draw(context, x, y, colorIndex, size, alpha) {
      const color = (theme === 'light' ? COLORS_LIGHT : COLORS)[colorIndex];
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },

  // Neon: colores saturados con glow (shadowBlur) sobre fondo negro
  neon: {
    colors: [
      null,
      '#00f0ff', // I
      '#fff200', // O
      '#d500f9', // T
      '#39ff14', // S
      '#ff1744', // Z
      '#2979ff', // J
      '#ff9100', // L
      '#e0e0ff', // Tuerca
    ],
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size + 2, py = y * size + 2, s = size - 4;
      context.save();
      context.globalAlpha = alpha ?? 1;
      context.shadowColor = color;
      context.shadowBlur = Math.round(size * 0.5);
      context.fillStyle = color;
      context.globalAlpha *= 0.85;
      context.fillRect(px, py, s, s);
      // borde brillante interior, sin sombra
      context.shadowBlur = 0;
      context.globalAlpha = alpha ?? 1;
      context.strokeStyle = 'rgba(255,255,255,0.75)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      context.restore(); // restaura shadowBlur/shadowColor/globalAlpha
    },
  },

  // Pastel: colores suaves y esquinas redondeadas
  pastel: {
    colors: [
      null,
      '#a8e6ef', // I
      '#fff1a8', // O
      '#d9b8f0', // T
      '#b5ead0', // S
      '#ffb3ba', // Z
      '#b5d3f7', // J
      '#ffd6a5', // L
      '#d5d8e0', // Tuerca
    ],
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size + 1.5, py = y * size + 1.5, s = size - 3;
      const r = Math.max(2, Math.round(size * 0.28));
      context.save();
      context.globalAlpha = alpha ?? 1;
      skinRoundRectPath(context, px, py, s, s, r);
      context.fillStyle = color;
      context.fill();
      context.lineWidth = 1;
      context.strokeStyle = 'rgba(0,0,0,0.25)';
      context.stroke();
      // brillo suave en la mitad superior
      skinRoundRectPath(context, px + 3, py + 3, s - 6, Math.max(3, s * 0.3), Math.max(1, r - 3));
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fill();
      context.restore();
    },
  },

  // Pixel art: textura de subpíxeles claros/oscuros con borde oscuro
  pixel: {
    colors: [
      null,
      '#29adff', // I
      '#ffec27', // O
      '#b13e9d', // T
      '#00e436', // S
      '#ff004d', // Z
      '#3a5bd9', // J
      '#ffa300', // L
      '#a0a0a8', // Tuerca
    ],
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size + 1, py = y * size + 1, s = size - 2;
      const n = 6;                       // rejilla de n×n subpíxeles
      const cell = Math.max(1, Math.floor((s - 4) / n));
      const inner = cell * n;
      const ox = px + Math.floor((s - inner) / 2);
      const oy = py + Math.floor((s - inner) / 2);
      context.save();
      context.globalAlpha = alpha ?? 1;
      // borde oscuro y base
      context.fillStyle = 'rgba(0,0,0,0.65)';
      context.fillRect(px, py, s, s);
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, s - 2, s - 2);
      // textura de tablero de ajedrez de subpíxeles
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          context.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)';
          context.fillRect(ox + c * cell, oy + r * cell, cell, cell);
        }
      }
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.55)';
      context.fillRect(px + 1, py + 1, s - 2, 1);
      context.fillRect(px + 1, py + 1, 1, s - 2);
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(px + 1, py + s - 2, s - 2, 1);
      context.fillRect(px + s - 2, py + 1, 1, s - 2);
      context.restore();
    },
  },
};

let skin = 'retro';

// Color de la cuadrícula según skin y tema
function skinGridColor(isLight) {
  if (skin === 'neon') return '#16161f';
  // Pastel y Pixel tienen fondo propio en tema claro: cuadrícula oscura translúcida
  if (isLight && (skin === 'pastel' || skin === 'pixel')) return 'rgba(0,0,0,0.1)';
  return isLight ? '#e3e5ef' : '#22222e';
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  SKINS[skin].draw(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = theme;
  gridColor = skinGridColor(isLight);
  themeBtn.setAttribute('aria-pressed', String(isLight));
  themeBtn.setAttribute('aria-label', isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
  themeBtn.textContent = isLight ? 'Tema oscuro' : 'Tema claro';
  if (next) drawNext();
  if (current && board && (paused || gameOver)) draw(); // sin rAF activo hay que repintar a mano
}

themeBtn.addEventListener('click', () => {
  const name = theme === 'light' ? 'dark' : 'light';
  applyTheme(name);
  try { localStorage.setItem('theme', name); } catch (e) {}
  themeBtn.blur(); // evita que Space (hard drop) active el botón
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
applyTheme(savedTheme);

// ---- Skins ---- (selector y arranque)
const skinSelect = document.getElementById('skin-select');

function applySkin(name) {
  skin = Object.prototype.hasOwnProperty.call(SKINS, name) ? name : 'retro';
  document.documentElement.dataset.skin = skin;
  skinSelect.value = skin;
  gridColor = skinGridColor(theme === 'light');
  if (next) drawNext();
  // Si no hay rAF activo (pausa / game over) hay que repintar el tablero a mano
  if (current && board && (paused || gameOver)) draw();
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try { localStorage.setItem('skin', skin); } catch (e) {}
  skinSelect.blur(); // evita que las flechas y Space manipulen el <select>
});

// Con el <select> enfocado, las flechas/Space no deben llegar al juego (solo P)
skinSelect.addEventListener('keydown', e => {
  if (e.code === 'KeyP') {
    e.preventDefault(); // evita el type-ahead nativo ("P" -> Pastel/Pixel); P sigue llegando al juego
    return;
  }
  if (e.code === 'Escape' || e.code === 'Enter') skinSelect.blur(); // devuelve el control al juego sin cambiar nada
  e.stopPropagation();
});

let savedSkin = null;
try { savedSkin = localStorage.getItem('skin'); } catch (e) {}
applySkin(savedSkin);

init();
