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
  return cleared;
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
  recordsOnLock(clearLines());
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
  const color = (theme === 'light' ? COLORS_LIGHT : COLORS)[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
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
  recordsOnGameOver();
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
  recordsOnInit();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (recordsIsTextTarget(e.target)) return; // escribiendo el nombre: no actuar
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
  gridColor = isLight ? '#e3e5ef' : '#22222e';
  themeBtn.setAttribute('aria-pressed', String(isLight));
  themeBtn.setAttribute('aria-label', isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
  themeBtn.textContent = isLight ? 'Tema oscuro' : 'Tema claro';
  if (next) drawNext();
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

// ---- Records ----
// Tabla de records local en localStorage['tetris.records'] =
// { top: [{ name, score }], bestCombo, maxLines }.
// Combo: bloqueos consecutivos de pieza que limpian >= 1 línea.
const RECORDS_KEY = 'tetris.records';
const RECORDS_TOP_MAX = 5;
const RECORDS_NAME_MAX = 12;
const RECORDS_DEFAULT_NAME = 'Jugador';

const recordsListEl = document.getElementById('records-list');
const recordsStatsEl = document.getElementById('records-stats');
const recordsResetBtn = document.getElementById('records-reset-btn');
const recordsGoBlock = document.getElementById('gameover-records');
const recordsGoListEl = document.getElementById('gameover-records-list');
const recordsGoStatsEl = document.getElementById('gameover-records-stats');
const recordsGoResetBtn = document.getElementById('gameover-records-reset-btn');
const recordsForm = document.getElementById('records-save-form');
const recordsNameInput = document.getElementById('records-name-input');
const recordsMsgEl = document.getElementById('records-save-msg');

let combo = 0;              // combo actual de la partida
let comboMax = 0;           // mejor combo de la partida en curso
let recordsPending = null;  // { score } si hay una puntuación pendiente de guardar
let recordsHighlight = -1;  // índice (en top) de la fila guardada que se resalta

function recordsDefault() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function recordsNonNegInt(v) {
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

// Valida la forma del objeto leído; cualquier campo inválido cae a su valor por defecto.
function recordsSanitize(raw) {
  const out = recordsDefault();
  if (!raw || typeof raw !== 'object') return out;
  if (Array.isArray(raw.top)) {
    for (const entry of raw.top) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.name !== 'string' || !Number.isFinite(entry.score) || entry.score < 0) continue;
      out.top.push({
        name: entry.name.slice(0, RECORDS_NAME_MAX) || RECORDS_DEFAULT_NAME,
        score: Math.floor(entry.score),
      });
    }
    out.top.sort((a, b) => b.score - a.score); // sort estable: conserva el orden entre empates
    out.top = out.top.slice(0, RECORDS_TOP_MAX);
  }
  out.bestCombo = recordsNonNegInt(raw.bestCombo);
  out.maxLines = recordsNonNegInt(raw.maxLines);
  return out;
}

function recordsLoad() {
  try {
    const txt = localStorage.getItem(RECORDS_KEY);
    if (txt) return recordsSanitize(JSON.parse(txt));
  } catch (e) {}
  return recordsDefault();
}

function recordsStore() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(recordsData)); } catch (e) {}
}

let recordsData = recordsLoad();

// Posición que ocuparía una puntuación: tras las que ya tienen igual o más puntos.
function recordsInsertIndex(sc) {
  const i = recordsData.top.findIndex(e => e.score < sc);
  return i === -1 ? recordsData.top.length : i;
}

function recordsQualifies(sc) {
  return sc > 0 && recordsInsertIndex(sc) < RECORDS_TOP_MAX;
}

