import { prisma } from "@repo/db";
import { BackButton } from "@repo/ui/back-button";
import { readExternal } from "../../../../lib/storage";
import { decryptSecret, isVaultConfigured } from "../../../../lib/vault-crypto";
import { toWireType } from "../../../../lib/vault-wire";
import { canWriteSecrets } from "../../../../lib/rbac";
import { requireProjectAccess, requireUser } from "../../../../lib/tenancy";
import { SecretsEditor } from "./secrets-editor";
import type { EnvironmentTab } from "./secrets-editor";
import { deleteSecret, setSecret } from "./actions";

export const metadata = { title: "Variables" };

/**
 * Per-environment environment-variable editor. Loads every schema key and the
 * latest value for each environment, decrypts them server-side, and hands a
 * matrix to the client editor. Decryption happens only here, never on disk.
 */
export default async function SecretsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<React.JSX.Element> {
  const { projectId } = await params;
  const user = await requireUser();
  const { project, role } = await requireProjectAccess(user.id, projectId);

  const [environments, keys] = await Promise.all([
    prisma.environment.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.key.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          // One latest version per (key, environment); take enough to cover
          // every environment, then reduce to the newest per env below.
          take: 1,
          distinct: ["environmentId"],
        },
      },
    }),
  ]);

  // The portal can only read/write values when the vault master key is set.
  // Without it, skip decryption entirely and surface a clear banner rather than
  // crashing the page render.
  const vaultConfigured = isVaultConfigured();

  // Pull the latest version per (key, environment). `distinct` with desc order
  // returns the newest row for each environmentId. Values are read from the
  // project's external store when configured, falling back to the DB copy.
  const tabs: EnvironmentTab[] = vaultConfigured
    ? await Promise.all(
    environments.map(async (environment) => {
      const resolved = await Promise.all(
        keys.map(async (key) => {
          const version = key.versions.find(
            (candidate) => candidate.environmentId === environment.id,
          );
          if (!version) {
            return {
              keyId: key.id,
              name: key.name,
              type: toWireType(key.type),
              value: null as string | null,
              version: null as number | null,
            };
          }
          const external = await readExternal(project, {
            environment: environment.name,
            keyName: key.name,
            version: version.version,
          });
          const sealed = external ?? {
            ciphertext: Buffer.from(version.ciphertext),
            nonce: Buffer.from(version.nonce),
            authTag: Buffer.from(version.authTag),
            kekId: version.kekId,
          };
          return {
            keyId: key.id,
            name: key.name,
            type: toWireType(key.type),
            value: decryptSecret(project.id, sealed) as string | null,
            version: version.version as number | null,
          };
        }),
      );
      // Only show keys that have a value in this environment; new keys are
      // added explicitly through the editor.
      const variables = resolved.filter((variable) => variable.value !== null);
      return {
        id: environment.id,
        name: environment.name,
        variables,
      };
    }),
      )
    : // Vault not configured: render the tabs with no values.
      environments.map((environment) => ({
        id: environment.id,
        name: environment.name,
        variables: [],
      }));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <BackButton href={`/dashboard/${projectId}`} className="mt-1" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white">
            {project.name} variables
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Manage environment variables per environment. Values are encrypted
            at rest and resolved by the SDK at runtime.
          </p>
        </div>
      </div>
      {!vaultConfigured ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-semibold">Vault not configured</p>
          <p className="mt-1">
            This deployment has no <code className="font-mono">VAULT_MASTER_KEY</code>,
            so secret values can&apos;t be read or written. Generate one with{" "}
            <code className="font-mono">vaultlier generate-key</code> and set it
            in the server environment, then reload.
          </p>
        </div>
      ) : null}
      <SecretsEditor
        tabs={tabs}
        canManage={vaultConfigured && canWriteSecrets(role)}
        setAction={setSecret.bind(null, projectId)}
        deleteAction={deleteSecret.bind(null, projectId)}
      />
    </div>
  );
}
