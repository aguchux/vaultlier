import type { ReactNode } from "react";
import { cn } from "./lib/cn";

/** Generic surface card. */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface shadow-sm",
        "dark:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
