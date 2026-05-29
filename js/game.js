/**
 * game.js - AZ Kvíz game state factory
 * @module game
 */

import { createBoard, checkWin } from './board.js';

/**
 * @typedef {{ id: string, name: string, color: string }} Team
 * @typedef {{ id: string, text: string, imageUrl: string|null, options: string[], correctIndex: number }} Question
 * @typedef {{ id: string, name: string, settings: { timeLimitSec: number, shuffleAnswers: boolean }, questions: Question[] }} Quiz
 */

/** Fisher-Yates shuffle (mutates array). @template T @param {T[]} arr @returns {T[]} */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Creates a game instance.
 * @param {Quiz} quiz
 * @param {Team[]} teams  2 or 3 teams
 * @returns {object} Game API
 */
export function createGame(quiz, teams) {
  const board = createBoard();
  let currentTeamIndex = 0;
  let phase = 'picking';   // 'picking' | 'answering' | 'finished'
  let activeField = null;  // index of selected field
  let winner = null;       // team id or 'TIE'

  // Pick 28 questions randomly, assign one per field
  const pickedQuestions = shuffle([...quiz.questions]).slice(0, 28);
  board.forEach((field, i) => {
    field.questionId = pickedQuestions[i].id;
  });

  /** @returns {Question|undefined} */
  function questionForField(fieldIndex) {
    const qid = board[fieldIndex].questionId;
    return quiz.questions.find(q => q.id === qid);
  }

  /** Advance turn to next team, skip to 'finished' if no free fields remain. */
  function nextTurn() {
    const free = board.some(f => f.owner === null);
    if (!free) {
      phase = 'finished';
      // Winner = most fields, or TIE
      const counts = teams.map(t => ({
        id: t.id,
        count: board.filter(f => f.owner === t.id).length,
      }));
      counts.sort((a, b) => b.count - a.count);
      winner = counts[0].count > counts[1].count ? counts[0].id : 'TIE';
      return;
    }
    currentTeamIndex = (currentTeamIndex + 1) % teams.length;
    phase = 'picking';
    activeField = null;
  }

  return {
    /** Start/reset — already initialised in createGame, but exposed for clarity. */
    startGame() {},

    /** @returns {object} Current game state snapshot (plain object, not reactive). */
    getState() {
      return {
        teams: teams.map(t => ({
          ...t,
          score: board.filter(f => f.owner === t.id).length,
        })),
        board: board.map(f => ({ ...f })),
        currentTeam: teams[currentTeamIndex],
        phase,
        activeField,
        winner,
        /** Current question (only valid during 'answering' phase). */
        activeQuestion: activeField !== null ? questionForField(activeField) : null,
      };
    },

    /**
     * Team picks a field to answer.
     * Only valid in 'picking' phase; field must be unowned.
     * @param {number} index
     */
    pickField(index) {
      if (phase !== 'picking') return;
      if (board[index].owner !== null) return;
      activeField = index;
      phase = 'answering';
    },

    /**
     * Team submits an answer.
     * @param {number} optionIndex  0-3
     */
    answer(optionIndex) {
      if (phase !== 'answering' || activeField === null) return;

      const question = questionForField(activeField);
      const correct = question && optionIndex === question.correctIndex;

      board[activeField].owner = correct ? teams[currentTeamIndex].id : 'BLACK';

      // Check win for current team
      if (correct && checkWin(board, teams[currentTeamIndex].id)) {
        phase = 'finished';
        winner = teams[currentTeamIndex].id;
        return;
      }

      nextTurn();
    },
  };
}
