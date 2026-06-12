"use client";

import { usePathname, useRouter } from "next/navigation";

export interface SwitcherProject {
  id: string;
  name: string;
  orgName: string;
}

/** Tenant/project selector. The dashboard scopes to whichever project is picked. */
export function ProjectSwitcher({
  projects,
}: {
  projects: SwitcherProject[];
}): React.JSX.Element | null {
  const router = useRouter();
  const pathname = usePathname();
  if (projects.length === 0) return null;

  const activeId =
    projects.find((p) => pathname.startsWith(`/dashboard/${p.id}`))?.id ?? "";

  return (
    <select
      value={activeId}
      onChange={(event) => {
        const id = event.target.value;
        router.push(id ? `/dashboard/${id}` : "/dashboard");
      }}
      className="h-9 max-w-56 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-ink-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      aria-label="Select project"
    >
      <option value="">All projects</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.orgName} / {project.name}
        </option>
      ))}
    </select>
  );
}
