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
