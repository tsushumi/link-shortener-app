// server/utils/analytics.js
// Helpers for the "clicks over the last 7 days" chart.

function resolveTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

// Returns ['YYYY-MM-DD', ...] oldest -> newest, ending with "today" in the given time zone
function lastNDays(n, tz) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()); // en-CA formats as YYYY-MM-DD

  const [y, m, d] = today.split('-').map(Number);
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    // Pure calendar arithmetic in UTC, so DST shifts can never skip or repeat a day
    days.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  }
  return days;
}

// Merge SQL rows ({ day, clicks }) into a complete series with zeros for quiet days
function fillSeries(days, rows) {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.clicks)]));
  return days.map((date) => ({ date, clicks: byDay.get(date) || 0 }));
}

module.exports = { resolveTimeZone, lastNDays, fillSeries };
