import {
  A,
  Callout,
  DocPage,
  H2,
  InlineCode,
  OL,
  P,
} from "../components/doc";
import { CodeBlock } from "../components/code-block";
import { createDocsMetadata } from "../lib/seo";

export const metadata = createDocsMetadata({
  title: "Quickstart",
  description:
    "Go from an empty project to typed, sealed configuration with the Vaultlier CLI and runtime SDK.",
  path: "/quickstart",
});

const toc = [
  { id: "sign-in", title: "1. Sign in" },
  { id: "initialize", title: "2. Initialize" },
  { id: "declare-keys", title: "3. Declare keys" },
  { id: "set-values", title: "4. Set values" },
  { id: "read-at-runtime", title: "5. Read at runtime" },
];

export default function QuickstartPage(): React.JSX.Element {
  return (
    <DocPage
      href="/quickstart"
      title="Quickstart"
      lede="Go from an empty directory to typed, sealed configuration in five steps."
      toc={toc}
    >
      <H2 id="sign-in">1. Sign in</H2>
      <P>
        Authenticate this machine with the portal. The CLI prints a link and a
        short code; approve it in your browser.
      </P>
      <CodeBlock label="Terminal">{`vaultlier login

# To authenticate, open this link in a browser:
#   https://vaultlier.com/cli/approve?code=WDJB-MJHT
# and confirm the code WDJB-MJHT`}</CodeBlock>
      <Callout tone="info">
        Login is optional if you already have a project id and API key — pass
        them to <InlineCode>init</InlineCode> directly. See{" "}
        <A href="/api-keys">API Keys</A>.
      </Callout>

      <H2 id="initialize">2. Initialize</H2>
      <P>
        In your project directory, run <InlineCode>init</InlineCode>. Pick an
        existing project with the arrow keys or create a new one. It writes{" "}
        <InlineCode>vaultlier.json</InlineCode> (schema metadata) and{" "}
        <InlineCode>lib/vaultlier.ts</InlineCode> (the generated typed client).
      </P>
      <CodeBlock label="Terminal">{`vaultlier init`}</CodeBlock>

      <H2 id="declare-keys">3. Declare keys</H2>
      <P>
        Add the keys your app needs to <InlineCode>vaultlier.json</InlineCode>,
        or let <InlineCode>scan</InlineCode> detect them from your existing{" "}
        <InlineCode>.env</InlineCode> files, then push the schema to the portal.
        Only metadata — names, types, scopes — is sent; never values.
      </P>
      <CodeBlock label="Terminal">{`vaultlier scan          # detect keys from .env files (optional)
vaultlier push          # sync schema metadata to the portal`}</CodeBlock>

      <H2 id="set-values">4. Set values</H2>
      <P>
        Write secret values for an environment. They are sealed server-side as
        new immutable versions; the CLI prints version numbers and never echoes
        the values back.
      </P>
      <CodeBlock label="Terminal">{`vaultlier set DATABASE_URL=postgres://prod-db/main --env=prod
vaultlier set STRIPE_SECRET=sk_live_... FEATURE_NEW_FLOW=true -e prod`}</CodeBlock>

      <H2 id="read-at-runtime">5. Read at runtime</H2>
      <P>
        Set <InlineCode>VAULTLIER_API_KEY</InlineCode> in your hosting
        environment, then resolve typed configuration on boot.
      </P>
      <CodeBlock label="TypeScript">{`import { vault } from "./lib/vaultlier";

const config = await vault({ environment: "prod" });

await db.connect(config.DATABASE_URL); // typed string`}</CodeBlock>
      <P>That&apos;s the full loop. Next, dig into the details:</P>
      <OL>
        <li>
          <A href="/cli">CLI reference</A> — every command and flag.
        </li>
        <li>
          <A href="/sdk">SDK reference</A> — client options and error handling.
        </li>
        <li>
          <A href="/environments">Environments</A> — scoping and promotion.
        </li>
      </OL>
    </DocPage>
  );
}
