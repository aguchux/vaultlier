"use client";

import { useEffect, useRef, useState } from "react";
import { Cloud, Pencil, Plus, Trash2, X } from "lucide-react";

interface EnvironmentRow {
  id: string;
  name: string;
  deletionBlockers: string[];
}

function useDialog(open: boolean): React.RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return ref;
}

export function EnvironmentManager({
  environments,
  canManage,
  createAction,
  updateAction,
  deleteAction,
}: {
  environments: EnvironmentRow[];
  canManage: boolean;
  createAction: (formData: FormData) => Promise<void>;
  updateAction: (environmentId: string, formData: FormData) => Promise<void>;
  deleteAction: (environmentId: string, formData: FormData) => Promise<void>;
}): React.JSX.Element {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EnvironmentRow | null>(null);
  const [deleting, setDeleting] = useState<EnvironmentRow | null>(null);
  const createRef = useDialog(createOpen);
  const editRef = useDialog(Boolean(editing));
  const deleteRef = useDialog(Boolean(deleting));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {environments.map((environment) => (
          <div
            key={environment.id}
            className="flex items-center gap-2 rounded-xl border border-black/5 bg-ink-50 px-3 py-2 text-sm"
          >
            <Cloud className="h-4 w-4 text-brand-600" />
            <span className="font-medium">{environment.name}</span>
            {canManage ? (
              <span className="ml-1 flex items-center gap-0.5 border-l border-black/10 pl-1.5">
                <button
                  type="button"
                  onClick={() => setEditing(environment)}
                  aria-label={`Rename ${environment.name}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-white hover:text-ink-800"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={environment.deletionBlockers.length > 0}
                  onClick={() => setDeleting(environment)}
                  aria-label={`Delete ${environment.name}`}
                  title={
                    environment.deletionBlockers.length > 0
                      ? `Remove ${environment.deletionBlockers.join(", ")} before deleting.`
                      : `Delete ${environment.name}`
                  }
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
          </div>
        ))}
        {canManage ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-brand-200 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" /> Add environment
          </button>
        ) : null}
        {environments.length === 0 && !canManage ? (
          <span className="text-sm text-ink-400">No environments.</span>
        ) : null}
      </div>

      <EnvironmentDialog
        dialogRef={createRef}
        title="Add environment"
        description="Add a runtime target to this project's typed configuration schema."
        action={createAction}
        submitLabel="Add environment"
        onClose={() => setCreateOpen(false)}
      />
      <EnvironmentDialog
        key={editing?.id ?? "edit-environment"}
        dialogRef={editRef}
        title="Rename environment"
        description="Key scopes that reference this environment will be updated atomically."
        action={editing ? updateAction.bind(null, editing.id) : createAction}
        submitLabel="Save environment"
        defaultName={editing?.name}
        onClose={() => setEditing(null)}
      />
      <dialog
        ref={deleteRef}
        aria-label="Delete environment"
        onCancel={() => setDeleting(null)}
        onClose={() => setDeleting(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDeleting(null);
        }}
        className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-red-200 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/40"
      >
        {deleting ? (
          <form
            action={async (formData) => {
              await deleteAction(deleting.id, formData);
              setDeleting(null);
            }}
          >
            <DialogHeader
              title="Delete environment"
              description="This removes the environment from the project schema."
              onClose={() => setDeleting(null)}
              destructive
            />
            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-ink-600">
                Type <strong>{deleting.name}</strong> to confirm.
              </p>
              <input
                name="confirmation"
                required
                autoComplete="off"
                placeholder={deleting.name}
                className="h-11 w-full rounded-xl border border-red-200 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />
            </div>
            <DialogFooter
              submitLabel="Delete environment"
              onClose={() => setDeleting(null)}
              destructive
            />
          </form>
        ) : null}
      </dialog>
    </>
  );
}

function EnvironmentDialog({
  dialogRef,
  title,
  description,
  action,
  submitLabel,
  defaultName,
  onClose,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  description: string;
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  defaultName?: string;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-black/10 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/40"
    >
      <form
        action={async (formData) => {
          await action(formData);
          onClose();
        }}
      >
        <DialogHeader
          title={title}
          description={description}
          onClose={onClose}
        />
        <div className="px-6 py-5">
          <label className="block text-sm font-medium">
            Environment name
            <input
              name="name"
              required
              maxLength={32}
              pattern="[a-z][a-z0-9_-]{0,31}"
              defaultValue={defaultName}
              placeholder="preview"
              className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3 font-mono text-sm font-normal lowercase outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
            <span className="mt-1.5 block text-xs font-normal text-ink-400">
              Lowercase letters, numbers, hyphens, and underscores.
            </span>
          </label>
        </div>
        <DialogFooter submitLabel={submitLabel} onClose={onClose} />
      </form>
    </dialog>
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
          <Cloud className="h-5 w-5" />
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

function DialogFooter({
  submitLabel,
  onClose,
  destructive = false,
}: {
  submitLabel: string;
  onClose: () => void;
  destructive?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex justify-end gap-3 border-t border-black/5 bg-ink-50/60 px-6 py-4">
      <button
        type="button"
        onClick={onClose}
        className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium hover:bg-ink-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        className={`h-10 rounded-xl px-4 text-sm font-medium text-white ${destructive ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"}`}
      >
        {submitLabel}
      </button>
    </div>
  );
}
