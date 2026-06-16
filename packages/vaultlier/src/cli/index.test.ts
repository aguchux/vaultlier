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

/** Build a fake portal transport. Records requests; replies per handler. */
function fakePortal(
  handler: (url: string, init?: { method?: string; body?: string }) => {
    status: number;
    body: unknown;
  },
) {
  const requests: { url: string; method: string; body?: string }[] = [];
  const fetchImpl = async (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => {
    requests.push({ url, method: init?.method ?? "GET", body: init?.body });
    const { status, body } = handler(url, init);
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "x-request-id" ? "req_test_1" : null,
      },
      json: async () => body,
    };
  };
  return { fetchImpl, requests };
}

const PORTAL_SCHEMA = {
  projectId: "prj_checkout_api",
  version: 3,
  environments: ["dev", "prod"],
  keys: {
    DATABASE_URL: { type: "string", scopes: ["all"] },
    FEATURE_NEW_FLOW: { type: "boolean", scopes: ["prod"] },
  },
};

describe("parseArgs", () => {
  it("parses command and --env flag", () => {
    const r = parseArgs(["pull", "--env=prod"]);
    expect(r.command).toBe("pull");
    expect(r.env).toBe("prod");
  });

  it("parses key-value args and -g", () => {
    const r = parseArgs(["-g", "env=prod"]);
    expect(r.command).toBeUndefined();
    expect(r.env).toBe("prod");
    expect(r.flags.generate).toBe(true);
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

  it("normalizes --environment and camelCase aliases to canonical names", () => {
    const r = parseArgs([
      "set",
      "--environment=prod",
      "--apiKey=vlt_test_12345678",
      "--projectId=prj_x",
      "--apiUrl=https://portal.test",
    ]);
    expect(r.env).toBe("prod");
    expect(r.flags["api-key"]).toBe("vlt_test_12345678");
    expect(r.flags["project-id"]).toBe("prj_x");
    expect(r.flags["api-url"]).toBe("https://portal.test");
  });

  it("parses short flags with inline and space-separated values", () => {
    const r = parseArgs(["pull", "-e", "prod", "-o=.env.local", "-y", "-h"]);
    expect(r.env).toBe("prod");
    expect(r.flags.output).toBe(".env.local");
    expect(r.flags.yes).toBe(true);
    expect(r.flags.help).toBe(true);
  });

  it("parses version flags", () => {
    expect(parseArgs(["--version"]).flags.version).toBe(true);
    expect(parseArgs(["-v"]).flags.version).toBe(true);
  });

  it("collects KEY=VALUE args after a command as positionals", () => {
    const r = parseArgs(["set", "DATABASE_URL=postgres://x", "RETRIES=3", "--env=prod"]);
    expect(r.command).toBe("set");
    expect(r.positionals).toEqual(["DATABASE_URL=postgres://x", "RETRIES=3"]);
    expect(r.env).toBe("prod");
    expect(r.flags.DATABASE_URL).toBeUndefined();
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
  it("prints the CLI version", async () => {
    const stdout = capture();
    const stderr = capture();

    await expect(
      run(["--version"], { stdout: stdout.stream, stderr: stderr.stream }),
    ).resolves.toBe(ExitCode.Success);

    expect(stdout.read()).toBe("0.1.11\n");
    expect(stderr.read()).toBe("");
  });

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

    const client = await readFile(join(cwd, "lib", "vaultlier.ts"), "utf8");
    expect(client).toContain("createClient");
    expect(client).toContain("prj_checkout_api");
    expect(client).not.toContain("vlt_test_12345678");

    const credentials = await readFile(
      join(cwd, ".vaultlier", "credentials.json"),
      "utf8",
    );
    expect(credentials).toContain("vlt_test_12345678");
  });

  it("init can add detected env keys without writing env values", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, ".env.local"),
      "DATABASE_URL=postgres://user:pass@example.com/db\nSTRIPE_SECRET=sk_test_secret\n",
      "utf8",
    );

    const code = await run(
      [
        "init",
        "--project-id=prj_checkout_api",
        "--api-key=vlt_test_12345678",
        "--yes",
      ],
      { cwd, stdout: capture().stream },
    );

    expect(code).toBe(ExitCode.Success);

    const config = await readFile(join(cwd, "vaultlier.json"), "utf8");
    expect(config).toContain("DATABASE_URL");
    expect(config).toContain("STRIPE_SECRET");
    expect(config).not.toContain("postgres://");
    expect(config).not.toContain("sk_test_secret");

    const client = await readFile(join(cwd, "lib", "vaultlier.ts"), "utf8");
    expect(client).toContain("DATABASE_URL: string;");
    expect(client).not.toContain("sk_test_secret");
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

  it("init succeeds without an API key and warns how to add one later", async () => {
    const cwd = await makeTempDir();
    const stdout = capture();

    const code = await run(["init", "--project-id=prj_checkout_api"], {
      cwd,
      stdout: stdout.stream,
      env: {},
    });

    expect(code).toBe(ExitCode.Success);
    expect(stdout.read()).toContain("no API key set");
    expect(stdout.read()).toContain("VAULTLIER_API_KEY");

    const credentials = JSON.parse(
      await readFile(join(cwd, ".vaultlier", "credentials.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(credentials.projectId).toBe("prj_checkout_api");
    expect(credentials.apiKey).toBeUndefined();
  });

  it("login completes the device flow and stores account credentials", async () => {
    const cwd = await makeTempDir();
    const home = await makeTempDir();
    const stdout = capture();
    let polls = 0;
    const portal = fakePortal((url, init) => {
      if (url.endsWith("/v1/cli/sessions") && init?.method === "POST") {
        return {
          status: 201,
          body: {
            sessionId: "cls_1",
            userCode: "WDJB-MJHT",
            verificationUrl: "https://vaultlier.com/cli/approve",
            expiresInSeconds: 900,
            pollIntervalSeconds: 1,
          },
        };
      }
      polls += 1;
      return polls < 2
        ? { status: 200, body: { status: "pending" } }
        : {
            status: 200,
            body: {
              status: "approved",
              token: "vlt_login_tok",
              email: "dev@example.com",
            },
          };
    });

    const code = await run(["login", "--api-url=https://portal.test"], {
      cwd,
      homedir: home,
      stdout: stdout.stream,
      fetch: portal.fetchImpl,
      sleep: async () => {},
    });

    expect(code).toBe(ExitCode.Success);
    expect(stdout.read()).toContain("https://vaultlier.com/cli/approve");
    expect(stdout.read()).toContain("WDJB-MJHT");
    expect(stdout.read()).toContain("logged in as dev@example.com");

    const stored = JSON.parse(
      await readFile(join(home, ".vaultlier", "auth.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(stored.token).toBe("vlt_login_tok");

    // A second login is a no-op while credentials exist.
    const again = capture();
    expect(
      await run(["login"], {
        cwd,
        homedir: home,
        stdout: again.stream,
        fetch: portal.fetchImpl,
      }),
    ).toBe(ExitCode.Success);
    expect(again.read()).toContain("already logged in as dev@example.com");
  });

  it("login fails when the browser denies the request", async () => {
    const home = await makeTempDir();
    const stderr = capture();
    const portal = fakePortal((url, init) =>
      init?.method === "POST"
        ? {
            status: 201,
            body: {
              sessionId: "cls_1",
              userCode: "CODE",
              verificationUrl: "https://vaultlier.com/cli/approve",
              expiresInSeconds: 900,
              pollIntervalSeconds: 1,
            },
          }
        : { status: 200, body: { status: "denied" } },
    );

    const code = await run(["login"], {
      cwd: await makeTempDir(),
      homedir: home,
      stdout: capture().stream,
      stderr: stderr.stream,
      fetch: portal.fetchImpl,
      sleep: async () => {},
    });

    expect(code).toBe(ExitCode.AuthFailed);
    expect(stderr.read()).toContain("denied");
  });

  it("logout removes stored credentials and is idempotent", async () => {
    const home = await makeTempDir();
    const cwd = await makeTempDir();

    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(home, ".vaultlier"), { recursive: true });
    await writeFile(
      join(home, ".vaultlier", "auth.json"),
      JSON.stringify({ token: "vlt_login_tok" }),
      "utf8",
    );

    const stdout = capture();
    expect(
      await run(["logout"], { cwd, homedir: home, stdout: stdout.stream }),
    ).toBe(ExitCode.Success);
    expect(stdout.read()).toContain("logged out");

    const again = capture();
    expect(
      await run(["logout"], { cwd, homedir: home, stdout: again.stream }),
    ).toBe(ExitCode.Success);
    expect(again.read()).toContain("not logged in");
  });

  it("config set updates project and apiKey without echoing the key", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_old",
          version: 1,
          environments: ["dev"],
          keys: {},
        },
        null,
        2,
      ),
      "utf8",
    );

    const stdout = capture();
    const code = await run(
      ["config", "set", "project=prj_new", "apiKey=vlt_test_1234567890"],
      { cwd, stdout: stdout.stream },
    );

    expect(code).toBe(ExitCode.Success);
    expect(stdout.read()).toContain("project set to prj_new");
    expect(stdout.read()).not.toContain("vlt_test_1234567890");

    const config = JSON.parse(
      await readFile(join(cwd, "vaultlier.json"), "utf8"),
    ) as { projectId: string };
    expect(config.projectId).toBe("prj_new");
    const client = await readFile(join(cwd, "lib", "vaultlier.ts"), "utf8");
    expect(client).toContain("prj_new");
    const cache = JSON.parse(
      await readFile(join(cwd, ".vaultlier", "credentials.json"), "utf8"),
    ) as { projectId: string; apiKey: string };
    expect(cache).toEqual({
      projectId: "prj_new",
      apiKey: "vlt_test_1234567890",
    });
  });

  it("config set rejects malformed keys and unknown settings", async () => {
    const cwd = await makeTempDir();
    const badKey = capture();
    expect(
      await run(["config", "set", "apiKey=oops"], {
        cwd,
        stderr: badKey.stream,
      }),
    ).toBe(ExitCode.AuthFailed);
    expect(badKey.read()).toContain("invalid API key format");

    const unknown = capture();
    expect(
      await run(["config", "set", "color=red"], {
        cwd,
        stderr: unknown.stream,
      }),
    ).toBe(ExitCode.SchemaInvalid);
    expect(unknown.read()).toContain('unknown setting "color"');
  });

  it("config get prints masked state", async () => {
    const cwd = await makeTempDir();
    const home = await makeTempDir();
    const stdout = capture();

    expect(
      await run(["config", "get"], {
        cwd,
        homedir: home,
        stdout: stdout.stream,
      }),
    ).toBe(ExitCode.Success);
    expect(stdout.read()).toContain("project: (not set)");
    expect(stdout.read()).toContain("apiKey: (not set)");
    expect(stdout.read()).toContain("account: (not logged in)");
  });

  it("config verify validates the project and key against the portal", async () => {
    const cwd = await makeSetProject();
    const stdout = capture();
    const portal = fakePortal(() => ({ status: 200, body: PORTAL_SCHEMA }));

    const code = await run(
      ["config", "verify", "--api-key=vlt_test_12345678"],
      { cwd, stdout: stdout.stream, fetch: portal.fetchImpl },
    );

    expect(code).toBe(ExitCode.Success);
    expect(stdout.read()).toContain(
      "apiKey is valid for project prj_checkout_api",
    );

    const denied = fakePortal(() => ({
      status: 401,
      body: { code: "auth/invalid_api_key", message: "Invalid API key." },
    }));
    const stderr = capture();
    expect(
      await run(["config", "verify", "--api-key=vlt_test_12345678"], {
        cwd,
        stderr: stderr.stream,
        fetch: denied.fetchImpl,
      }),
    ).toBe(ExitCode.AuthFailed);
    expect(stderr.read()).toContain("Invalid API key");
  });

  it("config verify requires an API key", async () => {
    const cwd = await makeSetProject();
    const stderr = capture();
    expect(
      await run(["config", "verify"], {
        cwd,
        env: {},
        stderr: stderr.stream,
      }),
    ).toBe(ExitCode.AuthFailed);
    expect(stderr.read()).toContain("no API key found");
  });

  it("init rejects malformed API keys", async () => {
    const cwd = await makeTempDir();
    const stderr = capture();

    const code = await run(
      ["init", "--project-id=prj_checkout_api", "--api-key=not-a-key"],
      { cwd, stdout: capture().stream, stderr: stderr.stream },
    );

    expect(code).toBe(ExitCode.AuthFailed);
    expect(stderr.read()).toContain("invalid API key format");
  });

  it("init does not prompt for install when vaultlier is already a dependency", async () => {
    const cwd = await makeTempDir();
    let installCalls = 0;
    await writeFile(
      join(cwd, "package.json"),
      JSON.stringify({ dependencies: { vaultlier: "^0.1.0" } }),
      "utf8",
    );

    const code = await run(
      ["init", "--project-id=prj_checkout_api", "--api-key=vlt_test_12345678"],
      {
        cwd,
        stdout: capture().stream,
        installer: async () => {
          installCalls += 1;
          return 0;
        },
      },
    );

    expect(code).toBe(ExitCode.Success);
    expect(installCalls).toBe(0);
  });

  it("init can install vaultlier before writing config", async () => {
    const cwd = await makeTempDir();
    const stdout = capture();
    const calls: Array<{ command: string; args: string[] }> = [];

    const code = await run(
      [
        "init",
        "--project-id=prj_checkout_api",
        "--api-key=vlt_test_12345678",
        "--install",
      ],
      {
        cwd,
        stdout: stdout.stream,
        installer: async ({ command, args }) => {
          calls.push({ command, args });
          return 0;
        },
      },
    );

    expect(code).toBe(ExitCode.Success);
    expect(calls).toEqual([{ command: "npm", args: ["install", "vaultlier"] }]);
    expect(stdout.read()).toContain(
      "installing dependency - npm install vaultlier",
    );
    await expect(
      readFile(join(cwd, "vaultlier.json"), "utf8"),
    ).resolves.toContain("prj_checkout_api");
  });

  it("init can skip dependency install explicitly", async () => {
    const cwd = await makeTempDir();
    const stdout = capture();
    let installCalls = 0;

    const code = await run(
      [
        "init",
        "--project-id=prj_checkout_api",
        "--api-key=vlt_test_12345678",
        "--no-install",
      ],
      {
        cwd,
        stdout: stdout.stream,
        installer: async () => {
          installCalls += 1;
          return 0;
        },
      },
    );

    expect(code).toBe(ExitCode.Success);
    expect(installCalls).toBe(0);
    expect(stdout.read()).toContain("skipped dependency install");
  });

  it("init stops before writing config when dependency install fails", async () => {
    const cwd = await makeTempDir();
    const stderr = capture();

    const code = await run(
      [
        "init",
        "--project-id=prj_checkout_api",
        "--api-key=vlt_test_12345678",
        "--install",
      ],
      {
        cwd,
        stdout: capture().stream,
        stderr: stderr.stream,
        installer: async () => 1,
      },
    );

    expect(code).toBe(ExitCode.GenericError);
    expect(stderr.read()).toContain("dependency install failed");
    await expect(
      readFile(join(cwd, "vaultlier.json"), "utf8"),
    ).rejects.toThrow();
  });

  it("init handles dependency installer spawn errors", async () => {
    const cwd = await makeTempDir();
    const stderr = capture();

    const code = await run(
      [
        "init",
        "--project-id=prj_checkout_api",
        "--api-key=vlt_test_12345678",
        "--install",
      ],
      {
        cwd,
        stdout: capture().stream,
        stderr: stderr.stream,
        installer: async () => {
          throw new Error("spawn EINVAL");
        },
      },
    );

    expect(code).toBe(ExitCode.GenericError);
    expect(stderr.read()).toContain("dependency install failed: spawn EINVAL");
    await expect(
      readFile(join(cwd, "vaultlier.json"), "utf8"),
    ).rejects.toThrow();
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
    const client = await readFile(join(cwd, "lib", "vaultlier.ts"), "utf8");
    expect(client).toContain("DATABASE_URL: string;");
    expect(client).toContain("FEATURE_NEW_FLOW: boolean;");
    expect(client).not.toContain("false");
  });

  it("pull can generate a key-only env file from schema", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 2,
          environments: ["dev", "prod"],
          keys: {
            STRIPE_SECRET: {
              type: "string",
              scopes: ["prod"],
              description: "Stripe secret key",
            },
            DATABASE_URL: { type: "string", scopes: ["all"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const code = await run(["pull", "--env=prod", "--generate-env"], {
      cwd,
      stdout: capture().stream,
    });

    expect(code).toBe(ExitCode.Success);
    const env = await readFile(join(cwd, ".env"), "utf8");
    expect(env).toContain("DATABASE_URL=");
    expect(env).toContain("# Stripe secret key\nSTRIPE_SECRET=");
    expect(env).not.toContain("sk_test");
  });

  it("generate writes a key-only env file and respects env scope", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 2,
          environments: ["dev", "prod"],
          keys: {
            STRIPE_SECRET: { type: "string", scopes: ["prod"] },
            DATABASE_URL: { type: "string", scopes: ["all"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const code = await run(["-g", "env=dev"], {
      cwd,
      stdout: capture().stream,
    });

    expect(code).toBe(ExitCode.Success);
    const env = await readFile(join(cwd, ".env"), "utf8");
    expect(env).toBe("DATABASE_URL=\n");
  });

  it("generate does not overwrite an existing env file without confirmation", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 2,
          environments: ["dev"],
          keys: {
            DATABASE_URL: { type: "string", scopes: ["all"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(join(cwd, ".env"), "DATABASE_URL=keep-me\n", "utf8");

    const code = await run(["--generate", "env=dev"], {
      cwd,
      stdout: capture().stream,
    });

    expect(code).toBe(ExitCode.Success);
    await expect(readFile(join(cwd, ".env"), "utf8")).resolves.toBe(
      "DATABASE_URL=keep-me\n",
    );
  });

  it("scan can update schema from env files and process.env references", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 2,
          environments: ["dev"],
          keys: {},
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(join(cwd, ".env"), "DATABASE_URL=secret-url\n", "utf8");
    await writeFile(
      join(cwd, "app.ts"),
      "console.log(process.env.FEATURE_NEW_FLOW, process.env['STRIPE_SECRET']);\n",
      "utf8",
    );

    const code = await run(["scan", "--yes"], {
      cwd,
      stdout: capture().stream,
    });

    expect(code).toBe(ExitCode.Success);
    const config = await readFile(join(cwd, "vaultlier.json"), "utf8");
    expect(config).toContain("DATABASE_URL");
    expect(config).toContain("FEATURE_NEW_FLOW");
    expect(config).toContain("STRIPE_SECRET");
    expect(config).not.toContain("secret-url");
  });

  it("push updates local schema from env keys before failing on missing API key", async () => {
    const cwd = await makeTempDir();
    const stderr = capture();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 2,
          environments: ["dev"],
          keys: {},
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(join(cwd, ".env"), "DATABASE_URL=secret-url\n", "utf8");

    const code = await run(["push", "--env=dev", "--yes"], {
      cwd,
      stdout: capture().stream,
      stderr: stderr.stream,
    });

    expect(code).toBe(ExitCode.AuthFailed);
    expect(stderr.read()).toContain("missing API key");

    const config = await readFile(join(cwd, "vaultlier.json"), "utf8");
    expect(config).toContain("DATABASE_URL");
    expect(config).not.toContain("secret-url");
  });

  it("push syncs the schema to the portal and adopts the returned version", async () => {
    const cwd = await makeTempDir();
    const stdout = capture();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 2,
          environments: ["dev", "prod"],
          keys: { DATABASE_URL: { type: "string", scopes: ["all"] } },
        },
        null,
        2,
      ),
      "utf8",
    );

    const portal = fakePortal(() => ({ status: 200, body: PORTAL_SCHEMA }));
    const code = await run(
      ["push", "--api-key=vlt_test_12345678", "--api-url=https://portal.test"],
      { cwd, stdout: stdout.stream, fetch: portal.fetchImpl },
    );

    expect(code).toBe(ExitCode.Success);
    expect(stdout.read()).toContain("portal now at v3");
    expect(portal.requests).toHaveLength(1);
    expect(portal.requests[0]!.url).toBe(
      "https://portal.test/v1/projects/prj_checkout_api/schema",
    );
    expect(portal.requests[0]!.method).toBe("PUT");
    // Schema metadata only — the push body must never contain values.
    expect(portal.requests[0]!.body).toContain("DATABASE_URL");
    expect(portal.requests[0]!.body).not.toContain("vlt_test_12345678");

    const config = JSON.parse(
      await readFile(join(cwd, "vaultlier.json"), "utf8"),
    ) as { version: number; keys: Record<string, unknown> };
    expect(config.version).toBe(3);
    expect(config.keys.FEATURE_NEW_FLOW).toBeDefined();
  });

  it("push maps portal conflicts and auth failures to exit codes", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 1,
          environments: ["dev"],
          keys: {},
        },
        null,
        2,
      ),
      "utf8",
    );

    const conflict = fakePortal(() => ({
      status: 409,
      body: { code: "schema/version_conflict", message: "behind the portal" },
    }));
    const conflictStderr = capture();
    expect(
      await run(["push", "--api-key=vlt_test_12345678"], {
        cwd,
        stderr: conflictStderr.stream,
        fetch: conflict.fetchImpl,
      }),
    ).toBe(ExitCode.Conflict);
    expect(conflictStderr.read()).toContain("behind the portal");

    const denied = fakePortal(() => ({
      status: 401,
      body: { code: "auth/invalid_api_key", message: "Invalid API key." },
    }));
    expect(
      await run(["push", "--api-key=vlt_test_12345678"], {
        cwd,
        stderr: capture().stream,
        fetch: denied.fetchImpl,
      }),
    ).toBe(ExitCode.AuthFailed);

    const offline = fakePortal(() => {
      throw new Error("ECONNREFUSED");
    });
    const offlineStderr = capture();
    expect(
      await run(["push", "--api-key=vlt_test_12345678"], {
        cwd,
        stderr: offlineStderr.stream,
        fetch: offline.fetchImpl,
      }),
    ).toBe(ExitCode.GenericError);
    expect(offlineStderr.read()).toContain("could not reach");
  });

  async function makeSetProject(): Promise<string> {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 3,
          environments: ["dev", "prod"],
          keys: {
            DATABASE_URL: { type: "string", scopes: ["all"] },
            STRIPE_SECRET: { type: "string", scopes: ["prod"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    return cwd;
  }

  it("set writes secret values to the portal and reports versions only", async () => {
    const cwd = await makeSetProject();
    const stdout = capture();
    const portal = fakePortal(() => ({
      status: 200,
      body: {
        environment: "prod",
        versions: { DATABASE_URL: 4, STRIPE_SECRET: 1 },
      },
    }));

    const code = await run(
      [
        "set",
        "DATABASE_URL=postgres://prod-db/main",
        "STRIPE_SECRET=sk_live_abc",
        "--environment=prod",
        "--api-key=vlt_test_12345678",
        "--api-url=https://portal.test",
      ],
      { cwd, stdout: stdout.stream, fetch: portal.fetchImpl },
    );

    expect(code).toBe(ExitCode.Success);
    expect(portal.requests).toHaveLength(1);
    expect(portal.requests[0]!.url).toBe(
      "https://portal.test/v1/projects/prj_checkout_api/secrets",
    );
    expect(portal.requests[0]!.method).toBe("PUT");
    expect(JSON.parse(portal.requests[0]!.body!)).toEqual({
      environment: "prod",
      secrets: {
        DATABASE_URL: "postgres://prod-db/main",
        STRIPE_SECRET: "sk_live_abc",
      },
    });
    // Versions only — stdout must never echo the values.
    const out = stdout.read();
    expect(out).toContain("DATABASE_URL -> v4");
    expect(out).toContain("STRIPE_SECRET -> v1");
    expect(out).toContain('set 2 values in "prod"');
    expect(out).not.toContain("sk_live_abc");
    expect(out).not.toContain("postgres://prod-db/main");
  });

  it("set accepts the -e short flag and values containing '='", async () => {
    const cwd = await makeSetProject();
    const portal = fakePortal(() => ({
      status: 200,
      body: { environment: "dev", versions: { DATABASE_URL: 1 } },
    }));

    const code = await run(
      [
        "set",
        "DATABASE_URL=postgres://db?opts=a=b",
        "-e",
        "dev",
        "--api-key=vlt_test_12345678",
      ],
      { cwd, stdout: capture().stream, fetch: portal.fetchImpl },
    );

    expect(code).toBe(ExitCode.Success);
    expect(JSON.parse(portal.requests[0]!.body!)).toMatchObject({
      environment: "dev",
      secrets: { DATABASE_URL: "postgres://db?opts=a=b" },
    });
  });

  it("set requires an explicit single environment", async () => {
    const cwd = await makeSetProject();
    const stderr = capture();
    expect(
      await run(["set", "DATABASE_URL=x"], {
        cwd,
        stderr: stderr.stream,
      }),
    ).toBe(ExitCode.SchemaInvalid);
    expect(stderr.read()).toContain("--env=prod");

    const allStderr = capture();
    expect(
      await run(["set", "DATABASE_URL=x", "--env=all"], {
        cwd,
        stderr: allStderr.stream,
      }),
    ).toBe(ExitCode.SchemaInvalid);

    const unknownStderr = capture();
    expect(
      await run(["set", "DATABASE_URL=x", "--env=qa"], {
        cwd,
        stderr: unknownStderr.stream,
      }),
    ).toBe(ExitCode.SchemaInvalid);
    expect(unknownStderr.read()).toContain('unknown environment "qa"');
  });

  it("set requires at least one well-formed KEY=VALUE pair", async () => {
    const cwd = await makeSetProject();
    const emptyStderr = capture();
    expect(
      await run(["set", "--env=prod"], { cwd, stderr: emptyStderr.stream }),
    ).toBe(ExitCode.SchemaInvalid);
    expect(emptyStderr.read()).toContain("KEY=VALUE");

    const noValueStderr = capture();
    expect(
      await run(["set", "DATABASE_URL", "--env=prod"], {
        cwd,
        stderr: noValueStderr.stream,
      }),
    ).toBe(ExitCode.SchemaInvalid);
    expect(noValueStderr.read()).toContain("missing a value");
  });

  it("set rejects schema violations locally before any value leaves the machine", async () => {
    const cwd = await makeSetProject();
    const portal = fakePortal(() => ({ status: 200, body: {} }));

    const unknownStderr = capture();
    expect(
      await run(
        ["set", "NOT_IN_SCHEMA=value", "--env=prod", "--api-key=vlt_test_12345678"],
        { cwd, stderr: unknownStderr.stream, fetch: portal.fetchImpl },
      ),
    ).toBe(ExitCode.SchemaInvalid);
    expect(unknownStderr.read()).toContain("not in the project schema");

    const scopeStderr = capture();
    expect(
      await run(
        ["set", "STRIPE_SECRET=sk_live_abc", "--env=dev", "--api-key=vlt_test_12345678"],
        { cwd, stderr: scopeStderr.stream, fetch: portal.fetchImpl },
      ),
    ).toBe(ExitCode.SchemaInvalid);
    expect(scopeStderr.read()).toContain('not scoped to environment "dev"');

    expect(portal.requests).toHaveLength(0);
  });

  it("set fails without an API key and maps portal auth errors", async () => {
    const cwd = await makeSetProject();
    const stderr = capture();
    expect(
      await run(["set", "DATABASE_URL=x", "--env=prod"], {
        cwd,
        stderr: stderr.stream,
      }),
    ).toBe(ExitCode.AuthFailed);
    expect(stderr.read()).toContain("missing API key");

    const denied = fakePortal(() => ({
      status: 401,
      body: { code: "auth/invalid_api_key", message: "Invalid API key." },
    }));
    expect(
      await run(
        ["set", "DATABASE_URL=x", "--env=prod", "--api-key=vlt_test_12345678"],
        { cwd, stderr: capture().stream, fetch: denied.fetchImpl },
      ),
    ).toBe(ExitCode.AuthFailed);
  });

  it("set creates a missing environment via schema push with --yes", async () => {
    const cwd = await makeSetProject();
    const stdout = capture();
    const portal = fakePortal((url) =>
      url.endsWith("/schema")
        ? {
            status: 200,
            body: {
              projectId: "prj_checkout_api",
              version: 4,
              environments: ["dev", "prod", "working"],
              keys: {
                DATABASE_URL: { type: "string", scopes: ["all"] },
                STRIPE_SECRET: { type: "string", scopes: ["prod"] },
              },
            },
          }
        : {
            status: 200,
            body: { environment: "working", versions: { DATABASE_URL: 1 } },
          },
    );

    const code = await run(
      [
        "set",
        "DATABASE_URL=postgres://working-db",
        "--env=working",
        "--yes",
        "--api-key=vlt_test_12345678",
        "--api-url=https://portal.test",
      ],
      { cwd, stdout: stdout.stream, fetch: portal.fetchImpl },
    );

    expect(code).toBe(ExitCode.Success);
    expect(portal.requests).toHaveLength(2);
    // 1. Additive schema push that declares the new environment — no values.
    expect(portal.requests[0]!.url).toBe(
      "https://portal.test/v1/projects/prj_checkout_api/schema",
    );
    const schemaBody = JSON.parse(portal.requests[0]!.body!) as {
      environments: string[];
    };
    expect(schemaBody.environments).toContain("working");
    expect(portal.requests[0]!.body).not.toContain("postgres://working-db");
    // 2. The secret write against the new environment.
    expect(portal.requests[1]!.url).toBe(
      "https://portal.test/v1/projects/prj_checkout_api/secrets",
    );
    expect(JSON.parse(portal.requests[1]!.body!)).toMatchObject({
      environment: "working",
    });

    expect(stdout.read()).toContain('created environment "working"');
    // The local config adopts the synced schema including the new env.
    const config = JSON.parse(
      await readFile(join(cwd, "vaultlier.json"), "utf8"),
    ) as { version: number; environments: string[] };
    expect(config.environments).toContain("working");
    expect(config.version).toBe(4);
  });

  it("set does not create an environment without confirmation or --yes", async () => {
    const cwd = await makeSetProject();
    const stderr = capture();
    const portal = fakePortal(() => ({ status: 200, body: {} }));

    const code = await run(
      ["set", "DATABASE_URL=x", "--env=working", "--api-key=vlt_test_12345678"],
      { cwd, stderr: stderr.stream, fetch: portal.fetchImpl },
    );

    expect(code).toBe(ExitCode.SchemaInvalid);
    expect(stderr.read()).toContain("rerun with --yes");
    expect(portal.requests).toHaveLength(0);
  });

  it("set rejects invalid environment names before contacting the portal", async () => {
    const cwd = await makeSetProject();
    const stderr = capture();
    const portal = fakePortal(() => ({ status: 200, body: {} }));

    const code = await run(
      ["set", "DATABASE_URL=x", "--env=%bad", "--yes", "--api-key=vlt_test_12345678"],
      { cwd, stderr: stderr.stream, fetch: portal.fetchImpl },
    );

    expect(code).toBe(ExitCode.SchemaInvalid);
    expect(stderr.read()).toContain('invalid environment name "%bad"');
    expect(portal.requests).toHaveLength(0);
  });

  it("set syncs and retries when the environment exists locally but not remotely", async () => {
    const cwd = await makeSetProject();
    const stdout = capture();
    let secretCalls = 0;
    const portal = fakePortal((url) => {
      if (url.endsWith("/schema")) {
        return {
          status: 200,
          body: {
            projectId: "prj_checkout_api",
            version: 4,
            environments: ["dev", "prod"],
            keys: {
              DATABASE_URL: { type: "string", scopes: ["all"] },
              STRIPE_SECRET: { type: "string", scopes: ["prod"] },
            },
          },
        };
      }
      secretCalls += 1;
      return secretCalls === 1
        ? {
            status: 404,
            body: {
              code: "environment/unknown",
              message: 'Unknown environment "prod".',
            },
          }
        : {
            status: 200,
            body: { environment: "prod", versions: { DATABASE_URL: 5 } },
          };
    });

    const code = await run(
      ["set", "DATABASE_URL=postgres://x", "--env=prod", "--api-key=vlt_test_12345678"],
      { cwd, stdout: stdout.stream, fetch: portal.fetchImpl },
    );

    expect(code).toBe(ExitCode.Success);
    // secrets (404) -> schema push -> secrets retry
    expect(portal.requests.map((r) => r.url.split("/").pop())).toEqual([
      "secrets",
      "schema",
      "secrets",
    ]);
    expect(stdout.read()).toContain("DATABASE_URL -> v5");
  });

  it("pull adopts the portal schema and regenerates the client", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 1,
          environments: ["dev"],
          keys: {},
        },
        null,
        2,
      ),
      "utf8",
    );

    const portal = fakePortal(() => ({ status: 200, body: PORTAL_SCHEMA }));
    const stdout = capture();
    const code = await run(["pull", "--api-key=vlt_test_12345678"], {
      cwd,
      stdout: stdout.stream,
      fetch: portal.fetchImpl,
    });

    expect(code).toBe(ExitCode.Success);
    expect(stdout.read()).toContain("pulled portal schema v3");
    expect(portal.requests[0]!.method).toBe("GET");

    const config = JSON.parse(
      await readFile(join(cwd, "vaultlier.json"), "utf8"),
    ) as { version: number; environments: string[] };
    expect(config.version).toBe(3);
    expect(config.environments).toEqual(["dev", "prod"]);

    const client = await readFile(join(cwd, "lib", "vaultlier.ts"), "utf8");
    expect(client).toContain("FEATURE_NEW_FLOW: boolean;");
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
    const client = await readFile(join(cwd, "lib", "vaultlier.ts"), "utf8");
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

  it("diff reports differences between local and portal schemas", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 2,
          environments: ["dev", "staging"],
          keys: {
            DATABASE_URL: { type: "string", scopes: ["all"] },
            LOCAL_ONLY: { type: "string" },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const portal = fakePortal(() => ({ status: 200, body: PORTAL_SCHEMA }));
    const stdout = capture();
    const code = await run(["diff", "--api-key=vlt_test_12345678"], {
      cwd,
      stdout: stdout.stream,
      fetch: portal.fetchImpl,
    });

    expect(code).toBe(ExitCode.Success);
    const output = stdout.read();
    expect(output).toContain("local v2 vs portal v3");
    expect(output).toContain("+ LOCAL_ONLY (local only");
    expect(output).toContain("- FEATURE_NEW_FLOW (portal only");
    expect(output).toContain("+ env staging (local only");
    expect(output).toContain("- env prod (portal only");
  });

  it("diff reports an in-sync schema", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "vaultlier.json"),
      JSON.stringify(
        {
          projectId: "prj_checkout_api",
          version: 3,
          environments: ["dev", "prod"],
          keys: {
            DATABASE_URL: { type: "string", scopes: ["all"] },
            FEATURE_NEW_FLOW: { type: "boolean", scopes: ["prod"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const portal = fakePortal(() => ({ status: 200, body: PORTAL_SCHEMA }));
    const stdout = capture();
    const code = await run(["diff", "--api-key=vlt_test_12345678"], {
      cwd,
      stdout: stdout.stream,
      fetch: portal.fetchImpl,
    });

    expect(code).toBe(ExitCode.Success);
    expect(stdout.read()).toContain("schema in sync with portal (v3)");
  });

  it("diff uses the API key cached by init", async () => {
    const cwd = await makeTempDir();

    await run(
      ["init", "--project-id=prj_checkout_api", "--api-key=vlt_test_12345678"],
      { cwd, stdout: capture().stream },
    );

    let sawAuth: string | undefined;
    const fetchImpl = async (
      url: string,
      init?: { headers?: Record<string, string> },
    ) => {
      sawAuth = init?.headers?.authorization;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          projectId: "prj_checkout_api",
          version: 1,
          environments: ["dev", "staging", "prod"],
          keys: {},
        }),
      };
    };

    const code = await run(["diff"], {
      cwd,
      stdout: capture().stream,
      fetch: fetchImpl,
    });

    expect(code).toBe(ExitCode.Success);
    expect(sawAuth).toBe("Bearer vlt_test_12345678");
  });
});
