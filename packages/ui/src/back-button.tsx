"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "./lib/cn";

/**
 * Back-navigation icon button for subsidiary pages. Steps back through the
 * app's own history (router.back) so users don't have to reach for the
 * browser's back button. Falls back to a provided `href` when there is no
 * in-app history to return to (e.g. a deep link opened in a fresh tab).
 */
export function BackButton({
  href,
  label = "Go back",
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}): React.JSX.Element {
  const router = useRouter();

  const onClick = (): void => {
    // history.length <= 1 means this is the first entry in the tab's history;
    // there is nothing in-app to go back to, so use the fallback if given.
    if (href && typeof window !== "undefined" && window.history.length <= 1) {
      router.push(href);
      return;
    }
    router.back();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/10 text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900",
        "dark:border-white/10 dark:text-ink-300 dark:hover:bg-white/5 dark:hover:text-white",
        className,
      )}
    >
      <ArrowLeft className="h-[18px] w-[18px]" />
    </button>
  );
}
