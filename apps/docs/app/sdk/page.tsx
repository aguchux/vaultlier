import {
  A,
  Callout,
  DocPage,
  H2,
  H3,
  InlineCode,
  OL,
  P,
  Table,
  UL,
} from "../components/doc";
import { CodeBlock } from "../components/code-block";
import { createDocsMetadata } from "../lib/seo";

export const metadata = createDocsMetadata({
  title: "Runtime SDK",
  description:
    "Use Vaultlier's edge-compatible TypeScript runtime SDK to resolve typed, environment-specific configuration securely.",
  path: "/sdk",
});

const toc = [
  { id: "generated-client", title: "Generated client" },
  { id: "create-client", title: "createClient" },
  { id: "options", title: "Client options" },
  { id: "key-resolution", title: "API key resolution" },
  { id: "caching", title: "Caching" },
  { id: "errors", title: "Error handling" },
  { id: "storage", title: "Storage backends" },
];

export default function SdkPage(): React.JSX.Element {
  return (
    <DocPage
      href="/sdk"
      title="SDK"
      lede="A tiny, edge-safe runtime client that resolves typed configuration for one environment. No Node-only imports, no third-party dependencies."
      toc={toc}
    >
      <H2 id="generated-client">Generated client</H2>
      <P>
        <InlineCode>vaultlier init</InlineCode> writes a typed client to{" "}
        <InlineCode>lib/vaultlier.ts</InlineCode> with your project id and a
        type parameter derived from your schema. Import and call it:
      </P>
      <CodeBlock label="TypeScript">{`import { vault } from "./lib/vaultlier";

const config = await vault({ environment: "prod" });
config.DATABASE_URL; // typed`}</CodeBlock>

      <H2 id="create-client">createClient</H2>
      <P>You can also construct a client directly with your own type:</P>
      <CodeBlock label="TypeScript">{`import { createClient } from "vaultlier";

export const vault = createClient<{
  DATABASE_URL: string;
  STRIPE_SECRET: string;
  FEATURE_NEW_FLOW: boolean;
}>({ projectId: "prj_checkout_api" });

const config = await vault({ environment: "prod" });`}</CodeBlock>

      <H2 id="options">Client options</H2>
      <H3>createClient(config)</H3>
      <Table
        head={["Option", "Type", "Description"]}
        rows={[
          [
            <InlineCode key="p">projectId</InlineCode>,
            "string",
            "The public project id (prj_…). Required.",
          ],
          [
            <InlineCode key="b">baseUrl</InlineCode>,
            "string",
            "Override the portal API base URL (defaults to the hosted API). Primarily for self-hosting and tests.",
          ],
        ]}
      />
      <H3>vault(options)</H3>
      <Table
        head={["Option", "Type", "Description"]}
        rows={[
          [
            <InlineCode key="e">environment</InlineCode>,
            "string",
            'Which environment to resolve, e.g. "dev" | "staging" | "prod". Required.',
          ],
          [
            <InlineCode key="a">apiKey</InlineCode>,
            "string",
            "Explicit API key. Takes precedence over the environment variable.",
          ],
          [
            <InlineCode key="c">cache</InlineCode>,
            '"memory" | "none"',
            'Defaults to "memory" - caches per process, environment, and API key.',
          ],
          [
            <InlineCode key="ct">cacheTtlMs</InlineCode>,
            "number",
            "Memory-cache lifetime. Defaults to 60000 (one minute).",
          ],
          [
            <InlineCode key="t">timeoutMs</InlineCode>,
            "number",
            "Request timeout. Defaults to 10000.",
          ],
        ]}
      />

      <H2 id="key-resolution">API key resolution</H2>
      <P>The runtime resolves the API key in this order:</P>
      <OL>
        <li>
          The explicit <InlineCode>apiKey</InlineCode> passed to the call.
        </li>
        <li>
          <InlineCode>VAULTLIER_API_KEY</InlineCode> in the hosting/CI
          environment.
        </li>
        <li>
          The local credential cache created by{" "}
          <InlineCode>vaultlier init</InlineCode> (development only).
        </li>
      </OL>
      <Callout tone="warn" title="Never commit your API key">
        Set <InlineCode>VAULTLIER_API_KEY</InlineCode> in your platform&apos;s
        secret store. It should never appear in source control or in the
        generated client — which contains metadata only.
      </Callout>

      <H2 id="caching">Caching</H2>
      <P>
        With the default <InlineCode>cache: &quot;memory&quot;</InlineCode>, the
        first call for an environment and API key fetches the config and keeps
        it in process memory for one minute. Concurrent first calls share one
        request. The cache never writes values to disk, browser storage, a CDN,
        or a shared data store.
      </P>
      <CodeBlock label="TypeScript">{`// Export one module-level client and reuse it throughout the process.
const config = await vault({ environment: "prod" });

// Use a shorter revocation/freshness window for sensitive workloads.
const strict = await vault({ environment: "prod", cacheTtlMs: 15_000 });

// Bypass the memory cache completely.
const fresh = await vault({ environment: "prod", cache: "none" });`}</CodeBlock>
      <Callout tone="security">
        Do not place decrypted configuration in Redis, a database, Next.js
        shared fetch caching, CDN caches, browser storage, or serialized build
        output. A longer TTL reduces calls but also extends the maximum window
        before key revocation or secret rotation is observed.
      </Callout>

      <H2 id="errors">Error handling</H2>
      <P>
        Failures throw a <InlineCode>VaultlierRuntimeError</InlineCode> carrying
        a stable <InlineCode>code</InlineCode>, a safe{" "}
        <InlineCode>message</InlineCode>, and an optional{" "}
        <InlineCode>requestId</InlineCode>. It never includes the API key,
        headers, or decrypted values, and its <InlineCode>toJSON</InlineCode>{" "}
        only serializes those safe fields.
      </P>
      <CodeBlock label="TypeScript">{`import { VaultlierRuntimeError } from "vaultlier";

try {
  const config = await vault({ environment: "prod" });
} catch (err) {
  if (err instanceof VaultlierRuntimeError) {
    console.error(err.code, err.requestId); // e.g. "http/401"
  }
  throw err;
}`}</CodeBlock>
      <P>Common codes:</P>
      <UL>
        <li>
          <InlineCode>auth/missing_api_key</InlineCode> — no key found in any
          resolution source.
        </li>
        <li>
          <InlineCode>auth/invalid_api_key</InlineCode> — the key is malformed
          (rejected locally before any request).
        </li>
        <li>
          <InlineCode>http/&lt;status&gt;</InlineCode> — the portal rejected the
          request.
        </li>
        <li>
          <InlineCode>network/timeout</InlineCode> /{" "}
          <InlineCode>network/error</InlineCode> — transport failures.
        </li>
      </UL>
      <Callout tone="info">
        Create the client once at module scope and call that same client
        throughout the process. Avoid constructing a new client per request,
        because each client owns a separate memory cache. See the{" "}
        <A href="/quickstart">Quickstart</A>.
      </Callout>

      <H2 id="storage">Storage backends</H2>
      <P>
        The SDK call is identical no matter where a project&apos;s secrets are
        stored. If a project uses a bring-your-own backend (S3 or Postgres),
        Vaultlier reads from it and falls back to its own encrypted copy if that
        store is briefly unreachable, so <InlineCode>vault()</InlineCode> stays
        resilient through a backend outage. See{" "}
        <A href="/storage">Storage backends</A>.
      </P>
    </DocPage>
  );
}
