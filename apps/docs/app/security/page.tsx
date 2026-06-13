import {
  A,
  Callout,
  DocPage,
  H2,
  InlineCode,
  P,
  UL,
} from "../components/doc";

export const metadata = { title: "Security" };

const toc = [
  { id: "disk", title: "Secrets never touch disk" },
  { id: "encryption", title: "Encryption at rest" },
  { id: "credentials", title: "Credential handling" },
  { id: "boundaries", title: "Trust boundaries" },
  { id: "checklist", title: "Production checklist" },
];

export default function SecurityPage(): React.JSX.Element {
  return (
    <DocPage
      href="/security"
      title="Security"
      lede="How Vaultlier keeps secret values sealed — from your machine, through the wire, to disk at rest."
      toc={toc}
    >
      <Callout tone="security" title="The core guarantee">
        Secret values are resolved in memory and never written to disk, logs, or
        environment files by Vaultlier. The files the CLI generates contain
        metadata only.
      </Callout>

      <H2 id="disk">Secrets never touch disk</H2>
      <UL>
        <li>
          The runtime SDK fetches values over HTTPS and holds them in memory for
          the client&apos;s lifetime. Nothing is persisted.
        </li>
        <li>
          <InlineCode>vaultlier.json</InlineCode> /{" "}
          <InlineCode>vaultlier.config.json</InlineCode> and{" "}
          <InlineCode>lib/vaultlier.ts</InlineCode> contain metadata only — key
          names, types, and scopes — never values or keys.
        </li>
        <li>
          Error objects expose only a stable code, a safe message, and a request
          id. They never carry the API key, headers, or decrypted values.
        </li>
      </UL>

      <H2 id="encryption">Encryption at rest</H2>
      <P>
        Secret values are encrypted with a per-project key before storage. Each
        write produces a new immutable, encrypted version, so history is
        preserved and rotations are auditable. The database stores ciphertext,
        not plaintext.
      </P>

      <H2 id="credentials">Credential handling</H2>
      <UL>
        <li>
          <strong>API keys</strong> (<InlineCode>vlt_live_…</InlineCode>) are
          stored as a SHA-256 hash plus a display prefix. The raw key is shown
          once and never retrievable.
        </li>
        <li>
          <strong>Account tokens</strong> (<InlineCode>vlt_acct_…</InlineCode>)
          from <InlineCode>login</InlineCode> are stored per-user in{" "}
          <InlineCode>~/.vaultlier/auth.json</InlineCode> with owner-only
          permissions — outside any repository.
        </li>
        <li>
          The CLI masks keys in all output (e.g. <InlineCode>config get</InlineCode>,{" "}
          <InlineCode>whoami</InlineCode>, the <InlineCode>dev</InlineCode> UI).
        </li>
        <li>
          The <InlineCode>set</InlineCode> command validates key names and scopes
          locally before any value leaves your machine.
        </li>
      </UL>

      <H2 id="boundaries">Trust boundaries</H2>
      <UL>
        <li>
          <strong>Account tokens</strong> authorize listing and creating
          projects only — they cannot read or write secrets.
        </li>
        <li>
          <strong>API keys</strong> are scoped to one project and bounded by
          their role (viewer reads; member writes).
        </li>
        <li>
          <strong>The device-login flow</strong> requires a signed-in user to
          approve each CLI session in the browser; the code in the terminal must
          match the code shown on the page.
        </li>
        <li>
          The <InlineCode>dev</InlineCode> UI binds to loopback and only ever
          surfaces dev-environment values — staging and prod stay sealed.
        </li>
      </UL>

      <H2 id="checklist">Production checklist</H2>
      <UL>
        <li>
          Set <InlineCode>VAULTLIER_API_KEY</InlineCode> in your platform&apos;s
          secret store — never in source control.
        </li>
        <li>Use a viewer-role key for runtime reads; reserve member keys for CI writes.</li>
        <li>Add an IP allowlist and expiry to keys where practical.</li>
        <li>Revoke unused API keys and CLI device sessions from the portal.</li>
        <li>
          Keep <InlineCode>.vaultlier/</InlineCode> (the local credential cache)
          out of version control.
        </li>
      </UL>
      <P>
        Related: <A href="/api-keys">API Keys</A> for roles and rotation, and the{" "}
        <A href="/cli">CLI reference</A> for output controls.
      </P>
    </DocPage>
  );
}
