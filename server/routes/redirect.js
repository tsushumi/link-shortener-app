// server/routes/redirect.js
const express = require('express');
const prisma = require('../lib/prisma');
const { RESERVED_CODES, CODE_PATTERN } = require('../utils/generateCode');

const router = express.Router();

const PAGES = {
  404: { title: 'Link not found', message: 'This short link does not exist. It may have been deleted, or the address was mistyped.' },
  410: { title: 'Link expired', message: 'This short link has expired and no longer redirects anywhere.' },
};

// Browsers get a small HTML page; API clients (curl, fetch with JSON) get JSON.
function sendProblem(req, res, status, jsonMessage) {
  const wantsHtml = /text\/html/.test(req.headers.accept || '');
  if (!wantsHtml) return res.status(status).json({ error: jsonMessage });

  const { title, message } = PAGES[status];
  res.status(status).type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} | LinkSnap</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f4f7;color:#101828;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  main{max-width:26rem;padding:2rem;text-align:left}
  .code{font-size:5rem;font-weight:800;letter-spacing:-.04em;line-height:1;color:#3447ff;margin:0}
  h1{font-size:1.5rem;margin:.75rem 0 .5rem}
  p{color:#475467;line-height:1.5;margin:0 0 1.25rem}
  a{display:inline-block;background:#3447ff;color:#fff;text-decoration:none;font-weight:600;padding:.6rem 1.1rem;border-radius:.6rem}
</style>
</head>
<body>
<main>
  <p class="code">${status}</p>
  <h1>${title}</h1>
  <p>${message}</p>
  <a href="${process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',')[0].trim() : '/'}">Go to LinkSnap</a>
</main>
</body>
</html>`);
}

// Handle redirects -- this catches /:shortCode
router.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;

  // Cheap rejection of anything that can't be a code (favicon.ico, scanner probes, ...)
  if (RESERVED_CODES.has(shortCode.toLowerCase()) || !CODE_PATTERN.test(shortCode)) {
    return sendProblem(req, res, 404, 'Short link not found');
  }

  try {
    const link = await prisma.link.findUnique({ where: { shortCode } });

    if (!link) {
      return sendProblem(req, res, 404, 'Short link not found');
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      return sendProblem(req, res, 410, 'This link has expired');
    }

    // Record the click without blocking the redirect. Both writes run in one transaction so
    // the counter and the event log can never disagree.
    const now = new Date();
    prisma
      .$transaction([
        prisma.link.update({
          where: { id: link.id },
          data: { clicks: { increment: 1 }, lastClicked: now },
        }),
        prisma.clickEvent.create({
          data: {
            linkId: link.id,
            clickedAt: now,
            referrer: (req.headers.referer || '').slice(0, 500) || null,
            userAgent: (req.headers['user-agent'] || '').slice(0, 500) || null,
          },
        }),
      ])
      .catch((err) => console.error('Failed to record click:', err));

    // 301 as the brief requires. Browsers cache permanent redirects heuristically, which would
    // make repeat visits skip the server and go uncounted, so we forbid caching explicitly.
    res.set('Cache-Control', 'no-store, max-age=0');
    res.redirect(301, link.originalUrl);
  } catch (err) {
    console.error('Redirect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
