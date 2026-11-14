/** A page with a folded corner turning into an arrow: a document changing form. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M10 7h8l5 5v13a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" fill="var(--accent-fg)" opacity="0.95" />
      <path d="M18 7v5h5" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.5 19.5h7m0 0-2.5-2.5m2.5 2.5L17 22" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
