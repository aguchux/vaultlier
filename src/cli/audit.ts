import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import type {
  AuditCategoryScore,
  AuditSeverity,
  AuditSummary,
  VaultlierConfig,
} from "../schema/types.js";

export type AuditCategory =
  | "structure"
  | "exposedSecrets"
  | "dependencies"
  | "framework";

export interface AuditFinding {
  id: string;
  title: string;
  severity: AuditSeverity;
  category: AuditCategory;
  path?: string;
  detail: string;
  recommendation: string;
}

export interface AuditCategoryResult extends AuditCategoryScore {
  label: string;
}

export interface AuditReport {
  scannedAt: string;
  score: number;
  categories: Record<AuditCategory, AuditCategoryResult>;
  frameworks: string[];
  findings: AuditFinding[];
  filesScanned: number;
  ai?: AuditAiAnalysis;
}

export interface AuditAiAnalysis {
  provider: "deepseek" | "openai" | "anthropic";
  model: string;
  summary: string;
  recommendations: string[];
}

export interface AuditAnalyzePayload {
  score: number;
  categories: Record<AuditCategory, AuditCategoryResult>;
  frameworks: string[];
  filesScanned: number;
  findings: AuditFinding[];
}

const REPORT_VERSION = 1;
const DEFAULT_REPORT_PATH = "vaultlier-audit-report.html";
const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".env",
  ".js",
  ".jsx",
  ".json",
  ".mjs",
  ".mts",
  ".svelte",
  ".ts",
  ".tsx",
  ".vue",
  ".yaml",
  ".yml",
]);
const SKIPPED_DIRS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".turbo",
  ".vaultlier",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "output",
]);
const SECRET_NAME_PATTERN =
  /(SECRET|TOKEN|PASSWORD|PASS|PRIVATE|API[_-]?KEY|DATABASE_URL|CONNECTION_STRING)/i;
const SECRET_VALUE_PATTERN =
  /(vlt_(?:live|test)_[A-Za-z0-9_=-]{8,}|sk_(?:live|test)_[A-Za-z0-9_=-]{8,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|postgres(?:ql)?:\/\/[^"'\s]+)/g;

export function defaultAuditReportPath(): string {
  return DEFAULT_REPORT_PATH;
}

export function buildAuditAnalyzePayload(report: AuditReport): AuditAnalyzePayload {
  return {
    score: report.score,
    categories: report.categories,
    frameworks: report.frameworks.map(redactAuditText),
    filesScanned: report.filesScanned,
    findings: report.findings.map((finding) => ({
      id: redactAuditText(finding.id),
      title: redactAuditText(finding.title),
      severity: finding.severity,
      category: finding.category,
      ...(finding.path ? { path: redactAuditText(finding.path) } : {}),
      detail: redactAuditText(finding.detail),
      recommendation: redactAuditText(finding.recommendation),
    })),
  };
}

export async function runLocalAudit(
  cwd: string,
  config?: VaultlierConfig,
): Promise<AuditReport> {
  const files = await collectAuditFiles(cwd);
  const [packageJson, gitignore] = await Promise.all([
    readJsonObject(join(cwd, "package.json")),
    readOptionalText(join(cwd, ".gitignore")),
  ]);
  const findings: AuditFinding[] = [];

  findings.push(...(await detectStructureFindings(cwd, packageJson, gitignore)));
  findings.push(...detectDependencyFindings(packageJson));
  findings.push(...detectConfigFindings(config));

  let filesScanned = 0;
  for (const file of files) {
    const rel = toPosix(relative(cwd, file));
    const raw = await readFile(file, "utf8");
    filesScanned += 1;
    findings.push(...detectFileFindings(rel, raw));
  }

  const frameworks = detectFrameworks(packageJson, files.map((file) => toPosix(relative(cwd, file))));
  findings.push(...detectFrameworkFindings(frameworks, packageJson));

  return buildReport({
    scannedAt: new Date().toISOString(),
    frameworks,
    findings: dedupeFindings(findings),
    filesScanned,
  });
}

export async function writeAuditHtmlReport(
  cwd: string,
  reportPath: string,
  report: AuditReport,
): Promise<void> {
  const path = join(cwd, reportPath);
  await writeFile(path, renderAuditHtml(report), "utf8");
}

export function auditSummaryFromReport(
  report: AuditReport,
  reportPath: string,
): AuditSummary {
  return {
    lastRun: {
      toolVersion: REPORT_VERSION,
      scannedAt: report.scannedAt,
      reportPath,
      score: report.score,
      categories: {
        structure: summarizeCategory(report.categories.structure),
        exposedSecrets: summarizeCategory(report.categories.exposedSecrets),
        dependencies: summarizeCategory(report.categories.dependencies),
        framework: summarizeCategory(report.categories.framework),
      },
      findings: report.findings.slice(0, 25).map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        category: finding.category,
        ...(finding.path ? { path: finding.path } : {}),
      })),
      frameworks: report.frameworks,
      ...(report.ai
        ? {
            ai: {
              provider: report.ai.provider,
              model: report.ai.model,
              summary: report.ai.summary,
              recommendations: report.ai.recommendations,
            },
          }
        : {}),
    },
  };
}

