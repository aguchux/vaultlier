import Link from "next/link";
import { Logo } from "@repo/ui/logo";
import { signOut } from "../../lib/auth";
import { getUserOrgs, requireUser } from "../../lib/tenancy";
import { ProjectSwitcher } from "./project-switcher";

export const metadata = {
  title: "Dashboard — Vaultlier",
};

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const user = await requireUser();
  const orgs = await getUserOrgs(user);
  const projects = orgs.flatMap((org) =>
    org.projects.map((project) => ({
      id: project.id,
      name: project.name,
      orgName: org.name,
    })),
  );

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4 lg:px-8">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <ProjectSwitcher projects={projects} />
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden items-center gap-2 text-sm text-ink-700 sm:inline-flex">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar from OAuth provider
                <img
                  src={user.image}
                  alt=""
                  className="h-7 w-7 rounded-full border border-black/10"
                />
              ) : null}
              {user.name ?? user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="text-sm font-medium text-ink-500 hover:text-ink-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">{children}</main>
    </div>
  );
}
