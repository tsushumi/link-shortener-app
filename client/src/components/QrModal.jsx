import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export default function QrModal({ link, token, onClose }) {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api(`/api/links/${link.id}/qr`, { token })
      .then((d) => !cancelled && setQr(d.qrCode))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [link.id, token]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={`QR code for ${link.shortUrl}`} className="pop w-full max-w-xs rounded-2xl bg-paper p-6 text-center shadow-xl">
        <p className="mb-4 break-all text-lg font-bold">{link.shortCode}</p>
        <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-line">
          {qr ? (
            <img src={qr} alt={`QR code that opens ${link.shortUrl}`} width="200" height="200" />
          ) : error ? (
            <p className="px-4 text-sm text-danger">{error}</p>
          ) : (
            <p className="text-sm text-ink-faint">Generating...</p>
          )}
        </div>
        <p className="mt-3 break-all text-sm text-ink-soft">{link.shortUrl}</p>
        <div className="mt-5 flex gap-2">
          {qr && (
            <a
              href={qr}
              download={`qr-${link.shortCode}.png`}
              className="flex-1 rounded-lg bg-cobalt px-4 py-2 text-sm font-semibold text-white hover:bg-cobalt-dark"
            >
              Download PNG
            </a>
          )}
          <button
            ref={closeRef}
            onClick={onClose}
            className="flex-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-chalk"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
