import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, userTimeZone } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { localInputValue } from '../lib/format';
import BulkUpload from '../components/BulkUpload';
import ClicksChart from '../components/ClicksChart';
import LinkRow from '../components/LinkRow';
import Logo from '../components/Logo';
import Pagination from '../components/Pagination';
import QrModal from '../components/QrModal';
import Toast from '../components/Toast';

const PAGE_SIZE = 8;

const field =
  'w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/30';

export default function Dashboard() {
  const { user, token, logout } = useAuth();

  const [links, setLinks] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [overview, setOverview] = useState(null);

  const [url, setUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [minExpiry, setMinExpiry] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);

  const [freshId, setFreshId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [qrLink, setQrLink] = useState(null);
  const [toast, setToast] = useState(null);

  const toastTimer = useRef(null);
  const copyTimer = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(copyTimer.current);
    },
    []
  );

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await api(`/api/links/analytics/overview?tz=${encodeURIComponent(userTimeZone())}`, { token }));
    } catch {
      /* the chart is secondary; the list still works without it */
    }
  }, [token]);

  const loadLinks = useCallback(
    async (targetPage) => {
      setListLoading(true);
      setListError(null);
      try {
        const res = await api(`/api/links?page=${targetPage}&pageSize=${PAGE_SIZE}`, { token });
        // Deleting the last item on the final page leaves it empty: step back one page
        if (res.data.length === 0 && targetPage > 1) {
          setPage(targetPage - 1);
          return;
        }
        setLinks(res.data);
        setPagination(res.pagination);
      } catch (err) {
        setListError(err.message);
      } finally {
        setListLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadLinks(page);
  }, [page, loadLinks]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const body = { url: url.trim() };
      if (customCode.trim()) body.customCode = customCode.trim();
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();

      const created = await api('/api/links', { method: 'POST', token, body });

      setUrl('');
      setCustomCode('');
      setExpiresAt('');
      setFreshId(created.id);
      showToast('Short link created');

      // New links sort first, so jump to page 1 and reload to keep pagination honest
      if (page === 1) await loadLinks(1);
      else setPage(1);
      loadOverview();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleBulkDone = async (created) => {
    if (created > 0) {
      showToast(`${created} short ${created === 1 ? 'link' : 'links'} created`);
      if (page === 1) await loadLinks(1);
      else setPage(1);
      loadOverview();
    }
  };

  const handleDelete = async (link) => {
    try {
      await api(`/api/links/${link.id}`, { method: 'DELETE', token });
      showToast('Link deleted');
      await loadLinks(page);
      loadOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCopy = async (link) => {
    const ok = await copyText(link.shortUrl);
    if (!ok) return showToast('Copy failed. Select the link and copy it manually.', 'error');
    setCopiedId(link.id);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 2000);
  };

  const total = pagination?.totalItems ?? 0;

  return (
    <div className="min-h-screen">
      <Toast toast={toast} />
      {qrLink && <QrModal link={qrLink} token={token} onClose={() => setQrLink(null)} />}

      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Logo className="text-lg" />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ink-soft sm:inline">{user?.name}</span>
            <button onClick={logout} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-chalk">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <section aria-labelledby="create-heading">
          <h1 id="create-heading" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Paste a long link. Get a short one.
          </h1>
          <form onSubmit={handleCreate} className="mt-5" noValidate>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="url">Long URL</label>
              <input
                id="url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/a/very/long/address"
                required
                className={`${field} flex-1`}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={creating || !url.trim()}
                className="rounded-xl bg-cobalt px-7 py-3 text-base font-bold text-white transition-colors hover:bg-cobalt-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? 'Shortening...' : 'Shorten'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMinExpiry(localInputValue(new Date()));
                setShowOptions((s) => !s);
              }}
              aria-expanded={showOptions}
              aria-controls="options"
              className="mt-3 rounded-md text-sm font-semibold text-cobalt hover:underline"
            >
              {showOptions ? 'Hide options' : 'Custom code and expiry'}
            </button>

            {showOptions && (
              <div id="options" className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="customCode" className="mb-1 block text-sm font-medium">Custom code</label>
                  <input
                    id="customCode"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    placeholder="my-portfolio"
                    maxLength={20}
                    className={field}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  <p className="mt-1 text-xs text-ink-faint">3-20 letters, numbers or hyphens. Leave empty for a random code.</p>
                </div>
                <div>
                  <label htmlFor="expiresAt" className="mb-1 block text-sm font-medium">Expires on</label>
                  <input
                    id="expiresAt"
                    type="datetime-local"
                    value={expiresAt}
                    min={minExpiry}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className={field}
                  />
                  <p className="mt-1 text-xs text-ink-faint">After this time the link stops redirecting. Leave empty to keep it forever.</p>
                </div>
              </div>
            )}

            {formError && (
              <p role="alert" className="mt-3 rounded-lg bg-danger-wash px-3 py-2 text-sm font-medium text-danger">
                {formError}
              </p>
            )}
          </form>
          <BulkUpload token={token} onDone={handleBulkDone} />
        </section>

        <section aria-labelledby="activity-heading" className="mt-10 rounded-2xl border border-line bg-paper p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <h2 id="activity-heading" className="text-lg font-bold">Clicks, last 7 days</h2>
            {overview && (
              <p className="m-0 text-sm text-ink-soft">
                <strong className="text-ink">{overview.clicksLast7Days}</strong> this week
                {' · '}
                <strong className="text-ink">{overview.totalClicks}</strong> all time across{' '}
                <strong className="text-ink">{overview.totalLinks}</strong> {overview.totalLinks === 1 ? 'link' : 'links'}
              </p>
            )}
          </div>
          {overview ? (
            <ClicksChart data={overview.dailyClicks} />
          ) : (
            <div className="h-[190px] animate-pulse rounded-xl bg-chalk" aria-hidden="true" />
          )}
        </section>

        <section aria-labelledby="links-heading" className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper">
          <div className="border-b border-line px-4 py-4 sm:px-6">
            <h2 id="links-heading" className="text-lg font-bold">Your links</h2>
            <p className="m-0 text-sm text-ink-soft">{total} {total === 1 ? 'link' : 'links'}</p>
          </div>

          {listError ? (
            <div className="px-6 py-10 text-center">
              <p className="text-danger">{listError}</p>
              <button onClick={() => loadLinks(page)} className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-chalk">
                Try again
              </button>
            </div>
          ) : listLoading && links.length === 0 ? (
            <ul className="m-0 list-none p-0" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="animate-pulse border-b border-line px-6 py-5 last:border-b-0">
                  <div className="mb-2 h-6 w-28 rounded bg-chalk" />
                  <div className="h-3.5 w-2/3 rounded bg-chalk" />
                </li>
              ))}
            </ul>
          ) : links.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-lg font-semibold">No links yet</p>
              <p className="mt-1 text-ink-soft">Paste a URL above and your first short link will appear here.</p>
            </div>
          ) : (
            <ul className={`m-0 list-none p-0 transition-opacity ${listLoading ? 'opacity-60' : ''}`}>
              {links.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  fresh={link.id === freshId}
                  copied={copiedId === link.id}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                  onQr={setQrLink}
                />
              ))}
            </ul>
          )}

          <Pagination pagination={pagination} onPage={setPage} disabled={listLoading} />
        </section>
      </main>
    </div>
  );
}