function recordsIsTextTarget(t) {
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

// Pinta una fila con textContent (nunca innerHTML) para no interpretar el nombre como HTML.
function recordsRow(pos, name, sc, cls) {
  const li = document.createElement('li');
  if (cls) li.className = cls;
  const p = document.createElement('span');
  p.className = 'rec-pos';
  p.textContent = pos + '.';
  const n = document.createElement('span');
  n.className = 'rec-name';
  n.textContent = name;
  const s = document.createElement('span');
  s.className = 'rec-score';
  s.textContent = sc;
  li.append(p, n, s);
  return li;
}

function recordsRenderList(listEl) {
  // Entradas a mostrar; si hay puntuación pendiente se inserta como vista previa resaltada.
  const rows = recordsData.top.map((e, i) => ({ name: e.name, score: e.score, hl: i === recordsHighlight }));
  if (recordsPending) {
    rows.splice(recordsInsertIndex(recordsPending.score), 0,
      { name: recordsNameInput.value.trim() || RECORDS_DEFAULT_NAME, score: recordsPending.score, hl: true });
  }
  listEl.replaceChildren();
  for (let i = 0; i < RECORDS_TOP_MAX; i++) {
    const e = rows[i];
    listEl.appendChild(e
      ? recordsRow(i + 1, e.name, e.score.toLocaleString(), e.hl ? 'rec-highlight' : '')
      : recordsRow(i + 1, '---', '0', 'rec-empty'));
  }
}

function recordsRenderStats(el) {
  el.replaceChildren();
  for (const txt of [`Mejor combo: ${recordsData.bestCombo}`, `Líneas máx: ${recordsData.maxLines}`]) {
    const d = document.createElement('div');
    d.textContent = txt;
    el.appendChild(d);
  }
}

function renderRecords() {
  recordsRenderList(recordsListEl);
  recordsRenderList(recordsGoListEl);
  recordsRenderStats(recordsStatsEl);
  recordsRenderStats(recordsGoStatsEl);
}

// Se llama desde lockPiece con las líneas limpiadas por la pieza recién bloqueada.
function recordsOnLock(cleared) {
  if (cleared > 0) {
    combo++;
    if (combo > comboMax) comboMax = combo;
  } else {
    combo = 0;
  }
}

// Se llama desde init(): limpia el estado de la partida y el bloque de guardado.
function recordsOnInit() {
  recordsCommitPending(); // si se reinicia sin pulsar Guardar, no se pierde la puntuación
  combo = 0;
  comboMax = 0;
  recordsPending = null;
  recordsHighlight = -1;
  recordsNameInput.value = RECORDS_DEFAULT_NAME;
  recordsMsgEl.textContent = '';
  recordsForm.classList.add('hidden');
  recordsGoBlock.classList.add('hidden');
  renderRecords();
}

// Se llama desde endGame(): actualiza bestCombo/maxLines y ofrece guardar el nombre.
function recordsOnGameOver() {
  if (comboMax > recordsData.bestCombo) recordsData.bestCombo = comboMax;
  if (lines > recordsData.maxLines) recordsData.maxLines = lines;
  recordsStore();
  recordsHighlight = -1;
  recordsPending = recordsQualifies(score) ? { score } : null;
  recordsMsgEl.textContent = recordsPending ? '¡Entras en el top!' : '';
  recordsForm.classList.toggle('hidden', !recordsPending);
  recordsGoBlock.classList.remove('hidden');
  renderRecords();
}

recordsNameInput.addEventListener('input', () => {
  if (recordsPending) renderRecords(); // actualiza el nombre de la vista previa
});

// Inserta la puntuación pendiente con el nombre del campo (o el nombre por defecto) y la persiste.
function recordsCommitPending() {
  if (!recordsPending) return;
  const name = recordsNameInput.value.trim().slice(0, RECORDS_NAME_MAX) || RECORDS_DEFAULT_NAME;
  const idx = recordsInsertIndex(recordsPending.score);
  recordsData.top.splice(idx, 0, { name, score: recordsPending.score });
  recordsData.top = recordsData.top.slice(0, RECORDS_TOP_MAX);
  recordsHighlight = idx < RECORDS_TOP_MAX ? idx : -1;
  recordsPending = null;
  recordsStore();
  recordsForm.classList.add('hidden');
  recordsMsgEl.textContent = 'Guardado';
  renderRecords();
}

recordsForm.addEventListener('submit', e => {
  e.preventDefault();
  recordsCommitPending();
  if (document.activeElement) document.activeElement.blur(); // Space no debe activar controles
});

function recordsReset() {
  const ok = confirm('¿Borrar todos los records?');
  if (!paused && !gameOver) lastTime = performance.now(); // confirm() bloquea: evita un salto de dt
  if (!ok) return;
  recordsData = recordsDefault();
  recordsHighlight = -1;
  recordsStore();
  renderRecords();
}

restartBtn.addEventListener('click', () => restartBtn.blur()); // Space no debe reactivar el botón

for (const btn of [recordsResetBtn, recordsGoResetBtn]) {
  btn.addEventListener('click', () => {
    recordsReset();
    btn.blur();
  });
}

init();
