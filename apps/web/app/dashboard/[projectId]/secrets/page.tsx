import { prisma } from "@repo/db";
import { readExternal } from "../../../../lib/storage";
import { decryptSecret } from "../../../../lib/vault-crypto";
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

  // Pull the latest version per (key, environment). `distinct` with desc order
  // returns the newest row for each environmentId. Values are read from the
  // project's external store when configured, falling back to the DB copy.
  const tabs: EnvironmentTab[] = await Promise.all(
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
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white">
          {project.name} variables
        </h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Manage environment variables per environment. Values are encrypted at
          rest and resolved by the SDK at runtime.
        </p>
      </div>
      <SecretsEditor
        tabs={tabs}
        canManage={canWriteSecrets(role)}
        setAction={setSecret.bind(null, projectId)}
        deleteAction={deleteSecret.bind(null, projectId)}
      />
    </div>
  );
}
