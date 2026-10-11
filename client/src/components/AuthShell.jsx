import Logo from './Logo';

// Shared layout for sign-in and registration: form on one side, a worked example on the other.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10 text-xl" />
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mb-6 mt-1 text-ink-soft">{subtitle}</p>
          {children}
          <p className="mt-6 text-sm text-ink-soft">{footer}</p>
        </div>
      </div>

      <aside aria-hidden="true" className="hidden bg-ink px-12 py-10 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="mx-auto w-full max-w-md">
          <p className="break-all text-sm leading-relaxed text-white/50">
            https://www.example.com/blog/2026/10/how-to-plan-a-launch-week-that-actually-ships?utm_source=newsletter&utm_campaign=autumn
          </p>
          <svg width="24" height="40" viewBox="0 0 24 40" className="my-3 text-[#7C89FF]">
            <path d="M12 2v32m0 0l-7-7m7 7l7-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-6xl font-extrabold tracking-tight">x7Kq2P</p>
          <p className="mt-6 max-w-xs text-white/70">
            Share the short one. See every click, per day, for every link.
          </p>
        </div>
      </aside>
    </div>
  );
}
