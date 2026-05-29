/**
 * play.js - AZ Kvíz play screen logic (M2: mock quiz, no backend)
 * @module play
 */

import { renderBoardSVG } from './board.js';
import { createGame } from './game.js';

// ── DOM refs ──────────────────────────────────────────────────────────────
const screenSetup  = document.getElementById('screen-setup');
const screenGame   = document.getElementById('screen-game');
const screenFinish = document.getElementById('screen-finish');

const teamCountBtns = document.querySelectorAll('.team-count-btns button');
const teamInputs    = document.getElementById('team-inputs');
const btnStart      = document.getElementById('btn-start');

const boardEl       = document.getElementById('board');
const currentTeamEl = document.getElementById('current-team-name');
const currentHintEl = document.getElementById('current-hint');
const scoreListEl   = document.getElementById('score-list');
const btnEndGame    = document.getElementById('btn-end-game');

const modalOverlay  = document.getElementById('modal-overlay');
const modalBadge    = document.getElementById('modal-team-badge');
const modalQuestion = document.getElementById('modal-question');
const modalImage    = document.getElementById('modal-image');
const modalTimer    = document.getElementById('modal-timer');
const answerGrid    = document.getElementById('answer-grid');

const finishTitle   = document.getElementById('finish-title');
const finishSub     = document.getElementById('finish-sub');
const btnPlayAgain  = document.getElementById('btn-play-again');

// ── Setup state ───────────────────────────────────────────────────────────
const DEFAULT_COLORS = ['#1e88e5', '#e53935', '#43a047'];
const DEFAULT_NAMES  = ['Tým 1', 'Tým 2', 'Tým 3'];

let selectedTeamCount = 2;
let quiz = null;
let game = null;
let timerInterval = null;

// ── Load quiz ─────────────────────────────────────────────────────────────
async function loadQuiz() {
  try {
    const res = await fetch('./mock/sample-quiz.json');
    quiz = await res.json();
  } catch (e) {
    alert('Nepodařilo se načíst kvíz. Zkontrolujte konzoli.');
    console.error(e);
  }
}

// ── Setup screen ──────────────────────────────────────────────────────────
function buildTeamInputs(count) {
  teamInputs.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'team-row';
    row.innerHTML = `
      <label>Tým ${i + 1}</label>
      <input type="text" class="team-name-input" value="${DEFAULT_NAMES[i]}" maxlength="20">
      <input type="color" class="team-color-input" value="${DEFAULT_COLORS[i]}">
    `;
    teamInputs.appendChild(row);
  }
}

teamCountBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    teamCountBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTeamCount = parseInt(btn.dataset.count, 10);
    buildTeamInputs(selectedTeamCount);
  });
});

btnStart.addEventListener('click', () => {
  if (!quiz) return;
  const nameInputs  = teamInputs.querySelectorAll('.team-name-input');
  const colorInputs = teamInputs.querySelectorAll('.team-color-input');
  const teamIds = ['A', 'B', 'C'];
  const teams = Array.from(nameInputs).map((inp, i) => ({
    id:    teamIds[i],
    name:  inp.value.trim() || DEFAULT_NAMES[i],
    color: colorInputs[i].value,
  }));

  startGame(teams);
});

// ── Game ──────────────────────────────────────────────────────────────────
function startGame(teams) {
  game = createGame(quiz, teams);

  screenSetup.style.display  = 'none';
  screenGame.style.display   = 'grid';
  screenFinish.classList.add('hidden');

  updateUI();
}

function updateUI() {
  const state = game.getState();

  // Board
  renderBoardSVG(state.board, boardEl, index => {
    if (state.phase !== 'picking') return;
    if (state.board[index].owner !== null) return;
    game.pickField(index);
    openModal();
  });

  // Mark clickable / disabled fields
  boardEl.querySelectorAll('svg g').forEach(g => {
    const idx = parseInt(g.dataset.index, 10);
    const field = state.board[idx];
    if (state.phase === 'picking' && field.owner === null) {
      g.classList.add('clickable');
      g.classList.remove('disabled');
    } else {
      g.classList.remove('clickable');
      g.classList.add('disabled');
    }
  });

  // Current team
  currentTeamEl.textContent  = state.currentTeam.name;
  currentTeamEl.style.color  = state.currentTeam.color;
  currentHintEl.textContent  = state.phase === 'picking' ? 'Vyberte pole' : 'Odpovídá…';

  // Scores
  scoreListEl.innerHTML = state.teams.map(t => `
    <div class="score-row" style="background:${t.color}22">
      <span class="dot" style="background:${t.color}"></span>
      <span class="sname">${t.name}</span>
      <span class="pts">${t.score}</span>
    </div>
  `).join('');

  // Finish?
  if (state.phase === 'finished') showFinish(state);
}

