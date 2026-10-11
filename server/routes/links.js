// server/routes/links.js
const express = require('express');
const QRCode = require('qrcode');
const prisma = require('../lib/prisma');
const authenticateToken = require('../middleware/auth');
const { resolveTimeZone, lastNDays, fillSeries } = require('../utils/analytics');
const { summarizeBrowsers } = require('../utils/userAgent');
const { parseCsv, toCsv } = require('../utils/csv');
const { LinkError, createLinkRecord, serializeLink, toShortUrl } = require('../utils/linkService');

const router = express.Router();

const MAX_BULK_ROWS = 200;

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

// Create a short link
router.post('/', authenticateToken, async (req, res) => {
  const { url, customCode, expiresAt } = req.body || {};
  try {
    const link = await createLinkRecord({ url, customCode, expiresAt, userId: req.user.id });
    res.status(201).json(serializeLink(link));
  } catch (err) {
    if (err instanceof LinkError) return res.status(err.status).json({ error: err.message });
    console.error('Create link error:', err);
    res.status(500).json({ error: 'Failed to create short link' });
  }
});

// Bulk create from CSV. Body is the raw CSV text (Content-Type: text/csv).
// Columns: url (required), customCode (optional), expiresAt (optional). A header row is optional;
// without one, the first column is the URL.
// Responds with JSON (including a `csv` string); add ?format=csv to receive the CSV file directly.
router.post('/bulk', authenticateToken, express.text({ type: ['text/csv', 'text/plain'], limit: '512kb' }), async (req, res) => {
  if (typeof req.body !== 'string' || !req.body.trim()) {
    return res.status(400).json({ error: 'Send CSV text with Content-Type: text/csv' });
  }

  let rows = parseCsv(req.body);
  if (rows.length === 0) return res.status(400).json({ error: 'The CSV file is empty' });

  // Work out which column is which
  const header = rows[0].map((c) => c.trim().toLowerCase().replace(/[\s_-]/g, ''));
  const hasHeader = header.some((h) => ['url', 'originalurl', 'link', 'longurl'].includes(h));
  const col = { url: 0, customCode: -1, expiresAt: -1 };
  if (hasHeader) {
    col.url = header.findIndex((h) => ['url', 'originalurl', 'link', 'longurl'].includes(h));
    col.customCode = header.findIndex((h) => ['customcode', 'code', 'slug', 'shortcode'].includes(h));
    col.expiresAt = header.findIndex((h) => ['expiresat', 'expires', 'expiry', 'expirationdate'].includes(h));
    rows = rows.slice(1);
  }

  if (rows.length === 0) return res.status(400).json({ error: 'The CSV has a header but no rows' });
  if (rows.length > MAX_BULK_ROWS) {
    return res.status(400).json({ error: `Too many rows. Upload at most ${MAX_BULK_ROWS} links at a time` });
  }

  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    const url = (cells[col.url] || '').trim();
    const customCode = col.customCode >= 0 ? (cells[col.customCode] || '').trim() : '';
    const expiresAt = col.expiresAt >= 0 ? (cells[col.expiresAt] || '').trim() : '';
    const base = { row: i + (hasHeader ? 2 : 1), originalUrl: url };

    try {
      const link = await createLinkRecord({
        url,
        customCode: customCode || undefined,
        expiresAt: expiresAt || undefined,
        userId: req.user.id,
      });
      results.push({ ...base, status: 'created', shortCode: link.shortCode, shortUrl: toShortUrl(link.shortCode), error: '' });
    } catch (err) {
      if (!(err instanceof LinkError)) {
        console.error('Bulk create error:', err);
        results.push({ ...base, status: 'failed', shortCode: '', shortUrl: '', error: 'Unexpected error' });
      } else {
        results.push({ ...base, status: 'failed', shortCode: '', shortUrl: '', error: err.message });
      }
    }
  }

  const csv = toCsv(
    ['original_url', 'short_url', 'status', 'error'],
    results.map((r) => [r.originalUrl, r.shortUrl, r.status, r.error])
  );
  const created = results.filter((r) => r.status === 'created').length;

  if (req.query.format === 'csv') {
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="short-links.csv"',
    });
    return res.status(201).send(csv);
  }

  res.status(created > 0 ? 201 : 400).json({
    total: results.length,
    created,
    failed: results.length - created,
    results,
    csv,
  });
});

