import { ScrollText } from "lucide-react";
import { prisma } from "@repo/db";
import { BackButton } from "@repo/ui/back-button";
import { Card } from "@repo/ui/card";
import { requireUser } from "../../../lib/tenancy";

type SearchParams = Promise<{ organizationId?: string }>;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const user = await requireUser();
  const { organizationId } = await searchParams;
  const organizations = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    orderBy: { createdAt: "asc" },
  });
  const selected =
    organizations.find((org) => org.id === organizationId) ?? organizations[0];
  if (!selected) return <div />;
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: selected.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      project: { select: { name: true } },
      apiKey: { select: { name: true, prefix: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start gap-3">
        <BackButton
          href={`/dashboard?organizationId=${selected.id}`}
          className="mt-1"
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="mt-1 text-sm text-ink-500">
            Append-only access and change history for {selected.name}.
          </p>
        </div>
      </div>
      <Card className="overflow-hidden border-border shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-ink-50/50 text-xs text-ink-500">
                <th className="px-6 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Environment</th>
                <th className="px-6 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-3.5">
                    <span className="inline-flex items-center gap-2 font-mono text-xs font-medium text-brand-700">
                      <ScrollText className="h-4 w-4" />
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-ink-600">
                    {log.user?.name ??
                      log.user?.email ??
                      (log.apiKey
                        ? `${log.apiKey.name} (${log.apiKey.prefix}...)`
                        : "system")}
                  </td>
                  <td className="px-4 py-3.5 text-ink-500">
                    {log.project?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3.5 text-ink-500">
                    {log.environment ?? "-"}
                  </td>
                  <td className="px-6 py-3.5 text-ink-500">
                    {log.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-ink-400"
                  >
                    No audit activity recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
