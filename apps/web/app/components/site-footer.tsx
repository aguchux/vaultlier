import { Logo } from "@vaultlier/ui/logo";
import { DOCS_URL, GITHUB_URL, NPM_URL } from "../../lib/links";

const LINKS = [
  { label: "Docs", href: DOCS_URL },
  { label: "GitHub", href: GITHUB_URL },
  { label: "npm", href: NPM_URL },
  { label: "Security", href: `${DOCS_URL}/security` },
];

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t border-black/5 dark:border-white/10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row lg:px-8">
        <div className="flex items-center gap-3">
          <Logo />
        </div>
        <nav className="flex items-center gap-6">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <p className="text-sm text-ink-400 dark:text-ink-500">
          © {new Date().getFullYear()} Vaultlier. Open source.
        </p>
      </div>
    </footer>
  );
}
