import Link from "next/link";
import { Button } from "@repo/ui/button";
import { Logo } from "@repo/ui/logo";
import { auth, signOut } from "../../lib/auth";

const NAV = ["Product", "Docs", "Security", "Company"];

export async function SiteHeader(): Promise<React.JSX.Element> {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
      <Link href="/" aria-label="Vaultlier home">
        <Logo />
      </Link>
      <nav className="hidden items-center gap-8 md:flex">
        {NAV.map((item) => (
          <a
            key={item}
            href="#"
            className="text-sm font-medium text-ink-700 transition-colors hover:text-ink-900"
          >
            {item}
          </a>
        ))}
      </nav>
      {user ? <SignedInActions user={user} /> : <SignedOutActions />}
    </header>
  );
}

function SignedOutActions(): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <a
        href="/login"
        className="hidden text-sm font-medium text-ink-700 hover:text-ink-900 sm:block"
      >
        Log in
      </a>
      <Button href="/dashboard" size="sm">
        Get Started
      </Button>
    </div>
  );
}

function SignedInActions({
  user,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}): React.JSX.Element {
  const label = user.name ?? user.email ?? "Account";

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/dashboard"
        className="hidden items-center gap-2 text-sm font-medium text-ink-700 hover:text-ink-900 sm:inline-flex"
      >
        <Avatar image={user.image} label={label} />
        <span className="max-w-40 truncate">{label}</span>
      </Link>
      <Button href="/dashboard" size="sm">
        Dashboard
      </Button>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="hidden text-sm font-medium text-ink-500 hover:text-ink-900 sm:block"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

function Avatar({
  image,
  label,
}: {
  image?: string | null;
  label: string;
}): React.JSX.Element {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- OAuth avatar URL is provider-hosted.
      <img
        src={image}
        alt=""
        className="h-8 w-8 rounded-full border border-black/10 bg-ink-50"
      />
    );
  }

  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700"
      aria-hidden="true"
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}
