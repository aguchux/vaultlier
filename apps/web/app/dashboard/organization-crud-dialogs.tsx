"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";

function useNativeDialog(
  open: boolean,
): React.RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return ref;
}

export function OrganizationCrudDialogs({
  organization,
  canUpdate,
  canDelete,
  deletionBlockers,
  updateAction,
  deleteAction,
}: {
  organization: { name: string; description: string | null };
  canUpdate: boolean;
  canDelete: boolean;
  deletionBlockers: string[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}): React.JSX.Element {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editRef = useNativeDialog(editOpen);
  const deleteRef = useNativeDialog(deleteOpen);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canUpdate}
          onClick={() => setEditOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 text-sm font-medium hover:bg-ink-50 disabled:opacity-50"
        >
          <Pencil className="h-4 w-4" /> Edit
        </button>
        <button
          type="button"
          disabled={!canDelete}
          onClick={() => setDeleteOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          title={
            deletionBlockers.length > 0
              ? `Remove ${deletionBlockers.join(", ")} before deleting.`
              : canDelete
                ? "Delete organization"
                : "Only the owner can delete this organization."
          }
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>

      <dialog
        ref={editRef}
        aria-label="Edit organisation"
        onCancel={() => setEditOpen(false)}
        onClose={() => setEditOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setEditOpen(false);
        }}
        className="m-auto w-[min(92vw,32rem)] rounded-2xl border border-black/10 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/40"
      >
        <form
          action={async (formData) => {
            await updateAction(formData);
            setEditOpen(false);
          }}
          className="rounded-2xl"
        >
          <DialogHeader
            title="Edit organisation"
            description="Update the organisation's display details."
            onClose={() => setEditOpen(false)}
          />
          <div className="space-y-5 px-6 py-5">
            <label className="block text-sm font-medium">
              Organisation name
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={organization.name}
                className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3 text-sm font-normal outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block text-sm font-medium">
              Description
              <textarea
                name="description"
                maxLength={500}
                rows={4}
                defaultValue={organization.description ?? ""}
                className="mt-2 w-full resize-none rounded-xl border border-black/10 px-3 py-2.5 text-sm font-normal outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
          <DialogActions
            submitLabel="Save changes"
            onCancel={() => setEditOpen(false)}
          />
        </form>
      </dialog>

      <dialog
        ref={deleteRef}
        aria-label="Delete organisation"
        onCancel={() => setDeleteOpen(false)}
        onClose={() => setDeleteOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDeleteOpen(false);
        }}
        className="m-auto w-[min(92vw,32rem)] rounded-2xl border border-red-200 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/40"
      >
        <form
          action={async (formData) => {
            await deleteAction(formData);
            setDeleteOpen(false);
          }}
          className="rounded-2xl"
        >
          <DialogHeader
            title="Delete organisation"
            description="This permanently removes the empty organisation. Audit history is retained."
            onClose={() => setDeleteOpen(false)}
            destructive
          />
          <div className="space-y-4 px-6 py-5">
            <p className="text-sm text-ink-600">
              Type <strong>{organization.name}</strong> to confirm.
            </p>
            <input
              name="confirmation"
              required
              autoComplete="off"
              placeholder={organization.name}
              className="h-11 w-full rounded-xl border border-red-200 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-black/5 bg-ink-50/60 px-6 py-4">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium hover:bg-ink-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete organisation
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function DialogHeader({
  title,
  description,
  onClose,
  destructive = false,
}: {
  title: string;
  description: string;
  onClose: () => void;
  destructive?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-4 border-b border-black/5 px-6 py-5">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${destructive ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700"}`}
      >
        {destructive ? (
          <Trash2 className="h-5 w-5" />
        ) : (
          <Pencil className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-ink-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={`Close ${title.toLowerCase()} dialog`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-400 hover:bg-ink-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function DialogActions({
  submitLabel,
  onCancel,
}: {
  submitLabel: string;
  onCancel: () => void;
}): React.JSX.Element {
  return (
    <div className="flex justify-end gap-3 border-t border-black/5 bg-ink-50/60 px-6 py-4">
      <button
        type="button"
        onClick={onCancel}
        className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium hover:bg-ink-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
      >
        {submitLabel}
      </button>
    </div>
  );
}