// ── Modal ─────────────────────────────────────────────────────────────────
function openModal() {
  const state = game.getState();
  const { activeQuestion, currentTeam } = state;
  if (!activeQuestion) return;

  // Prep answer options (with optional shuffle tracking)
  let options = activeQuestion.options.map((text, i) => ({ text, realIndex: i }));
  if (quiz.settings.shuffleAnswers) shuffleArr(options);

  modalBadge.textContent       = currentTeam.name;
  modalBadge.style.background  = currentTeam.color + '44';
  modalBadge.style.color       = currentTeam.color;
  modalQuestion.textContent    = activeQuestion.text;

  if (activeQuestion.imageUrl) {
    modalImage.src = activeQuestion.imageUrl;
    modalImage.classList.remove('hidden');
    modalImage.style.display = 'block';
  } else {
    modalImage.style.display = 'none';
  }

  // Build answer buttons
  answerGrid.innerHTML = '';
  const labels = ['A', 'B', 'C', 'D'];
  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn-answer';
    btn.textContent = `${labels[i]}: ${opt.text}`;
    btn.addEventListener('click', () => submitAnswer(opt.realIndex, options, activeQuestion.correctIndex));
    answerGrid.appendChild(btn);
  });

  modalOverlay.classList.remove('hidden');
  startTimer();
}

function submitAnswer(realIndex, options, correctIndex) {
  stopTimer();

  const correct = realIndex === correctIndex;
  const buttons = answerGrid.querySelectorAll('.btn-answer');

  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (options[i].realIndex === correctIndex) btn.classList.add('correct');
    else if (options[i].realIndex === realIndex) btn.classList.add('wrong');
  });

  setTimeout(() => {
    modalOverlay.classList.add('hidden');
    game.answer(realIndex);
    updateUI();
  }, 900);
}

// ── Timer ─────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  const limit = quiz.settings.timeLimitSec;
  if (!limit) { modalTimer.textContent = ''; return; }

  let remaining = limit;
  modalTimer.textContent = `⏱ ${remaining}s`;
  modalTimer.classList.remove('urgent');

  timerInterval = setInterval(() => {
    remaining--;
    modalTimer.textContent = `⏱ ${remaining}s`;
    if (remaining <= 5) modalTimer.classList.add('urgent');
    if (remaining <= 0) {
      stopTimer();
      // Time's up → wrong answer (pass a definitely wrong index)
      const state = game.getState();
      const q = state.activeQuestion;
      const wrongIndex = q.correctIndex === 0 ? 1 : 0;
      submitAnswer(wrongIndex, q.options.map((t, i) => ({ text: t, realIndex: i })), q.correctIndex);
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ── Finish ────────────────────────────────────────────────────────────────
function showFinish(state) {
  if (state.winner === 'TIE') {
    finishTitle.textContent = 'Remíza!';
    finishSub.textContent   = 'Žádný tým nespojil všechny hrany.';
  } else {
    const team = state.teams.find(t => t.id === state.winner);
    finishTitle.textContent = `Vyhrál ${team.name}! 🏆`;
    finishTitle.style.color = team.color;
    finishSub.textContent   = `Počet polí: ${team.score}`;
  }
  screenFinish.classList.remove('hidden');
}

btnPlayAgain.addEventListener('click', () => {
  screenFinish.classList.add('hidden');
  screenGame.style.display  = 'none';
  screenSetup.style.display = 'flex';
});

btnEndGame.addEventListener('click', () => {
  if (confirm('Opravdu chcete ukončit hru?')) {
    screenGame.style.display  = 'none';
    screenSetup.style.display = 'flex';
    screenFinish.classList.add('hidden');
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────
function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
buildTeamInputs(selectedTeamCount);
loadQuiz();
