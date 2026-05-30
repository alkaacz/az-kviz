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
  // GAS 302-redirects POST→GET, losing the request body.
  // Workaround: send everything via GET URL params.
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  const idToken = getIdToken();
  if (idToken) url.searchParams.set('idToken', idToken);
  url.searchParams.set('payload', JSON.stringify(payload));

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'API error');
  return data.data;
}

/** @returns {Promise<Array<{id,name,questionCount,updatedAt}>>} */
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
export function saveQuiz(quiz) {
  return post('saveQuiz', quiz);
}

/** @returns {Promise<{}>} */
export function deleteQuiz(id) {
  return post('deleteQuiz', { id });
}
