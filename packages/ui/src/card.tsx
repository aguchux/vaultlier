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
        className,
      )}
    >
      {children}
    </div>
  );
}
