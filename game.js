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

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const NEON_COLORS = [
  null,
  '#00f0ff', // I
  '#fff200', // O
  '#ff00ff', // T
  '#39ff14', // S
  '#ff073a', // Z
  '#1f51ff', // J
  '#ff8c00', // L
  '#c0c0ff', // Nut
];

// Cada skin define paleta y rejilla por tema, y cómo pintar una celda.
// drawBlock() restaura globalAlpha y shadowBlur tras cada drawCell.
const SKINS = {
  retro: {
    colors: { dark: COLORS, light: COLORS_LIGHT },
    grid: { dark: '#22222e', light: '#e3e5ef' },
    drawCell(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    colors: { dark: NEON_COLORS, light: NEON_COLORS }, // fondo negro en ambos temas
    grid: { dark: '#111118', light: '#111118' },
    drawCell(context, px, py, size, color) {
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = color;
      context.globalAlpha *= 0.25;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.globalAlpha /= 0.25;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
    },
  },
  pastel: {
    colors: {
      dark: [null, '#a8e6ef', '#fff1a8', '#d7b8f3', '#b9eabc', '#f7b2b2', '#b8d8f8', '#ffd3a8', '#d5dde2'],
      light: [null, '#7fd3e0', '#f5dc72', '#c39be8', '#94d89a', '#f08f8f', '#90bff0', '#f9b97a', '#aab8c1'],
    },
    grid: { dark: '#24242f', light: '#eceef5' },
    drawCell(context, px, py, size, color) {
      roundRectPath(context, px + 2, py + 2, size - 4, size - 4, size * 0.25);
      context.fillStyle = color;
      context.fill();
      // brillo superior suave
      roundRectPath(context, px + 5, py + 4, size - 10, size * 0.25, size * 0.12);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fill();
    },
  },
  pixel: {
    colors: { dark: COLORS, light: COLORS_LIGHT },
    grid: { dark: '#22222e', light: '#e3e5ef' },
    drawCell(context, px, py, size, color) {
      const n = 6;
      const p = size / n;
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          let shade = null;
          if (r === 0 || c === 0) shade = 'rgba(255,255,255,0.35)';
          else if (r === n - 1 || c === n - 1) shade = 'rgba(0,0,0,0.35)';
          else if ((r + c) % 2 === 0) shade = 'rgba(0,0,0,0.1)';
          if (!shade) continue;
          context.fillStyle = shade;
          context.fillRect(px + c * p, py + r * p, p, p);
        }
      }
    },
  },
};

const LINE_SCORES = [0, 100, 300, 500, 800];
const MAX_START_LEVEL = 10; // desde el nivel 11 la velocidad ya está topada

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
const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const menuRestartBtn = document.getElementById('menu-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const startLevelSelect = document.getElementById('start-level');
const skinSelect = document.getElementById('skin-select');

let theme = 'dark';
let skin = SKINS.retro;
let startLevel = 1;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

// Teclas físicamente pulsadas y teclas bloqueadas hasta soltarse (evita
// movimientos accidentales al cerrar el menú de pausa o al reiniciar)
const pressedKeys = new Set();
let blockedKeys = new Set();

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
    level = startLevel + Math.floor(lines / 10);
    dropInterval = intervalFor(level);
    updateHUD();
  }
}

function intervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
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
  const color = skin.colors[theme][colorIndex];
  context.globalAlpha = alpha ?? 1;
  skin.drawCell(context, x * size, y * size, size, color);
  context.globalAlpha = 1;
  context.shadowBlur = 0;
}

function drawGrid() {
  ctx.strokeStyle = skin.grid[theme];
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

function blockHeldKeys() {
  if (document.activeElement) document.activeElement.blur(); // que Space no active un botón
  blockedKeys = new Set(pressedKeys);
}

function showMenuView(view) {
  pauseMain.classList.toggle('hidden', view !== 'main');
  pauseControls.classList.toggle('hidden', view !== 'controls');
  (view === 'main' ? resumeBtn : controlsBackBtn).focus();
}

function openPauseMenu() {
  paused = true;
  cancelAnimationFrame(animId);
  startLevelSelect.value = String(startLevel);
  pauseMenu.classList.remove('hidden');
  showMenuView('main');
}

function closePauseMenu() {
  pauseMenu.classList.add('hidden');
  blockHeldKeys();
  paused = false;
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function togglePause() {
  if (gameOver) return;
  if (paused) closePauseMenu();
  else openPauseMenu();
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
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  blockHeldKeys();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  pressedKeys.add(e.code);
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (e.repeat) return; // mantener P/Esc pulsada no alterna en bucle
    if (paused && e.code === 'Escape' && !pauseControls.classList.contains('hidden')) {
      showMenuView('main');
    } else {
      togglePause();
    }
    return;
  }
  if (paused || gameOver) return;
  if (blockedKeys.has(e.code)) return;
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

document.addEventListener('keyup', e => {
  pressedKeys.delete(e.code);
  blockedKeys.delete(e.code);
});

window.addEventListener('blur', () => {
  pressedKeys.clear();
  blockedKeys.clear();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', closePauseMenu);
menuRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => showMenuView('controls'));
controlsBackBtn.addEventListener('click', () => showMenuView('main'));

for (let lvl = 1; lvl <= MAX_START_LEVEL; lvl++) {
  startLevelSelect.add(new Option(String(lvl), String(lvl)));
}

startLevelSelect.addEventListener('change', () => {
  startLevel = Number(startLevelSelect.value);
  try { localStorage.setItem('startLevel', String(startLevel)); } catch (e) {}
});

let savedStartLevel = null;
try { savedStartLevel = Number(localStorage.getItem('startLevel')); } catch (e) {}
if (Number.isInteger(savedStartLevel) && savedStartLevel >= 1 && savedStartLevel <= MAX_START_LEVEL) {
  startLevel = savedStartLevel;
}

function applyTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = theme;
  themeBtn.setAttribute('aria-pressed', String(isLight));
  themeBtn.setAttribute('aria-label', isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
  themeBtn.textContent = isLight ? 'Tema oscuro' : 'Tema claro';
  if (next) drawNext();
  if (current) draw(); // repinta aunque el rAF esté parado (pausa / game over)
}

function applySkin(name) {
  const key = Object.hasOwn(SKINS, name) ? name : 'retro';
  skin = SKINS[key];
  document.documentElement.dataset.skin = key;
  skinSelect.value = key;
  if (next) drawNext();
  if (current) draw();
}

themeBtn.addEventListener('click', () => {
  const name = theme === 'light' ? 'dark' : 'light';
  applyTheme(name);
  try { localStorage.setItem('theme', name); } catch (e) {}
  themeBtn.blur(); // evita que Space (hard drop) active el botón
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try { localStorage.setItem('skin', skinSelect.value); } catch (e) {}
  skinSelect.blur(); // evita que flechas / Space sigan actuando sobre el select
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
applyTheme(savedTheme);

let savedSkin = null;
try { savedSkin = localStorage.getItem('skin'); } catch (e) {}
applySkin(savedSkin);

init();