// Get all links for authenticated user (paginated)
router.get('/', authenticateToken, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
  const skip = (page - 1) * pageSize;

  try {
    const [links, totalItems] = await Promise.all([
      prisma.link.findMany({
        where: { userId: req.user.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.link.count({ where: { userId: req.user.id } }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    res.json({
      data: links.map(serializeLink),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error('Get links error:', err);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// Clicks per day over the last 7 days across ALL of the user's links.
// Declared before /:id routes so "analytics" is never treated as an id.
router.get('/analytics/overview', authenticateToken, async (req, res) => {
  const tz = resolveTimeZone(req.query.tz);
  const days = lastNDays(7, tz);

  try {
    // Look back one extra day so clicks near local midnight are never cut off
    const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    const [rows, totalLinks, totals] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char((ce."clickedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS clicks
        FROM "ClickEvent" ce
        JOIN "Link" l ON l."id" = ce."linkId"
        WHERE l."userId" = ${req.user.id} AND ce."clickedAt" >= ${since}
        GROUP BY day`,
      prisma.link.count({ where: { userId: req.user.id } }),
      prisma.link.aggregate({ where: { userId: req.user.id }, _sum: { clicks: true } }),
    ]);

    const dailyClicks = fillSeries(days, rows);

    res.json({
      timeZone: tz,
      totalLinks,
      totalClicks: totals._sum.clicks || 0,
      clicksLast7Days: dailyClicks.reduce((sum, d) => sum + d.clicks, 0),
      dailyClicks,
    });
  } catch (err) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Detailed analytics for one link: clicks over time, top referrers, browser breakdown
router.get('/:id/stats', authenticateToken, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Link not found' });

  const tz = resolveTimeZone(req.query.tz);

  try {
    const link = await prisma.link.findFirst({
      where: { id, userId: req.user.id },
      include: {
        clickEvents: { orderBy: { clickedAt: 'desc' }, take: 50 },
      },
    });

    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    // Aggregations happen in SQL. (groupBy on the raw timestamp would give one group per click,
    // so days are bucketed by calendar date; referrers are reduced to their hostname.)
    const [dayRows, referrerRows, browserRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char(("clickedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS clicks
        FROM "ClickEvent"
        WHERE "linkId" = ${link.id} AND "clickedAt" >= ${since}
        GROUP BY day`,
      prisma.$queryRaw`
        SELECT CASE
                 WHEN "referrer" IS NULL THEN 'Direct'
                 ELSE COALESCE(
                   lower(regexp_replace(substring("referrer" from '^https?://([^/:?#]+)'), '^www[.]', '')),
                   'Other')
               END AS source,
               COUNT(*)::int AS clicks
        FROM "ClickEvent"
        WHERE "linkId" = ${link.id}
        GROUP BY source
        ORDER BY clicks DESC, source ASC
        LIMIT 8`,
      prisma.$queryRaw`
        SELECT "userAgent" AS ua, COUNT(*)::int AS clicks
        FROM "ClickEvent"
        WHERE "linkId" = ${link.id}
        GROUP BY "userAgent"
        ORDER BY clicks DESC
        LIMIT 500`,
    ]);

    res.json({
      ...serializeLink(link),
      totalClicks: link.clicks,
      timeZone: tz,
      recentClicks: link.clickEvents,
      dailyClicks: fillSeries(lastNDays(7, tz), dayRows),
      topReferrers: referrerRows.map((r) => ({ source: r.source, clicks: Number(r.clicks) })),
      browsers: summarizeBrowsers(browserRows),
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Failed to fetch link stats' });
  }
});

// QR code for a short link (returned as a PNG data URL)
router.get('/:id/qr', authenticateToken, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Link not found' });

  try {
    const link = await prisma.link.findFirst({ where: { id, userId: req.user.id } });
    if (!link) return res.status(404).json({ error: 'Link not found' });

    const qrCode = await QRCode.toDataURL(toShortUrl(link.shortCode), {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    res.json({ qrCode, shortUrl: toShortUrl(link.shortCode) });
  } catch (err) {
    console.error('QR code error:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Delete a link
router.delete('/:id', authenticateToken, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Link not found' });

  try {
    // deleteMany scoped by userId = ownership check and delete in one atomic query
    const { count } = await prisma.link.deleteMany({ where: { id, userId: req.user.id } });
    if (count === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete link error:', err);
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

module.exports = router;
