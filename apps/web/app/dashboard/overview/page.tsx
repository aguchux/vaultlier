import Link from "next/link";
import { Activity, Cloud, Folder, KeyRound, Users } from "lucide-react";
import { prisma } from "@repo/db";
import { BackButton } from "@repo/ui/back-button";
import { Card } from "@repo/ui/card";
import { activityActionFilter } from "../../../lib/audit";
import { requireUser } from "../../../lib/tenancy";

type SearchParams = Promise<{ organizationId?: string }>;

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const user = await requireUser();
  const { organizationId } = await searchParams;
  const organizations = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    orderBy: { createdAt: "asc" },
    include: {
      memberships: true,
      projects: {
        include: {
          environments: true,
          _count: { select: { keys: true, apiKeys: true } },
        },
      },
    },
  });
  const selected =
    organizations.find((org) => org.id === organizationId) ?? organizations[0];
  if (!selected) return <div />;

  const environmentCount = selected.projects.reduce(
    (sum, project) => sum + project.environments.length,
    0,
  );
  const keyCount = selected.projects.reduce(
    (sum, project) => sum + project._count.keys,
    0,
  );
  const apiKeyCount = selected.projects.reduce(
    (sum, project) => sum + project._count.apiKeys,
    0,
  );
  const activity = await prisma.auditLog.findMany({
    where: { organizationId: selected.id, ...activityActionFilter() },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { user: { select: { name: true, email: true } } },
  });

  const suffix = `?organizationId=${selected.id}`;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start gap-3">
        <BackButton href={`/dashboard${suffix}`} className="mt-1" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-ink-500">
            Security and usage snapshot for {selected.name}.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          icon={Folder}
          label="Projects"
          value={selected.projects.length}
          href={`/dashboard${suffix}`}
        />
        <OverviewMetric
          icon={Cloud}
          label="Environments"
          value={environmentCount}
          href={`/dashboard/environments${suffix}`}
        />
        <OverviewMetric
          icon={Users}
          label="Members"
          value={selected.memberships.length}
          href={`/dashboard/organizations${suffix}`}
        />
        <OverviewMetric
          icon={KeyRound}
          label="API keys"
          value={apiKeyCount}
          href={`/dashboard/api-keys${suffix}`}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="border-border p-6 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Projects</h2>
              <p className="mt-1 text-sm text-ink-500">
                {keyCount} schema keys across the organization.
              </p>
            </div>
            <Link
              href={`/dashboard${suffix}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {selected.projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/${project.id}`}
                className="rounded-xl border border-black/5 p-4 hover:border-brand-200 hover:bg-brand-50/30"
              >
                <p className="font-semibold">{project.name}</p>
                <p className="mt-1 font-mono text-xs text-ink-400">
                  {project.publicId}
                </p>
                <p className="mt-3 text-xs text-ink-500">
                  {project.environments.length} environments -{" "}
                  {project._count.keys} keys
                </p>
              </Link>
            ))}
          </div>
        </Card>
        <Card className="border-border p-6 shadow-none">
          <h2 className="flex items-center gap-2 font-semibold">
            <Activity className="h-4 w-4 text-brand-600" /> Recent activity
          </h2>
          <ul className="mt-4 space-y-4">
            {activity.map((item) => (
              <li
                key={item.id}
                className="border-l-2 border-brand-100 pl-3 text-sm"
              >
                <p className="font-medium capitalize">
                  {item.action.replaceAll("_", " ").toLowerCase()}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  {item.user?.name ?? item.user?.email ?? "system"} -{" "}
                  {item.createdAt.toLocaleString()}
                </p>
              </li>
            ))}
            {activity.length === 0 ? (
              <li className="text-sm text-ink-400">No activity yet.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Folder;
  label: string;
  value: number;
  href: string;
}): React.JSX.Element {
  return (
    <Link href={href}>
      <Card className="flex items-center gap-4 border-black/10 p-5 shadow-none transition-colors hover:border-brand-200">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm text-ink-500">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </Card>
    </Link>
  );
}
