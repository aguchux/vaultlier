import { A, DocPage, H2, InlineCode, P } from "../components/doc";
import { CodeBlock } from "../components/code-block";
import { createDocsMetadata } from "../lib/seo";

export const metadata = createDocsMetadata({
  title: "Frequently Asked Questions",
  description:
    "Answers about Vaultlier, .env replacement, offline behavior, API keys, project IDs, rotation, and self-hosting.",
  path: "/faq",
});

const toc = [
  { id: "vs-dotenv", title: "How is this different from .env?" },
  { id: "projectid-secret", title: "Is the project id a secret?" },
  { id: "where-stored", title: "Where are my secrets stored?" },
  { id: "offline", title: "Does it work offline?" },
  { id: "no-key", title: "Can I init without an API key?" },
  { id: "self-host", title: "Can I self-host?" },
  { id: "rotate", title: "How do I rotate a key?" },
];

export default function FaqPage(): React.JSX.Element {
  return (
    <DocPage
      href="/faq"
      title="FAQ"
      lede="Short answers to the questions that come up most often."
      toc={toc}
    >
      <H2 id="vs-dotenv">How is this different from .env?</H2>
      <P>
        With <InlineCode>.env</InlineCode> the secret values live in a file on
        disk and in version-control-adjacent places. With Vaultlier, your repo
        holds only metadata — which keys exist and their types — while the
        values stay encrypted in the portal and are resolved in memory at
        runtime. You also get typing, per-environment values, versioned history,
        and role-scoped access.
      </P>

      <H2 id="projectid-secret">Is the project id a secret?</H2>
      <P>
        No. The project id (<InlineCode>prj_…</InlineCode>) is a public
        identifier and is safe to commit. Reading or writing a project always
        additionally requires a valid API key, so the id alone grants nothing.
      </P>

      <H2 id="where-stored">Where are my secrets stored?</H2>
      <P>
        By default, encrypted in Vaultlier&apos;s managed store. Per project you
        can switch to a bring-your-own backend — your own S3 bucket or Postgres
        database — and the values live in infrastructure you own. Either way
        Vaultlier encrypts every value before it is stored, so the backend only
        ever holds ciphertext. See <A href="/storage">Storage backends</A>.
      </P>

      <H2 id="offline">Does it work offline?</H2>
      <P>
        Schema operations degrade gracefully: <InlineCode>pull</InlineCode>{" "}
        without an API key regenerates the typed client from local metadata.
        Resolving secret values at runtime requires network access to the
        portal.
      </P>

      <H2 id="no-key">Can I init without an API key?</H2>
      <P>
        Yes. Press Enter at the API-key prompt during{" "}
        <InlineCode>init</InlineCode>. You can add a key later:
      </P>
      <CodeBlock label="Terminal">{`vaultlier config set apiKey=vlt_live_...
# or set it in the environment
export VAULTLIER_API_KEY=vlt_live_...`}</CodeBlock>

      <H2 id="self-host">Can I self-host the portal?</H2>
      <P>
        Yes. Point the CLI and SDK at your deployment with{" "}
        <InlineCode>--api-url</InlineCode> /{" "}
        <InlineCode>VAULTLIER_API_URL</InlineCode> (CLI) or the{" "}
        <InlineCode>baseUrl</InlineCode> client option (SDK). See{" "}
        <A href="/installation">Installation</A>.
      </P>
      <P>
        A self-hosted portal <strong>must</strong> set{" "}
        <InlineCode>VAULT_MASTER_KEY</InlineCode> in its server environment — the
        32-byte base64 key it uses to seal and unseal secret values. Generate one
        with{" "}
        <A href="/cli#generate-key">
          <InlineCode>vaultlier generate-key</InlineCode>
        </A>
        , set it once, and keep it safe.
      </P>
      <P>
        This is enforced at startup: a portal launched without a valid{" "}
        <InlineCode>VAULT_MASTER_KEY</InlineCode> fails to boot with a clear
        error rather than serving broken secret operations. If the server is
        already running and the key is missing, the variables page shows a
        &quot;Vault not configured&quot; notice and stays read-only until the key
        is set. The key is read only server-side — it is never created, shown, or
        sent to the browser. Treat it like a root credential:{" "}
        <strong>changing or losing it makes existing sealed secrets
        unrecoverable</strong>. See <A href="/security#encryption">Security</A>.
      </P>

      <H2 id="rotate">How do I rotate an API key?</H2>
      <P>
        Create a new key in the portal, deploy it via{" "}
        <InlineCode>VAULTLIER_API_KEY</InlineCode>, confirm it works with{" "}
        <InlineCode>vaultlier config verify</InlineCode>, then revoke the old
        key. Revocation is immediate. More in <A href="/api-keys">API Keys</A>.
      </P>
    </DocPage>
  );
}
