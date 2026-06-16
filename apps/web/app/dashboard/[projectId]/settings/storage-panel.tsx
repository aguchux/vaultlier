"use client";

import { useActionState, useState } from "react";
import { Database, HardDrive, Save } from "lucide-react";
import type { StorageActionState } from "./storage-actions";

export interface StorageConfigView {
  adapterType: "VAULTLIER" | "S3" | "POSTGRES";
  metadata: Record<string, unknown> | null;
  lastTestStatus: string | null;
  lastTestedAt: string | null;
}

type SaveAction = (
  prev: StorageActionState | null,
  formData: FormData,
) => Promise<StorageActionState>;

const inputClass =
  "h-10 w-full rounded-xl border border-black/10 px-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:bg-ink-50 dark:border-white/10 dark:bg-ink-800";

/**
 * Configure where a project's encrypted secret blobs are stored: the default
 * Vaultlier-managed store, or a bring-your-own S3 / Postgres backend. Credential
 * fields are write-only — stored values are never sent back to the client.
 */
export function StoragePanel({
  current,
  canManage,
  saveAction,
  testAction,
}: {
  current: StorageConfigView;
  canManage: boolean;
  saveAction: SaveAction;
  testAction: SaveAction;
}): React.JSX.Element {
  const [adapterType, setAdapterType] = useState(current.adapterType);
  const [saveState, save, saving] = useActionState(saveAction, null);
  const [testState, test, testing] = useActionState(testAction, null);

  const bucket = (current.metadata?.bucket as string) ?? null;
  const region = (current.metadata?.region as string) ?? null;
  const host = (current.metadata?.host as string) ?? null;

  return (
    <div>
      <h2 className="flex items-center gap-2 font-semibold text-ink-900 dark:text-white">
        <HardDrive className="h-4 w-4" /> Storage backend
      </h2>
      <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
        Choose where this project&apos;s encrypted secrets live. Bring your own
        S3 bucket or Postgres database — Vaultlier seals every value before it
        leaves, so your store only ever sees ciphertext. A fallback copy is kept
        in Vaultlier so reads keep working if your store is briefly unavailable.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-500 dark:text-ink-400">Current:</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 font-medium text-ink-700 dark:bg-white/5 dark:text-ink-200">
          {current.adapterType === "VAULTLIER"
            ? "Vaultlier-managed"
            : current.adapterType === "S3"
              ? `S3 · ${bucket ?? "?"}${region ? ` (${region})` : ""}`
              : `Postgres${host ? ` · ${host}` : ""}`}
        </span>
        {current.lastTestStatus ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              current.lastTestStatus === "SUCCESS"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            last test {current.lastTestStatus.toLowerCase()}
          </span>
        ) : null}
      </div>

      {saveState?.ok ? (
        <p className="mt-4 text-sm text-green-700">Storage backend saved.</p>
      ) : null}
      {(saveState?.error || testState?.error) ? (
        <p className="mt-4 text-sm text-red-600">
          {saveState?.error ?? testState?.error}
        </p>
      ) : null}
      {testState?.ok && testState.tested === "SUCCESS" ? (
        <p className="mt-4 text-sm text-green-700">Connection test passed.</p>
      ) : null}

      <form action={save} className="mt-4 space-y-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-700 dark:text-ink-200">
          Backend
          <select
            name="adapterType"
            value={adapterType}
            onChange={(e) =>
              setAdapterType(e.target.value as StorageConfigView["adapterType"])
            }
            disabled={!canManage}
            className={inputClass}
          >
            <option value="VAULTLIER">Vaultlier-managed (default)</option>
            <option value="S3">Amazon S3 (or S3-compatible: R2, MinIO)</option>
            <option value="POSTGRES">Postgres (your database)</option>
          </select>
        </label>

        {adapterType === "S3" ? (
          <fieldset className="grid gap-3 sm:grid-cols-2" disabled={!canManage}>
            <Field name="bucket" label="Bucket" placeholder="my-secrets-bucket" />
            <Field name="region" label="Region" placeholder="us-east-1" />
            <Field
              name="accessKeyId"
              label="Access key ID"
              placeholder="AKIA…"
            />
            <Field
              name="secretAccessKey"
              label="Secret access key"
              placeholder="write-only"
              type="password"
            />
            <Field
              name="endpoint"
              label="Endpoint (optional)"
              placeholder="https://…r2.cloudflarestorage.com"
            />
            <Field
              name="prefix"
              label="Key prefix (optional)"
              placeholder="vaultlier"
            />
          </fieldset>
        ) : null}

        {adapterType === "POSTGRES" ? (
          <fieldset disabled={!canManage}>
            <Field
              name="connectionString"
              label="Connection string"
              placeholder="postgresql://user:pass@host:5432/db"
              type="password"
            />
          </fieldset>
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap gap-3">
            {adapterType !== "VAULTLIER" ? (
              <button
                type="submit"
                formAction={test}
                disabled={testing}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 px-4 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50 dark:border-white/10 dark:text-ink-200 dark:hover:bg-white/5"
              >
                <Database className="h-4 w-4" />
                {testing ? "Testing…" : "Test connection"}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save backend"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-ink-400">
            Only organization owners and admins can change storage.
          </p>
        )}
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-700 dark:text-ink-200">
      {label}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClass}
      />
    </label>
  );
}
