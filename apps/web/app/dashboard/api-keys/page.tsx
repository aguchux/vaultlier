import { Suspense } from "react";
import { KeyRound, ShieldAlert } from "lucide-react";
import { prisma } from "@repo/db";
import { BackButton } from "@repo/ui/back-button";
import { Card } from "@repo/ui/card";
import {
  canManageProject,
  requireProjectAccess,
  requireUser,
} from "../../../lib/tenancy";
import { createProjectApiKey, revokeProjectApiKey } from "./actions";
import { ProjectApiKeysPanel } from "./project-api-keys-panel";
import { ProjectTargetSelect } from "./project-target-select";

type SearchParams = Promise<{ projectId?: string }>;

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const user = await requireUser();
  const { projectId } = await searchParams;
  const organizations = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    orderBy: { name: "asc" },
    include: { projects: { orderBy: { name: "asc" } } },
  });
  const projects = organizations.flatMap((organization) =>
    organization.projects.map((project) => ({
      id: project.id,
      name: project.name,
      publicId: project.publicId,
      organizationId: organization.id,
      organizationName: organization.name,
    })),
  );

  let target: Awaited<ReturnType<typeof requireProjectAccess>> | null = null;
  let keys: Awaited<ReturnType<typeof prisma.apiKey.findMany>> = [];
  if (projectId) {
    target = await requireProjectAccess(user.id, projectId);
    keys = await prisma.apiKey.findMany({
      where: { projectId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start gap-3">
        <BackButton href="/dashboard" className="mt-1" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="mt-1 text-sm text-ink-500">
            Create credentials for one project at a time. Keys never cross
            project boundaries.
          </p>
        </div>
      </div>
      <Card className="border-border p-6 shadow-none">
        <label className="text-sm font-semibold">
          Target project
          <span className="mt-1 block text-xs font-normal text-ink-500">
            A project must be selected before keys can be viewed or created.
          </span>
          <span className="mt-3 block">
            <Suspense fallback={<div className="h-11 rounded-xl bg-ink-50" />}>
              <ProjectTargetSelect projects={projects} />
            </Suspense>
          </span>
        </label>
      </Card>
      {target ? (
        <Card className="border-border p-6 shadow-none">
          <div className="mb-5 flex items-center justify-between gap-4 rounded-xl bg-brand-50 px-4 py-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
                Selected project
              </p>
              <p className="mt-1 font-semibold">{target.project.name}</p>
              <p className="font-mono text-xs text-ink-500">
                {target.project.publicId}
              </p>
            </div>
            <KeyRound className="h-6 w-6 text-brand-600" />
          </div>
          <ProjectApiKeysPanel
            keys={keys.map((key) => ({
              id: key.id,
              name: key.name,
              prefix: key.prefix,
              role: key.role,
              createdAt: key.createdAt.toISOString(),
              lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
            }))}
            canManage={canManageProject(target.role)}
            createAction={createProjectApiKey.bind(null, target.project.id)}
            revokeAction={revokeProjectApiKey.bind(null, target.project.id)}
          />
        </Card>
      ) : (
        <Card className="border-dashed border-black/10 px-6 py-14 text-center shadow-none">
          <ShieldAlert className="mx-auto h-9 w-9 text-ink-300" />
          <h2 className="mt-4 font-semibold">Select a target project</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
            Vaultlier API keys are deliberately project-specific. Choose a
            project above to manage its CLI and runtime credentials.
          </p>
        </Card>
      )}
    </div>
  );
}
