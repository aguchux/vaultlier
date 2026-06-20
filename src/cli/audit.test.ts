import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildAuditAnalyzePayload, runLocalAudit } from "./audit.js";
import type { AuditReport } from "./audit.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vaultlier-audit-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runLocalAudit", () => {
  it("detects common frameworks from package metadata and config files", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "package.json"),
      JSON.stringify({
        dependencies: {
          "@nestjs/core": "latest",
          express: "latest",
          next: "latest",
          vite: "latest",
        },
      }),
      "utf8",
    );
    await writeFile(join(cwd, "package-lock.json"), "{}\n", "utf8");
    await writeFile(join(cwd, ".gitignore"), ".env*\n", "utf8");
    await writeFile(join(cwd, "next.config.js"), "module.exports = {};\n", "utf8");

    const report = await runLocalAudit(cwd);

    expect(report.frameworks).toEqual(["Express", "NestJS", "Next.js", "Vite"]);
    expect(report.categories.framework.score).toBe(100);
  });

  it("reports populated secret-looking env files", async () => {
    const cwd = await makeTempDir();
    await writeFile(join(cwd, "package.json"), JSON.stringify({}), "utf8");
    await writeFile(join(cwd, "package-lock.json"), "{}\n", "utf8");
    await writeFile(join(cwd, ".gitignore"), ".env*\n", "utf8");
    await writeFile(join(cwd, ".env"), "DATABASE_URL=postgres://user:pass@localhost/db\n", "utf8");

    const report = await runLocalAudit(cwd);

    expect(report.score).toBeLessThan(100);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "exposedSecrets",
          severity: "critical",
          path: ".env",
        }),
      ]),
    );
  });

  it("does not include secret values in finding titles or recommendations", async () => {
    const cwd = await makeTempDir();
    await writeFile(join(cwd, "package.json"), JSON.stringify({}), "utf8");
    await writeFile(join(cwd, "package-lock.json"), "{}\n", "utf8");
    await writeFile(join(cwd, ".gitignore"), ".env*\n", "utf8");
    await writeFile(join(cwd, ".env"), "API_KEY=vlt_live_supersecret123\n", "utf8");

    const report = await runLocalAudit(cwd);
    const serialized = JSON.stringify(report.findings);

    expect(serialized).not.toContain("vlt_live_supersecret123");
  });

  it("redacts secret-looking values before building the AI payload", () => {
    const report: AuditReport = {
      scannedAt: "2026-06-20T00:00:00.000Z",
      score: 50,
      categories: {
        structure: { label: "Project structure", score: 100, findings: 0 },
        exposedSecrets: {
          label: "Exposed unprotected secrets",
          score: 0,
          findings: 1,
        },
        dependencies: { label: "Dependency posture", score: 100, findings: 0 },
        framework: { label: "Framework surface", score: 100, findings: 0 },
      },
      frameworks: ["Node.js"],
      filesScanned: 1,
      findings: [
        {
          id: "literal.vlt_live_supersecret123",
          title: "Potential hardcoded secret literal",
          severity: "high",
          category: "exposedSecrets",
          path: "src/config.ts",
          detail: "Found vlt_live_supersecret123 and postgres://user:pass@host/db",
          recommendation: "Rotate vlt_live_supersecret123 immediately.",
        },
      ],
    };

    const payload = buildAuditAnalyzePayload(report);
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain("vlt_live_supersecret123");
    expect(serialized).not.toContain("postgres://user:pass@host/db");
    expect(serialized).toContain("[redacted]");
  });
});
