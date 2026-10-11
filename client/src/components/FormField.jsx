export default function FormField({ id, label, hint, ...props }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input
        id={id}
        {...props}
        className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/30"
      />
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
