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

const RECORDS_KEY = 'tetris-records';
const PLAYER_KEY = 'tetris-player';
const MAX_RECORDS = 5;
const MAX_NAME = 12;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const recordMsg = document.getElementById('record-msg');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsBox = document.getElementById('records-box');
const recordsList = document.getElementById('records-list');
const recordsStats = document.getElementById('records-stats');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const themeBtn = document.getElementById('theme-toggle');
const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const startLevelEl = document.getElementById('start-level');
const skinBtns = document.querySelectorAll('#skin-picker button[data-skin]');

const MAX_START_LEVEL = 10;

let theme = 'dark';
let skin = 'retro';
let gridColor = SKINS.retro.grid.dark;
let board, current, next, score, lines, level, baseLevel, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo, started, pendingEntry;
let records = { top: [], bestCombo: 0, maxLines: 0 };
// Estado del menú de pausa: startLevel persiste entre partidas (init() no lo reinicia)
let startLevel = 1;
let menuView = 'main';
let menuIndex = 0;

// Velocidad de caída (ms) para un nivel dado
function intervalForLevel(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

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
  // combo: piezas consecutivas que limpian al menos una línea
  combo = cleared ? combo + 1 : 0;
  maxCombo = Math.max(maxCombo, combo);
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = baseLevel + Math.floor(lines / 10);
    dropInterval = intervalForLevel(level);
  }
  updateHUD(); // también refleja el combo reiniciado
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
  comboEl.textContent = combo;
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

// ---- Records (localStorage) ----
function loadRecords() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(RECORDS_KEY)); } catch (e) {}
  const num = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const top = Array.isArray(data && data.top) ? data.top : [];
  return {
    top: top
      .filter(e => e && Number.isFinite(e.score))
      .map(e => ({ name: String(e.name || 'Anónimo').slice(0, MAX_NAME), score: num(e.score), lines: num(e.lines), combo: num(e.combo) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS),
    bestCombo: num(data && data.bestCombo),
    maxLines: num(data && data.maxLines),
  };
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

// Posición (0-based) que ocuparía `s` en el top, o -1 si no entra
function rankFor(s) {
  if (s <= 0) return -1;
  const idx = records.top.findIndex(e => s > e.score);
  if (idx !== -1) return idx;
  return records.top.length < MAX_RECORDS ? records.top.length : -1;
}

// Actualiza mejor combo y líneas máximas (no dependen de entrar en el top)
function updateStats() {
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  saveRecords();
}

// Guarda la entrada pendiente del game over; devuelve su posición o -1
function commitPending(name) {
  if (!pendingEntry) return -1;
  const entry = pendingEntry;
  pendingEntry = null;
  entry.name = String(name || '').trim().slice(0, MAX_NAME) || 'Anónimo';
  try { localStorage.setItem(PLAYER_KEY, entry.name); } catch (e) {}
  const rank = rankFor(entry.score);
  if (rank === -1) return -1;
  records.top.splice(rank, 0, entry);
  records.top.length = Math.min(records.top.length, MAX_RECORDS);
  saveRecords();
  return rank;
}

// highlight: índice a resaltar; preview: entrada aún sin guardar que se muestra en esa posición
function renderRecords(highlight = -1, preview = null) {
  const list = records.top.slice();
  if (preview && highlight >= 0) list.splice(highlight, 0, preview);
  recordsList.textContent = '';
  list.slice(0, MAX_RECORDS).forEach((e, i) => {
    const li = document.createElement('li');
    if (i === highlight) li.className = 'highlight';
    const name = document.createElement('span');
    name.className = 'rec-name';
    name.textContent = `${i + 1}. ${e.name}`;
    const pts = document.createElement('span');
    pts.textContent = e.score.toLocaleString();
    li.append(name, pts);
    recordsList.appendChild(li);
  });
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin records todavía';
    recordsList.appendChild(li);
  }
  recordsStats.textContent = `Mejor combo: ${records.bestCombo} · Líneas máx: ${records.maxLines}`;
}

// Configura el overlay compartido (inicio, pausa, game over)
function showOverlay({ title, ok = false, text = '', msg = '', form = false, showRecords = false, btn = 'Reiniciar' }) {
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('ok', ok);
  overlayScore.textContent = text;
  recordMsg.textContent = msg;
  recordMsg.classList.toggle('hidden', !msg);
  nameForm.classList.toggle('hidden', !form);
  recordsBox.classList.toggle('hidden', !showRecords);
  restartBtn.textContent = btn;
  overlay.classList.remove('hidden');
}

function showStart() {
  cancelAnimationFrame(animId);
  started = false;
  draw();
  renderRecords();
  showOverlay({ title: 'TETRIS', ok: true, showRecords: true, btn: 'Jugar' });
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  updateStats();
  const rank = rankFor(score);
  pendingEntry = rank === -1 ? null : { name: '', score, lines, combo: maxCombo };
  let saved = '';
  try { saved = localStorage.getItem(PLAYER_KEY) || ''; } catch (e) {}
  nameInput.value = saved;
  renderRecords(rank, pendingEntry && { name: 'TÚ', score });
  showOverlay({
    title: 'GAME OVER',
    text: `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Mejor combo: ${maxCombo}`,
    msg: rank === -1 ? '' : `¡Entras en el top 5! Puesto #${rank + 1}`,
    form: rank !== -1,
    showRecords: true,
  });
  if (rank !== -1) { nameInput.focus(); nameInput.select(); }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
  }
}

