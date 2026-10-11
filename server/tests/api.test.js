// Integration tests: run the real Express app against a real Postgres database.
// Usage: npm test   (needs DATABASE_URL, JWT_SECRET in .env; uses NODE_ENV=test)
require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../app');
const prisma = require('../lib/prisma');

let server, api;
const tag = Date.now();
const emailA = `a${tag}@test.com`;
const emailB = `b${tag}@test.com`;
let tokenA, tokenB;

async function call(method, path, { token, body, redirect = 'manual' } = {}) {
  const res = await fetch(api + path, {
    method,
    redirect,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 / redirects */ }
  return { status: res.status, json, headers: res.headers };
}
const waitForClicks = () => new Promise((r) => setTimeout(r, 300));

test.before(async () => {
  server = createApp().listen(0);
  api = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await prisma.user.deleteMany({ where: { email: emailA } });
  await prisma.user.deleteMany({ where: { email: emailB } });
  server.close();
  await prisma.$disconnect();
});

test('register validates input', async () => {
  assert.equal((await call('POST', '/api/auth/register', { body: {} })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { body: { email: 'nope', name: 'x', password: 'password1' } })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { body: { email: emailA, name: 'x', password: 'short' } })).status, 400);
});

test('register + duplicate + login', async () => {
  const reg = await call('POST', '/api/auth/register', { body: { email: emailA, name: 'Alice', password: 'password123' } });
  assert.equal(reg.status, 201);
  assert.ok(reg.json.token);
  assert.equal(reg.json.user.password, undefined);
  tokenA = reg.json.token;

  const dup = await call('POST', '/api/auth/register', { body: { email: emailA.toUpperCase(), name: 'Alice', password: 'password123' } });
  assert.equal(dup.status, 409, 'email match must be case-insensitive');

  const bad = await call('POST', '/api/auth/login', { body: { email: emailA, password: 'wrongpass1' } });
  assert.equal(bad.status, 401);
  const ok = await call('POST', '/api/auth/login', { body: { email: emailA, password: 'password123' } });
  assert.equal(ok.status, 200);

  const regB = await call('POST', '/api/auth/register', { body: { email: emailB, name: 'Bob', password: 'password123' } });
  tokenB = regB.json.token;
});

test('links require auth', async () => {
  assert.equal((await call('GET', '/api/links')).status, 401);
  assert.equal((await call('GET', '/api/links', { token: 'garbage' })).status, 401);
});

test('create link: validation', async () => {
  const t = tokenA;
  assert.equal((await call('POST', '/api/links', { token: t, body: {} })).status, 400);
  assert.equal((await call('POST', '/api/links', { token: t, body: { url: 'not a url' } })).status, 400);
  assert.equal((await call('POST', '/api/links', { token: t, body: { url: 'javascript:alert(1)' } })).status, 400);
  assert.equal((await call('POST', '/api/links', { token: t, body: { url: 'https://example.com', customCode: 'a b' } })).status, 400);
  assert.equal((await call('POST', '/api/links', { token: t, body: { url: 'https://example.com', customCode: 'api' } })).status, 400);
  assert.equal((await call('POST', '/api/links', { token: t, body: { url: 'https://example.com', expiresAt: 'yesterday-ish' } })).status, 400);
  assert.equal((await call('POST', '/api/links', { token: t, body: { url: 'https://example.com', expiresAt: '2000-01-01' } })).status, 400);
  assert.equal((await call('POST', '/api/links', { token: t, body: { url: `${process.env.BASE_URL}/abc` } })).status, 400);
});

let link;
test('create link: generated code', async () => {
  const res = await call('POST', '/api/links', { token: tokenA, body: { url: 'https://example.com/a/very/long/path' } });
  assert.equal(res.status, 201);
  assert.match(res.json.shortCode, /^[A-Za-z0-9]{6}$/);
  assert.equal(res.json.shortUrl, `${process.env.BASE_URL}/${res.json.shortCode}`);
  assert.equal(res.json.clicks, 0);
  link = res.json;
});

test('create link: custom code + duplicates', async () => {
  const code = `my-${tag}`.slice(0, 20);
  const res = await call('POST', '/api/links', { token: tokenA, body: { url: 'https://example.com/b', customCode: code } });
  assert.equal(res.status, 201);
  assert.equal(res.json.shortCode, code);
  const dup = await call('POST', '/api/links', { token: tokenB, body: { url: 'https://example.com/c', customCode: code } });
  assert.equal(dup.status, 409);
});

test('redirect: 301 (no-store), counts clicks, records events', async () => {
  for (let i = 0; i < 3; i++) {
    const res = await call('GET', `/${link.shortCode}`);
    assert.equal(res.status, 301);
    assert.match(res.headers.get('cache-control'), /no-store/, 'must not be cached or repeat clicks go uncounted');
    assert.equal(res.headers.get('location'), 'https://example.com/a/very/long/path');
  }
  await waitForClicks();
  const list = await call('GET', '/api/links', { token: tokenA });
  const mine = list.json.data.find((l) => l.id === link.id);
  assert.equal(mine.clicks, 3);
  assert.ok(mine.lastClicked);
});

