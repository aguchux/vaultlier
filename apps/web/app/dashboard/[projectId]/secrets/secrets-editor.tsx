"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { SecretActionState } from "./actions";

const WIRE_TYPES = ["string", "boolean", "number", "json"] as const;
type WireType = (typeof WIRE_TYPES)[number];

export interface SecretVariable {
  keyId: string;
  name: string;
  type: WireType;
  value: string;
  version: number | null;
}

export interface EnvironmentTab {
  id: string;
  name: string;
  // Server sends value: string | null; null-valued rows are filtered out, so
  // by the time it reaches the table value is always a string.
  variables: Array<Omit<SecretVariable, "value"> & { value: string | null }>;
}

type SetAction = (
  prev: SecretActionState | null,
  formData: FormData,
) => Promise<SecretActionState>;
type DeleteAction = (formData: FormData) => Promise<void>;

type SortDir = "asc" | "desc";

export function SecretsEditor({
  tabs,
  canManage,
  setAction,
  deleteAction,
}: {
  tabs: EnvironmentTab[];
  canManage: boolean;
  setAction: SetAction;
  deleteAction: DeleteAction;
}): React.JSX.Element {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  if (!active) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-10 text-center text-sm text-ink-500 dark:border-white/10 dark:bg-white/3 dark:text-ink-400">
        Create an environment before adding variables.
      </div>
    );
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Environments"
        className="flex flex-wrap gap-1 border-b border-black/10 dark:border-white/10"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(tab.id)}
              className={`-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                  : "border-transparent text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
              }`}
            >
              {tab.name}
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                  selected
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "bg-ink-100 text-ink-500 dark:bg-white/10 dark:text-ink-400"
                }`}
              >
                {tab.variables.length}
              </span>
            </button>
          );
        })}
      </div>

      <EnvironmentPanel
        key={active.id}
        environment={active}
        canManage={canManage}
        setAction={setAction}
        deleteAction={deleteAction}
      />
    </div>
  );
}

function EnvironmentPanel({
  environment,
  canManage,
  setAction,
  deleteAction,
}: {
  environment: EnvironmentTab;
  canManage: boolean;
  setAction: SetAction;
  deleteAction: DeleteAction;
}): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editing, setEditing] = useState<SecretVariable | "new" | null>(null);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return environment.variables
      .filter((variable) => variable.value !== null)
      .map((variable) => variable as SecretVariable)
      .filter((variable) => variable.name.toLowerCase().includes(term))
      .sort((a, b) =>
        sortDir === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name),
      );
  }, [environment.variables, query, sortDir]);

  return (
    <div role="tabpanel" className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter variables…"
            aria-label="Filter variables"
            className="h-10 w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5 dark:text-ink-100"
          />
        </div>
        <span className="text-sm text-ink-500 dark:text-ink-400">
          {rows.length} variable{rows.length === 1 ? "" : "s"}
        </span>
        {canManage ? (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 dark:bg-brand-500 dark:text-ink-900 dark:hover:bg-brand-400"
          >
            <Plus className="h-4 w-4" /> Add variable
          </button>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-ink-50/70 dark:bg-white/5">
              <th className="px-4 py-2.5 text-left font-semibold text-ink-700 dark:text-ink-200">
                <button
                  type="button"
                  onClick={() =>
                    setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
                  }
                  className="inline-flex items-center gap-1.5 hover:text-ink-900 dark:hover:text-white"
                >
                  Key
                  {sortDir === "asc" ? (
                    <ArrowDownAZ className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpAZ className="h-3.5 w-3.5" />
                  )}
                </button>
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-ink-700 dark:text-ink-200">
                Value
              </th>
              <th className="w-28 px-4 py-2.5 text-left font-semibold text-ink-700 dark:text-ink-200">
                Type
              </th>
              {canManage ? <th className="w-24 px-4 py-2.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 4 : 3}
                  className="px-4 py-12 text-center text-sm text-ink-400"
                >
                  {query
                    ? "No variables match your filter."
                    : `No variables in ${environment.name} yet.`}
                </td>
              </tr>
            ) : (
              rows.map((variable) => (
                <SecretRow
                  key={variable.keyId}
                  environmentId={environment.id}
                  variable={variable}
                  canManage={canManage}
                  deleteAction={deleteAction}
                  onEdit={() => setEditing(variable)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <SecretDialog
          environmentId={environment.id}
          environmentName={environment.name}
          existing={editing === "new" ? null : editing}
          setAction={setAction}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function SecretRow({
  environmentId,
  variable,
  canManage,
  deleteAction,
  onEdit,
}: {
  environmentId: string;
  variable: SecretVariable;
  canManage: boolean;
  deleteAction: DeleteAction;
  onEdit: () => void;
}): React.JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(variable.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const remove = (): void => {
    const formData = new FormData();
    formData.set("environmentId", environmentId);
    formData.set("keyId", variable.keyId);
    startTransition(async () => {
      await deleteAction(formData);
    });
  };

  return (
    <tr className="border-t border-black/5 dark:border-white/10">
      <td className="px-4 py-2.5 align-top">
        <span className="font-mono text-ink-900 dark:text-ink-100">
          {variable.name}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-ink-600 dark:text-ink-300">
            {revealed ? variable.value : "•".repeat(Math.min(variable.value.length, 24) || 8)}
          </span>
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide value" : "Reveal value"}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-800 dark:hover:bg-white/5 dark:hover:text-ink-100"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy value"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-800 dark:hover:bg-white/5 dark:hover:text-ink-100"
          >
            {copied ? (
              <Check className="h-4 w-4 text-brand-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </td>
      <td className="px-4 py-2.5 align-top">
        <span className="rounded-full bg-ink-100 px-2 py-0.5 font-mono text-xs text-ink-600 dark:bg-white/10 dark:text-ink-300">
          {variable.type}
        </span>
      </td>
      {canManage ? (
        <td className="px-4 py-2.5 align-top">
          {confirmDelete ? (
            <span className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                aria-label="Cancel delete"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-50 dark:hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <span className="flex items-center justify-end gap-0.5">
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${variable.name}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-800 dark:hover:bg-white/5 dark:hover:text-ink-100"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label={`Delete ${variable.name}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </td>
      ) : null}
    </tr>
  );
}

