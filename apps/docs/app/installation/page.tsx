import {
  A,
  Callout,
  DocPage,
  H2,
  InlineCode,
  P,
  Table,
  UL,
} from "../components/doc";
import { CodeBlock } from "../components/code-block";

export const metadata = { title: "Installation" };

const toc = [
  { id: "requirements", title: "Requirements" },
  { id: "install", title: "Install the package" },
  { id: "entry-points", title: "Entry points" },
  { id: "self-hosting", title: "Self-hosted portals" },
];

export default function InstallationPage(): React.JSX.Element {
  return (
    <DocPage
      href="/installation"
      title="Installation"
      lede="Add Vaultlier to your project. One package ships both the CLI and the runtime SDK."
      toc={toc}
    >
      <H2 id="requirements">Requirements</H2>
      <UL>
        <li>
          <strong>Node.js 18 or newer</strong> for the CLI (it uses native
          <InlineCode>fetch</InlineCode> and Web Crypto).
        </li>
        <li>
          The runtime SDK is edge-safe and additionally runs on Bun, Deno,
          Cloudflare Workers, Vercel Edge, and AWS Lambda.
        </li>
      </UL>

      <H2 id="install">Install the package</H2>
      <P>
        Vaultlier is distributed as a single npm package. Install it as a
        dependency so the runtime SDK is available at deploy time, and use the
        bundled CLI via <InlineCode>npx</InlineCode> or your package scripts.
      </P>
      <CodeBlock label="Terminal">{`npm install vaultlier
# pnpm add vaultlier
# yarn add vaultlier
# bun add vaultlier`}</CodeBlock>
      <P>
        Running <InlineCode>vaultlier init</InlineCode> will offer to install the
        dependency for you if it isn&apos;t present yet, detecting your package
        manager from the lockfile.
      </P>

      <H2 id="entry-points">Entry points</H2>
      <P>The package exposes two import surfaces:</P>
      <Table
        head={["Import", "Surface", "Environment"]}
        rows={[
          [
            <InlineCode key="r">vaultlier</InlineCode>,
            "Runtime SDK (createClient)",
            "Edge-safe — Node 18+, Bun, Deno, Workers, Edge, Lambda",
          ],
          [
            <InlineCode key="c">vaultlier/cli</InlineCode>,
            "CLI programmatic API",
            "Node-only",
          ],
        ]}
      />
      <P>
        The runtime entry uses only <InlineCode>fetch</InlineCode> and Web
        Crypto — no Node-only imports and no third-party dependencies.
      </P>

      <H2 id="self-hosting">Self-hosted portals</H2>
      <P>
        By default the CLI and SDK talk to the hosted portal at{" "}
        <InlineCode>https://api.vaultlier.com</InlineCode>. Point them at a
        self-hosted deployment with the <InlineCode>--api-url</InlineCode> flag
        or the <InlineCode>VAULTLIER_API_URL</InlineCode> environment variable.
      </P>
      <CodeBlock label="Terminal">{`export VAULTLIER_API_URL=https://vault.internal.example.com
vaultlier pull --env=prod`}</CodeBlock>
      <Callout tone="info">
        See the <A href="/cli">CLI reference</A> for the full flag list and the{" "}
        <A href="/sdk">SDK reference</A> for the <InlineCode>baseUrl</InlineCode>{" "}
        client option.
      </Callout>
    </DocPage>
  );
}
