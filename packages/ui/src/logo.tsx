import { cn } from "./lib/cn";

/** Vaultlier wordmark backed by the canonical raster brand mark. */
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}): React.JSX.Element {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <ShieldMark className="h-8 w-8" />
      {showWordmark ? (
        <span className="text-xl font-bold tracking-tight text-ink-900 dark:text-white">
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
    // The same public path is populated in every Vaultlier site.
    <img
      src="/brand/logo.png"
      alt=""
      aria-hidden="true"
      width={64}
      height={64}
      className={cn("block object-contain", className)}
    />
  );
}
