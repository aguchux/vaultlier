import type { Metadata } from "next";
import {
  ArrowRight,
  Boxes,
  FileLock2,
  KeyRound,
  Layers,
  PackageX,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@vaultlier/ui/button";
import { FeatureCard } from "@vaultlier/ui/feature-card";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { DOCS_URL } from "../../lib/links";

export const metadata: Metadata = {
  title: "Security — Vaultlier",
  description:
    "How Vaultlier protects your secrets: AES-256-GCM envelope encryption, in-memory resolution, zero runtime dependencies, role-based access, and a full audit trail.",
};

const FEATURES = [
  {
    icon: FileLock2,
    title: "Secrets never touch disk",
    description:
      "Values are resolved in memory and never written to disk, logs, or env files by Vaultlier. Generated files contain metadata only.",
  },
  {
    icon: Layers,
    title: "Envelope encryption",
    description:
      "AES-256-GCM with a per-project key derived via HKDF from a server-side master key. The database only ever sees ciphertext, nonce, and auth tag.",
  },
  {
    icon: KeyRound,
    title: "Server-side master key",
    description:
      "VAULT_MASTER_KEY lives only in the server environment — never in the browser. It's validated at startup so a misconfigured deploy fails fast.",
  },
  {
    icon: PackageX,
    title: "Zero runtime dependencies",
    description:
      "The vaultlier package ships with no third-party dependencies — nothing to install beneath it, so the supply-chain attack surface is effectively nil.",
  },
  {
    icon: ShieldCheck,
    title: "Least-privilege access",
    description:
      "Role-based: viewers read, members write. Account tokens manage projects but can never read secrets. API keys are scoped to one project.",
  },
  {
    icon: ScrollText,
    title: "Audited mutations",
    description:
      "Every change is recorded and versioned. The activity log surfaces who wrote or deleted what, while routine reads stay out of the way.",
  },
  {
    icon: KeyRound,
    title: "Hashed credentials",
    description:
      "API keys are stored as a SHA-256 hash plus a display prefix. The raw key is shown once and is never retrievable afterward.",
  },
  {
    icon: Boxes,
    title: "Clear trust boundaries",
    description:
      "The dev inspector binds to loopback and only ever surfaces dev values. Device login requires browser approval for each CLI session.",
  },
];

export default function SecurityPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 lg:px-8">
        <section className="py-12 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            Security
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-fg sm:text-5xl">
            Built so a leak yields nothing but ciphertext.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Security isn&apos;t a feature bolted on after the fact — it&apos;s the
            architecture. Secret values are sealed before they reach the
            database, resolved only in memory at runtime, and guarded by
            least-privilege access and a full audit trail.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              href={`${DOCS_URL}/security`}
              size="lg"
              target="_blank"
              rel="noreferrer"
            >
              <ArrowRight className="h-4 w-4" />
              Read the full security model
            </Button>
          </div>
        </section>

        <section className="grid gap-x-6 gap-y-10 border-t border-border py-12 sm:grid-cols-2 lg:grid-cols-4 lg:py-16">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </section>

        <section className="border-t border-border py-12 lg:py-16">
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              The core guarantee
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Vaultlier encrypts every value with a per-project key before it is
              stored, and decrypts only in the running process that needs it.
              The master key stays server-side and is never exposed to the
              browser. A database or storage-bucket compromise reveals opaque
              bytes — not your secrets. Full details, including the trust
              boundaries and a production checklist, live in the docs.
            </p>
            <div className="mt-6">
              <Button
                href={`${DOCS_URL}/security`}
                size="md"
                variant="secondary"
                target="_blank"
                rel="noreferrer"
              >
                Security documentation
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
