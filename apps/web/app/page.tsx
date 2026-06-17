import {
  BookOpen,
  ChevronRight,
  Cloud,
  Lock,
  ShieldCheck,
  TerminalSquare,
  Users,
} from "lucide-react";
import { Button } from "@vaultlier/ui/button";
import { FeatureCard } from "@vaultlier/ui/feature-card";
import { CodeWindow } from "./components/code-window";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { DOCS_URL } from "../lib/links";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Secure by design",
    description: "End-to-end encryption with per-project keys and audit logs.",
  },
  {
    icon: Cloud,
    title: "Environment-first",
    description: "Manage dev, staging, prod and custom environments.",
  },
  {
    icon: TerminalSquare,
    title: "Simple CLI",
    description: "Init, pull, push — everything you need in four commands.",
  },
  {
    icon: Users,
    title: "Built for teams",
    description: "Granular access, scopes, and least-privilege by default.",
  },
];

export default function Home(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 lg:px-8">
        <Hero />
        <FeatureRow />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero(): React.JSX.Element {
  return (
    <section className="grid items-center gap-12 py-12 lg:grid-cols-2 lg:gap-16 lg:py-20">
      <div>
        <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-fg sm:text-6xl">
          Configuration secrets, secured.{" "}
          <span className="text-brand-600 dark:text-brand-400">
            Develop with confidence.
          </span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
          Vaultlier is a Node.js library and platform for managing application
          configuration in a sealed vault — without exposing environment
          variables locally.
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

        <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted">
          <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          End-to-end encrypted. Audit logged. Built for teams.
        </p>
      </div>

      <div className="relative">
        <CodeWindow />
        <SecretsBadge />
      </div>
    </section>
  );
}

function SecretsBadge(): React.JSX.Element {
  return (
    <div className="mt-4 flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
        <Lock className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-fg">
          Secrets never touch disk.
        </p>
        <p className="text-sm text-muted">Only in-memory. Always encrypted.</p>
      </div>
    </div>
  );
}

function FeatureRow(): React.JSX.Element {
  return (
    <section className="grid gap-8 border-t border-border py-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:py-16">
      {FEATURES.map((feature) => (
        <FeatureCard key={feature.title} {...feature} />
      ))}
    </section>
  );
}
