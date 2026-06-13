import Link from "next/link";
import { Button } from "@repo/ui/button";
import { Logo } from "@repo/ui/logo";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { auth, signOut } from "../../lib/auth";
import { DOCS_URL } from "../../lib/links";

const NAV: { label: string; href: string; external?: boolean }[] = [
  { label: "Product", href: "/#product" },
  { label: "Docs", href: DOCS_URL, external: true },
  { label: "Security", href: `${DOCS_URL}/security`, external: true },
  { label: "Company", href: "/#company" },
];

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
            key={item.label}
            href={item.href}
            {...(item.external
              ? { target: "_blank", rel: "noreferrer" }
              : {})}
            className="text-sm font-medium text-ink-700 transition-colors hover:text-ink-900 dark:text-ink-300 dark:hover:text-white"
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user ? <SignedInActions user={user} /> : <SignedOutActions />}
      </div>
    </header>
  );
}

function SignedOutActions(): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <a
        href="/login"
        className="hidden text-sm font-medium text-ink-700 hover:text-ink-900 sm:block dark:text-ink-300 dark:hover:text-white"
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
        className="hidden items-center gap-2 text-sm font-medium text-ink-700 hover:text-ink-900 sm:inline-flex dark:text-ink-300 dark:hover:text-white"
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
          className="hidden text-sm font-medium text-ink-500 hover:text-ink-900 sm:block dark:text-ink-400 dark:hover:text-white"
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
