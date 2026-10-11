// server/scripts/seed-demo.js
// Creates a demo account with 6 links and a week of realistic click data, so the dashboard and
// analytics pages have something to show for a demo.
// Safe to re-run: the demo user's existing links are replaced.
require('dotenv').config();
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');

const EMAIL = (process.env.DEMO_EMAIL || 'demo@linksnap.app').toLowerCase();
const PASSWORD = process.env.DEMO_PASSWORD || 'demo-password-123';

// Small deterministic PRNG so the demo data looks the same every run
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(2026);
const pick = (items) => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = random() * total;
  for (const [value, weight] of items) { if ((r -= weight) <= 0) return value; }
  return items[0][0];
};

const REFERRERS = [
  [null, 30],
  ['https://www.google.com/search?q=link+shortener', 24],
  ['https://twitter.com/home', 14],
  ['https://www.linkedin.com/feed/', 12],
  ['https://news.ycombinator.com/item?id=41234567', 9],
  ['https://www.reddit.com/r/webdev/', 6],
];
const AGENTS = [
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 40],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 22],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 14],
  ['Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0', 12],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0', 8],
  ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', 4],
];

const LINKS = [
  { code: 'demo-portfolio', url: 'https://github.com/your-username/portfolio', clicks: 64 },
  { code: 'demo-launch', url: 'https://www.producthunt.com/posts/example-launch-day', clicks: 41 },
  { code: 'demo-docs', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', clicks: 27 },
  { code: 'demo-blog', url: 'https://dev.to/your-username/how-i-built-a-link-shortener', clicks: 18 },
  { code: 'demo-newsletter', url: 'https://example.substack.com/p/october-roundup', clicks: 9 },
  { code: 'demo-resume', url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view', clicks: 4 },
];

async function main() {
  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: EMAIL, name: 'Demo User', password: await bcrypt.hash(PASSWORD, 10) },
    });
    console.log(`Created demo user ${EMAIL}`);
  } else {
    await prisma.link.deleteMany({ where: { userId: user.id } }); // cascades to click events
    console.log(`Reusing demo user ${EMAIL}; replaced their links`);
  }

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  for (const [index, spec] of LINKS.entries()) {
    const createdAt = new Date(now - (7 - index) * DAY * 0.9);
    const link = await prisma.link.create({
      data: { originalUrl: spec.url, shortCode: spec.code, userId: user.id, createdAt, expiresAt: index === 4 ? new Date(now + 21 * DAY) : null },
    });

    // Spread clicks across the last 7 days, weighted toward recent days, never before creation
    const events = [];
    for (let i = 0; i < spec.clicks; i++) {
      const daysAgo = Math.min(6, Math.floor(Math.pow(random(), 1.6) * 7));
      let clickedAt = new Date(now - daysAgo * DAY - Math.floor(random() * 20 * 60 * 60 * 1000));
      if (clickedAt < createdAt || clickedAt > now) clickedAt = new Date(now - Math.floor(random() * 3 * 60 * 60 * 1000));
      events.push({ linkId: link.id, referrer: pick(REFERRERS), userAgent: pick(AGENTS), clickedAt });
    }
    await prisma.clickEvent.createMany({ data: events });

    const last = events.reduce((a, b) => (a.clickedAt > b.clickedAt ? a : b)).clickedAt;
    await prisma.link.update({ where: { id: link.id }, data: { clicks: spec.clicks, lastClicked: last } });
    console.log(`  ${spec.code.padEnd(16)} ${String(spec.clicks).padStart(3)} clicks`);
  }

  console.log(`\nDone. Log in with ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
