import { prisma } from "@repo/db";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import {
  canManageProject,
  requireProjectAccess,
  requireUser,
} from "../../../../lib/tenancy";
import {
  createApiKey,
  deleteProject,
  renameProject,
  revokeApiKey,
} from "../../actions";
import { ApiKeysPanel } from "./api-keys-panel";
import { DestroyProjectForm } from "./destroy-form";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<React.JSX.Element> {
  const { projectId } = await params;
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);
  const canManage = canManageProject(role);

  const apiKeys = await prisma.apiKey.findMany({
    where: { projectId: project.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          Project settings
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          <a
            href={`/dashboard/${project.id}`}
            className="text-brand-700 hover:underline"
          >
            {project.name}
          </a>{" "}
          · created {project.createdAt.toLocaleDateString()}
        </p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold text-ink-900">General</h2>
        <form
          action={renameProject.bind(null, project.id)}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <label className="flex grow flex-col gap-1.5 text-sm font-medium text-ink-700">
            Project name
            <input
              name="name"
              defaultValue={project.name}
              required
              disabled={!canManage}
              className="h-10 rounded-xl border border-black/10 px-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:bg-ink-50"
            />
          </label>
          <Button type="submit" size="sm" disabled={!canManage}>
            Save
          </Button>
        </form>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-500">Project ID</dt>
            <dd className="mt-0.5 font-mono text-ink-900">
              {project.publicId}
            </dd>
          </div>
          <div>
            <dt className="text-ink-500">Schema version</dt>
            <dd className="mt-0.5 font-mono text-ink-900">
              v{project.schemaVersion}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <ApiKeysPanel
          keys={apiKeys.map((key) => ({
            id: key.id,
            name: key.name,
            prefix: key.prefix,
            role: key.role,
            createdAt: key.createdAt.toISOString(),
            lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          }))}
          canManage={canManage}
          createAction={createApiKey.bind(null, project.id)}
          revokeAction={revokeApiKey.bind(null, project.id)}
        />
      </Card>

      <Card className="border-red-200 p-6">
        <h2 className="font-semibold text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-ink-500">
          Destroying a project permanently deletes its environments, keys,
          encrypted secret versions, and API keys. This cannot be undone.
        </p>
        <div className="mt-4">
          <DestroyProjectForm
            projectName={project.name}
            action={deleteProject.bind(null, project.id)}
            disabled={!canManage}
          />
        </div>
        {!canManage ? (
          <p className="mt-2 text-xs text-ink-400">
            Only organization owners and admins can destroy a project.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
