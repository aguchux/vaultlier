"use client";

import { useActionState } from "react";
import { KeyRound, Plus } from "lucide-react";
import type { CreateApiKeyState } from "../../actions";

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  role: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Project API keys: mint keys for the vaultlier CLI/runtime and revoke them.
 * A freshly created key is shown exactly once — it is never retrievable later.
 */
export function ApiKeysPanel({
  keys,
  canManage,
  createAction,
  revokeAction,
}: {
  keys: ApiKeyRow[];
  canManage: boolean;
  createAction: (
    prev: CreateApiKeyState | null,
    formData: FormData,
  ) => Promise<CreateApiKeyState>;
  revokeAction: (formData: FormData) => Promise<void>;
}): React.JSX.Element {
  const [state, formAction, pending] = useActionState(createAction, null);

  return (
    <div>
      <h2 className="flex items-center gap-2 font-semibold text-ink-900">
        <KeyRound className="h-4 w-4" /> API keys
      </h2>
      <p className="mt-1 text-sm text-ink-500">
        Used by <code className="font-mono text-xs">vaultlier</code> (CLI and
        runtime) to talk to this vault. Read-only keys can fetch config;
        read-write keys can also push schema and write secrets.
      </p>

      {state?.rawKey ? (
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-ink-900">
            “{state.name}” created — copy it now, it won&apos;t be shown again:
          </p>
          <code className="mt-2 block select-all break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-ink-900">
            {state.rawKey}
          </code>
          <p className="mt-2 text-xs text-ink-500">
            Use it with{" "}
            <code className="font-mono">
              npx vaultlier init --api-key=&lt;key&gt;
            </code>{" "}
            or set <code className="font-mono">VAULTLIER_API_KEY</code> in your
            deployment.
          </p>
        </div>
      ) : null}
      {state?.error ? (
        <p className="mt-4 text-sm text-red-600">{state.error}</p>
      ) : null}

      {keys.length > 0 ? (
        <ul className="mt-4 divide-y divide-black/5">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm"
            >
              <span className="font-medium text-ink-900">{key.name}</span>
              <code className="font-mono text-xs text-ink-500">
                {key.prefix}…
              </code>
              <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-700">
                {key.role === "VIEWER" ? "read-only" : "read-write"}
              </span>
              <span className="text-xs text-ink-400">
                {key.lastUsedAt
                  ? `last used ${new Date(key.lastUsedAt).toLocaleString()}`
                  : "never used"}
              </span>
              {canManage ? (
                <form action={revokeAction} className="ml-auto">
                  <input type="hidden" name="apiKeyId" value={key.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Revoke
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-400">No active API keys.</p>
      )}

      {canManage ? (
        <form
          action={formAction}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <input
            name="name"
            required
            placeholder="Key name (e.g. ci, production)"
            className="h-10 grow rounded-xl border border-black/10 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          />
          <select
            name="role"
            defaultValue="VIEWER"
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
            aria-label="Key permissions"
          >
            <option value="VIEWER">Read-only</option>
            <option value="MEMBER">Read-write</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {pending ? "Creating…" : "Create key"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
