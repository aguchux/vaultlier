import { KeyRound, Layers, ScrollText, Settings, Variable } from "lucide-react";
import { prisma } from "@repo/db";
import { BackButton } from "@repo/ui/back-button";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { activityActionFilter } from "../../../lib/audit";
import { requireProjectAccess, requireUser } from "../../../lib/tenancy";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<React.JSX.Element> {
  const { projectId } = await params;
  const user = await requireUser();
  const { project } = await requireProjectAccess(user.id, projectId);

  const [environments, keyCount, apiKeyCount, auditLogs] = await Promise.all([
    prisma.environment.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.key.count({ where: { projectId } }),
    prisma.apiKey.count({ where: { projectId, revokedAt: null } }),
    prisma.auditLog.findMany({
      where: {
        ...activityActionFilter(),
        OR: [
          { projectId },
          // Include entries (e.g. creation) recorded against this project id
          // in metadata before/without the relation.
          { organizationId: project.organizationId, projectId: null },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <BackButton href="/dashboard" className="mt-1" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">
              {project.name}
            </h1>
            <p className="mt-1 font-mono text-sm text-ink-400">
              {project.publicId} · schema v{project.schemaVersion}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button href={`/dashboard/${project.id}/secrets`} size="sm">
            <Variable className="h-4 w-4" />
            Variables
          </Button>
          <Button
            href={`/dashboard/${project.id}/settings`}
            variant="secondary"
            size="sm"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Layers className="h-4 w-4" /> Environments
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            {environments.length}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {environments.map((env) => env.name).join(", ") || "None yet"}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <KeyRound className="h-4 w-4" /> Keys
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink-900">{keyCount}</p>
          <p className="mt-1 text-sm text-ink-500">Defined in the schema</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <ScrollText className="h-4 w-4" /> Active API keys
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            {apiKeyCount}
          </p>
          <p className="mt-1 text-sm text-ink-500">CLI &amp; runtime access</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-ink-900">Recent activity</h2>
        {auditLogs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No activity yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {auditLogs.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-4 py-2.5 text-sm"
              >
                <span className="font-mono text-xs text-brand-700">
                  {log.action}
                </span>
                <span className="truncate text-ink-500">
                  {log.user?.name ?? log.user?.email ?? "system"}
                </span>
                <span className="shrink-0 text-ink-400">
                  {log.createdAt.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
