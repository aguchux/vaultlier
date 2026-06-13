import { Logo } from "@repo/ui/logo";

const LINKS = [
  { label: "Docs", href: "#" },
  { label: "GitHub", href: "https://github.com/aguchux/vaultlierjs" },
  { label: "npm", href: "https://www.npmjs.com/package/vaultlier" },
  { label: "Security", href: "#" },
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
