"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";
import { OrganizationCreateDialog } from "./organization-create-dialog";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const projectId = pathname.match(/^\/dashboard\/([^/]+)/)?.[1];
  const projectOrgId = projectOrganizations.find(
    (item) => item.projectId === projectId,
  )?.orgId;
  const requestedOrgId = searchParams.get("organizationId");
  const active =
    organizations.find((org) => org.id === projectOrgId) ??
    organizations.find((org) => org.id === requestedOrgId) ??
    organizations[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!active) {
    return <div className="h-11 w-48 rounded-xl bg-ink-50" />;
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 min-w-0 items-center gap-3 rounded-xl border border-black/10 bg-white px-2.5 pr-3 shadow-sm hover:bg-ink-50 sm:min-w-56"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-semibold text-white shadow-sm">
          {initials(active.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
          {active.name}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-13 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-black/10 bg-white p-2 shadow-2xl"
        >
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
            Organizations
          </div>
          <div className="max-h-72 overflow-y-auto">
            {organizations.map((org) => (
              <Link
                key={org.id}
                role="menuitem"
                href={`/dashboard?organizationId=${org.id}`}
                onClick={() => setOpen(false)}
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
                    {org.projectCount} project
                    {org.projectCount === 1 ? "" : "s"} -{" "}
                    {org.role.toLowerCase()}
                  </span>
                </span>
                {org.id === active.id ? (
                  <Check className="h-4 w-4 text-brand-600" />
                ) : null}
              </Link>
            ))}
          </div>
          <div className="my-2 border-t border-black/5" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setCreateOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-200 bg-brand-50">
              <Plus className="h-4 w-4" />
            </span>
            Create Organisation
          </button>
        </div>
      ) : null}
      <OrganizationCreateDialog
        action={createAction}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
