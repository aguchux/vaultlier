import {
  A,
  Callout,
  DocPage,
  H2,
  InlineCode,
  OL,
  P,
  Table,
  UL,
} from "../components/doc";
import { CodeBlock } from "../components/code-block";
import { createDocsMetadata } from "../lib/seo";

export const metadata = createDocsMetadata({
  title: "API Keys",
  description:
    "Create, scope, rotate, and revoke project-specific Vaultlier API keys without storing raw credentials.",
  path: "/api-keys",
});

const toc = [
  { id: "what", title: "What API keys are" },
  { id: "roles", title: "Roles" },
  { id: "creating", title: "Creating a key" },
  { id: "using", title: "Using a key" },
  { id: "account-tokens", title: "Account tokens vs API keys" },
  { id: "rotation", title: "Rotation & revocation" },
];

export default function ApiKeysPage(): React.JSX.Element {
  return (
    <DocPage
      href="/api-keys"
      title="API Keys"
      lede="Project-scoped credentials the CLI and runtime use to read and write a vault. Shown once at creation; only a hash is stored."
      toc={toc}
    >
      <H2 id="what">What API keys are</H2>
      <P>
        An API key (<InlineCode>vlt_…</InlineCode>) authorizes access to a single
        project. The portal stores only a SHA-256 hash plus a non-sensitive
        prefix for display — the raw key is shown exactly once at creation and
        is never retrievable later.
      </P>
      <Callout tone="warn" title="Copy it immediately">
        When you create a key, copy it right away and store it in your secret
        manager. If you lose it, revoke it and create a new one.
      </Callout>

      <H2 id="roles">Roles</H2>
      <P>An API key carries a role that bounds what it can do:</P>
      <Table
        head={["Role", "Can do"]}
        rows={[
          ["VIEWER", "Read configuration (pull, runtime reads, diff)."],
          [
            "MEMBER",
            "Everything VIEWER can, plus push schema and write secret values (set).",
          ],
        ]}
      />
      <P>
        For runtime reads in production, prefer a <strong>VIEWER</strong> key —
        the app never needs write access. Use a <strong>MEMBER</strong> key for
        CI steps that run <InlineCode>push</InlineCode> or{" "}
        <InlineCode>set</InlineCode>.
      </P>

      <H2 id="creating">Creating a key</H2>
      <P>
        Create keys from the project&apos;s settings in the portal dashboard.
        Optionally set an IP allowlist and an expiry for defense in depth.
      </P>

      <H2 id="using">Using a key</H2>
      <P>The CLI and SDK resolve the key in this order:</P>
      <OL>
        <li>An explicit <InlineCode>--api-key</InlineCode> flag or <InlineCode>apiKey</InlineCode> option.</li>
        <li><InlineCode>VAULTLIER_API_KEY</InlineCode> in the environment.</li>
        <li>The local credential cache from <InlineCode>vaultlier init</InlineCode> (dev only).</li>
      </OL>
      <CodeBlock label="Terminal">{`# Production: set it in your platform's secret store
export VAULTLIER_API_KEY=vlt_live_...

# One-off CLI use
vaultlier pull --env=prod --api-key=vlt_live_...

# Persist to the local cache (development)
vaultlier config set apiKey=vlt_live_...`}</CodeBlock>

      <H2 id="account-tokens">Account tokens vs API keys</H2>
      <P>These are two different credentials — don&apos;t confuse them:</P>
      <Table
        head={["Credential", "Scope", "Created by", "Reads secrets?"]}
        rows={[
          [
            <InlineCode key="a">vlt_acct_…</InlineCode>,
            "Account — list/create projects",
            "vaultlier login",
            "No",
          ],
          [
            <InlineCode key="k">vlt_live_…</InlineCode>,
            "A single project",
            "Portal dashboard",
            "Yes (per role)",
          ],
        ]}
      />
      <Callout tone="security">
        Account tokens from <InlineCode>login</InlineCode> can never read or write
        secrets. Secret access always requires a project API key.
      </Callout>

      <H2 id="rotation">Rotation &amp; revocation</H2>
      <UL>
        <li>Revoke a key from the portal; revocation takes effect immediately.</li>
        <li>
          To rotate, create a new key, deploy it via{" "}
          <InlineCode>VAULTLIER_API_KEY</InlineCode>, then revoke the old one.
        </li>
        <li>
          Verify a key without exposing it using{" "}
          <InlineCode>vaultlier config verify</InlineCode>.
        </li>
      </UL>
      <P>
        See <A href="/security">Security</A> for the full credential-handling
        guarantees.
      </P>
    </DocPage>
  );
}