function summarizeCategory(category: AuditCategoryResult): AuditCategoryScore {
  return { score: category.score, findings: category.findings };
}

function buildReport(params: {
  scannedAt: string;
  frameworks: string[];
  findings: AuditFinding[];
  filesScanned: number;
}): AuditReport {
  const categories: Record<AuditCategory, AuditCategoryResult> = {
    structure: categoryResult("Project structure", params.findings, "structure"),
    exposedSecrets: categoryResult(
      "Exposed unprotected secrets",
      params.findings,
      "exposedSecrets",
    ),
    dependencies: categoryResult(
      "Dependency posture",
      params.findings,
      "dependencies",
    ),
    framework: categoryResult(
      "Framework surface",
      params.findings,
      "framework",
    ),
  };
  const score = Math.round(
    categories.structure.score * 0.2 +
      categories.exposedSecrets.score * 0.45 +
      categories.dependencies.score * 0.2 +
      categories.framework.score * 0.15,
  );

  return {
    scannedAt: params.scannedAt,
    score,
    categories,
    frameworks: params.frameworks,
    findings: params.findings.sort(compareFindings),
    filesScanned: params.filesScanned,
  };
}

function categoryResult(
  label: string,
  findings: readonly AuditFinding[],
  category: AuditCategory,
): AuditCategoryResult {
  const categoryFindings = findings.filter((finding) => finding.category === category);
  return {
    label,
    score: Math.max(
      0,
      100 -
        categoryFindings.reduce(
          (total, finding) => total + severityPenalty(finding.severity),
          0,
        ),
    ),
    findings: categoryFindings.length,
  };
}

function severityPenalty(severity: AuditSeverity): number {
  switch (severity) {
    case "critical":
      return 45;
    case "high":
      return 30;
    case "medium":
      return 15;
    case "low":
      return 7;
    case "info":
      return 0;
  }
}

async function detectStructureFindings(
  cwd: string,
  packageJson: Record<string, unknown> | undefined,
  gitignore: string | undefined,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  if (!packageJson) {
    findings.push({
      id: "structure.no-package-json",
      title: "No package.json found",
      severity: "low",
      category: "structure",
      detail: "The scanner could not identify package metadata for this repository.",
      recommendation: "Run the audit from the repository root or add package metadata.",
    });
  }
  if (gitignore === undefined) {
    findings.push({
      id: "structure.no-gitignore",
      title: "No .gitignore file found",
      severity: "medium",
      category: "structure",
      detail: "A repository without .gitignore is more likely to commit local secrets and generated output.",
      recommendation: "Add .gitignore entries for .env*, .vaultlier/, build output, and dependency folders.",
    });
  } else if (!/\.env\*?/.test(gitignore) && !/\.env\./.test(gitignore)) {
    findings.push({
      id: "structure.gitignore-env",
      title: ".gitignore does not ignore env files",
      severity: "high",
      category: "structure",
      path: ".gitignore",
      detail: "Environment files are common places for plaintext credentials.",
      recommendation: "Ignore .env* files and keep only safe templates such as .env.example.",
    });
  }
  if (!(await hasAnyLockfile(cwd))) {
    findings.push({
      id: "structure.no-lockfile",
      title: "No package lockfile detected",
      severity: "low",
      category: "structure",
      detail: "Unpinned dependency resolution makes builds less reproducible.",
      recommendation: "Commit the lockfile for the package manager used by this repository.",
    });
  }
  return findings;
}

