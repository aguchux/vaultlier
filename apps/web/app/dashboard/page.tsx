import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Cloud,
  Folder,
  KeyRound,
  MoreHorizontal,
  ShieldCheck,
  Users,
} from "lucide-react";
import { prisma } from "@vaultlier/db";
import { Card } from "@vaultlier/ui/card";
import { activityActionFilter } from "../../lib/audit";
import { requireUser } from "../../lib/tenancy";
import { planLabel } from "../../lib/plan";
import { createProject } from "./actions";
import { ProjectCreateButton } from "./project-create-dialog";

type SearchParams = Promise<{
  organizationId?: string;
  query?: string;
}>;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function relativeDate(date: Date): string {
  const elapsed = Date.now() - date.getTime();
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const user = await requireUser();
  const filters = await searchParams;
  const organizations = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    orderBy: { createdAt: "asc" },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      projects: {
        orderBy: { updatedAt: "desc" },
        include: {
          environments: { select: { id: true, name: true } },
          _count: { select: { keys: true, apiKeys: true } },
        },
      },
    },
  });

  const selected =
    organizations.find((org) => org.id === filters.organizationId) ??
    organizations[0];
  if (!selected) {
    return <div />;
  }

  const normalizedQuery = filters.query?.trim().toLowerCase() ?? "";
  const projects = selected.projects.filter((project) => {
    if (!normalizedQuery) return true;
    return (
      project.name.toLowerCase().includes(normalizedQuery) ||
      project.publicId.toLowerCase().includes(normalizedQuery) ||
      project.environments.some((env) =>
        env.name.toLowerCase().includes(normalizedQuery),
      )
    );
  });
  const actorRole = selected.memberships.find(
    (membership) => membership.userId === user.id,
  )?.role;
  const canManage = actorRole === "OWNER" || actorRole === "ADMIN";
  const totalProjects = organizations.reduce(
    (sum, org) => sum + org.projects.length,
    0,
  );
  const totalEnvironments = organizations.reduce(
    (sum, org) =>
      sum +
      org.projects.reduce(
        (orgSum, project) => orgSum + project.environments.length,
        0,
      ),
    0,
  );
  const activity = await prisma.auditLog.findMany({
    where: { organizationId: selected.id, ...activityActionFilter() },
    orderBy: { createdAt: "desc" },
    take: 4,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Projects
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Manage typed configuration vaults across your organizations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={Building2}
          label="Total Organizations"
          value={organizations.length}
          hint="Across your workspaces"
        />
        <MetricCard
          icon={Folder}
          label="Active Projects"
          value={totalProjects}
          hint={`${selected.projects.length} in ${selected.name}`}
        />
        <MetricCard
          icon={Cloud}
          label="Environments"
          value={totalEnvironments}
          hint="Across all projects"
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden border-border shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-5 py-4">
            <div className="flex items-center gap-3">
              <ChevronDown className="h-4 w-4 text-ink-500" />
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700">
                {initials(selected.name)}
              </span>
              <h2 className="font-semibold">{selected.name}</h2>
              <span className="rounded-md border border-brand-100 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                {actorRole?.toLowerCase()}
              </span>
            </div>
            <span className="text-xs text-ink-500">
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </span>
          </div>

          {projects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-ink-50/40 text-xs font-medium text-ink-500">
                    <th className="px-5 py-3">Project</th>
                    <th className="px-4 py-3">Environments</th>
                    <th className="px-4 py-3">Organization access</th>
                    <th className="px-4 py-3">Schema keys</th>
                    <th className="px-4 py-3">Last updated</th>
                    <th className="w-12 px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {projects.map((project) => (
                    <tr key={project.id} className="group hover:bg-ink-50/50">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/dashboard/${project.id}`}
                          className="block"
                        >
                          <span className="block font-semibold group-hover:text-brand-700">
                            {project.name}
                          </span>
                          <span className="mt-0.5 block font-mono text-xs text-ink-400">
                            {project.publicId}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-2 text-ink-600">
                          {project.environments.length}
                          <Cloud className="h-4 w-4 text-ink-400" />
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex -space-x-1.5">
                          {selected.memberships
                            .slice(0, 3)
                            .map((membership) => (
                              <span
                                key={membership.id}
                                title={
                                  membership.user.name ?? membership.user.email
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-ink-100 text-[10px] font-semibold text-ink-700"
                              >
                                {initials(
                                  membership.user.name ?? membership.user.email,
                                )}
                              </span>
                            ))}
                          {selected.memberships.length > 3 ? (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-ink-50 text-[10px] font-medium text-ink-500">
                              +{selected.memberships.length - 3}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-ink-600">
                        {project._count.keys}
                      </td>
                      <td className="px-4 py-3.5 text-ink-500">
                        {relativeDate(project.updatedAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/dashboard/${project.id}/settings`}
                          aria-label={`Open settings for ${project.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-white hover:text-ink-800"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <Folder className="mx-auto h-8 w-8 text-ink-300" />
              <p className="mt-3 font-semibold">
                {normalizedQuery ? "No matching projects" : "No projects yet"}
              </p>
              <p className="mt-1 text-sm text-ink-500">
                {normalizedQuery
                  ? "Try another search term."
                  : "Create the first project for this organization."}
              </p>
            </div>
          )}

          {organizations
            .filter((org) => org.id !== selected.id)
            .map((org) => (
              <Link
                key={org.id}
                href={`/dashboard?organizationId=${org.id}`}
                className="flex items-center gap-3 border-t border-black/5 px-5 py-3.5 hover:bg-ink-50"
              >
                <ChevronRight className="h-4 w-4 text-ink-400" />
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-50 text-[10px] font-semibold text-brand-700">
                  {initials(org.name)}
                </span>
                <span className="font-medium">{org.name}</span>
                <span className="ml-auto text-xs text-ink-500">
                  {org.projects.length} project
                  {org.projects.length === 1 ? "" : "s"}
                </span>
                <ChevronRight className="h-4 w-4 text-ink-400" />
              </Link>
            ))}
        </Card>

        <Card className="border-black/10 p-5 shadow-none xl:sticky xl:top-28">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
              {initials(selected.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{selected.name}</h2>
              <p className="text-xs text-ink-500">
                {planLabel(selected.plan)} plan
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-brand-600" />
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <SummaryRow
              icon={Folder}
              label="Projects"
              value={selected.projects.length}
            />
            <SummaryRow
              icon={Cloud}
              label="Environments"
              value={selected.projects.reduce(
                (sum, project) => sum + project.environments.length,
                0,
              )}
            />
            <SummaryRow
              icon={Users}
              label="Members"
              value={selected.memberships.length}
            />
            <SummaryRow
              icon={CalendarDays}
              label="Created"
              value={selected.createdAt.toLocaleDateString()}
            />
          </dl>

          <div className="my-6 border-t border-black/5" />
          <h3 className="text-sm font-semibold">Quick actions</h3>
          <div className="mt-3 space-y-2">
            {canManage ? (
              <ProjectCreateButton
                action={createProject}
                organizationId={selected.id}
                organizationName={selected.name}
              />
            ) : null}
            <Link
              href={`/dashboard/organizations?organizationId=${selected.id}`}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-black/10 text-sm font-medium hover:bg-ink-50"
            >
              <Users className="h-4 w-4" /> Manage Members
            </Link>
            <Link
              href={`/dashboard/api-keys?organizationId=${selected.id}`}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-black/10 text-sm font-medium hover:bg-ink-50"
            >
              <KeyRound className="h-4 w-4" /> Project API Keys
            </Link>
          </div>

          <div className="my-6 border-t border-black/5" />
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent activity</h3>
            <Link
              href={`/dashboard/audit?organizationId=${selected.id}`}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {activity.length > 0 ? (
              activity.map((item) => (
                <li key={item.id} className="flex gap-2.5 text-xs">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <span>
                    <span className="block font-medium text-ink-700">
                      {item.action.replaceAll("_", " ").toLowerCase()}
                    </span>
                    <span className="mt-0.5 block text-ink-400">
                      {relativeDate(item.createdAt)} by{" "}
                      {item.user?.name ?? item.user?.email ?? "system"}
                    </span>
                  </span>
                </li>
              ))
            ) : (
              <li className="text-xs text-ink-400">
                No activity recorded yet.
              </li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Folder;
  label: string;
  value: number;
  hint: string;
}): React.JSX.Element {
  return (
    <Card className="flex items-center gap-4 border-black/10 p-4 shadow-none sm:p-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold">{value}</p>
        <p className="mt-0.5 text-xs text-ink-400">{hint}</p>
      </div>
    </Card>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Folder;
  label: string;
  value: string | number;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-ink-400" />
      <dt className="text-ink-500">{label}</dt>
      <dd className="ml-auto font-medium text-ink-800">{value}</dd>
    </div>
  );
}
