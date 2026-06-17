"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "../lib/nav";
import { cn } from "@vaultlier/ui/lib/cn";

/** Left documentation navigation. Highlights the active route. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="space-y-7" aria-label="Documentation">
      {nav.map((section, index) => (
        <div key={section.title ?? `section-${index}`}>
          {section.title ? (
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
              {section.title}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-300"
                        : "text-ink-500 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-white/5 dark:hover:text-white",
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
