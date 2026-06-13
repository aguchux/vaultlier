import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@repo/ui/logo";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { auth, signIn } from "../../lib/auth";

export const metadata = {
  title: "Log in — Vaultlier",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}): Promise<React.JSX.Element> {
  const { callbackUrl } = await searchParams;
  // Only honor same-origin relative paths to avoid open-redirects.
  const redirectTo =
    callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/dashboard";

  const session = await auth();
  if (session?.user) redirect(redirectTo);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-ink-900">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-500">
          Sign in to manage your projects and secrets.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <Button type="submit" variant="secondary" className="w-full">
              <GoogleIcon />
              Continue with Google
            </Button>
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo });
            }}
          >
            <Button type="submit" variant="secondary" className="w-full">
              <GitHubIcon />
              Continue with GitHub
            </Button>
          </form>
        </div>
      </Card>
      <p className="mt-6 max-w-sm text-center text-xs text-ink-400">
        By continuing you agree to keep your secrets sealed. New accounts get a
        personal organization automatically.
      </p>
    </div>
  );
}

function GoogleIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

function GitHubIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-ink-900" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}
