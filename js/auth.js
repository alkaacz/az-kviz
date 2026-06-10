/**
 * auth.js — Google Identity Services wrapper
 * @module auth
 */

let _idToken = null;
let _onSignIn  = null;
let _onSignOut = null;
const _authDebugEnabled = new URLSearchParams(window.location.search).get('debugAuth') === '1';

function _authDebug(message, details) {
  if (!_authDebugEnabled) return;
  if (details !== undefined) {
    console.log(`[auth-debug] ${message}`, details);
    return;
  }
  console.log(`[auth-debug] ${message}`);
}

/**
 * Initialise Google Sign-In.
 * @param {string} clientId
 * @param {(profile: {email:string, name:string, picture:string}) => void} onSignIn
 * @param {() => void} onSignOut
 */
export function initAuth(clientId, onSignIn, onSignOut) {
  _onSignIn  = onSignIn;
  _onSignOut = onSignOut;
  _authDebug('initAuth called', { hasClientId: Boolean(clientId) });

  // Restore token from sessionStorage
  _idToken = sessionStorage.getItem('az_id_token');
  if (_idToken) {
    _authDebug('token restored from sessionStorage', { tokenLength: _idToken.length });
    const storedProfile = _parseProfile(sessionStorage.getItem('az_profile'));
    const tokenProfile = _decodeJwtPayload(_idToken);
    const profile = {
      ...(storedProfile || {}),
      ...(tokenProfile || {}),
    };

    if (profile) {
      sessionStorage.setItem('az_profile', JSON.stringify(profile));
      _authDebug('profile restored from sessionStorage', { email: profile.email || null });
      setTimeout(() => onSignIn(profile), 0);
      return;
    }
  }

  // Load GIS script
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    _authDebug('GIS script loaded');
    google.accounts.id.initialize({
      client_id: clientId,
      callback: _handleCredential,
      auto_select: false,
    });
    _authDebug('google.accounts.id.initialize done');
  };
  script.onerror = () => {
    _authDebug('GIS script failed to load');
  };
  document.head.appendChild(script);
}

/**
 * Render the Google Sign-In button into the given element.
 * @param {HTMLElement} container
 */
export function renderSignInButton(container) {
  // Wait for GIS to load
  const tryRender = () => {
    if (window.google && google.accounts) {
      _authDebug('Rendering Google sign-in button');
      google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        locale: 'cs',
      });
      _authDebug('Google sign-in button rendered');
    } else {
      setTimeout(tryRender, 100);
    }
  };
  tryRender();
}

/** @returns {string|null} Current ID token */
export function getIdToken() {
  return _idToken || sessionStorage.getItem('az_id_token');
}

/** Sign out — clear token and call onSignOut. */
export function signOut() {
  _idToken = null;
  sessionStorage.removeItem('az_id_token');
  sessionStorage.removeItem('az_profile');
  _authDebug('signOut executed, token removed');
  if (window.google && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  _onSignOut && _onSignOut();
}

// ── Private ───────────────────────────────────────────────────────────────

function _handleCredential(response) {
  _idToken = response.credential;
  _authDebug('credential callback received', { tokenLength: _idToken ? _idToken.length : 0 });
  sessionStorage.setItem('az_id_token', _idToken);

  const profile = _decodeJwtPayload(_idToken);
  _authDebug('token payload decoded', { email: profile.email || null, aud: profile.aud || null });
  sessionStorage.setItem('az_profile', JSON.stringify(profile));

  _onSignIn && _onSignIn(profile);
}

function _decodeJwtPayload(token) {
  try {
    const base64UrlPayload = token.split('.')[1];
    if (!base64UrlPayload) return {};

    const paddedBase64 = _toPaddedBase64(base64UrlPayload);
    const raw = atob(paddedBase64);
    const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function _toPaddedBase64(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  return base64 + '='.repeat(padLen);
}

function _parseProfile(str) {
  try { return str ? JSON.parse(str) : null; } catch { return null; }
}
