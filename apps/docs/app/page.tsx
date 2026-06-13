import {
  Callout,
  DocPage,
  H2,
  InlineCode,
  OL,
  P,
  UL,
} from "./components/doc";
import { CodeBlock } from "./components/code-block";
import { createDocsMetadata } from "./lib/seo";

export const metadata = createDocsMetadata({
  title: "Getting Started",
  description:
    "Learn how to install Vaultlier, initialize a project, and resolve typed configuration without writing secret values to disk.",
  path: "/",
});

const toc = [
  { id: "overview", title: "Overview" },
  { id: "install", title: "Install" },
  { id: "initialize", title: "Initialize" },
  { id: "use-in-code", title: "Use in code" },
  { id: "next-steps", title: "Next steps" },
];

export default function GettingStartedPage(): React.JSX.Element {
  return (
    <DocPage
      href="/"
      title="Getting Started"
      lede="Vaultlier helps you securely manage secrets, API keys, and sensitive configuration across your projects and environments."
      toc={toc}
    >
      <H2 id="overview">Overview</H2>
      <P>
        Vaultlier is a sealed, centrally hosted configuration vault. It replaces
        the <InlineCode>.env</InlineCode> workflow without ever writing secret
        values to disk: your code declares <em>which</em> keys it needs, the
        portal stores the encrypted values, and the runtime SDK resolves them in
        memory at startup.
      </P>
      <P>You work with Vaultlier through three surfaces:</P>
      <UL>
        <li>
          <strong>The CLI</strong> — set up a project, sync schema metadata,
          write secret values, and inspect configuration locally.
        </li>
        <li>
          <strong>The SDK</strong> — a tiny, edge-safe runtime client that fetches
          typed configuration for one environment.
        </li>
        <li>
          <strong>The portal</strong> — the web dashboard where projects,
          environments, API keys, and members live.
        </li>
      </UL>

      <Callout tone="security" title="Secrets never touch disk">
        Vaultlier keeps your secrets in memory and never writes them to disk,
        logs, or environment files. The artifacts the CLI generates
        (<InlineCode>vaultlier.json</InlineCode> and{" "}
        <InlineCode>lib/vaultlier.ts</InlineCode>) contain metadata only — key
        names, types, and scopes.
      </Callout>

      <H2 id="install">Install</H2>
      <P>Install the Vaultlier package to get the CLI and the runtime SDK.</P>
      <CodeBlock label="Terminal">{`# Using npm
npm install vaultlier

# Or run the CLI ad-hoc with npx
npx vaultlier --help`}</CodeBlock>

      <H2 id="initialize">Initialize</H2>
      <P>
        Run <InlineCode>init</InlineCode> in your project directory. It installs
        the dependency if needed, walks you through logging in and selecting (or
        creating) a project, and writes the schema and the generated typed
        client.
      </P>
      <CodeBlock label="Terminal">{`vaultlier init   # creates vaultlier.json + lib/vaultlier.ts`}</CodeBlock>
      <P>
        Pressing Enter at the API-key prompt is fine — a brand-new account has
        no key yet, and you can add one later with{" "}
        <InlineCode>vaultlier config set apiKey=…</InlineCode> or the{" "}
        <InlineCode>VAULTLIER_API_KEY</InlineCode> environment variable.
      </P>

      <H2 id="use-in-code">Use in code</H2>
      <P>
        Import the generated client and resolve configuration for an
        environment. Every key is fully typed from your schema.
      </P>
      <CodeBlock label="TypeScript">{`import { vault } from "./lib/vaultlier";

const config = await vault({ environment: "prod" });

config.DATABASE_URL;     // string
config.STRIPE_SECRET;    // string
config.FEATURE_NEW_FLOW; // boolean`}</CodeBlock>

      <H2 id="next-steps">Next steps</H2>
      <OL>
        <li>
          Follow the <strong>Quickstart</strong> for an end-to-end walkthrough.
        </li>
        <li>
          Skim the <strong>CLI</strong> reference for every command and flag.
        </li>
        <li>
          Read <strong>Security</strong> to understand the trust boundaries.
        </li>
      </OL>
    </DocPage>
  );
}
