import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@repo/ui/logo";
import { Card } from "@repo/ui/card";
import { auth } from "../../../lib/auth";
import { approveCliLogin, denyCliLogin } from "./actions";
import { ApproveForm } from "./approve-form";

export const metadata = {
  title: "Authorize CLI — Vaultlier",
};

/**
 * Browser landing page for `vaultlier login`. The CLI sends the user here
 * with their device code; after signing in they approve or deny the request.
 */
export default async function CliApprovePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}): Promise<React.JSX.Element> {
  const { code = "" } = await searchParams;

  const session = await auth();
  if (!session?.user) {
    // Send them through login, then back to this exact approval link.
    const returnTo = `/cli/approve${code ? `?code=${encodeURIComponent(code)}` : ""}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-ink-900">
          Authorize the Vaultlier CLI
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          A device is requesting access to your account to list and create
          projects. It cannot read your secrets.
        </p>
        <div className="mt-6">
          <ApproveForm
            initialCode={code}
            approveAction={approveCliLogin}
            denyAction={denyCliLogin}
          />
        </div>
      </Card>
      <p className="mt-6 max-w-sm text-center text-xs text-ink-400">
        Signed in as {session.user.email}. Only approve this if you just ran{" "}
        <code className="font-mono">vaultlier login</code>.
      </p>
    </div>
  );
}
