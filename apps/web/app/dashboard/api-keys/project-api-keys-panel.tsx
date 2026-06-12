"use client";

import { useActionState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import type { CreateProjectApiKeyState } from "./actions";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  role: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ProjectApiKeysPanel({
  keys,
  canManage,
  createAction,
  revokeAction,
}: {
  keys: ApiKeyRow[];
  canManage: boolean;
  createAction: (
    previous: CreateProjectApiKeyState | null,
    formData: FormData,
  ) => Promise<CreateProjectApiKeyState>;
  revokeAction: (formData: FormData) => Promise<void>;
}): React.JSX.Element {
  const [state, formAction, pending] = useActionState(createAction, null);

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold">Project API keys</h2>
          <p className="mt-1 text-sm text-ink-500">
            Read-only keys fetch configuration. Read-write keys may also push
            schema changes and encrypted values.
          </p>
        </div>
      </div>

      {state?.rawKey ? (
        <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold">
            {state.name} created. Copy this key now; it will not be shown again.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3">
            <code className="min-w-0 flex-1 select-all break-all font-mono text-sm">
              {state.rawKey}
            </code>
            <Copy
              className="h-4 w-4 shrink-0 text-ink-400"
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Store it in <code className="font-mono">VAULTLIER_API_KEY</code> in
            the target runtime. Never commit it.
          </p>
        </div>
      ) : null}
      {state?.error ? (
        <p className="mt-4 text-sm font-medium text-red-600">{state.error}</p>
      ) : null}

      <div className="mt-5 divide-y divide-black/5 border-y border-black/5">
        {keys.map((key) => (
          <div
            key={key.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 text-sm"
          >
            <div className="min-w-48 flex-1">
              <p className="font-semibold">{key.name}</p>
              <code className="font-mono text-xs text-ink-400">
                {key.prefix}...
              </code>
            </div>
            <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium">
              {key.role === "VIEWER" ? "Read-only" : "Read-write"}
            </span>
            <span className="text-xs text-ink-400">
              {key.lastUsedAt
                ? `Last used ${new Date(key.lastUsedAt).toLocaleString()}`
                : `Created ${new Date(key.createdAt).toLocaleDateString()}`}
            </span>
            {canManage ? (
              <form action={revokeAction}>
                <input type="hidden" name="apiKeyId" value={key.id} />
                <button
                  type="submit"
                  aria-label={`Revoke ${key.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            ) : null}
          </div>
        ))}
        {keys.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">
            No active API keys.
          </p>
        ) : null}
      </div>

      {canManage ? (
        <form
          action={formAction}
          className="mt-5 grid gap-3 sm:grid-cols-[1fr_160px_auto]"
        >
          <input
            name="name"
            required
            placeholder="Key name, for example production"
            className="h-10 rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
          <select
            name="role"
            defaultValue="VIEWER"
            aria-label="API key permissions"
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
          >
            <option value="VIEWER">Read-only</option>
            <option value="MEMBER">Read-write</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {pending ? "Creating..." : "Create key"}
          </button>
        </form>
      ) : (
        <p className="mt-5 text-sm text-ink-500">
          Your organization role does not permit API key management.
        </p>
      )}
    </div>
  );
}