test('redirect: unknown code 404, junk paths 404', async () => {
  assert.equal((await call('GET', '/zzzzzz-nope')).status, 404);
  assert.equal((await call('GET', '/favicon.ico')).status, 404);
  assert.equal((await call('GET', '/api/nothing')).status, 404);
});

test('expired link returns 410 and does not count', async () => {
  const res = await call('POST', '/api/links', { token: tokenA, body: { url: 'https://example.com/exp', expiresAt: new Date(Date.now() + 60000).toISOString() } });
  assert.equal(res.status, 201);
  assert.equal(res.json.isExpired, false);
  // force-expire in the DB
  await prisma.$queryRaw`UPDATE "Link" SET "expiresAt" = NOW() - INTERVAL '1 hour' WHERE id = ${res.json.id}`;
  const hit = await call('GET', `/${res.json.shortCode}`);
  assert.equal(hit.status, 410);
  await waitForClicks();
  const list = await call('GET', '/api/links', { token: tokenA });
  const row = list.json.data.find((l) => l.id === res.json.id);
  assert.equal(row.clicks, 0);
  assert.equal(row.isExpired, true);
});

test('stats: 7-day series is complete and counts today', async () => {
  const res = await call('GET', `/api/links/${link.id}/stats?tz=Africa/Nairobi`, { token: tokenA });
  assert.equal(res.status, 200);
  assert.equal(res.json.dailyClicks.length, 7);
  assert.equal(res.json.totalClicks, 3);
  assert.equal(res.json.dailyClicks.reduce((s, d) => s + d.clicks, 0), 3);
  assert.equal(res.json.dailyClicks[6].clicks, 3, 'last bucket is today');
  assert.equal(res.json.recentClicks.length, 3);

  const bad = await call('GET', `/api/links/${link.id}/stats?tz=Not/AZone`, { token: tokenA });
  assert.equal(bad.status, 200, 'invalid tz falls back to UTC');
  assert.equal(bad.json.timeZone, 'UTC');
});

test('analytics overview aggregates across links', async () => {
  const res = await call('GET', '/api/links/analytics/overview?tz=Africa/Nairobi', { token: tokenA });
  assert.equal(res.status, 200);
  assert.equal(res.json.dailyClicks.length, 7);
  assert.equal(res.json.clicksLast7Days, 3);
  assert.equal(res.json.totalClicks, 3);
  assert.ok(res.json.totalLinks >= 3);
});

test('QR code endpoint returns a PNG data URL', async () => {
  const res = await call('GET', `/api/links/${link.id}/qr`, { token: tokenA });
  assert.equal(res.status, 200);
  assert.match(res.json.qrCode, /^data:image\/png;base64,/);
});

test('stats: top referrers and browser breakdown', async () => {
  const mk = await call('POST', '/api/links', { token: tokenA, body: { url: 'https://example.com/analytics' } });
  const code = mk.json.shortCode;
  const hit = (headers) => fetch(`${api}/${code}`, { redirect: 'manual', headers });
  const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const EDGE = CHROME + ' Edg/126.0.0.0';
  const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';
  const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

  await hit({ referer: 'https://www.google.com/search?q=x', 'user-agent': CHROME });
  await hit({ referer: 'https://google.com/', 'user-agent': CHROME });
  await hit({ referer: 'https://twitter.com/someone/status/1', 'user-agent': FIREFOX });
  await hit({ 'user-agent': SAFARI });
  await hit({ 'user-agent': EDGE });
  await waitForClicks();

  const res = await call('GET', `/api/links/${mk.json.id}/stats`, { token: tokenA });
  assert.equal(res.status, 200);
  const refs = Object.fromEntries(res.json.topReferrers.map((r) => [r.source, r.clicks]));
  assert.equal(refs['google.com'], 2, 'www. is stripped and hosts are merged');
  assert.equal(refs['twitter.com'], 1);
  assert.equal(refs['Direct'], 2);
  const browsers = Object.fromEntries(res.json.browsers.map((b) => [b.browser, b.clicks]));
  assert.deepEqual(browsers, { Chrome: 2, Firefox: 1, Safari: 1, Edge: 1 });
  assert.equal(res.json.topReferrers[0].clicks >= res.json.topReferrers[1].clicks, true, 'sorted by clicks');
});

test('404 for browsers is an HTML page, for API clients JSON; 410 likewise', async () => {
  const html = await fetch(`${api}/nope-nope`, { headers: { accept: 'text/html' } });
  assert.equal(html.status, 404);
  assert.match(html.headers.get('content-type'), /text\/html/);
  assert.match(await html.text(), /Link not found/);

  const json = await call('GET', '/nope-nope');
  assert.equal(json.status, 404);
  assert.ok(json.json.error);

  const mk = await call('POST', '/api/links', { token: tokenA, body: { url: 'https://example.com/gone', expiresAt: new Date(Date.now() + 60000).toISOString() } });
  await prisma.$queryRaw`UPDATE "Link" SET "expiresAt" = NOW() - INTERVAL '1 hour' WHERE id = ${mk.json.id}`;
  const gone = await fetch(`${api}/${mk.json.shortCode}`, { headers: { accept: 'text/html' } });
  assert.equal(gone.status, 410);
  assert.match(await gone.text(), /Link expired/);
});

