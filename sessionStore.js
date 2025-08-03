const crypto = require('crypto');

// Store structure
const store = new Map();

// TTL cleanup interval (in ms)
const CLEANUP_INTERVAL = 60 * 1000;

// Util: Secure random string
function generateSecureId(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// Internal function: Cleanup expired items
function cleanupStore() {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.expires_at && value.expires_at <= now) {
      store.delete(key);
    }
  }
}

// Run cleanup periodically
setInterval(cleanupStore, CLEANUP_INTERVAL);

// ========== PKCE Challenge Storage ==========
function setCodeChallenge(codeVerifier, codeChallenge, ttlMillis) {
  const key = `pkce:${codeChallenge}`;
  store.set(key, {
    code_verifier: codeVerifier,
    expires_at: Date.now() + ttlMillis
  });
}

function getCodeChallenge(codeChallenge) {
  const key = `pkce:${codeChallenge}`;
  const entry = store.get(key);
  if (entry && entry.expires_at > Date.now()) {
    return entry;
  }
  store.delete(key);
  return null;
}

// ========== Token Storage ==========
function storeTokenData(accessToken, refreshToken, accessTtl, refreshTtl) {
  const now = Date.now();
  store.set(`access:${accessToken}`, {
    token: accessToken,
    expires_at: now + accessTtl
  });
  store.set(`refresh:${refreshToken}`, {
    token: refreshToken,
    expires_at: now + refreshTtl
  });
}

// ========== Cookie Session Mapping ==========
function mapCookieToTokens(cookieId, accessToken, refreshToken, ttlMillis) {
  store.set(`cookie:${cookieId}`, {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + ttlMillis
  });
}


function deleteCookieMapping(cookieId) {
  store.delete(`cookie:${cookieId}`);
}

// ========== Cookie Generation ==========
function generateAuthCookie(accessToken, refreshToken, cookieTtlMillis) {
  const cookieId = generateSecureId(16);
  mapCookieToTokens(cookieId, accessToken, refreshToken, cookieTtlMillis);

  // Return cookie header
  return `session_id=${cookieId}; HttpOnly; Secure; Path=/; Max-Age=${cookieTtlMillis / 1000}`;
}

function getTokensFromCookie(cookieId) {
  const entry = store.get(`cookie:${cookieId}`);
  if (entry && entry.expires_at > Date.now()) {
    return {
      access_token: entry.access_token,
      refresh_token: entry.refresh_token
    };
  }
  store.delete(`cookie:${cookieId}`);
  return null;
}

module.exports = {
  setCodeChallenge,
  getCodeChallenge,
  storeTokenData,
  generateAuthCookie,
  getTokensFromCookie,
  mapCookieToTokens,
  deleteCookieMapping
};
