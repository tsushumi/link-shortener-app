// server/utils/linkService.js
// Shared link-creation logic used by both the single and bulk endpoints.
const prisma = require('../lib/prisma');
const { generateShortCode, RESERVED_CODES, CODE_PATTERN } = require('./generateCode');

const MAX_URL_LENGTH = 2048;

class LinkError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const baseUrl = () => (process.env.BASE_URL || '').replace(/\/+$/, '');
const toShortUrl = (code) => `${baseUrl()}/${code}`;

function serializeLink(link) {
  return {
    id: link.id,
    originalUrl: link.originalUrl,
    shortCode: link.shortCode,
    shortUrl: toShortUrl(link.shortCode),
    clicks: link.clicks,
    lastClicked: link.lastClicked,
    expiresAt: link.expiresAt,
    isExpired: Boolean(link.expiresAt && link.expiresAt <= new Date()),
    createdAt: link.createdAt,
  };
}

// Returns an error string, or null when the destination URL is acceptable
function validateTargetUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return 'URL is required';
  if (url.length > MAX_URL_LENGTH) return `URL must be ${MAX_URL_LENGTH} characters or fewer`;

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return 'Invalid URL format. Include http:// or https://';
  }

  // javascript:, data:, file: etc. would turn the shortener into an XSS vector
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http:// and https:// URLs can be shortened';
  }

  // Shortening a link that points back at this service creates redirect loops
  try {
    if (baseUrl() && parsed.host === new URL(baseUrl()).host) {
      return 'You cannot shorten a link that already points to this service';
    }
  } catch {
    /* BASE_URL misconfigured -- skip the loop check */
  }
  return null;
}

function parseExpiry(expiresAt) {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) throw new LinkError(400, 'Invalid expiration date');
  if (date <= new Date()) throw new LinkError(400, 'Expiration date must be in the future');
  return date;
}

// Creates a link or throws LinkError (400 invalid, 409 code taken, 500 could not generate)
async function createLinkRecord({ url, customCode, expiresAt, userId }) {
  const urlError = validateTargetUrl(url);
  if (urlError) throw new LinkError(400, urlError);

  const data = { originalUrl: url.trim(), userId, expiresAt: parseExpiry(expiresAt) };

  if (customCode) {
    if (typeof customCode !== 'string' || !CODE_PATTERN.test(customCode)) {
      throw new LinkError(400, 'Custom code must be 3-20 characters, using only letters, numbers, and hyphens');
    }
    if (RESERVED_CODES.has(customCode.toLowerCase())) {
      throw new LinkError(400, 'This custom code is reserved. Please choose another');
    }
    try {
      return await prisma.link.create({ data: { ...data, shortCode: customCode } });
    } catch (err) {
      if (err.code === 'P2002') throw new LinkError(409, 'This custom code is already taken');
      throw err;
    }
  }

  // Generated codes: rely on the unique index and retry on collision (check-then-insert would race)
  for (let attempt = 0; attempt < 6; attempt++) {
    const shortCode = generateShortCode();
    if (RESERVED_CODES.has(shortCode.toLowerCase())) continue;
    try {
      return await prisma.link.create({ data: { ...data, shortCode } });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
  }
  throw new LinkError(500, 'Failed to generate unique code');
}

module.exports = { LinkError, createLinkRecord, serializeLink, toShortUrl, validateTargetUrl };
