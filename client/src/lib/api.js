// Tiny fetch wrapper: attaches the JWT, parses JSON, and surfaces server error messages.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.status = status;
    this.data = data; // parsed JSON body, e.g. per-row results of a bulk upload
  }
}

// `body` is sent as JSON; `rawBody` is sent as-is with `contentType` (used for CSV uploads)
export async function api(path, { method = 'GET', token, body, rawBody, contentType } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(rawBody != null ? { 'Content-Type': contentType || 'text/plain' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: rawBody != null ? rawBody : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    // An expired or invalid token on a protected call sends the user back to the login page
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

export const userTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};
