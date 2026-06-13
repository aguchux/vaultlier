import type { ReactNode } from "react";
import { cn } from "./lib/cn";

/** Small pill used for trust lines and labels. */
export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400",
        className,
      )}
    >
      {children}
    </span>
  );
}