function detectDependencyFindings(
  packageJson: Record<string, unknown> | undefined,
): AuditFinding[] {
  if (!packageJson) return [];
  const findings: AuditFinding[] = [];
  const scripts = objectValue(packageJson.scripts);
  for (const [name, value] of Object.entries(scripts)) {
    if (typeof value !== "string") continue;
    if (/\bcurl\b[^|;&]*(?:\||&&)\s*(?:sh|bash)\b/.test(value)) {
      findings.push({
        id: `dependencies.script.${name}`,
        title: `Script "${name}" pipes remote code to a shell`,
        severity: "high",
        category: "dependencies",
        path: "package.json",
        detail: `The script runs: ${value}`,
        recommendation: "Pin and verify downloaded artifacts before execution, or replace the script with a checked-in tool.",
      });
    }
  }
  if (typeof scripts.postinstall === "string") {
    findings.push({
      id: "dependencies.postinstall",
      title: "postinstall script present",
      severity: "medium",
      category: "dependencies",
      path: "package.json",
      detail: "postinstall scripts run automatically during dependency installation.",
      recommendation: "Keep postinstall minimal, audited, and documented, or remove it if it is not required.",
    });
  }
  return findings;
}

function detectConfigFindings(config: VaultlierConfig | undefined): AuditFinding[] {
  if (!config) return [];
  const findings: AuditFinding[] = [];
  for (const [name, schema] of Object.entries(config.keys)) {
    if (
      schema.default !== undefined &&
      typeof schema.default === "string" &&
      (SECRET_NAME_PATTERN.test(name) || SECRET_VALUE_PATTERN.test(schema.default))
    ) {
      findings.push({
        id: `exposedSecrets.config-default.${name}`,
        title: `Potential secret default for ${name}`,
        severity: "high",
        category: "exposedSecrets",
        path: "vaultlier.config.json",
        detail: "Vaultlier config defaults are committed metadata and should not carry secret values.",
        recommendation: "Remove the default and store the value through `vaultlier set`.",
      });
    }
  }
  return findings;
}

function detectFileFindings(path: string, raw: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const name = basename(path);
  if (/^\.env(?:\.|$)/.test(name) && !/example|sample|template/i.test(name)) {
    const secretKeys = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .filter((line) => {
        const [key, value = ""] = line.split("=", 2);
        return SECRET_NAME_PATTERN.test(key ?? "") && value.trim().length > 0;
      });
    if (secretKeys.length > 0) {
      findings.push({
        id: `exposedSecrets.env-file.${path}`,
        title: "Plaintext secrets found in an env file",
        severity: "critical",
        category: "exposedSecrets",
        path,
        detail: `${path} contains populated secret-looking keys.`,
        recommendation: "Move values into Vaultlier with `vaultlier set`, keep only key-only templates, and rotate exposed values.",
      });
    }
  }

  if (isSourceLike(path) && SECRET_VALUE_PATTERN.test(raw)) {
    findings.push({
      id: `exposedSecrets.literal.${path}`,
      title: "Potential hardcoded secret literal",
      severity: "high",
      category: "exposedSecrets",
      path,
      detail: "A source/config file contains a string matching a known secret pattern.",
      recommendation: "Replace hardcoded credentials with runtime Vaultlier resolution and rotate the exposed credential.",
    });
  }
  return findings;
}

