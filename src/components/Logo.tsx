export function Logo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg
        viewBox="0 0 40 40"
        className="h-9 w-9 shrink-0 drop-shadow-[0_3px_8px_rgba(16,185,129,0.28)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="promo-log-mark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="12" fill="url(#promo-log-mark)" />
        <circle cx="20" cy="20.5" r="10.5" fill="#ffffff" opacity="0.16" />
        <circle
          cx="20"
          cy="20.5"
          r="8.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.4"
        />
        <path
          d="M20 14.8v5.7l4.2 2.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M30.5 7.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"
          fill="#fef08a"
        />
      </svg>
      <span className="text-lg font-bold tracking-tight text-slate-900">
        Promo <span className="text-emerald-600">Log</span>
      </span>
    </div>
  );
}
