import { FolderKey, Plus } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { getUserOrgs, requireUser } from "../../lib/tenancy";
import { createProject } from "./actions";

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const user = await requireUser();
  const orgs = await getUserOrgs(user);

  return (
    <div className="space-y-10">
      {orgs.map((org) => {
        const role = org.memberships[0]?.role ?? "VIEWER";
        return (
          <section key={org.id}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  {org.name}
                </h2>
                <p className="text-sm text-ink-500">
                  {org.projects.length} project
                  {org.projects.length === 1 ? "" : "s"} · your role:{" "}
                  {role.toLowerCase()}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {org.projects.map((project) => (
                <a key={project.id} href={`/dashboard/${project.id}`}>
                  <Card className="p-5 transition-shadow hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <FolderKey className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-ink-900">
                          {project.name}
                        </p>
                        <p className="font-mono text-xs text-ink-400">
                          {project.publicId}
                        </p>
                      </div>
                    </div>
                  </Card>
                </a>
              ))}

              {role !== "VIEWER" ? (
                <Card className="p-5">
                  <form
                    action={createProject}
                    className="flex h-full flex-col justify-between gap-3"
                  >
                    <input
                      type="hidden"
                      name="organizationId"
                      value={org.id}
                    />
                    <input
                      name="name"
                      required
                      placeholder="New project name"
                      className="h-10 rounded-xl border border-black/10 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    />
                    <Button type="submit" size="sm">
                      <Plus className="h-4 w-4" />
                      Create project
                    </Button>
                  </form>
                </Card>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
