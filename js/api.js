/**
 * api.js — wrapper nad GAS Web App
 * @module api
 */

import { CONFIG } from './config.js';
import { getIdToken } from './auth.js';

const API_URL = CONFIG.API_URL;

async function get(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const idToken = getIdToken();
  if (idToken) url.searchParams.set('idToken', idToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'API error');
  return data.data;
}

async function post(action, payload = {}) {
  const idToken = getIdToken();
  const res = await fetch(API_URL, {
    method: 'POST',
    // Keep this a simple request so the browser does not send a CORS preflight.
    // Apps Script web apps are fragile with OPTIONS/preflight handling.
    body: JSON.stringify({
      action,
      idToken,
      payload
    })
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'API error');
  return data.data;
}

/** @returns {Promise<Array<{id,name,settings,questionCount,updatedAt}>>} */
export function listQuizzes() {
  return get('listQuizzes');
}

/** @returns {Promise<object>} Full quiz with questions */
export function getQuiz(id) {
  return get('getQuiz', { id });
}

/** Public — no auth. @returns {Promise<object>} */
export function getQuizForPlay(id) {
  return get('getQuizForPlay', { id });
}

/** Create or update quiz. @returns {Promise<{id:string}>} */
export async function saveQuiz(quiz) {
  const id = quiz.id || crypto.randomUUID();
  const data = await post('saveQuiz', { ...quiz, id });
  return { id: data.id || id };
}

/** @returns {Promise<{}>} */
export async function deleteQuiz(id) {
  return post('deleteQuiz', { id });
}
