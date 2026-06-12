"use client";

import { Trash2 } from "lucide-react";

/**
 * Destroy button with a typed-name confirmation so a stray click can't wipe
 * a project. The actual deletion (and its audit entry) happens server-side.
 */
export function DestroyProjectForm({
  projectName,
  action,
  disabled = false,
}: {
  projectName: string;
  action: () => Promise<void>;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const answer = window.prompt(
          `Type the project name ("${projectName}") to confirm destruction:`,
        );
        if (answer !== projectName) {
          event.preventDefault();
          if (answer !== null) {
            window.alert("Name did not match — project was not deleted.");
          }
        }
      }}
    >
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-red-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        Destroy project
      </button>
    </form>
  );
}
