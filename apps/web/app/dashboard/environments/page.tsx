import Link from "next/link";
import { Folder } from "lucide-react";
import { prisma } from "@vaultlier/db";
import { BackButton } from "@vaultlier/ui/back-button";
import { Card } from "@vaultlier/ui/card";
import { environmentDeletionBlockers } from "../../../lib/resource-policy";
import { canManageProject, requireUser } from "../../../lib/tenancy";
import {
  createEnvironment,
  deleteEnvironment,
  updateEnvironment,
} from "../environment-actions";
import { EnvironmentManager } from "../environment-manager";

type SearchParams = Promise<{ organizationId?: string }>;

export default async function EnvironmentsPage({
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
      memberships: { where: { userId: user.id }, select: { role: true } },
      projects: {
        orderBy: { name: "asc" },
        include: {
          environments: {
            orderBy: { createdAt: "asc" },
            include: { _count: { select: { keyVersions: true } } },
          },
          keys: { select: { scopes: true } },
        },
      },
    },
  });
  const selected =
    organizations.find((org) => org.id === organizationId) ?? organizations[0];
  if (!selected) return <div />;
  const role = selected.memberships[0]?.role ?? "VIEWER";
  const canManage = canManageProject(role);
  const total = selected.projects.reduce(
    (sum, project) => sum + project.environments.length,
    0,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start gap-3">
        <BackButton
          href={`/dashboard?organizationId=${selected.id}`}
          className="mt-1"
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Environments</h1>
          <p className="mt-1 text-sm text-ink-500">
            Add, rename, and remove project environments in {selected.name}.
          </p>
        </div>
      </div>
      <Card className="overflow-hidden border-border shadow-none">
        <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
          <div>
            <h2 className="font-semibold">{selected.name}</h2>
            <p className="mt-1 text-xs text-ink-400">
              Environment changes increment the project schema version.
            </p>
          </div>
          <span className="text-sm text-ink-500">{total} environments</span>
        </div>
        <div className="divide-y divide-black/5">
          {selected.projects.map((project) => (
            <div
              key={project.id}
              className="grid gap-4 px-6 py-5 md:grid-cols-[260px_1fr]"
            >
              <Link
                href={`/dashboard/${project.id}`}
                className="flex items-center gap-3"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Folder className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold hover:text-brand-700">
                    {project.name}
                  </span>
                  <span className="font-mono text-xs text-ink-400">
                    {project.publicId}
                  </span>
                </span>
              </Link>
              <EnvironmentManager
                environments={project.environments.map((environment) => {
                  const scopedKeyCount = project.keys.filter((key) =>
                    key.scopes.includes(environment.name),
                  ).length;
                  return {
                    id: environment.id,
                    name: environment.name,
                    deletionBlockers: environmentDeletionBlockers({
                      keyVersionCount: environment._count.keyVersions,
                      scopedKeyCount,
                    }),
                  };
                })}
                canManage={canManage}
                createAction={createEnvironment.bind(null, project.id)}
                updateAction={updateEnvironment.bind(null, project.id)}
                deleteAction={deleteEnvironment.bind(null, project.id)}
              />
            </div>
          ))}
          {selected.projects.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-ink-400">
              Create a project before adding environments.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
