"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { Logo } from "@vaultlier/ui/logo";
import { ThemeToggle } from "@vaultlier/ui/theme-toggle";
import { Sidebar } from "./sidebar";

const TOP_NAV = [
  { label: "Docs", href: "/" },
  { label: "API", href: "/sdk" },
  { label: "Guides", href: "/quickstart" },
  { label: "Support", href: "/faq" },
];

/**
 * App-wide documentation chrome: sticky top bar, left sidebar (collapsible on
 * mobile), and the centered content column. The right-hand "On this page" TOC
 * is rendered per-page by DocPage so it can reflect that page's headings.
 */
export function DocsShell({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-ink-900/85">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-50 lg:hidden dark:text-ink-400 dark:hover:bg-white/5"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="shrink-0">
            <Logo />
          </Link>

          <div className="mx-auto hidden w-full max-w-md md:block">
            <SearchPlaceholder />
          </div>

          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {TOP_NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <ThemeToggle />
            <a
              href="https://github.com/aguchux/vaultlier"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Vaultlier on GitHub"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <GitHubMark className="h-[18px] w-[18px]" />
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[90rem] px-4 sm:px-6">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto py-8 pr-6 lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 top-16 z-30 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-ink-900/20"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-ink-100 bg-white p-6 dark:border-white/10 dark:bg-ink-900">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function GitHubMark({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

function SearchPlaceholder(): React.JSX.Element {
  return (
    <div className="flex h-10 items-center gap-2 rounded-xl border border-ink-100 bg-ink-50/60 px-3.5 text-sm text-ink-400 dark:border-white/10 dark:bg-white/5">
      <Search className="h-4 w-4" />
      <span>Search documentation…</span>
      <kbd className="ml-auto rounded border border-ink-200 px-1.5 py-0.5 font-mono text-[10px] text-ink-400 dark:border-white/10">
        ⌘K
      </kbd>
    </div>
  );
}
