import { Mail, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { prisma } from "@repo/db";
import { Card } from "@repo/ui/card";
import { organizationDeletionBlockers } from "../../../lib/resource-policy";
import {
  canManageOrganization,
  canManageRole,
  requireUser,
} from "../../../lib/tenancy";
import {
  createOrganization,
  deleteOrganization,
  inviteOrganizationMember,
  removeOrganizationMember,
  renameOrganization,
  revokeOrganizationInvitation,
  updateOrganizationMemberRole,
} from "../organization-actions";
import { OrganizationCreateButton } from "../organization-create-dialog";
import { OrganizationCrudDialogs } from "../organization-crud-dialogs";

type SearchParams = Promise<{ organizationId?: string }>;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default async function OrganizationsPage({
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
      memberships: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      invitations: {
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { projects: true } },
    },
  });
  const selected =
    organizations.find((org) => org.id === organizationId) ?? organizations[0];
  if (!selected) return <div />;
  const actorRole =
    selected.memberships.find((membership) => membership.userId === user.id)
      ?.role ?? "VIEWER";
  const canManage = canManageOrganization(actorRole);
  const deletionBlockers = organizationDeletionBlockers({
    projectCount: selected._count.projects,
    memberCount: selected.memberships.length,
    pendingInvitationCount: selected.invitations.length,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizations</h1>
          <p className="mt-1 text-sm text-ink-500">
            Manage organization members and role-based access.
          </p>
        </div>
        <OrganizationCreateButton action={createOrganization} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-black/10 p-2 shadow-none">
          {organizations.map((org) => (
            <a
              key={org.id}
              href={`/dashboard/organizations?organizationId=${org.id}`}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 ${org.id === selected.id ? "bg-brand-50 text-brand-800" : "hover:bg-ink-50"}`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-xs font-semibold text-brand-700 shadow-sm">
                {initials(org.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {org.name}
                </span>
                <span className="block text-xs text-ink-400">
                  {org._count.projects} projects - {org.memberships.length}{" "}
                  members
                </span>
              </span>
            </a>
          ))}
        </Card>

        <div className="space-y-6">
          <Card className="border-black/10 p-6 shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
                  {initials(selected.name)}
                </span>
                <div>
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <p className="text-sm capitalize text-ink-500">
                    {selected.plan.toLowerCase()} plan - your role:{" "}
                    {actorRole.toLowerCase()}
                  </p>
                  {selected.description ? (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
                      {selected.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-ink-400">
                      No description provided.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
                  <Shield className="h-4 w-4" /> Organization-scoped RBAC
                </div>
                <OrganizationCrudDialogs
                  organization={{
                    name: selected.name,
                    description: selected.description,
                  }}
                  canUpdate={canManage}
                  canDelete={
                    actorRole === "OWNER" && deletionBlockers.length === 0
                  }
                  deletionBlockers={deletionBlockers}
                  updateAction={renameOrganization.bind(null, selected.id)}
                  deleteAction={deleteOrganization.bind(null, selected.id)}
                />
              </div>
            </div>
            {actorRole === "OWNER" && deletionBlockers.length > 0 ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                Deletion is locked until you remove:{" "}
                {deletionBlockers.join(", ")}.
              </p>
            ) : null}
          </Card>

          {canManage ? (
            <Card className="border-black/10 p-6 shadow-none">
              <h2 className="flex items-center gap-2 font-semibold">
                <UserPlus className="h-4 w-4 text-brand-600" /> Invite member
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Existing Vaultlier users are added immediately. New users join
                after signing in with this email.
              </p>
              <form
                action={inviteOrganizationMember.bind(null, selected.id)}
                className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]"
              >
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="developer@company.com"
                  className="h-10 rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                />
                <select
                  name="role"
                  defaultValue="MEMBER"
                  className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
                >
                  {actorRole === "OWNER" ? (
                    <option value="ADMIN">Admin</option>
                  ) : null}
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Invite member
                </button>
              </form>
            </Card>
          ) : null}

          <Card className="overflow-hidden border-black/10 shadow-none">
            <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <Users className="h-4 w-4 text-brand-600" /> Members
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Permissions apply to every project in this organization.
                </p>
              </div>
              <span className="text-sm text-ink-400">
                {selected.memberships.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-ink-50/40 text-xs text-ink-500">
                    <th className="px-6 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {selected.memberships.map((membership) => {
                    const manageable = canManageRole(
                      actorRole,
                      membership.role,
                    );
                    return (
                      <tr key={membership.id}>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold">
                              {initials(
                                membership.user.name ?? membership.user.email,
                              )}
                            </span>
                            <div>
                              <p className="font-medium">
                                {membership.user.name ?? "Unnamed user"}
                                {membership.userId === user.id ? " (you)" : ""}
                              </p>
                              <p className="text-xs text-ink-400">
                                {membership.user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {manageable ? (
                            <form
                              action={updateOrganizationMemberRole.bind(
                                null,
                                selected.id,
                              )}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="hidden"
                                name="membershipId"
                                value={membership.id}
                              />
                              <select
                                name="role"
                                defaultValue={membership.role}
                                className="h-9 rounded-xl border border-black/10 bg-white px-2.5 text-sm"
                              >
                                {actorRole === "OWNER" ? (
                                  <option value="ADMIN">Admin</option>
                                ) : null}
                                <option value="MEMBER">Member</option>
                                <option value="VIEWER">Viewer</option>
                              </select>
                              <button
                                type="submit"
                                className="text-xs font-medium text-brand-700 hover:underline"
                              >
                                Save
                              </button>
                            </form>
                          ) : (
                            <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium capitalize">
                              {membership.role.toLowerCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-ink-500">
                          {membership.createdAt.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          {manageable ? (
                            <form
                              action={removeOrganizationMember.bind(
                                null,
                                selected.id,
                              )}
                            >
                              <input
                                type="hidden"
                                name="membershipId"
                                value={membership.id}
                              />
                              <button
                                type="submit"
                                aria-label={`Remove ${membership.user.email}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {selected.invitations.length > 0 ? (
            <Card className="border-black/10 p-6 shadow-none">
              <h2 className="flex items-center gap-2 font-semibold">
                <Mail className="h-4 w-4 text-brand-600" /> Pending invitations
              </h2>
              <div className="mt-4 divide-y divide-black/5">
                {selected.invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex flex-wrap items-center gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{invitation.email}</p>
                      <p className="text-xs text-ink-400">
                        Expires {invitation.expiresAt.toLocaleDateString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs capitalize">
                      {invitation.role.toLowerCase()}
                    </span>
                    {canManage ? (
                      <form
                        action={revokeOrganizationInvitation.bind(
                          null,
                          selected.id,
                        )}
                      >
                        <input
                          type="hidden"
                          name="invitationId"
                          value={invitation.id}
                        />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Revoke
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
