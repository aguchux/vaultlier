"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Plus, X } from "lucide-react";
import { cn } from "@repo/ui/lib/cn";

interface DialogProps {
  action: (formData: FormData) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrganizationCreateDialog({
  action,
  open,
  onOpenChange,
}: DialogProps): React.JSX.Element {
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
      aria-label="Create organisation"
      onCancel={() => onOpenChange(false)}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-black/10 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/40"
    >
      <form
        action={async (formData) => {
          await action(formData);
          onOpenChange(false);
        }}
        className="overflow-hidden rounded-2xl"
      >
        <div className="flex items-start gap-4 border-b border-black/5 px-6 py-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Create organisation</h2>
            <p className="mt-1 text-sm text-ink-500">
              Create a new security boundary for projects, members, and roles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close create organisation dialog"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-400 hover:bg-ink-50 hover:text-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <label className="block text-sm font-medium">
            Organisation name
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoFocus
              placeholder="Acme Corporation"
              className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-normal outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <label className="block text-sm font-medium">
            Description
            <textarea
              name="description"
              maxLength={500}
              rows={4}
              placeholder="What this organisation owns and who it serves."
              className="mt-2 w-full resize-none rounded-xl border border-black/10 px-3 py-2.5 text-sm font-normal outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
            <span className="mt-1.5 block text-xs font-normal text-ink-400">
              Optional. Up to 500 characters.
            </span>
          </label>
          <div className="grid gap-3 rounded-xl bg-ink-50 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
                Initial plan
              </p>
              <p className="mt-1 font-semibold">Hobby</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-400">
                Your role
              </p>
              <p className="mt-1 font-semibold">Owner</p>
            </div>
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
            <Plus className="h-4 w-4" /> Create organisation
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function OrganizationCreateButton({
  action,
  variant = "primary",
}: {
  action: (formData: FormData) => Promise<void>;
  variant?: "primary" | "menu";
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 text-sm font-medium",
          variant === "primary"
            ? "h-10 rounded-xl bg-brand-600 px-4 text-white hover:bg-brand-700"
            : "w-full rounded-xl px-3 py-2.5 text-brand-700 hover:bg-brand-50",
        )}
      >
        {variant === "menu" ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-200 bg-brand-50">
            <Plus className="h-4 w-4" />
          </span>
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Create Organisation
      </button>
      <OrganizationCreateDialog
        action={action}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
