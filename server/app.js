// server/app.js -- builds the Express app (kept separate from server.js so it can be tested)
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const linkRoutes = require('./routes/links');
const redirectRoute = require('./routes/redirect');

function createApp() {
  const app = express();

  // Railway/Vercel-style hosts sit behind a proxy; needed for correct client IPs (rate limiting)
  app.set('trust proxy', 1);

  // CLIENT_URL may hold several comma-separated origins; trailing slashes are ignored
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '10kb' }));

  const skipInTests = () => process.env.NODE_ENV === 'test';

  // Brute-force protection for login/register
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTests,
    message: { error: 'Too many attempts. Please try again in a few minutes.' },
  });

  // Stops one account from flooding the database with links
  const createLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => skipInTests() || req.method !== 'POST',
    message: { error: 'You are creating links too quickly. Please slow down.' },
  });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/', (req, res) => res.json({ name: 'LinkSnap API', status: 'ok' }));

  // API routes
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/links', createLimiter, linkRoutes);

  // Unknown API paths should 404 as JSON instead of falling into the redirect handler
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Redirect route (must be after API routes)
  app.use('/', redirectRoute);

  // Error handling
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
