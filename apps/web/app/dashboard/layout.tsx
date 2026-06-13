import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@repo/ui/logo";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { signOut } from "../../lib/auth";
import { getUserOrgs, requireUser } from "../../lib/tenancy";
import { DashboardNav } from "./dashboard-nav";
import { DashboardSearch } from "./dashboard-search";
import { createOrganization } from "./organization-actions";
import { OrganizationSwitcher } from "./organization-switcher";
import { UserMenu } from "./user-menu";

async function signOutAction(): Promise<void> {
  "use server";
  await signOut({ redirectTo: "/" });
}

export const metadata: Metadata = {
  title: "Dashboard",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
  },
};

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const user = await requireUser();
  const orgs = await getUserOrgs(user);
  const organizations = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: org.memberships[0]?.role ?? "VIEWER",
    projectCount: org.projects.length,
  }));
  const projectOrganizations = orgs.flatMap((org) =>
    org.projects.map((project) => ({ projectId: project.id, orgId: org.id })),
  );

  return (
    <div className="min-h-screen bg-ink-50/70 text-ink-900 dark:bg-ink-900 dark:text-ink-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-black/5 bg-white lg:flex dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex h-[74px] items-center border-b border-black/5 px-7 dark:border-white/10">
          <Link href="/dashboard" aria-label="Vaultlier dashboard">
            <Logo />
          </Link>
        </div>
        <Suspense fallback={<div className="h-96" />}>
          <DashboardNav />
        </Suspense>
        <div className="mt-auto p-5">
          <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-200 bg-white text-brand-700">
              <Logo showWordmark={false} className="[&>img]:h-5 [&>img]:w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold">
              Secrets never touch disk.
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-500">
              Encrypted at rest. Resolved only in memory.
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-black/5 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-ink-900/90">
          <div className="flex min-h-[74px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link
              href="/dashboard"
              className="mr-1 lg:hidden"
              aria-label="Vaultlier"
            >
              <Logo showWordmark={false} />
            </Link>
            <Suspense
              fallback={<div className="h-11 w-48 rounded-xl bg-ink-50" />}
            >
              <OrganizationSwitcher
                organizations={organizations}
                projectOrganizations={projectOrganizations}
                createAction={createOrganization}
              />
            </Suspense>
            <Suspense
              fallback={
                <div className="mx-auto h-11 max-w-xl flex-1 rounded-xl bg-ink-50" />
              }
            >
              <DashboardSearch />
            </Suspense>
            <button
              type="button"
              aria-label="Notifications"
              className="relative hidden h-10 w-10 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-50 hover:text-ink-900 sm:inline-flex dark:text-ink-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white dark:ring-ink-900" />
            </button>
            <ThemeToggle className="h-10 w-10" />
            <UserMenu
              name={user.name}
              email={user.email}
              image={user.image}
              signOutAction={signOutAction}
            />
          </div>
          <div className="border-t border-black/5 px-3 lg:hidden dark:border-white/10">
            <Suspense fallback={<div className="h-12" />}>
              <DashboardNav mobile />
            </Suspense>
          </div>
        </header>
        <main className="px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
