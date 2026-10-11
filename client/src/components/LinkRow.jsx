import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, stripProtocol, timeAgo } from '../lib/format';

const iconBtn =
  'rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-chalk hover:text-ink';

export default function LinkRow({ link, fresh, copied, onCopy, onDelete, onQr }) {
  const [confirming, setConfirming] = useState(false);

  // Cancel the delete confirmation if the user wanders off
  useEffect(() => {
    if (!confirming) return undefined;
    const t = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <li className={`${fresh ? 'arrive' : ''} border-b border-line last:border-b-0`}>
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <a
              href={link.shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-full truncate text-2xl font-extrabold tracking-tight text-ink hover:text-cobalt"
              title={link.shortUrl}
            >
              {link.shortCode}
            </a>
            {link.isExpired && (
              <span className="rounded-md bg-danger-wash px-2 py-0.5 text-xs font-semibold text-danger">Expired</span>
            )}
            {!link.isExpired && link.expiresAt && (
              <span className="rounded-md bg-amber-wash px-2 py-0.5 text-xs font-semibold text-amber">
                Expires {formatDate(link.expiresAt)}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-soft" title={link.originalUrl}>
            {stripProtocol(link.originalUrl)}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-faint">{link.shortUrl}</p>
        </div>

        <dl className="m-0 flex items-center gap-6 text-sm sm:grid sm:grid-cols-[3.5rem_8.5rem_7rem]">
          <div>
            <dt className="text-xs text-ink-faint">Clicks</dt>
            <dd className="m-0 text-xl font-bold tabular-nums">{link.clicks}</dd>
          </div>
          <div className="hidden sm:block">
            <dt className="text-xs text-ink-faint">Last clicked</dt>
            <dd className="m-0 text-ink-soft">{timeAgo(link.lastClicked)}</dd>
          </div>
          <div className="hidden sm:block">
            <dt className="text-xs text-ink-faint">Created</dt>
            <dd className="m-0 text-ink-soft">{formatDate(link.createdAt)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => onCopy(link)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              copied ? 'bg-ok-wash text-ok' : 'bg-cobalt-wash text-cobalt hover:bg-cobalt hover:text-white'
            }`}
            aria-label={`Copy ${link.shortUrl}`}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={() => onQr(link)} className={iconBtn}>
            QR code
          </button>
          <Link to={`/links/${link.id}`} className={iconBtn} aria-label={`View analytics for ${link.shortCode}`}>
            Analytics
          </Link>
          {confirming ? (
            <span className="ml-1 flex items-center gap-1">
              <button
                onClick={() => onDelete(link)}
                className="rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Delete link
              </button>
              <button onClick={() => setConfirming(false)} className={iconBtn}>
                Keep
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className={`${iconBtn} hover:!bg-danger-wash hover:!text-danger`}
              aria-label={`Delete ${link.shortCode}`}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
