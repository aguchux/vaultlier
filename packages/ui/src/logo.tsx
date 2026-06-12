import { cn } from "./lib/cn";

/** Vaultlier wordmark: shield-with-keyhole mark + name. */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}): React.JSX.Element {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <ShieldMark className="h-8 w-8 text-brand-600" />
      {showWordmark ? (
        <span className="text-xl font-bold tracking-tight text-ink-900">
          Vaultlier
        </span>
      ) : null}
    </span>
  );
}

export function ShieldMark({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12 2 4 5v6c0 4.5 3.2 8.4 8 9.8 4.8-1.4 8-5.3 8-9.8V5l-8-3Z"
        fill="currentColor"
      />
      <circle cx="12" cy="10.5" r="2.2" fill="white" />
      <rect x="11" y="11.5" width="2" height="4" rx="1" fill="white" />
    </svg>
  );
}
