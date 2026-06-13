"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "./lib/cn";

/**
 * Light/dark toggle, shared across all sites. Flips between explicit light and
 * dark (resolving "system" to whatever it currently is, so the first click
 * always does the obvious thing). Renders a stable placeholder until mounted
 * to avoid a hydration mismatch on the icon.
 */
export function ThemeToggle({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  const classes = cn(
    "flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors",
    "hover:bg-ink-50 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/5 dark:hover:text-white",
    className,
  );

  if (!mounted) {
    return (
      <span className={classes} aria-hidden="true">
        <Sun className="h-[18px] w-[18px] opacity-0" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      className={classes}
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px]" />
      ) : (
        <Moon className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
