// server/utils/generateCode.js
const { customAlphabet } = require('nanoid');

// URL-safe alphanumeric alphabet (no "-" or "_", so generated codes never start/end with punctuation).
// 62^6 is roughly 56.8 billion combinations.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function generateShortCode(length = 6) {
  return customAlphabet(ALPHABET, length)();
}

// Codes that would collide with real routes or frontend paths
const RESERVED_CODES = new Set([
  'api', 'health', 'favicon.ico', 'robots.txt', 'login', 'register', 'dashboard',
]);

// Custom codes: letters, numbers and hyphens, 3-20 characters
const CODE_PATTERN = /^[a-zA-Z0-9-]{3,20}$/;

module.exports = { generateShortCode, RESERVED_CODES, CODE_PATTERN };