function detectFrameworks(
  packageJson: Record<string, unknown> | undefined,
  files: readonly string[],
): string[] {
  const deps = {
    ...objectValue(packageJson?.dependencies),
    ...objectValue(packageJson?.devDependencies),
  };
  const frameworks = new Set<string>();
  const hasDep = (name: string) => deps[name] !== undefined;
  const hasFile = (pattern: RegExp) => files.some((file) => pattern.test(file));

  if (hasDep("next") || hasFile(/(^|\/)next\.config\.[cm]?[jt]s$/)) frameworks.add("Next.js");
  if (hasDep("@nestjs/core") || hasFile(/(^|\/)nest-cli\.json$/)) frameworks.add("NestJS");
  if (hasDep("vite") || hasFile(/(^|\/)vite\.config\.[cm]?[jt]s$/)) frameworks.add("Vite");
  if (hasDep("@angular/core") || hasFile(/(^|\/)angular\.json$/)) frameworks.add("Angular");
  if (hasDep("express")) frameworks.add("Express");
  if (hasDep("fastify")) frameworks.add("Fastify");
  if (hasDep("koa")) frameworks.add("Koa");
  if (hasDep("astro")) frameworks.add("Astro");
  if (hasDep("nuxt")) frameworks.add("Nuxt");
  if (hasDep("react")) frameworks.add("React");
  if (hasDep("vue")) frameworks.add("Vue");
  if (packageJson && frameworks.size === 0) frameworks.add("Node.js");
  return [...frameworks].sort();
}

function detectFrameworkFindings(
  frameworks: readonly string[],
  packageJson: Record<string, unknown> | undefined,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const deps = {
    ...objectValue(packageJson?.dependencies),
    ...objectValue(packageJson?.devDependencies),
  };
  if (frameworks.includes("Next.js") && deps["@next/env"] === undefined) {
    findings.push({
      id: "framework.next-runtime-env",
      title: "Next.js app should keep server secrets out of client bundles",
      severity: "info",
      category: "framework",
      detail: "Next.js exposes variables prefixed with NEXT_PUBLIC_ to the browser.",
      recommendation: "Keep Vaultlier reads in server-only code and avoid putting secret values behind NEXT_PUBLIC_ names.",
    });
  }
  if (frameworks.includes("Vite")) {
    findings.push({
      id: "framework.vite-public-env",
      title: "Vite exposes prefixed env vars to browser code",
      severity: "info",
      category: "framework",
      detail: "Vite exposes VITE_ variables to client bundles.",
      recommendation: "Never store secrets in VITE_ variables; resolve secrets on the server side.",
    });
  }
  return findings;
}

async function collectAuditFiles(cwd: string): Promise<string[]> {
  const files: string[] = [];
  await walk(cwd, async (path) => {
    const info = await stat(path);
    if (info.size > 1_000_000 || !shouldReadFile(path)) return;
    files.push(path);
  });
  return files.sort();
}

async function walk(dir: string, visitFile: (path: string) => Promise<void>): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        await walk(path, visitFile);
      }
      continue;
    }
    if (entry.isFile()) {
      await visitFile(path);
    }
  }
}

function shouldReadFile(path: string): boolean {
  const name = basename(path);
  if (/^\.env(?:\.|$)/.test(name)) return true;
  if (name === ".gitignore" || name === "package.json") return true;
  if (/lock(?:file)?\.json$/.test(name) || name.endsWith(".lock")) return false;
  return SOURCE_EXTENSIONS.has(extname(name));
}

function isSourceLike(path: string): boolean {
  const name = basename(path);
  if (/^\.env(?:\.|$)/.test(name)) return false;
  if (/lock(?:file)?\.json$/.test(name) || name.endsWith(".lock")) return false;
  return SOURCE_EXTENSIONS.has(extname(name));
}

