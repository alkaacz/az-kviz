/**
 * auth.js — Google Identity Services wrapper
 * @module auth
 */

let _idToken = null;
let _onSignIn  = null;
let _onSignOut = null;

/**
 * Initialise Google Sign-In.
 * @param {string} clientId
 * @param {(profile: {email:string, name:string, picture:string}) => void} onSignIn
 * @param {() => void} onSignOut
 */
export function initAuth(clientId, onSignIn, onSignOut) {
  _onSignIn  = onSignIn;
  _onSignOut = onSignOut;

  // Restore token from sessionStorage
  _idToken = sessionStorage.getItem('az_id_token');
  if (_idToken) {
    const profile = _parseProfile(sessionStorage.getItem('az_profile'));
    if (profile) {
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
    google.accounts.id.initialize({
      client_id: clientId,
      callback: _handleCredential,
      auto_select: false,
    });
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
      google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        locale: 'cs',
      });
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
  if (window.google && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  _onSignOut && _onSignOut();
}

// ── Private ───────────────────────────────────────────────────────────────

function _handleCredential(response) {
  _idToken = response.credential;
  sessionStorage.setItem('az_id_token', _idToken);

  const profile = _decodeJwtPayload(_idToken);
  sessionStorage.setItem('az_profile', JSON.stringify(profile));

  _onSignIn && _onSignIn(profile);
}

function _decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

function _parseProfile(str) {
  try { return str ? JSON.parse(str) : null; } catch { return null; }
}
