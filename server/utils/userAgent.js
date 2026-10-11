// server/utils/userAgent.js
// Minimal user-agent -> browser name parser. Order matters: Edge, Opera and Chrome-based
// browsers all contain "Chrome", and Chrome contains "Safari".

const BOT_PATTERN = /bot|crawler|spider|slurp|facebookexternalhit|slackbot|preview|headless/i;

function parseBrowser(userAgent) {
  if (!userAgent) return 'Unknown';
  const ua = String(userAgent);

  if (BOT_PATTERN.test(ua)) return 'Bot';
  if (/edg(e|a|ios)?\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser\//i.test(ua)) return 'Samsung Internet';
  if (/firefox\/|fxios\//i.test(ua)) return 'Firefox';
  if (/chrome\/|crios\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua)) return 'Safari';
  if (/curl\/|wget\/|postman|insomnia|python-requests|node|axios|okhttp/i.test(ua)) return 'API client';
  return 'Other';
}

// rows: [{ ua, clicks }] -> [{ browser, clicks }] sorted by clicks desc
function summarizeBrowsers(rows) {
  const totals = new Map();
  for (const { ua, clicks } of rows) {
    const browser = parseBrowser(ua);
    totals.set(browser, (totals.get(browser) || 0) + Number(clicks));
  }
  return [...totals.entries()]
    .map(([browser, clicks]) => ({ browser, clicks }))
    .sort((a, b) => b.clicks - a.clicks || a.browser.localeCompare(b.browser));
}

module.exports = { parseBrowser, summarizeBrowsers };
