"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function DashboardSearch(): React.JSX.Element {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get("organizationId") ?? "";

  return (
    <form
      action="/dashboard"
      className="mx-auto hidden w-full max-w-xl md:block"
    >
      {organizationId ? (
        <input type="hidden" name="organizationId" value={organizationId} />
      ) : null}
      <label className="relative block">
        <span className="sr-only">Search projects and environments</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          name="query"
          defaultValue={searchParams.get("query") ?? ""}
          placeholder="Search projects, organizations, environments..."
          className="h-11 w-full rounded-xl border border-black/10 bg-white pl-11 pr-4 text-sm shadow-sm outline-none placeholder:text-ink-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
        />
      </label>
    </form>
  );
}
