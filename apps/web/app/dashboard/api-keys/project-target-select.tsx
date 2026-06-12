"use client";

import { useRouter, useSearchParams } from "next/navigation";

export interface ProjectTarget {
  id: string;
  name: string;
  publicId: string;
  organizationId: string;
  organizationName: string;
}

export function ProjectTargetSelect({
  projects,
}: {
  projects: ProjectTarget[];
}): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("projectId") ?? "";
  return (
    <select
      value={selected}
      onChange={(event) => {
        const project = projects.find((item) => item.id === event.target.value);
        if (!project) {
          router.push("/dashboard/api-keys");
          return;
        }
        router.push(
          `/dashboard/api-keys?organizationId=${project.organizationId}&projectId=${project.id}`,
        );
      }}
      aria-label="Target project"
      className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
    >
      <option value="">Select a target project</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.organizationName} / {project.name} ({project.publicId})
        </option>
      ))}
    </select>
  );
}
