export default function Toast({ toast }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`pop fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg sm:left-auto sm:right-5 sm:translate-x-0 ${
        isError ? 'bg-danger' : 'bg-ink'
      }`}
    >
      {toast.message}
    </div>
  );
}
