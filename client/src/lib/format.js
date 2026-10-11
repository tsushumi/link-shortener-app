export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

export function timeAgo(value) {
  if (!value) return 'Never';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'Just now';
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, size] of units) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${name}${n === 1 ? '' : 's'} ago`;
    }
  }
  return 'Just now';
}

// 'YYYY-MM-DD' -> 'Mon'
export function weekday(isoDay) {
  return new Date(`${isoDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

// Value for <input type="datetime-local" min=...> in the user's local time
export function localInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function stripProtocol(url) {
  return url.replace(/^https?:\/\//, '');
}

// Hostname of a referrer URL, or 'Direct visit' when absent/unparseable
export function referrerHost(referrer) {
  if (!referrer) return 'Direct visit';
  try {
    // Same normalisation the server applies for the referrer chart: lowercase, no leading www.
    return new URL(referrer).host.toLowerCase().replace(/^www\./, '') || 'Direct visit';
  } catch {
    return 'Direct visit';
  }
}
