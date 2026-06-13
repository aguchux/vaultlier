import {
  A,
  Callout,
  DocPage,
  H2,
  InlineCode,
  P,
  UL,
} from "../components/doc";
import { CodeBlock } from "../components/code-block";

export const metadata = { title: "Environments" };

const toc = [
  { id: "model", title: "The model" },
  { id: "scopes", title: "Key scopes" },
  { id: "creating", title: "Creating environments" },
  { id: "versions", title: "Values & versions" },
];

export default function EnvironmentsPage(): React.JSX.Element {
  return (
    <DocPage
      href="/environments"
      title="Environments"
      lede="Environments separate values for the same key — your dev DATABASE_URL differs from prod, but the key is declared once."
      toc={toc}
    >
      <H2 id="model">The model</H2>
      <P>
        A project declares each key <strong>once</strong> in its schema. Values
        are then stored <strong>per environment</strong>. Resolving config
        always targets a single environment:
      </P>
      <CodeBlock label="TypeScript">{`const dev = await vault({ environment: "dev" });
const prod = await vault({ environment: "prod" });
// Same typed shape, different values.`}</CodeBlock>

      <H2 id="scopes">Key scopes</H2>
      <P>
        A key can apply to all environments (the default) or be restricted to
        specific ones via its <InlineCode>scopes</InlineCode>. A key scoped to{" "}
        <InlineCode>[&quot;prod&quot;]</InlineCode> can only receive values in
        prod — the CLI checks this locally before any value leaves your machine,
        and the portal enforces it authoritatively.
      </P>
      <CodeBlock label="vaultlier.json">{`{
  "keys": {
    "DATABASE_URL":     { "type": "string", "scopes": ["all"] },
    "STRIPE_SECRET":    { "type": "string", "scopes": ["prod"] },
    "FEATURE_NEW_FLOW": { "type": "boolean" }
  }
}`}</CodeBlock>

      <H2 id="creating">Creating environments</H2>
      <P>
        Beyond the default dev/staging/prod, you can add environments at any
        time. <InlineCode>set</InlineCode> will offer to create a missing
        environment for you, declaring it through an additive schema push:
      </P>
      <CodeBlock label="Terminal">{`vaultlier set DATABASE_URL=postgres://wip-db --env=working --yes
# created environment "working", then wrote the value`}</CodeBlock>
      <Callout tone="info">
        Environment creation is additive — pushing a new environment never
        deletes existing ones or their values.
      </Callout>

      <H2 id="versions">Values &amp; versions</H2>
      <P>
        Writing a value with <InlineCode>set</InlineCode> stores a new immutable
        version sealed server-side. History is preserved, so rotations are
        auditable and reversible. The CLI reports the new version number and
        never echoes the value back.
      </P>
      <UL>
        <li>Each write produces a new version; older versions are retained.</li>
        <li>The runtime always resolves the latest version for the environment.</li>
        <li>Values are encrypted at rest with a per-project key.</li>
      </UL>
      <P>
        See <A href="/cli">the CLI reference</A> for <InlineCode>set</InlineCode>{" "}
        details and <A href="/security">Security</A> for the encryption model.
      </P>
    </DocPage>
  );
}
