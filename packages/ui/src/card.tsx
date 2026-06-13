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
        "rounded-2xl border border-black/5 bg-white shadow-sm",
        "dark:border-white/10 dark:bg-white/5 dark:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
