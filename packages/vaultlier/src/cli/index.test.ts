import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { maskApiKey, parseArgs, run } from "./index.js";
import { CONFIG_SCHEMA_URL, ExitCode } from "../schema/types.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vaultlier-cli-"));
  tempDirs.push(dir);
  return dir;
}

function capture() {
  let text = "";
  return {
    stream: {
      write(chunk: string | Uint8Array): boolean {
        text += chunk.toString();
        return true;
      },
    },
    read(): string {
      return text;
    },
  };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("parseArgs", () => {
  it("parses command and --env flag", () => {
    const r = parseArgs(["pull", "--env=prod"]);
    expect(r.command).toBe("pull");
    expect(r.env).toBe("prod");
  });

  it("parses space-separated flag values", () => {
    const r = parseArgs(["init", "--project-id", "prj_checkout_api"]);
    expect(r.flags["project-id"]).toBe("prj_checkout_api");
  });

  it("treats leading flags as flags, not the command", () => {
    const r = parseArgs(["--help"]);
    expect(r.command).toBeUndefined();
    expect(r.flags.help).toBe(true);
  });

  it("captures the command even when a flag comes first", () => {
    const r = parseArgs(["--help", "init"]);
    expect(r.command).toBe("init");
    expect(r.flags.help).toBe(true);
  });
});

describe("maskApiKey", () => {
  it("masks all but a prefix and suffix", () => {
    expect(maskApiKey("vlt_test_1234567890")).toBe("vlt_test\u202690");
  });

  it("fully masks short keys", () => {
    expect(maskApiKey("short")).toBe("****");
  });
});

describe("run", () => {
  it("init writes metadata, generated client, and credential cache", async () => {
    const cwd = await makeTempDir();
    const stdout = capture();
    const stderr = capture();

    const code = await run(
      [
        "init",
        "--project-id=prj_checkout_api",
        "--api-key=vlt_test_12345678",
        "--environments=dev,prod",
      ],
      { cwd, stdout: stdout.stream, stderr: stderr.stream },
    );

    expect(code).toBe(ExitCode.Success);
    expect(stderr.read()).toBe("");
    expect(stdout.read()).toContain("validated - 2 environments synced");

    const config = await readFile(join(cwd, "vaultlier.json"), "utf8");
    const parsedConfig = JSON.parse(config) as Record<string, unknown>;
    expect(parsedConfig.$schema).toBe(CONFIG_SCHEMA_URL);
    expect(parsedConfig.projectId).toBe("prj_checkout_api");
    expect(config).not.toContain("vlt_test_12345678");

    const client = await readFile(join(cwd, "lib", "Vaultlier.ts"), "utf8");
    expect(client).toContain("createClient");
    expect(client).toContain("prj_checkout_api");
    expect(client).not.toContain("vlt_test_12345678");

    const credentials = await readFile(
      join(cwd, ".vaultlier", "credentials.json"),
      "utf8",
    );
    expect(credentials).toContain("vlt_test_12345678");
  });

  it("init refuses to overwrite metadata without --force", async () => {
    const cwd = await makeTempDir();
    await writeFile(join(cwd, "vaultlier.json"), "{}\n", "utf8");
    const stderr = capture();

    const code = await run(
      ["init", "--project-id=prj_checkout_api", "--api-key=vlt_test_12345678"],
      { cwd, stderr: stderr.stream },
    );

    expect(code).toBe(ExitCode.GenericError);
    expect(stderr.read()).toContain("already exists");
  });

  it("init refuses to overwrite alternate config metadata without --force", async () => {
    const cwd = await makeTempDir();
    await writeFile(join(cwd, "vaultlier.config.json"), "{}\n", "utf8");
    const stderr = capture();

    const code = await run(
      ["init", "--project-id=prj_checkout_api", "--api-key=vlt_test_12345678"],
      { cwd, stderr: stderr.stream },
    );

    expect(code).toBe(ExitCode.GenericError);
    expect(stderr.read()).toContain("vaultlier.config.json already exists");
  });

  it("init rejects malformed API keys", async () => {
    const cwd = await makeTempDir();
    const stderr = capture();

    const code = await run(
      ["init", "--project-id=prj_checkout_api", "--api-key=not-a-key"],
      { cwd, stderr: stderr.stream },
    );

    expect(code).toBe(ExitCode.AuthFailed);
    expect(stderr.read()).toContain("invalid API key format");
  });

  it("pull regenerates the typed client from local metadata", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 2,
          environments: ["dev", "prod"],
          keys: {
            FEATURE_NEW_FLOW: { type: "boolean", default: false },
            DATABASE_URL: { type: "string", scopes: ["all"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const code = await run(["pull", "--env=prod"], {
      cwd,
      stdout: capture().stream,
    });

    expect(code).toBe(ExitCode.Success);
    const client = await readFile(join(cwd, "lib", "Vaultlier.ts"), "utf8");
    expect(client).toContain("DATABASE_URL: string;");
    expect(client).toContain("FEATURE_NEW_FLOW: boolean;");
    expect(client).not.toContain("false");
  });

  it("pull accepts vaultlier.config.json as an alternate config file", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.config.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 2,
          environments: ["dev", "prod"],
          keys: {
            DATABASE_URL: { type: "string", scopes: ["all"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const code = await run(["pull", "--env=prod"], {
      cwd,
      stdout: capture().stream,
    });

    expect(code).toBe(ExitCode.Success);
    const client = await readFile(join(cwd, "lib", "Vaultlier.ts"), "utf8");
    expect(client).toContain("DATABASE_URL: string;");
  });

  it("whoami prints masked context", async () => {
    const cwd = await makeTempDir();
    const stdout = capture();

    await run(
      ["init", "--project-id=prj_checkout_api", "--api-key=vlt_test_12345678"],
      { cwd, stdout: capture().stream },
    );
    const code = await run(["whoami"], { cwd, stdout: stdout.stream });

    expect(code).toBe(ExitCode.Success);
    expect(stdout.read()).toContain("projectId: prj_checkout_api");
    expect(stdout.read()).toContain("apiKey: vlt_test\u202678");
    expect(stdout.read()).not.toContain("vlt_test_12345678");
  });

  it("diff validates local schema but fails closed until portal sync exists", async () => {
    const cwd = await makeTempDir();
    const stderr = capture();

    await run(
      ["init", "--project-id=prj_checkout_api", "--api-key=vlt_test_12345678"],
      { cwd, stdout: capture().stream },
    );
    const code = await run(["diff", "--env=prod"], {
      cwd,
      stderr: stderr.stream,
    });

    expect(code).toBe(ExitCode.GenericError);
    expect(stderr.read()).toContain("portal API sync is not available");
  });
});
