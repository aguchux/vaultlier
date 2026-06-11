import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

const workflow = [
  {
    step: "01",
    title: "Initialize once",
    text: "Connect a project with an API key and generate vaultlier.json plus a typed client.",
  },
  {
    step: "02",
    title: "Sync metadata",
    text: "Pull schema updates from the portal without writing decrypted values to disk.",
  },
  {
    step: "03",
    title: "Read at runtime",
    text: "Resolve environment-aware configuration in memory from Node, edge, and CI runtimes.",
  },
];

const guarantees = [
  "No generated .env files",
  "Metadata-only vaultlier.json",
  "Typed lib/vaultlier.ts client",
  "Auditable reads and writes",
];

const surfaces = [
  {
    title: "Portal",
    text: "Create projects, manage environments, rotate API keys, and review access history from one source of truth.",
  },
  {
    title: "CLI",
    text: "Run init, pull, push, diff, and whoami from the same workflow developers already use.",
  },
  {
    title: "Runtime SDK",
    text: "Import a small typed client that stays compatible with modern serverless and edge targets.",
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <Image
          className={styles.heroImage}
          src="/vaultlier-product.png"
          alt="Vaultlier dashboard and CLI workflow preview"
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.heroOverlay} />
        <header className={styles.nav}>
          <Link className={styles.brand} href="/" aria-label="Vaultlier home">
            <span className={styles.brandMark}>V</span>
            <span>Vaultlier</span>
          </Link>
          <nav className={styles.navLinks} aria-label="Main navigation">
            <Link href="#workflow">Workflow</Link>
            <Link href="#security">Security</Link>
            <Link href="/docs">Docs</Link>
          </nav>
        </header>

        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Sealed configuration for teams</p>
          <h1 id="hero-title">Vaultlier</h1>
          <p className={styles.heroText}>
            Replace scattered .env files with typed runtime configuration,
            project-scoped API keys, and a portal that remains the source of
            truth across every environment.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/docs">
              Read the docs
            </Link>
            <Link className={styles.secondaryAction} href="#workflow">
              See workflow
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.trustBand} aria-label="Vaultlier guarantees">
        {guarantees.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>

      <section className={styles.section} id="workflow">
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Developer workflow</p>
          <h2>Ship config changes without shipping secrets.</h2>
        </div>
        <div className={styles.workflowGrid}>
          {workflow.map((item) => (
            <article className={styles.workflowItem} key={item.step}>
              <span>{item.step}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <div className={styles.commandPanel} aria-label="Vaultlier CLI example">
          <code>npm install vaultlier</code>
          <code>npx vaultlier init</code>
          <code>npx vaultlier pull --env=prod</code>
        </div>
      </section>

      <section className={styles.surfaceBand}>
        <div className={styles.surfaceIntro}>
          <p className={styles.eyebrow}>Product surface</p>
          <h2>One control plane for app configuration.</h2>
          <p>
            Vaultlier keeps local files limited to metadata while the portal,
            CLI, and runtime SDK handle the rest of the configuration lifecycle.
          </p>
        </div>
        <div className={styles.surfaceGrid}>
          {surfaces.map((surface) => (
            <article className={styles.surfaceItem} key={surface.title}>
              <h3>{surface.title}</h3>
              <p>{surface.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.securitySection} id="security">
        <div>
          <p className={styles.eyebrow}>Security model</p>
          <h2>Secrets stay sealed. Access stays visible.</h2>
        </div>
        <p>
          Runtime requests resolve configuration in memory, API keys stay masked
          in terminal output, and every read or write is designed to be
          attributable to a project, environment, and actor.
        </p>
      </section>
    </main>
  );
}
