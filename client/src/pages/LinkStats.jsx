import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, userTimeZone } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { formatDate, formatDateTime, referrerHost, timeAgo } from '../lib/format';
import BrowserChart from '../components/BrowserChart';
import ClicksChart from '../components/ClicksChart';
import Logo from '../components/Logo';
import ReferrersChart from '../components/ReferrersChart';

function Panel({ title, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-line bg-paper p-5 sm:p-6 ${className}`}>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

// Remounts per link id, so state never carries over from one link to another
export default function LinkStatsRoute() {
  const { id } = useParams();
  return <LinkStats key={id} id={id} />;
}

function LinkStats({ id }) {
  const { token, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api(`/api/links/${id}/stats?tz=${encodeURIComponent(userTimeZone())}`, { token })
      .then((d) => !cancelled && setStats(d))
      .catch((e) => !cancelled && setError(e.status === 404 ? 'This link does not exist or belongs to another account.' : e.message));
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const handleCopy = async () => {
    if (!(await copyText(stats.shortUrl))) return;
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/dashboard" aria-label="LinkSnap dashboard"><Logo className="text-lg" /></Link>
          <button onClick={logout} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-chalk">
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <Link to="/dashboard" className="inline-block rounded-md text-sm font-semibold text-cobalt hover:underline">
          Back to all links
        </Link>

        {error ? (
          <div className="mt-6 rounded-2xl border border-line bg-paper px-6 py-12 text-center">
            <p className="text-lg font-semibold">{error}</p>
            <Link to="/dashboard" className="mt-4 inline-block rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white hover:bg-cobalt-dark">
              Go to your links
            </Link>
          </div>
        ) : !stats ? (
          <div className="mt-6 animate-pulse space-y-4" aria-busy="true">
            <div className="h-10 w-56 rounded bg-line" />
            <div className="h-64 rounded-2xl bg-line" />
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="m-0 break-all text-4xl font-extrabold tracking-tight">{stats.shortCode}</h1>
                <a href={stats.shortUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-cobalt hover:underline">
                  {stats.shortUrl}
                </a>
                <p className="mt-1 break-all text-sm text-ink-soft">Redirects to {stats.originalUrl}</p>
              </div>
              <button
                onClick={handleCopy}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  copied ? 'bg-ok-wash text-ok' : 'bg-cobalt-wash text-cobalt hover:bg-cobalt hover:text-white'
                }`}
              >
                {copied ? 'Copied' : 'Copy short link'}
              </button>
            </div>

            <dl className="m-0 mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
              {[
                ['Total clicks', stats.totalClicks],
                ['Last clicked', timeAgo(stats.lastClicked)],
                ['Created', formatDate(stats.createdAt)],
                ['Expires', stats.expiresAt ? (stats.isExpired ? `Expired ${formatDate(stats.expiresAt)}` : formatDate(stats.expiresAt)) : 'Never'],
              ].map(([label, value]) => (
                <div key={label} className="bg-paper px-4 py-3">
                  <dt className="text-xs text-ink-faint">{label}</dt>
                  <dd className={`m-0 mt-0.5 font-bold ${label === 'Total clicks' ? 'text-2xl tabular-nums' : 'text-base'} ${label === 'Expires' && stats.isExpired ? 'text-danger' : ''}`}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Panel title="Clicks, last 7 days" className="lg:col-span-2">
                <ClicksChart data={stats.dailyClicks} height={220} />
              </Panel>
              <Panel title="Browsers">
                <BrowserChart data={stats.browsers} />
              </Panel>
              <Panel title="Top referrers">
                <ReferrersChart data={stats.topReferrers} />
              </Panel>
              <Panel title="Latest clicks" className="lg:col-span-2">
                {stats.recentClicks.length === 0 ? (
                  <p className="text-sm text-ink-faint">Nobody has opened this link yet. Share it and clicks will show up here.</p>
                ) : (
                  <ul className="m-0 max-h-72 list-none divide-y divide-line overflow-y-auto p-0 text-sm">
                    {stats.recentClicks.slice(0, 20).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-4 py-2">
                        <span className="min-w-0 truncate">
                          {referrerHost(c.referrer)}
                        </span>
                        <span className="shrink-0 text-ink-faint">{formatDateTime(c.clickedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
