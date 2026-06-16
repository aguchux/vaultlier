"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Cloud,
  Folder,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@repo/ui/lib/cn";

const items = [
  { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
  { label: "Projects", href: "/dashboard", icon: Folder },
  { label: "Environments", href: "/dashboard/environments", icon: Cloud },
  { label: "API Keys", href: "/dashboard/api-keys", icon: KeyRound },
  { label: "Audit Logs", href: "/dashboard/audit", icon: ScrollText },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

const dashboardSections = new Set([
  "overview",
  "organizations",
  "environments",
  "api-keys",
  "audit",
  "settings",
]);

export function DashboardNav({
  mobile = false,
}: {
  mobile?: boolean;
}): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("organizationId");
  const suffix = organizationId ? `?organizationId=${organizationId}` : "";

  return (
    <nav
      aria-label="Dashboard navigation"
      className={cn(
        mobile
          ? "flex gap-1 overflow-x-auto py-2"
          : "flex flex-1 flex-col gap-1 px-4 py-6",
      )}
    >
      {items.map((item) => {
        const projectSegment = pathname.match(/^\/dashboard\/([^/]+)$/)?.[1];
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard" ||
              Boolean(projectSegment && !dashboardSections.has(projectSegment))
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={`${item.href}${suffix}`}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-xl text-sm font-medium transition-colors",
              mobile ? "px-3 py-2" : "px-3.5 py-3",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
