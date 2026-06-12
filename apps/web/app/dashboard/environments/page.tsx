import Link from "next/link";
import { Cloud, Folder } from "lucide-react";
import { prisma } from "@repo/db";
import { Card } from "@repo/ui/card";
import { requireUser } from "../../../lib/tenancy";

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
      projects: {
        orderBy: { name: "asc" },
        include: { environments: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  const selected =
    organizations.find((org) => org.id === organizationId) ?? organizations[0];
  if (!selected) return <div />;
  const total = selected.projects.reduce(
    (sum, project) => sum + project.environments.length,
    0,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Environments</h1>
        <p className="mt-1 text-sm text-ink-500">
          Environment metadata for every project in {selected.name}.
        </p>
      </div>
      <Card className="overflow-hidden border-black/10 shadow-none">
        <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
          <h2 className="font-semibold">{selected.name}</h2>
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
              <div className="flex flex-wrap gap-2">
                {project.environments.map((environment) => (
                  <span
                    key={environment.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-black/5 bg-ink-50 px-3 py-2 text-sm"
                  >
                    <Cloud className="h-4 w-4 text-brand-600" />
                    {environment.name}
                  </span>
                ))}
                {project.environments.length === 0 ? (
                  <span className="text-sm text-ink-400">No environments.</span>
                ) : null}
              </div>
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
