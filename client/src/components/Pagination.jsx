export default function Pagination({ pagination, onPage, disabled }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, totalItems, pageSize } = pagination;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const btn =
    'rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-chalk disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-6">
      <p className="text-sm text-ink-soft">
        {from}-{to} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={disabled || !pagination.hasPreviousPage} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span className="px-1 text-sm text-ink-soft" aria-current="page">
          Page {page} of {totalPages}
        </span>
        <button className={btn} disabled={disabled || !pagination.hasNextPage} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}
