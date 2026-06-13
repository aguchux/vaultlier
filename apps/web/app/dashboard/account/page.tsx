import { Laptop, ShieldCheck } from "lucide-react";
import { prisma } from "@repo/db";
import { Card } from "@repo/ui/card";
import { requireUser } from "../../../lib/tenancy";
import { revokeCliToken } from "./actions";

export const metadata = {
  title: "Account — Vaultlier",
};

function formatDate(value: Date | null): string {
  if (!value) return "never";
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Per-user account settings. Currently surfaces the CLI device sessions
 * created by `vaultlier login` so a user can review and revoke them.
 */
export default async function AccountPage(): Promise<React.JSX.Element> {
  const user = await requireUser();
  const tokens = await prisma.cliToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-ink-500">
          Signed in as {user.email}.
        </p>
      </div>

      <Card className="border-black/10 p-6 shadow-none">
        <h2 className="flex items-center gap-2 font-semibold">
          <Laptop className="h-4 w-4 text-brand-600" /> CLI devices
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Devices authorized with{" "}
          <code className="font-mono text-xs">vaultlier login</code>. These
          tokens can list and create projects on your behalf, but cannot read
          secrets. Revoke any you don&apos;t recognize.
        </p>

        {tokens.length === 0 ? (
          <p className="mt-5 rounded-xl bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">
            No CLI devices are connected.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-black/5">
            {tokens.map((token) => {
              const expired = token.expiresAt != null && token.expiresAt <= now;
              return (
                <li
                  key={token.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium text-ink-900">
                      {token.device ?? "Unnamed device"}{" "}
                      <span className="font-mono text-xs text-ink-400">
                        {token.prefix}…
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      Added {formatDate(token.createdAt)} · Last used{" "}
                      {formatDate(token.lastUsedAt)}
                      {expired ? " · expired" : ""}
                    </p>
                  </div>
                  <form action={revokeCliToken}>
                    <input type="hidden" name="tokenId" value={token.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-xl border border-black/10 px-3.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                    >
                      Revoke
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="border-brand-100 bg-brand-50/40 p-6 shadow-none">
        <h2 className="flex items-center gap-2 font-semibold text-brand-800">
          <ShieldCheck className="h-4 w-4" /> About device tokens
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-600">
          A device token is account-scoped: it authorizes project listing and
          creation, never secret access. Reading or writing secrets always
          requires a project API key. Revoking a device takes effect
          immediately.
        </p>
      </Card>
    </div>
  );
}
