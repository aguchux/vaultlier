import { Building2, CreditCard, ShieldCheck } from "lucide-react";
import { prisma } from "@repo/db";
import { Card } from "@repo/ui/card";
import { canManageOrganization, requireUser } from "../../../lib/tenancy";
import { renameOrganization } from "../organization-actions";

type SearchParams = Promise<{ organizationId?: string }>;

export default async function OrganizationSettingsPage({
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
      _count: { select: { projects: true, memberships: true } },
    },
  });
  const selected =
    organizations.find((org) => org.id === organizationId) ?? organizations[0];
  if (!selected) return <div />;
  const role = selected.memberships[0]?.role ?? "VIEWER";
  const canManage = canManageOrganization(role);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Organization Settings
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Configuration and plan details for {selected.name}.
        </p>
      </div>
      <Card className="border-black/10 p-6 shadow-none">
        <h2 className="flex items-center gap-2 font-semibold">
          <Building2 className="h-4 w-4 text-brand-600" /> General
        </h2>
        <form
          action={renameOrganization.bind(null, selected.id)}
          className="mt-5 flex flex-wrap items-end gap-3"
        >
          <label className="min-w-64 flex-1 text-sm font-medium">
            Organization name
            <input
              name="name"
              required
              minLength={2}
              defaultValue={selected.name}
              disabled={!canManage}
              className="mt-2 h-10 w-full rounded-xl border border-black/10 px-3 text-sm font-normal outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50"
            />
          </label>
          <button
            type="submit"
            disabled={!canManage}
            className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Save changes
          </button>
        </form>
        <dl className="mt-6 grid gap-4 border-t border-black/5 pt-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-400">Slug</dt>
            <dd className="mt-1 font-mono">{selected.slug}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Projects</dt>
            <dd className="mt-1 font-medium">{selected._count.projects}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Members</dt>
            <dd className="mt-1 font-medium">{selected._count.memberships}</dd>
          </div>
        </dl>
      </Card>
      <Card className="border-black/10 p-6 shadow-none">
        <h2 className="flex items-center gap-2 font-semibold">
          <CreditCard className="h-4 w-4 text-brand-600" /> Plan
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-ink-50 p-4">
          <div>
            <p className="font-semibold capitalize">
              {selected.plan.toLowerCase()}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              Billing and limits are organization-wide.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-600 shadow-sm">
            Current plan
          </span>
        </div>
      </Card>
      <Card className="border-brand-100 bg-brand-50/40 p-6 shadow-none">
        <h2 className="flex items-center gap-2 font-semibold text-brand-800">
          <ShieldCheck className="h-4 w-4" /> Security boundary
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-600">
          Members and roles are organization-scoped. API keys remain
          project-scoped and must be created from a selected project.
        </p>
      </Card>
    </div>
  );
}
