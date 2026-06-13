"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemeProvider } from "next-themes";

/**
 * Shared theme provider for every Vaultlier site.
 *
 * Wraps `next-themes` with one consistent configuration: class-based dark mode
 * (toggling `class="dark"` on <html>, which our Tailwind `dark:` variant and
 * the token overrides in theme.css key off), a shared storage key so the
 * choice is consistent per origin, and system preference as the default.
 *
 * Mount once near the root of each app, inside <body>. Pair it with
 * `suppressHydrationWarning` on <html> since the theme class is applied on the
 * client before React hydrates.
 */
export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="vaultlier-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
