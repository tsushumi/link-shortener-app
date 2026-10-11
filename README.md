# LinkSnap: Link Shortener

A full-stack link shortener. Paste a long URL, get a 6-character short link, share it, and see where every click comes from: clicks per day, top referrers and a browser breakdown. Includes QR codes, custom codes, link expiry and bulk creation from a CSV file.

![Dashboard with six links and a 7-day clicks chart](docs/screenshots/dashboard.png)

| Link analytics | Bulk CSV upload | Analytics on mobile |
| --- | --- | --- |
| ![Analytics page with clicks per day, browser pie chart and referrer bars](docs/screenshots/stats.png) | ![Bulk upload showing 2 of 4 links created and per-row errors](docs/screenshots/bulk.png) | ![Analytics page on a phone](docs/screenshots/stats-mobile.png) |

## Features

**Core**
- Register and log in with email, name and password (JWT, bcrypt-hashed passwords); protected routes
- Shorten any `http(s)` URL into a unique 6-character code (nanoid), with collision handling
- `GET /:shortCode` redirects with a `301`, is never behind authentication, and shows a 404 page for unknown codes
- Every visit records timestamp, referrer and user agent, and increments the link's click count, without slowing the redirect
- Dashboard of your links with click counts, created date and last-clicked time, paginated and responsive
- Per-link analytics page: clicks over the last 7 days, top referrers, browser breakdown (parsed from the user agent)
- Copy short URL to the clipboard in one click
- Delete a link (cascades to its click events); you can only see and manage your own links
- QR code per link, shown in a modal and downloadable as a PNG

**Stretch goals (all four)**
- **Custom short codes**: letters, numbers and hyphens, 3-20 characters, checked for uniqueness
- **Link expiration**: expired links answer `410 Gone` and are badged in the dashboard
- **Analytics charts**: clicks over time (bar chart), browsers (pie chart), referrers (horizontal bar chart), built with Recharts
- **Bulk link creation**: upload a CSV, create up to 200 links at once, download a CSV of original URLs and their short links

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite, React Router, Tailwind CSS 4, Recharts |
| Backend | Node.js, Express 5, JWT, bcrypt, nanoid 3, qrcode, express-rate-limit |
| Database | PostgreSQL with Prisma 6 |
| Hosting | Vercel (client), Railway (server and database) |

## Setup

You need Node 18+ and a PostgreSQL database.

### 1. Server

```bash
cd server
cp .env.example .env        # then edit the values
npm install                 # also runs `prisma generate`
npx prisma migrate dev      # creates the tables
npm run seed                # optional: demo account with 6 links and click data
npm run dev                 # http://localhost:5000
```

`server/.env`:

| Variable | Example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/linkshortener` | Postgres connection string |
| `JWT_SECRET` | a long random string | Signs login tokens. Required |
| `PORT` | `5000` | API port |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin(s). Comma-separate several |
| `BASE_URL` | `http://localhost:5000` | Public URL of the API, used to build short URLs |

### 2. Client

```bash
cd client
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm install
npm run dev                 # http://localhost:5173
```

### 3. Tests

```bash
cd server
npm test
```

28 tests: the real Express app runs against your Postgres database (auth, validation, redirects, click counting, expiry, analytics, QR, ownership, pagination, bulk upload, 404/410 pages), plus unit tests for the CSV and user-agent parsers. Tests create throwaway users and clean up after themselves.

### Demo data

`npm run seed` creates `demo@linksnap.app` with six links (4 to 64 clicks each) and click events spread over the last 7 days with a realistic mix of referrers and browsers. It replaces that account's links each time, so it is safe to re-run. 

## API reference

All `/api/links` routes need `Authorization: Bearer <token>`. Errors are `{ "error": "message" }`.

| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Create an account. Body: `email`, `name`, `password` (8+ chars). Returns `{ user, token }` | No |
| POST | `/api/auth/login` | Log in. Body: `email`, `password`. Returns `{ user, token }` | No |
| POST | `/api/links` | Create a link. Body: `url`, optional `customCode`, optional `expiresAt` (ISO date) | Yes |
| POST | `/api/links/bulk` | Create many links from CSV text (`Content-Type: text/csv`). See below | Yes |
| GET | `/api/links?page=1&pageSize=10` | Your links, newest first, with `pagination` metadata (`pageSize` max 50) | Yes |
| GET | `/api/links/analytics/overview?tz=Africa/Nairobi` | Totals and clicks per day for the last 7 days across all your links | Yes |
| GET | `/api/links/:id/stats?tz=Africa/Nairobi` | Detailed analytics for one link. See below | Yes |
| GET | `/api/links/:id/qr` | QR code for the short URL as a PNG data URL | Yes |
| DELETE | `/api/links/:id` | Delete a link and its click history. Returns `204` | Yes |
| GET | `/:shortCode` | Redirect (`301`) to the original URL and record the click. `404` if unknown, `410` if expired | No |
| GET | `/health` | Health check | No |

`/:shortCode` answers browsers (`Accept: text/html`) with a small HTML error page and API clients with JSON.

**Create link**

```bash
curl -X POST http://localhost:5000/api/links \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/long/path","customCode":"my-portfolio","expiresAt":"2026-12-31T23:59:00Z"}'
```

```json
{
  "id": 7,
  "originalUrl": "https://example.com/long/path",
  "shortCode": "my-portfolio",
  "shortUrl": "http://localhost:5000/my-portfolio",
  "clicks": 0,
  "lastClicked": null,
  "expiresAt": "2026-12-31T23:59:00.000Z",
  "isExpired": false,
  "createdAt": "2026-10-09T15:00:00.000Z"
}
```

**Link analytics** (`GET /api/links/:id/stats`) returns the link fields above plus:

```json
{
  "totalClicks": 64,
  "dailyClicks":  [{ "date": "2026-10-04", "clicks": 5 }, "... 7 days, oldest first, zeros included"],
  "topReferrers": [{ "source": "Direct", "clicks": 21 }, { "source": "google.com", "clicks": 18 }],
  "browsers":     [{ "browser": "Chrome", "clicks": 33 }, { "browser": "Safari", "clicks": 16 }],
  "recentClicks": ["... the 50 most recent click events"]
}
```

Referrers are reduced to their hostname (`www.` removed, no referrer = `Direct`) and the top 8 are returned. Pass the browser's IANA time zone as `tz` so days line up with the viewer's calendar.

**Bulk create** (`POST /api/links/bulk`)

```bash
curl -X POST "http://localhost:5000/api/links/bulk?format=csv" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/csv" \
  --data-binary @links.csv -o short-links.csv
```

- The first column is the URL. If the first row is a header, `url`, `customCode` and `expiresAt` columns are recognised by name.
- At most 200 rows and 512 KB per request. Each row is validated independently: bad rows are reported and do not stop the rest.
- By default the response is JSON `{ total, created, failed, results: [...], csv }`. With `?format=csv` it is the CSV file itself, with columns `original_url, short_url, status, error`. Cells that start with `=`, `+`, `-` or `@` are prefixed with `'` so spreadsheets never run them as formulas.

**Validation rules**
- URLs must be `http://` or `https://`, at most 2048 characters, and must not point back at this service
- Custom codes: 3-20 letters, numbers or hyphens; reserved words such as `api`, `login` and `dashboard` are refused
- Expiry must be a valid date in the future
