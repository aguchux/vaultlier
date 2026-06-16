"use client";

import { useEffect, useRef, useState } from "react";
import { Folder, Plus, X } from "lucide-react";

interface ProjectCreateDialogProps {
  action: (formData: FormData) => Promise<void>;
  organizationId: string;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectCreateDialog({
  action,
  organizationId,
  organizationName,
  open,
  onOpenChange,
}: ProjectCreateDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Create project"
      onCancel={() => onOpenChange(false)}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      className="m-auto w-[min(92vw,32rem)] rounded-2xl border border-black/10 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/40"
    >
      <form
        action={async (formData) => {
          await action(formData);
          onOpenChange(false);
        }}
        className="overflow-hidden rounded-2xl"
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <div className="flex items-start gap-4 border-b border-black/5 px-6 py-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Folder className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Create project</h2>
            <p className="mt-1 text-sm text-ink-500">
              Add a new configuration vault to {organizationName}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close create project dialog"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-400 hover:bg-ink-50 hover:text-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <label className="block text-sm font-medium">
            Project name
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoFocus
              placeholder="Payments API"
              className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-normal outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <div className="rounded-xl bg-ink-50 p-4 text-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
              Defaults
            </p>
            <p className="mt-1 text-ink-600">
              New projects start with dev, staging, and prod environments.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-black/5 bg-ink-50/60 px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium hover:bg-ink-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Create project
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function ProjectCreateButton({
  action,
  organizationId,
  organizationName,
}: {
  action: (formData: FormData) => Promise<void>;
  organizationId: string;
  organizationName: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> New Project
      </button>
      <ProjectCreateDialog
        action={action}
        organizationId={organizationId}
        organizationName={organizationName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
