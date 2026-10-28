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

// ---- Skins -----------------------------------------------------------------
// Cada skin define su paleta (por tema claro/oscuro), color de cuadrícula y una
// función draw(context, px, py, size, color) que pinta un bloque ya posicionado
// en píxeles. drawBlock() se encarga del alpha (ghost) y de elegir la paleta.
const SKINS = {
  retro: {
    colors: { dark: COLORS, light: COLORS_LIGHT },
    grid: { dark: '#22222e', light: '#e3e5ef' },
    draw(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    colors: {
      dark:  [null, '#00f0ff', '#fff700', '#d400ff', '#39ff14', '#ff2a6d', '#2979ff', '#ff9100', '#e6e6ff'],
      light: [null, '#00f0ff', '#fff700', '#d400ff', '#39ff14', '#ff2a6d', '#2979ff', '#ff9100', '#e6e6ff'],
    },
    grid: { dark: '#16162a', light: '#16162a' },
    draw(context, px, py, size, color) {
      const m = Math.max(2, Math.round(size * 0.1));
      const baseAlpha = context.globalAlpha;
      context.save();
      context.shadowColor = color;
      context.shadowBlur = size * 0.45;
      context.fillStyle = color;
      context.globalAlpha = baseAlpha * 0.28;
      context.fillRect(px + m, py + m, size - 2 * m, size - 2 * m);
      context.globalAlpha = baseAlpha;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + m, py + m, size - 2 * m, size - 2 * m);
      context.restore();
    },
  },
  pastel: {
    colors: {
      dark:  [null, '#a8e6ef', '#fff1a8', '#d9b8f0', '#b8e8c0', '#f7b9bd', '#b9d4f7', '#fbd3a6', '#d3dce0'],
      light: [null, '#7fd3df', '#f6dc7a', '#c39be3', '#95d9a2', '#f09aa0', '#8fb9ee', '#f5b97c', '#b4c3cb'],
    },
    grid: { dark: '#22222e', light: '#eceef5' },
    draw(context, px, py, size, color) {
      const pad = 1.5;
      roundRectPath(context, px + pad, py + pad, size - 2 * pad, size - 2 * pad, size * 0.3);
      context.fillStyle = color;
      context.fill();
      // brillo suave
      roundRectPath(context, px + size * 0.2, py + size * 0.16, size * 0.6, size * 0.16, size * 0.08);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fill();
    },
  },
  pixel: {
    colors: { dark: COLORS, light: COLORS_LIGHT },
    grid: { dark: '#22222e', light: '#e3e5ef' },
    draw(context, px, py, size, color) {
      const u = Math.max(1, Math.floor(size / 10)); // "píxel" del sprite (3 px con BLOCK=30)
      const x0 = px + 1, y0 = py + 1, n = Math.floor((size - 2) / u);
      context.fillStyle = color;
      context.fillRect(x0, y0, n * u, n * u);
      // textura: damero de píxeles más oscuros en el interior
      context.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 1; i < n - 1; i++)
        for (let j = 1; j < n - 1; j++)
          if ((i + j) % 2 === 0) context.fillRect(x0 + i * u, y0 + j * u, u, u);
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.55)';
      context.fillRect(x0, y0, n * u, u);
      context.fillRect(x0, y0, u, n * u);
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(x0, y0 + (n - 1) * u, n * u, u);
      context.fillRect(x0 + (n - 1) * u, y0, u, n * u);
    },
  },
};

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

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
const skinBtns = document.querySelectorAll('#skin-picker button[data-skin]');

let theme = 'dark';
let skin = 'retro';
let gridColor = SKINS.retro.grid.dark;
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const def = SKINS[skin];
  const color = def.colors[theme === 'light' ? 'light' : 'dark'][colorIndex];
  context.globalAlpha = alpha ?? 1;
  def.draw(context, x * size, y * size, size, color);
  context.globalAlpha = 1;
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

function refreshColors() {
  gridColor = SKINS[skin].grid[theme === 'light' ? 'light' : 'dark'];
  if (current) draw();   // repinta también con el juego en pausa o terminado
  if (next) drawNext();
}

function applyTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = theme;
  themeBtn.setAttribute('aria-pressed', String(isLight));
  themeBtn.setAttribute('aria-label', isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
  themeBtn.textContent = isLight ? 'Tema oscuro' : 'Tema claro';
  refreshColors();
}

function applySkin(name) {
  skin = SKINS[name] ? name : 'retro';
  document.documentElement.dataset.skin = skin;
  skinBtns.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.skin === skin)));
  refreshColors();
}

themeBtn.addEventListener('click', () => {
  const name = theme === 'light' ? 'dark' : 'light';
  applyTheme(name);
  try { localStorage.setItem('theme', name); } catch (e) {}
  themeBtn.blur(); // evita que Space (hard drop) active el botón
});

skinBtns.forEach(btn => btn.addEventListener('click', () => {
  applySkin(btn.dataset.skin);
  try { localStorage.setItem('skin', skin); } catch (e) {}
  btn.blur(); // evita que Space (hard drop) active el botón
}));

let savedTheme = null, savedSkin = null;
try {
  savedTheme = localStorage.getItem('theme');
  savedSkin = localStorage.getItem('skin');
} catch (e) {}
applyTheme(savedTheme);
applySkin(savedSkin);

init();