async function readJsonObject(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

async function readOptionalText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

async function hasAnyLockfile(cwd: string): Promise<boolean> {
  const checks = await Promise.all(
    [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
  ].map(async (name) => {
    try {
      await stat(join(cwd, name));
      return true;
    } catch {
      return false;
    }
  }),
  );
  return checks.some(Boolean);
}

function dedupeFindings(findings: readonly AuditFinding[]): AuditFinding[] {
  const seen = new Set<string>();
  const result: AuditFinding[] = [];
  for (const finding of findings) {
    if (seen.has(finding.id)) continue;
    seen.add(finding.id);
    result.push(finding);
  }
  return result;
}

function compareFindings(a: AuditFinding, b: AuditFinding): number {
  const severity = severityRank(b.severity) - severityRank(a.severity);
  if (severity !== 0) return severity;
  return a.title.localeCompare(b.title);
}

function severityRank(severity: AuditSeverity): number {
  switch (severity) {
    case "critical":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    case "info":
      return 1;
  }
}

function renderAuditHtml(report: AuditReport): string {
  const ai = report.ai
    ? `<section class="ai">
  <h2>AI recommendations</h2>
  <p><strong>${escapeHtml(report.ai.provider)}</strong> / ${escapeHtml(report.ai.model)}</p>
  <p>${escapeHtml(report.ai.summary)}</p>
  <ul>${report.ai.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
</section>`
    : "";
  const findings = report.findings
    .map(
      (finding) => `<tr>
  <td><span class="severity ${finding.severity}">${escapeHtml(finding.severity)}</span></td>
  <td>${escapeHtml(finding.category)}</td>
  <td>${escapeHtml(finding.title)}${finding.path ? `<br><small>${escapeHtml(finding.path)}</small>` : ""}</td>
  <td>${escapeHtml(finding.detail)}</td>
  <td>${escapeHtml(finding.recommendation)}</td>
</tr>`,
    )
    .join("\n");
  const categoryCards = Object.entries(report.categories)
    .map(
      ([name, category]) => `<section class="card">
  <h2>${escapeHtml(category.label)}</h2>
  <strong>${category.score}%</strong>
  <p>${category.findings} finding${category.findings === 1 ? "" : "s"} in ${escapeHtml(name)}</p>
</section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Vaultlier Audit Report</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; color: #17201b; background: #f7faf8; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px; }
    header { margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 2rem; }
    .score { font-size: 4rem; font-weight: 800; line-height: 1; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 24px 0; }
    .card { background: #fff; border: 1px solid #dce7e0; border-radius: 8px; padding: 16px; }
    .ai { background: #fff; border: 1px solid #dce7e0; border-radius: 8px; padding: 18px; margin: 24px 0; }
    .card strong { font-size: 2rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dce7e0; }
    th, td { border-bottom: 1px solid #dce7e0; padding: 12px; text-align: left; vertical-align: top; }
    th { background: #edf5f0; }
    small { color: #64746b; }
    .severity { border-radius: 999px; color: #fff; display: inline-block; font-size: 0.78rem; font-weight: 700; padding: 3px 8px; text-transform: uppercase; }
    .critical { background: #991b1b; } .high { background: #b45309; } .medium { background: #9a6700; }
    .low { background: #3f6212; } .info { background: #2563eb; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Vaultlier Audit Report</h1>
      <div class="score">${report.score}%</div>
      <p>Scanned ${report.filesScanned} files at ${escapeHtml(report.scannedAt)}.</p>
      <p>Frameworks: ${report.frameworks.length > 0 ? escapeHtml(report.frameworks.join(", ")) : "none detected"}</p>
    </header>
    <div class="grid">${categoryCards}</div>
    ${ai}
    <h2>Findings</h2>
    <table>
      <thead><tr><th>Severity</th><th>Category</th><th>Finding</th><th>Detail</th><th>Recommendation</th></tr></thead>
      <tbody>${findings || `<tr><td colspan="5">No findings.</td></tr>`}</tbody>
    </table>
  </main>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function redactAuditText(value: string): string {
  return value.replace(SECRET_VALUE_PATTERN, "[redacted]");
}

function toPosix(path: string): string {
  return path.replaceAll("\\", "/");
}
