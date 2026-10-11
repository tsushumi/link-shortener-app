import { useId, useRef, useState } from 'react';
import { api } from '../lib/api';
import { downloadText } from '../lib/download';

const MAX_BYTES = 512 * 1024;
const TEMPLATE = 'url,customCode,expiresAt\nhttps://example.com/first-page,,\nhttps://example.com/second-page,my-second-page,2027-01-31T23:59:00Z\n';

// Upload a CSV of URLs, create all the short links at once, and download the results as CSV.
export default function BulkUpload({ token, onDone }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const inputId = useId();

  const reset = () => {
    setFile(null);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = (e) => {
    const picked = e.target.files?.[0] || null;
    setResult(null);
    setError(null);
    if (picked && picked.size > MAX_BYTES) {
      setFile(null);
      setError('That file is larger than 512 KB. Split it into smaller files of up to 200 links.');
      e.target.value = '';
      return;
    }
    setFile(picked);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const data = await api('/api/links/bulk', { method: 'POST', token, rawBody: text, contentType: 'text/csv' });
      setResult(data);
      onDone?.(data.created);
    } catch (err) {
      // A batch where every row failed still carries per-row details
      if (err.data?.results) setResult(err.data);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const failedRows = result ? result.results.filter((r) => r.status === 'failed') : [];

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="bulk-panel"
        className="rounded-md text-sm font-semibold text-cobalt hover:underline"
      >
        {open ? 'Hide bulk upload' : 'Upload a CSV to shorten many links at once'}
      </button>

      {open && (
        <div id="bulk-panel" className="mt-3 rounded-xl border border-line bg-paper p-4">
          <p className="m-0 text-sm text-ink-soft">
            One link per row. The first column is the URL; optional <code>customCode</code> and <code>expiresAt</code> columns are
            read when the file has a header row. Up to 200 links per file.{' '}
            <button
              type="button"
              onClick={() => downloadText('link-shortener-template.csv', TEMPLATE)}
              className="rounded font-semibold text-cobalt hover:underline"
            >
              Download a template
            </button>
          </p>

          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor={inputId} className="sr-only">CSV file</label>
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-cobalt-wash file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cobalt hover:file:bg-cobalt hover:file:text-white sm:flex-1"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!file || busy}
                className="rounded-lg bg-cobalt px-5 py-2 text-sm font-bold text-white hover:bg-cobalt-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Creating...' : 'Create links'}
              </button>
              {(file || result) && (
                <button type="button" onClick={reset} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-chalk">
                  Clear
                </button>
              )}
            </div>
          </form>

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-danger-wash px-3 py-2 text-sm font-medium text-danger">{error}</p>
          )}

          {result && (
            <div className="mt-4" role="status">
              <p className="m-0 text-sm">
                <strong>{result.created}</strong> of {result.total} {result.total === 1 ? 'link' : 'links'} created
                {result.failed > 0 && <>, <strong className="text-danger">{result.failed} failed</strong></>}.
              </p>

              {failedRows.length > 0 && (
                <ul className="m-0 mt-2 max-h-40 list-none divide-y divide-line overflow-y-auto rounded-lg border border-line p-0 text-sm">
                  {failedRows.slice(0, 20).map((r) => (
                    <li key={r.row} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:justify-between sm:gap-4">
                      <span className="min-w-0 truncate text-ink-soft">Row {r.row}: {r.originalUrl || '(empty)'}</span>
                      <span className="shrink-0 text-danger">{r.error}</span>
                    </li>
                  ))}
                </ul>
              )}
              {failedRows.length > 20 && (
                <p className="mt-1 text-xs text-ink-faint">Showing the first 20 failures. The downloaded CSV lists every row.</p>
              )}

              <button
                type="button"
                onClick={() => downloadText(`short-links-${new Date().toISOString().slice(0, 10)}.csv`, result.csv)}
                className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:bg-chalk"
              >
                Download results (CSV)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
