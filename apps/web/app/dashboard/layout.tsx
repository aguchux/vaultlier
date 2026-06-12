import { Suspense } from "react";
import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";
import { Logo } from "@repo/ui/logo";
import { signOut } from "../../lib/auth";
import { getUserOrgs, requireUser } from "../../lib/tenancy";
import { DashboardNav } from "./dashboard-nav";
import { DashboardSearch } from "./dashboard-search";
import { createOrganization } from "./organization-actions";
import { OrganizationSwitcher } from "./organization-switcher";

export const metadata = {
  title: "Dashboard - Vaultlier",
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
    <div className="min-h-screen bg-ink-50/70 text-ink-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-black/5 bg-white lg:flex">
        <div className="flex h-[74px] items-center border-b border-black/5 px-7">
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
              <Logo showWordmark={false} className="[&>svg]:h-5 [&>svg]:w-5" />
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
        <header className="sticky top-0 z-20 border-b border-black/5 bg-white/95 backdrop-blur">
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
              className="relative hidden h-10 w-10 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-50 hover:text-ink-900 sm:inline-flex"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white" />
            </button>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-1.5 hover:bg-ink-50 [&::-webkit-details-marker]:hidden">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- OAuth avatar URL is user-provided.
                  <img
                    src={user.image}
                    alt=""
                    className="h-8 w-8 rounded-full border border-black/10 object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
                    {(user.name ?? user.email).slice(0, 2).toUpperCase()}
                  </span>
                )}
                <ChevronDown className="hidden h-4 w-4 text-ink-400 sm:block" />
              </summary>
              <div className="absolute right-0 top-12 w-60 rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold">
                    {user.name ?? "Vaultlier user"}
                  </p>
                  <p className="truncate text-xs text-ink-500">{user.email}</p>
                </div>
                <div className="my-1 border-t border-black/5" />
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button
                    type="submit"
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink-700 hover:bg-ink-50"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
          <div className="border-t border-black/5 px-3 lg:hidden">
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
