import type { Metadata } from "next";
import {
  BookOpen,
  ChevronRight,
  Cloud,
  FileLock2,
  GitBranch,
  History,
  PackageCheck,
  ScanLine,
  TerminalSquare,
  Users,
} from "lucide-react";
import { Button } from "@vaultlier/ui/button";
import { FeatureCard } from "@vaultlier/ui/feature-card";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { DOCS_URL } from "../../lib/links";

export const metadata: Metadata = {
  title: "Product — Vaultlier",
  description:
    "Vaultlier replaces the .env workflow with a sealed configuration vault: encrypted secrets, a typed runtime SDK, a four-command CLI, environments, and audit logs.",
};

const FEATURES = [
  {
    icon: FileLock2,
    title: "Secrets never touch disk",
    description:
      "The runtime SDK resolves values in memory over HTTPS. The files the CLI generates hold metadata only — key names, types, and scopes, never values.",
  },
  {
    icon: TerminalSquare,
    title: "A four-command CLI",
    description:
      "init, pull, push, diff. Add set for one-off writes and dev for a local read-only inspector. The .env workflow you know, without the plaintext file.",
  },
  {
    icon: Cloud,
    title: "Environments, first-class",
    description:
      "Model dev, staging, prod, and any custom environment. Scope each key to where it belongs so prod values never leak into a dev shell.",
  },
  {
    icon: PackageCheck,
    title: "Typed runtime client",
    description:
      "Generate a typed accessor for your keys so missing or misspelled config is a compile error, not a 2 a.m. incident.",
  },
  {
    icon: ScanLine,
    title: "Scan your codebase",
    description:
      "vaultlier scan detects the env vars your code actually uses — process.env, import.meta.env, NestJS config, and more — and reconciles your schema.",
  },
  {
    icon: History,
    title: "Versioned & audited",
    description:
      "Every write is a new immutable version. Mutations are recorded in an audit log so you can see who changed what, and when.",
  },
  {
    icon: Users,
    title: "Built for teams",
    description:
      "Role-based access with least privilege by default: viewers read, members write, and account tokens manage projects without reading secrets.",
  },
  {
    icon: GitBranch,
    title: "Bring your own storage",
    description:
      "Keep ciphertext in infrastructure you own. Vaultlier encrypts, then stores opaque bytes in your S3 or Postgres — with a built-in fallback.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Install & init",
    body: "Add the package and run vaultlier init to link a project and write a metadata-only config.",
  },
  {
    step: "2",
    title: "Define your schema",
    body: "Declare keys and environments, or let vaultlier scan detect them from your code and .env files.",
  },
  {
    step: "3",
    title: "Resolve at runtime",
    body: "The typed SDK fetches and decrypts values in memory at startup — nothing is written to disk.",
  },
];

export default function ProductPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 lg:px-8">
        <section className="py-12 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            Product
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-fg sm:text-5xl">
            A sealed vault for your application configuration.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Vaultlier is a Node.js library, CLI, and platform that replaces the{" "}
            <code className="font-mono text-fg">.env</code> workflow. Secrets are
            encrypted at rest, resolved in memory at runtime, and never written
            to disk — so you get the convenience of environment variables without
            scattering plaintext across machines and CI logs.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href="/dashboard" size="lg">
              <ChevronRight className="h-4 w-4" />
              Get Started
            </Button>
            <Button
              href={DOCS_URL}
              size="lg"
              variant="secondary"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen className="h-4 w-4" />
              Read Docs
            </Button>
          </div>
        </section>

        <section className="grid gap-x-6 gap-y-10 border-t border-border py-12 sm:grid-cols-2 lg:grid-cols-4 lg:py-16">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </section>

        <section className="border-t border-border py-12 lg:py-16">
          <h2 className="text-2xl font-bold tracking-tight text-fg">
            How it works
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {STEPS.map((item) => (
              <div key={item.step} className="flex flex-col gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
                  {item.step}
                </span>
                <h3 className="text-base font-semibold text-fg">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