function SecretDialog({
  environmentId,
  environmentName,
  existing,
  setAction,
  onClose,
}: {
  environmentId: string;
  environmentName: string;
  existing: SecretVariable | null;
  setAction: SetAction;
  onClose: () => void;
}): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const isEdit = existing !== null;

  const submit = (formData: FormData): void => {
    formData.set("environmentId", environmentId);
    startTransition(async () => {
      const result = await setAction(null, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  };

  return (
    <dialog
      ref={ref}
      aria-label={isEdit ? "Edit variable" : "Add variable"}
      // Only the X button and Cancel close this dialog — block Esc (cancel
      // event) and don't wire a backdrop-click handler, so an accidental
      // click-out or keypress can't discard in-progress edits.
      onCancel={(event) => event.preventDefault()}
      className="m-auto w-[min(92vw,32rem)] rounded-2xl border border-black/10 bg-white p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/40 dark:border-white/10 dark:bg-ink-800 dark:text-ink-100"
    >
      <form action={submit}>
        <div className="flex items-start justify-between border-b border-black/5 px-6 py-5 dark:border-white/10">
          <div>
            <h2 className="text-lg font-semibold">
              {isEdit ? "Edit variable" : "Add variable"}
            </h2>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {isEdit
                ? `Update ${existing.name} in ${environmentName}.`
                : `Add a variable to ${environmentName}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-400 hover:bg-ink-50 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="block text-sm font-medium">
            Key
            <input
              name="name"
              required
              autoFocus={!isEdit}
              readOnly={isEdit}
              defaultValue={existing?.name}
              maxLength={128}
              pattern="[A-Za-z_][A-Za-z0-9_]*"
              placeholder="DATABASE_URL"
              className="mt-2 h-11 w-full rounded-xl border border-black/10 px-3 font-mono text-sm font-normal outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100 read-only:bg-ink-50 read-only:text-ink-500 dark:border-white/10 dark:bg-white/5 dark:read-only:bg-white/3"
            />
            {!isEdit ? (
              <span className="mt-1.5 block text-xs font-normal text-ink-400">
                Letters, numbers, and underscores; must start with a letter or
                underscore.
              </span>
            ) : null}
          </label>

          <label className="block text-sm font-medium">
            Type
            <select
              name="type"
              defaultValue={existing?.type ?? "string"}
              disabled={isEdit}
              className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-normal outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-500 dark:border-white/10 dark:bg-white/5 dark:disabled:bg-white/3"
            >
              {WIRE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Value
            <textarea
              name="value"
              required
              rows={3}
              defaultValue={existing?.value}
              placeholder="value"
              className="mt-2 w-full resize-none rounded-xl border border-black/10 px-3 py-2.5 font-mono text-sm font-normal outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100 dark:border-white/10 dark:bg-white/5"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-black/5 bg-ink-50/60 px-6 py-4 dark:border-white/10 dark:bg-white/3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium hover:bg-ink-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:text-ink-900 dark:hover:bg-brand-400"
          >
            {pending ? "Saving…" : isEdit ? "Save value" : "Add variable"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