function openPauseMenu() {
  menuView = 'main';
  menuIndex = 0;
  renderMenu();
  pauseMenu.classList.remove('hidden');
}

function closePauseMenu() {
  pauseMenu.classList.add('hidden');
  // Evita que un botón con foco reaccione a Space/Enter al volver al juego
  if (document.activeElement) document.activeElement.blur();
}

// Botones navegables de la vista visible del menú
function menuItems() {
  const view = menuView === 'main' ? pauseMain : pauseControls;
  return [...view.querySelectorAll('.menu-item')];
}

function renderMenu() {
  pauseMain.classList.toggle('hidden', menuView !== 'main');
  pauseControls.classList.toggle('hidden', menuView !== 'controls');
  menuItems().forEach((el, i) => el.classList.toggle('selected', i === menuIndex));
  startLevelEl.textContent = startLevel;
}

function setMenuView(view) {
  menuView = view;
  menuIndex = 0;
  renderMenu();
}

function moveMenu(delta) {
  const n = menuItems().length;
  menuIndex = (menuIndex + delta + n) % n;
  renderMenu();
}

// Cambia el nivel inicial (cíclico 1..MAX_START_LEVEL); solo afecta a la próxima partida
function changeStartLevel(delta) {
  startLevel = ((startLevel - 1 + delta + MAX_START_LEVEL) % MAX_START_LEVEL) + 1;
  renderMenu();
}

function activateMenuItem(action) {
  switch (action) {
    case 'resume': togglePause(); break;
    case 'restart': closePauseMenu(); init(); break;
    case 'controls': setMenuView('controls'); break;
    case 'back': setMenuView('main'); break;
    case 'level': changeStartLevel(1); break;
  }
}

// Teclas con el menú abierto: nada llega al juego
function handleMenuKey(e) {
  const item = menuItems()[menuIndex];
  switch (e.code) {
    case 'ArrowUp': moveMenu(-1); break;
    case 'ArrowDown': moveMenu(1); break;
    case 'ArrowLeft':
    case 'ArrowRight':
      if (item.dataset.action === 'level') changeStartLevel(e.code === 'ArrowLeft' ? -1 : 1);
      break;
    case 'Enter':
    case 'NumpadEnter':
      activateMenuItem(item.dataset.action);
      break;
    case 'Space': break; // se ignora (no activa), pero se evita el click sobre un botón con foco
    default: return;
  }
  e.preventDefault();
}

pauseMenu.addEventListener('click', e => {
  const deltaBtn = e.target.closest('[data-delta]');
  if (deltaBtn) {
    changeStartLevel(Number(deltaBtn.dataset.delta));
    return;
  }
  const item = e.target.closest('.menu-item');
  if (item) activateMenuItem(item.dataset.action);
});

pauseMenu.addEventListener('mouseover', e => {
  const item = e.target.closest('.menu-item');
  const i = menuItems().indexOf(item);
  if (i >= 0 && i !== menuIndex) {
    menuIndex = i;
    renderMenu();
  }
});

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
  baseLevel = startLevel;
  level = baseLevel;
  paused = false;
  gameOver = false;
  dropInterval = intervalForLevel(level);
  dropAccum = 0;
  combo = 0;
  maxCombo = 0;
  started = true;
  pendingEntry = null;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!started) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!e.repeat) togglePause();
    return;
  }
  if (gameOver) return;
  if (paused) { handleMenuKey(e); return; }
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

restartBtn.addEventListener('click', () => {
  commitPending(nameInput.value); // si había un record sin guardar, se guarda con el nombre escrito
  restartBtn.blur(); // evita que Space (hard drop) vuelva a activar el botón
  init();
});

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  const rank = commitPending(nameInput.value);
  nameForm.classList.add('hidden');
  recordMsg.textContent = rank === -1 ? '' : `¡Guardado en el puesto #${rank + 1}!`;
  recordMsg.classList.toggle('hidden', rank === -1);
  renderRecords(rank);
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  records = { top: [], bestCombo: 0, maxLines: 0 };
  if (gameOver) {
    // la partida recién terminada sigue contando para las estadísticas y su entrada pendiente
    updateStats();
    if (pendingEntry) renderRecords(0, { name: 'TÚ', score });
    else renderRecords();
  } else {
    saveRecords();
    renderRecords();
  }
  resetRecordsBtn.blur();
});

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

records = loadRecords();
init();
showStart();
