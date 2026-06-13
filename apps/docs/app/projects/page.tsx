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
import { createDocsMetadata } from "../lib/seo";

export const metadata = createDocsMetadata({
  title: "Projects",
  description:
    "Understand Vaultlier projects, project IDs, organizations, roles, local bindings, environments, and API keys.",
  path: "/projects",
});

const toc = [
  { id: "what", title: "What a project is" },
  { id: "create", title: "Creating a project" },
  { id: "binding", title: "Local binding" },
  { id: "organizations", title: "Organizations & roles" },
];

export default function ProjectsPage(): React.JSX.Element {
  return (
    <DocPage
      href="/projects"
      title="Projects"
      lede="A project is the unit that owns a schema, its environments, secret values, and API keys."
      toc={toc}
    >
      <H2 id="what">What a project is</H2>
      <P>
        Every project has a public id (<InlineCode>prj_…</InlineCode>) that the
        CLI and SDK use to address it. The id is not a secret — it&apos;s safe to
        commit in <InlineCode>vaultlier.json</InlineCode> and the generated
        client. A project holds:
      </P>
      <UL>
        <li>
          A <strong>schema</strong> — the declared keys with their types and
          environment scopes.
        </li>
        <li>
          One or more <A href="/environments">environments</A> (e.g. dev,
          staging, prod).
        </li>
        <li>
          Encrypted, versioned secret <strong>values</strong> per key per
          environment.
        </li>
        <li>
          Project-scoped <A href="/api-keys">API keys</A> used by the CLI and
          runtime.
        </li>
      </UL>

      <H2 id="create">Creating a project</H2>
      <P>
        The quickest path is <InlineCode>vaultlier init</InlineCode>: after you
        log in, choose &quot;Create a new project&quot; from the list and give it
        a name. You can also create projects in the portal dashboard.
      </P>
      <CodeBlock label="Terminal">{`vaultlier init          # interactive: pick or create a project`}</CodeBlock>
      <P>
        New projects start with three environments — <InlineCode>dev</InlineCode>,{" "}
        <InlineCode>staging</InlineCode>, and <InlineCode>prod</InlineCode> — which
        you can extend at any time.
      </P>

      <H2 id="binding">Local binding</H2>
      <P>
        A directory is bound to a project through{" "}
        <InlineCode>vaultlier.json</InlineCode>. Repoint it with{" "}
        <InlineCode>config set</InlineCode>, which also regenerates the typed
        client:
      </P>
      <CodeBlock label="Terminal">{`vaultlier config set project=prj_29ec67d64dd1
vaultlier config get      # confirm the current binding`}</CodeBlock>

      <H2 id="organizations">Organizations &amp; roles</H2>
      <P>
        Projects live inside organizations. Your role in the organization
        determines what you can do: owners and admins manage projects and API
        keys, members can write secrets, and viewers are read-only.
      </P>
      <Callout tone="info">
        Roles are organization-scoped, while API keys are project-scoped. See{" "}
        <A href="/api-keys">API Keys</A> for how key roles map to permissions.
      </Callout>
    </DocPage>
  );
}
