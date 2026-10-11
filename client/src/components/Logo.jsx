export default function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#101828" />
        <path d="M9 21l6-10M15 21l6-10" stroke="#7C89FF" strokeWidth="3" strokeLinecap="round" />
      </svg>
      LinkSnap
    </span>
  );
}
