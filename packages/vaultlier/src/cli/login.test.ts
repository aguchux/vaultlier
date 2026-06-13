import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  authStorePath,
  clearAccountCredentials,
  completeDeviceLogin,
  readAccountCredentials,
  writeAccountCredentials,
} from "./login.js";
import type { FetchLike } from "./portal.js";

const tempDirs: string[] = [];

async function makeTempHome(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vaultlier-home-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

const SESSION = {
  sessionId: "cls_123",
  userCode: "WDJB-MJHT",
  verificationUrl: "https://vaultlier.com/cli/approve",
  expiresInSeconds: 900,
  pollIntervalSeconds: 1,
};

describe("account credential store", () => {
  it("round-trips credentials in the home directory", async () => {
    const home = await makeTempHome();
    expect(await readAccountCredentials(home)).toBeUndefined();

    await writeAccountCredentials(
      { token: "vlt_login_abc", email: "dev@example.com" },
      home,
    );
    expect(await readAccountCredentials(home)).toMatchObject({
      token: "vlt_login_abc",
      email: "dev@example.com",
    });

    // Stored under the home dir, never the project dir.
    expect(authStorePath(home)).toBe(join(home, ".vaultlier", "auth.json"));
    const raw = await readFile(authStorePath(home), "utf8");
    expect(raw).toContain("vlt_login_abc");
  });

  it("clear removes the store and is idempotent", async () => {
    const home = await makeTempHome();
    await writeAccountCredentials({ token: "vlt_login_abc" }, home);
    await clearAccountCredentials(home);
    expect(await readAccountCredentials(home)).toBeUndefined();
    await clearAccountCredentials(home); // no throw on missing file
  });

  it("ignores malformed store contents", async () => {
    const home = await makeTempHome();
    await writeAccountCredentials({ token: "" }, home);
    expect(await readAccountCredentials(home)).toBeUndefined();
  });
});

describe("completeDeviceLogin", () => {
  it("polls until approved and reports the session to the caller", async () => {
    let polls = 0;
    const fetchImpl: FetchLike = async (url, init) => {
      if (init?.method === "POST") return jsonResponse(201, SESSION);
      polls += 1;
      return polls < 3
        ? jsonResponse(200, { status: "pending" })
        : jsonResponse(200, {
            status: "approved",
            token: "vlt_login_tok",
            email: "dev@example.com",
          });
    };

    let shown: string | undefined;
    const credentials = await completeDeviceLogin(
      { apiUrl: "https://portal.test", fetchImpl },
      {
        onSession: (session) => {
          shown = `${session.verificationUrl} ${session.userCode}`;
        },
        sleep: async () => {},
      },
    );

    expect(shown).toBe("https://vaultlier.com/cli/approve WDJB-MJHT");
    expect(credentials.token).toBe("vlt_login_tok");
    expect(credentials.email).toBe("dev@example.com");
    expect(polls).toBe(3);
  });

  it("fails when the user denies the login", async () => {
    const fetchImpl: FetchLike = async (_url, init) =>
      init?.method === "POST"
        ? jsonResponse(201, SESSION)
        : jsonResponse(200, { status: "denied" });

    await expect(
      completeDeviceLogin(
        { apiUrl: "https://portal.test", fetchImpl },
        { onSession: () => {}, sleep: async () => {} },
      ),
    ).rejects.toMatchObject({ code: "login/denied" });
  });

  it("fails when the session expires", async () => {
    const fetchImpl: FetchLike = async (_url, init) =>
      init?.method === "POST"
        ? jsonResponse(201, SESSION)
        : jsonResponse(200, { status: "expired" });

    await expect(
      completeDeviceLogin(
        { apiUrl: "https://portal.test", fetchImpl },
        { onSession: () => {}, sleep: async () => {} },
      ),
    ).rejects.toMatchObject({ code: "login/expired" });
  });

  it("rejects an approval that carries no token", async () => {
    const fetchImpl: FetchLike = async (_url, init) =>
      init?.method === "POST"
        ? jsonResponse(201, SESSION)
        : jsonResponse(200, { status: "approved" });

    await expect(
      completeDeviceLogin(
        { apiUrl: "https://portal.test", fetchImpl },
        { onSession: () => {}, sleep: async () => {} },
      ),
    ).rejects.toMatchObject({ code: "response/invalid" });
  });
});