async function bulk(token, csv, query = '') {
  const res = await fetch(`${api}/api/links/bulk${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: csv,
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, body: type.includes('json') ? await res.json() : await res.text() };
}

test('bulk: requires auth and a body', async () => {
  assert.equal((await bulk(null, 'url\nhttps://example.com')).status, 401);
  assert.equal((await bulk(tokenA, '')).status, 400);
  assert.equal((await bulk(tokenA, 'url\n')).status, 400);
});

test('bulk: creates valid rows, reports bad rows, returns CSV', async () => {
  const bulkCode = `bulk-${tag}`.slice(0, 20);
  const csv = [
    'url,customCode',
    'https://example.com/one,',
    'https://example.com/two,' + bulkCode,
    'not a url,',
    'javascript:alert(1),',
    'https://example.com/three,' + bulkCode,        // duplicate code -> fails
    '"https://example.com/four?a=1,2",',            // comma inside quotes
    '=HYPERLINK("http://evil"),',                   // formula-looking junk -> invalid, must be escaped in output
  ].join('\r\n');

  const res = await bulk(tokenA, csv);
  assert.equal(res.status, 201);
  assert.equal(res.body.total, 7);
  assert.equal(res.body.created, 3);
  assert.equal(res.body.failed, 4);
  assert.equal(res.body.results[1].shortCode, bulkCode);
  assert.equal(res.body.results[2].status, 'failed');
  assert.match(res.body.results[4].error, /already taken/);
  assert.equal(res.body.results[5].originalUrl, 'https://example.com/four?a=1,2');
  assert.equal(res.body.results[5].status, 'created');
  assert.match(res.body.csv, /^original_url,short_url,status,error\r\n/);
  assert.match(res.body.csv, /'=HYPERLINK/, 'formula injection is neutralised in the CSV output');

  // The links really exist and belong to the user
  const list = await call('GET', '/api/links?pageSize=50', { token: tokenA });
  assert.ok(list.json.data.some((l) => l.shortCode === bulkCode));
});

test('bulk: headerless CSV, ?format=csv download, row cap', async () => {
  const plain = await bulk(tokenA, 'https://example.com/h1\nhttps://example.com/h2', '?format=csv');
  assert.equal(plain.status, 201);
  assert.match(plain.headers.get('content-type'), /text\/csv/);
  assert.match(plain.headers.get('content-disposition'), /attachment/);
  assert.equal(plain.body.trim().split('\r\n').length, 3, 'header + 2 rows');

  const tooMany = Array.from({ length: 201 }, (_, i) => `https://example.com/m${i}`).join('\n');
  assert.equal((await bulk(tokenA, tooMany)).status, 400);
});

test('bulk: all rows invalid returns 400', async () => {
  const res = await bulk(tokenA, 'url\nnope\nalso nope');
  assert.equal(res.status, 400);
  assert.equal(res.body.created, 0);
});

test('ownership: other users cannot see, stat, QR or delete my links', async () => {
  const listB = await call('GET', '/api/links', { token: tokenB });
  assert.equal(listB.json.data.some((l) => l.id === link.id), false);
  assert.equal((await call('GET', `/api/links/${link.id}/stats`, { token: tokenB })).status, 404);
  assert.equal((await call('GET', `/api/links/${link.id}/qr`, { token: tokenB })).status, 404);
  assert.equal((await call('DELETE', `/api/links/${link.id}`, { token: tokenB })).status, 404);
});

test('pagination', async () => {
  for (let i = 0; i < 4; i++) {
    await call('POST', '/api/links', { token: tokenB, body: { url: `https://example.com/p${i}` } });
  }
  const p1 = await call('GET', '/api/links?page=1&pageSize=3', { token: tokenB });
  assert.equal(p1.json.data.length, 3);
  assert.equal(p1.json.pagination.totalItems, 4);
  assert.equal(p1.json.pagination.totalPages, 2);
  assert.equal(p1.json.pagination.hasNextPage, true);
  const p2 = await call('GET', '/api/links?page=2&pageSize=3', { token: tokenB });
  assert.equal(p2.json.data.length, 1);
  assert.equal(p2.json.pagination.hasNextPage, false);
});

test('delete link removes it and cascades click events', async () => {
  assert.equal((await call('DELETE', `/api/links/${link.id}`, { token: tokenA })).status, 204);
  assert.equal((await call('GET', `/${link.shortCode}`)).status, 404);
  const rows = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "ClickEvent" WHERE "linkId" = ${link.id}`;
  assert.equal(rows[0].n, 0);
  assert.equal((await call('DELETE', `/api/links/abc`, { token: tokenA })).status, 404);
});

test('bad JSON body returns 400', async () => {
  const res = await fetch(api + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(res.status, 400);
});
