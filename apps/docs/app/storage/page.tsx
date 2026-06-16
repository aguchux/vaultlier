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
  title: "Storage backends",
  description:
    "Bring your own remote storage — store a project's encrypted secrets in your own S3 bucket or Postgres database while Vaultlier keeps the encryption and access control.",
  path: "/storage",
});

const toc = [
  { id: "model", title: "How it works" },
  { id: "s3", title: "Amazon S3 (and R2 / MinIO)" },
  { id: "postgres", title: "Postgres" },
  { id: "fallback", title: "Fallback & drift" },
  { id: "security", title: "Security guarantees" },
];

export default function StoragePage(): React.JSX.Element {
  return (
    <DocPage
      href="/storage"
      title="Storage backends"
      lede="By default your secrets live in Vaultlier's managed store. You can instead point a project at your own S3 bucket or Postgres database — the data physically resides in infrastructure you own."
      toc={toc}
    >
      <H2 id="model">How it works</H2>
      <P>
        Configure a backend per project under{" "}
        <strong>Settings → Storage backend</strong>. Once set, that backend
        becomes the <strong>authoritative</strong> store for the project&apos;s
        secret values. Vaultlier still owns the schema, the encryption, and all
        access control — only the encrypted blobs move.
      </P>
      <P>
        Crucially, <strong>Vaultlier encrypts every value before it leaves</strong>.
        Your bucket or database only ever receives opaque ciphertext (AES-256-GCM
        under a per-project key); the master key never leaves Vaultlier. A leak of
        your store yields nothing usable.
      </P>
      <UL>
        <li>Changing storage requires an organization owner or admin.</li>
        <li>Credentials are sealed with the same encryption used for secrets.</li>
        <li>Vaultlier tests the connection before saving a backend.</li>
      </UL>

      <H2 id="s3">Amazon S3 (and R2 / MinIO)</H2>
      <P>
        Each value is written as one object at{" "}
        <InlineCode>
          {"{prefix}/{projectId}/{env}/{key}/{version}.bin"}
        </InlineCode>
        . Provide a bucket, region, and an access key pair scoped to that bucket.
        For S3-compatible stores (Cloudflare R2, MinIO) also set the custom{" "}
        <InlineCode>endpoint</InlineCode>.
      </P>
      <P>The credentials need object read/write on the bucket, for example:</P>
      <CodeBlock label="IAM policy">{`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::my-secrets-bucket",
      "arn:aws:s3:::my-secrets-bucket/*"
    ]
  }]
}`}</CodeBlock>

      <H2 id="postgres">Postgres</H2>
      <P>
        Provide a connection string. On first write Vaultlier creates a table
        named <InlineCode>vaultlier_secret_blobs</InlineCode> holding the
        ciphertext, nonce, auth tag, and version — never plaintext. The role only
        needs rights to create that table and read/write its rows.
      </P>
      <CodeBlock label="Connection string">{`postgresql://vaultlier:••••@db.internal:5432/secrets`}</CodeBlock>

      <H2 id="fallback">Fallback &amp; drift</H2>
      <P>
        Vaultlier keeps an encrypted fallback copy of every value in its own
        database. If your store is briefly unreachable on a read, the runtime
        transparently serves the fallback so deployments never break. If a write
        can&apos;t reach your store, the value is still saved and the version is
        flagged as needing resync, surfaced on the settings page.
      </P>
      <Callout tone="info">
        Configuring a backend applies to <strong>new writes</strong>. Existing
        values remain readable from the fallback; re-save them to push them into
        your store.
      </Callout>

      <H2 id="security">Security guarantees</H2>
      <UL>
        <li>Your store only ever sees ciphertext — plaintext never leaves Vaultlier.</li>
        <li>The encryption master key stays Vaultlier-side; your store can&apos;t decrypt.</li>
        <li>Adapter credentials are encrypted at rest and never returned to the browser.</li>
        <li>Storage changes and connection tests are recorded in the audit log.</li>
      </UL>
      <P>
        See <A href="/security">Security</A> for the full encryption model and{" "}
        <A href="/api-keys">API Keys</A> for how the CLI and runtime authenticate.
      </P>
    </DocPage>
  );
}
