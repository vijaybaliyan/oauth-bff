const crypto = require('crypto');

/**
 * Generates a high-entropy cryptographically random code verifier
 * compliant with RFC 7636 (43–128 characters, URL-safe).
 * @returns {string} code_verifier
 */
function generateCodeVerifier() {
  return crypto.randomBytes(64).toString('base64url');
}

/**
 * Generates a code challenge by applying SHA-256 to the code verifier
 * and encoding the result in Base64 URL-safe format.
 * @param {string} codeVerifier
 * @returns {string} code_challenge
 */
function generateCodeChallenge(codeVerifier) {
  return crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
}





// Export the functions
module.exports = {
  generateCodeVerifier,
  generateCodeChallenge
};
