import type { Metadata } from "next";
import {
  BookOpen,
  Bug,
  Code,
  GitPullRequest,
  Heart,
  Package,
  PackageX,
  ScrollText,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@vaultlier/ui/button";
import { FeatureCard } from "@vaultlier/ui/feature-card";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { DOCS_URL, GITHUB_URL, NPM_URL } from "../../lib/links";

export const metadata: Metadata = {
  title: "Contribute — Vaultlier",
  description:
    "Vaultlier is open source under the MIT license. Learn how to report issues, open pull requests, and the ground rules that keep the package zero-dependency and secret-safe.",
};

const CONTRIBUTING_URL = `${GITHUB_URL}/blob/main/packages/vaultlier/CONTRIBUTING.md`;
const ISSUES_URL = `${GITHUB_URL}/issues`;

const WAYS = [
  {
    icon: Bug,
    title: "Report an issue",
    description:
      "Found a bug or a rough edge? Open an issue with a clear repro. Well-scoped reports are some of the most valuable contributions.",
  },
  {
    icon: GitPullRequest,
    title: "Send a pull request",
    description:
      "Fix a bug, add a CLI flag, or improve an error message. Behavior changes ship with tests in the matching *.test.ts file.",
  },
  {
    icon: BookOpen,
    title: "Improve the docs",
    description:
      "Clarify a guide, fix an example, or document a gotcha. Docs live in the repo alongside the code and review the same way.",
  },
  {
    icon: Star,
    title: "Spread the word",
    description:
      "Star the repo, share what you built, or help answer questions. Adoption and feedback steer the roadmap.",
  },
];

const RULES = [
  {
    icon: PackageX,
    title: "Zero runtime dependencies",
    description:
      "Everything in the published package ships with no third-party packages. Need a utility? Write the minimal version. Dev dependencies are fine.",
  },
  {
    icon: ShieldCheck,
    title: "Secrets never touch disk or logs",
    description:
      "No secret value may be written to a file, echoed to output, or embedded in an error. Tests assert this — keep them passing on new surfaces.",
  },
  {
    icon: ScrollText,
    title: "Tests accompany changes",
    description:
      "New commands, flags, and error paths need tests. CI enforces lint, type-checks, the suite, coverage floors, and a clean build on every PR.",
  },
];

export default function ContributePage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 lg:px-8">
        <section className="py-12 lg:py-20">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            <Heart className="h-4 w-4" />
            Open source
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-fg sm:text-5xl">
            Vaultlier is built in the open.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            The runtime SDK and CLI are open source under the{" "}
            <strong className="text-fg">MIT license</strong> and developed in
            public on GitHub. Because the package is what you run in production,
            we hold it to strict standards — and we welcome contributions that
            keep it that way.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href={GITHUB_URL} size="lg" target="_blank" rel="noreferrer">
              <Code className="h-4 w-4" />
              View on GitHub
            </Button>
            <Button
              href={CONTRIBUTING_URL}
              size="lg"
              variant="secondary"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen className="h-4 w-4" />
              Contributing guide
            </Button>
          </div>
        </section>

        <section className="border-t border-border py-12 lg:py-16">
          <h2 className="text-2xl font-bold tracking-tight text-fg">
            Ways to contribute
          </h2>
          <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {WAYS.map((way) => (
              <FeatureCard key={way.title} {...way} />
            ))}
          </div>
        </section>

        <section className="border-t border-border py-12 lg:py-16">
          <h2 className="text-2xl font-bold tracking-tight text-fg">
            Ground rules
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            A few invariants are non-negotiable because they are what make
            Vaultlier safe to depend on. CI enforces them on every pull request.
          </p>
          <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-3">
            {RULES.map((rule) => (
              <FeatureCard key={rule.title} {...rule} />
            ))}
          </div>
        </section>

        <section className="border-t border-border py-12 lg:py-16">
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              Get started
            </h2>
            <ol className="mt-4 max-w-2xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
              <li>
                Fork and clone the repo, then run{" "}
                <code className="font-mono text-fg">npm ci</code> from the root
                (npm workspaces).
              </li>
              <li>
                Make your change with tests, and run{" "}
                <code className="font-mono text-fg">npm run lint</code>,{" "}
                <code className="font-mono text-fg">check-types</code>,{" "}
                <code className="font-mono text-fg">test</code>, and{" "}
                <code className="font-mono text-fg">build</code> locally.
              </li>
              <li>
                Open a pull request. The full workflow and quality gates are in
                the contributing guide.
              </li>
            </ol>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button href={ISSUES_URL} size="md" target="_blank" rel="noreferrer">
                <Bug className="h-4 w-4" />
                Browse issues
              </Button>
              <Button
                href={NPM_URL}
                size="md"
                variant="secondary"
                target="_blank"
                rel="noreferrer"
              >
                <Package className="h-4 w-4" />
                View on npm
              </Button>
              <Button
                href={`${DOCS_URL}`}
                size="md"
                variant="secondary"
                target="_blank"
                rel="noreferrer"
              >
                <BookOpen className="h-4 w-4" />
                Read the docs
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
