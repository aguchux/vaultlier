"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";

interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
  role: string;
  projectCount: number;
}

interface ProjectOrganization {
  projectId: string;
  orgId: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function OrganizationSwitcher({
  organizations,
  projectOrganizations,
  createAction,
}: {
  organizations: OrganizationOption[];
  projectOrganizations: ProjectOrganization[];
  createAction: (formData: FormData) => Promise<void>;
}): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [creating, setCreating] = useState(false);
  const projectId = pathname.match(/^\/dashboard\/([^/]+)/)?.[1];
  const projectOrgId = projectOrganizations.find(
    (item) => item.projectId === projectId,
  )?.orgId;
  const requestedOrgId = searchParams.get("organizationId");
  const active =
    organizations.find((org) => org.id === projectOrgId) ??
    organizations.find((org) => org.id === requestedOrgId) ??
    organizations[0];

  if (!active) {
    return <div className="h-11 w-48 rounded-xl bg-ink-50" />;
  }

  return (
    <details ref={detailsRef} className="group relative">
      <summary className="flex h-11 min-w-0 cursor-pointer list-none items-center gap-3 rounded-xl border border-black/10 bg-white px-2.5 pr-3 shadow-sm hover:bg-ink-50 sm:min-w-56 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-semibold text-white shadow-sm">
          {initials(active.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
          {active.name}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="absolute left-0 top-13 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-black/10 bg-white p-2 shadow-2xl">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
          Organizations
        </div>
        <div className="max-h-72 overflow-y-auto">
          {organizations.map((org) => (
            <Link
              key={org.id}
              href={`/dashboard?organizationId=${org.id}`}
              onClick={() => detailsRef.current?.removeAttribute("open")}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-ink-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700">
                {initials(org.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {org.name}
                </span>
                <span className="block text-xs text-ink-400">
                  {org.projectCount} project{org.projectCount === 1 ? "" : "s"}{" "}
                  - {org.role.toLowerCase()}
                </span>
              </span>
              {org.id === active.id ? (
                <Check className="h-4 w-4 text-brand-600" />
              ) : null}
            </Link>
          ))}
        </div>
        <div className="my-2 border-t border-black/5" />
        {creating ? (
          <form action={createAction} className="space-y-2 p-2">
            <label className="block text-xs font-medium text-ink-600">
              Organisation name
              <input
                name="name"
                required
                minLength={2}
                autoFocus
                placeholder="Acme Corporation"
                className="mt-1.5 h-10 w-full rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-9 flex-1 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
              >
                Create organisation
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="h-9 rounded-xl px-3 text-sm font-medium text-ink-600 hover:bg-ink-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-200 bg-brand-50">
              <Plus className="h-4 w-4" />
            </span>
            Create Organisation
          </button>
        )}
      </div>
    </details>
  );
}
