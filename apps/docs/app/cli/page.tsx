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
import { createDocsMetadata } from "../lib/seo";

export const metadata = createDocsMetadata({
  title: "CLI Reference",
  description:
    "Reference for Vaultlier CLI commands, flags, exit codes, authentication, schema sync, and secret management.",
  path: "/cli",
});

const toc = [
  { id: "init", title: "init" },
  { id: "login", title: "login / logout" },
  { id: "config", title: "config" },
  { id: "scan", title: "scan" },
  { id: "push-pull-diff", title: "push / pull / diff" },
  { id: "set", title: "set" },
  { id: "dev", title: "dev" },
  { id: "whoami", title: "whoami" },
  { id: "generate-key", title: "generate-key" },
  { id: "flags", title: "Flag conventions" },
  { id: "output", title: "Output & scripting" },
];

export default function CliPage(): React.JSX.Element {
  return (
    <DocPage
      href="/cli"
      title="CLI"
      lede="Manage projects, schema, and secret values from the command line. Every command exits with a meaningful status code for scripting."
      toc={toc}
    >
      <P>
        Run <InlineCode>vaultlier --help</InlineCode> for a summary, or{" "}
        <InlineCode>vaultlier &lt;command&gt; --help</InlineCode> for details on
        any command.
      </P>

      <H2 id="init">init</H2>
      <P>
        Sets up the current directory. Installs the dependency if needed, offers
        a browser login when you have no account credentials, lets you pick or
        create a project, and writes <InlineCode>vaultlier.json</InlineCode> and{" "}
        <InlineCode>lib/vaultlier.ts</InlineCode>.
      </P>
      <CodeBlock label="Terminal">{`vaultlier init

# Non-interactive (CI):
vaultlier init --project-id=prj_29ec67d64dd1 --api-key=vlt_live_...`}</CodeBlock>
      <P>
        The API key is optional at init time — press Enter to skip it. Re-run
        with <InlineCode>--force</InlineCode> to overwrite existing metadata.
      </P>

      <H2 id="login">login / logout</H2>
      <P>
        <InlineCode>login</InlineCode> authenticates the machine via the OAuth
        device-code flow: it shows a verification URL and a short code, you
        approve it in the browser, and the CLI receives an account token. The
        token is stored per-user in <InlineCode>~/.vaultlier/auth.json</InlineCode>{" "}
        with owner-only permissions.
      </P>
      <CodeBlock label="Terminal">{`vaultlier login    # approve in the browser
vaultlier logout   # remove the stored account token`}</CodeBlock>
      <Callout tone="security" title="Account token ≠ project key">
        The account token only authorizes listing and creating projects. It can
        never read secrets — that always requires a project{" "}
        <A href="/api-keys">API key</A>. Review and revoke device sessions from
        the portal under Account &amp; devices.
      </Callout>

      <H2 id="config">config</H2>
      <P>Manage the local project binding and credentials.</P>
      <Table
        head={["Command", "Effect"]}
        rows={[
          [
            <InlineCode key="a">config set project=&lt;id&gt;</InlineCode>,
            "Update vaultlier.json and regenerate the typed client.",
          ],
          [
            <InlineCode key="b">config set apiKey=&lt;vlt_…&gt;</InlineCode>,
            "Update the local credential cache only; the key is never printed back.",
          ],
          [
            <InlineCode key="c">config get</InlineCode>,
            "Show the current project, masked API key, and account login state.",
          ],
          [
            <InlineCode key="d">config verify</InlineCode>,
            "Re-validate the project id + API key against the portal.",
          ],
        ]}
      />
      <CodeBlock label="Terminal">{`vaultlier config set project=prj_29ec67d64dd1
vaultlier config set apiKey=vlt_live_...
vaultlier config get
vaultlier config verify`}</CodeBlock>

      <H2 id="scan">scan</H2>
      <P>
        Detects environment-variable keys referenced in your code and{" "}
        <InlineCode>.env</InlineCode> files and offers to reconcile your schema
        metadata. Values are ignored — only key names are read.
      </P>
      <CodeBlock label="Terminal">{`vaultlier scan          # report detected keys
vaultlier scan --yes    # reconcile vaultlier.json without prompting`}</CodeBlock>
      <P>
        To avoid false positives, <InlineCode>scan</InlineCode> only recognizes
        established environment-access idioms — never bare{" "}
        <InlineCode>SCREAMING_SNAKE_CASE</InlineCode> constants:
      </P>
      <UL>
        <li>
          <InlineCode>.env</InlineCode> / <InlineCode>.env.*</InlineCode> file
          keys
        </li>
        <li>
          <InlineCode>process.env.X</InlineCode> /{" "}
          <InlineCode>process.env[&quot;X&quot;]</InlineCode> (Node.js, Next.js)
        </li>
        <li>
          <InlineCode>Deno.env.get(&quot;X&quot;)</InlineCode> (Deno)
        </li>
        <li>
          <InlineCode>import.meta.env.X</InlineCode> (Vite, Astro, SvelteKit) —
          framework built-ins like <InlineCode>MODE</InlineCode> are excluded
        </li>
        <li>
          <InlineCode>configService.get(&quot;X&quot;)</InlineCode> /{" "}
          <InlineCode>config.get(&quot;X&quot;)</InlineCode> (NestJS{" "}
          <InlineCode>@nestjs/config</InlineCode>)
        </li>
        <li>
          <InlineCode>env(&quot;X&quot;)</InlineCode> /{" "}
          <InlineCode>getenv(&quot;X&quot;)</InlineCode> config helpers
        </li>
      </UL>
      <P>
        Compiled and build output is never scanned —{" "}
        <InlineCode>node_modules</InlineCode>, <InlineCode>dist</InlineCode>,{" "}
        <InlineCode>build</InlineCode>, <InlineCode>out</InlineCode>,{" "}
        <InlineCode>output</InlineCode>, framework caches (
        <InlineCode>.next</InlineCode>, <InlineCode>.nuxt</InlineCode>,{" "}
        <InlineCode>.svelte-kit</InlineCode>, <InlineCode>.output</InlineCode>),
        and any <InlineCode>outDir</InlineCode> declared in your{" "}
        <InlineCode>tsconfig.json</InlineCode>.
      </P>
      <Callout tone="info" title="Self-correcting">
        Each scan reconciles the schema with what your code actually uses. Keys
        that <InlineCode>scan</InlineCode> previously added but no longer appear
        anywhere are removed. Keys you added by hand or with{" "}
        <InlineCode>set</InlineCode> are never touched — only scan-managed keys
        are pruned.
      </Callout>

      <H2 id="push-pull-diff">push / pull / diff</H2>
      <P>
        These sync schema <strong>metadata</strong> — key names, types, scopes,
        and environments — with the portal. Secret values are never sent or
        received by these commands.
      </P>
      <UL>
        <li>
          <InlineCode>push</InlineCode> — send local schema additions to the
          portal (additive; nothing is deleted server-side).
        </li>
        <li>
          <InlineCode>pull</InlineCode> — fetch the portal schema and regenerate
          the typed client. Without an API key it falls back to regenerating
          from local metadata.
        </li>
        <li>
          <InlineCode>diff</InlineCode> — show what differs between local and
          portal.
        </li>
      </UL>
      <CodeBlock label="Terminal">{`vaultlier push --env=prod
vaultlier pull --env=prod
vaultlier diff --env=prod`}</CodeBlock>

      <H2 id="set">set</H2>
      <P>
        Writes one or more <InlineCode>KEY=VALUE</InlineCode> pairs to a single
        environment. Keys must already exist in the schema and be scoped to the
        target environment — both are checked locally before any value leaves
        your machine. Values are sealed server-side as new immutable versions.
        Requires an API key with the member role or higher.
      </P>
      <CodeBlock label="Terminal">{`vaultlier set DATABASE_URL=postgres://prod-db/main --env=prod
vaultlier set STRIPE_SECRET=sk_live_... FEATURE_NEW_FLOW=true -e prod`}</CodeBlock>
      <P>
        If the target environment does not exist yet, <InlineCode>set</InlineCode>{" "}
        offers to create it (pass <InlineCode>--yes</InlineCode> to skip the
        prompt in CI). It declares the environment through an additive schema
        push, then writes the values.
      </P>
      <CodeBlock label="Terminal">{`vaultlier set DATABASE_URL=postgres://wip-db --env=working --yes`}</CodeBlock>

      <H2 id="dev">dev</H2>
      <P>
        Starts a small management UI for the <strong>one project</strong> bound
        in your local <InlineCode>vaultlier.json</InlineCode>, bound to loopback
        (<InlineCode>http://127.0.0.1:9090</InlineCode>). It is a tiny portal that
        stays in sync with the remote Vaultlier store — every change is written
        straight through. From it you can:
      </P>
      <UL>
        <li>
          View and edit (overwrite) environment variable <strong>values</strong>{" "}
          per environment.
        </li>
        <li>
          View and manage <strong>environments</strong> — create, rename, and
          delete.
        </li>
        <li>
          Manage the <strong>storage backend</strong> (Vaultlier, S3, Postgres),
          which updates the project&apos;s remote settings.
        </li>
      </UL>
      <CodeBlock label="Terminal">{`vaultlier dev
vaultlier dev --port=4000`}</CodeBlock>
      <Callout tone="security" title="The API key stays on your machine">
        The browser talks only to the loopback server, which proxies to the
        portal using a key resolved from <InlineCode>--api-key</InlineCode>,{" "}
        <InlineCode>VAULTLIER_API_KEY</InlineCode>, or the local credential
        cache — the key is never sent to the page. Value edits and environment
        changes need a <strong>member</strong> key; storage changes need an{" "}
        <strong>admin</strong> key, exactly as the portal enforces. Without a key
        the UI is read-only.
      </Callout>

      <H2 id="whoami">whoami</H2>
      <P>Prints the resolved project context: project id, environments, and the masked API key.</P>
      <CodeBlock label="Terminal">{`vaultlier whoami`}</CodeBlock>

      <H2 id="generate-key">generate-key</H2>
      <P>
        Prints a fresh <InlineCode>VAULT_MASTER_KEY</InlineCode> — 32
        cryptographically-random bytes, base64-encoded — for a portal deployment
        to seal and unseal secret values. This is only needed when you{" "}
        <A href="/faq#self-host">self-host</A> the portal; the hosted service is
        already configured. <InlineCode>vaultlier generate key</InlineCode> and{" "}
        <InlineCode>vaultlier -g key</InlineCode> are accepted aliases.
      </P>
      <CodeBlock label="Terminal">{`# print a key (also: vaultlier generate key)
vaultlier generate-key

# the key prints on stdout, setup notes on stderr — so you can capture just the key:
vaultlier generate-key 2>/dev/null
KEY=$(vaultlier generate-key 2>/dev/null)`}</CodeBlock>
      <Callout tone="security" title="Set once; never store it casually">
        The command <strong>does not store, cache, log, or transmit</strong> the
        key — it only prints it. Set it as a server environment variable
        (<InlineCode>VAULT_MASTER_KEY</InlineCode>) on your deployment and treat
        it like a root credential. Changing or losing it makes
        already-sealed secrets unrecoverable, because each value records the key
        generation it was sealed with.
      </Callout>

      <H2 id="flags">Flag conventions</H2>
      <P>
        Every value flag has a canonical <InlineCode>--kebab-case</InlineCode>{" "}
        long form; common ones also have a single-letter short form. Both{" "}
        <InlineCode>--flag=value</InlineCode> and <InlineCode>--flag value</InlineCode>{" "}
        work.
      </P>
      <Table
        head={["Short", "Long", "Aliases", "Used by"]}
        rows={[
          ["-e", <InlineCode key="e">--env</InlineCode>, <InlineCode key="ea">--environment</InlineCode>, "pull, push, diff, set"],
          ["-k", <InlineCode key="k">--api-key</InlineCode>, <InlineCode key="ka">--apiKey</InlineCode>, "all portal commands"],
          ["", <InlineCode key="u">--api-url</InlineCode>, <InlineCode key="ua">--apiUrl</InlineCode>, "all portal commands"],
          ["", <InlineCode key="p">--project-id</InlineCode>, <InlineCode key="pa">--projectId</InlineCode>, "init"],
          ["-p", <InlineCode key="po">--port</InlineCode>, "", "dev"],
          ["-o", <InlineCode key="o">--output</InlineCode>, "", "--generate, --generate-env"],
          ["-y", <InlineCode key="y">--yes</InlineCode>, "", "prompts"],
          ["-f", <InlineCode key="f">--force</InlineCode>, "", "init, generated .env"],
          ["-h", <InlineCode key="h">--help</InlineCode>, "", "everywhere"],
        ]}
      />

      <H2 id="output">Output &amp; scripting</H2>
      <P>
        Commands print status-prefixed lines and show a spinner while talking to
        the portal. Styling degrades gracefully:
      </P>
      <UL>
        <li>Colors and spinners activate only on an interactive terminal.</li>
        <li>
          They are suppressed when output is piped or <InlineCode>CI</InlineCode>{" "}
          is set, so logs stay plain.
        </li>
        <li>
          <InlineCode>NO_COLOR</InlineCode> disables colors;{" "}
          <InlineCode>FORCE_COLOR</InlineCode> forces them.
        </li>
        <li>Spinners render on stderr, keeping stdout clean for scripting.</li>
      </UL>
    </DocPage>
  );
}
