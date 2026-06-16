import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_URL,
  createProject,
  listProjects,
  resolveApiUrl,
} from "./portal.js";
import type { FetchLike } from "./portal.js";

function jsonFetch(status: number, body: unknown): FetchLike {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  });
}

const OPTIONS = { apiUrl: "https://portal.test", apiKey: "vlt_login_tok" };

describe("resolveApiUrl", () => {
  it("uses the same-origin hosted portal by default", () => {
    expect(resolveApiUrl(undefined, {})).toBe("https://vaultlier.com");
    expect(DEFAULT_API_URL).toBe("https://vaultlier.com");
  });
});

describe("listProjects", () => {
  it("returns project summaries and drops malformed entries", async () => {
    const projects = await listProjects({
      ...OPTIONS,
      fetchImpl: jsonFetch(200, {
        projects: [
          { publicId: "prj_1", name: "checkout", organization: "acme" },
          { publicId: "prj_2", name: "billing" },
          { name: "missing-id" },
          "garbage",
        ],
      }),
    });
    expect(projects).toEqual([
      { publicId: "prj_1", name: "checkout", organization: "acme" },
      { publicId: "prj_2", name: "billing" },
    ]);
  });

  it("sends the account token as a bearer credential", async () => {
    let auth: string | undefined;
    const fetchImpl: FetchLike = async (_url, init) => {
      auth = init?.headers?.authorization;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ projects: [] }),
      };
    };
    await listProjects({ ...OPTIONS, fetchImpl });
    expect(auth).toBe("Bearer vlt_login_tok");
  });

  it("rejects unexpected payload shapes", async () => {
    await expect(
      listProjects({ ...OPTIONS, fetchImpl: jsonFetch(200, { nope: true }) }),
    ).rejects.toMatchObject({ code: "response/invalid" });
  });

  it("surfaces portal error codes", async () => {
    await expect(
      listProjects({
        ...OPTIONS,
        fetchImpl: jsonFetch(401, {
          code: "auth/invalid_token",
          message: "expired",
        }),
      }),
    ).rejects.toMatchObject({ code: "auth/invalid_token", status: 401 });
  });
});

describe("createProject", () => {
  it("posts the name and returns the created summary", async () => {
    let sent: string | undefined;
    const fetchImpl: FetchLike = async (_url, init) => {
      sent = init?.body;
      return {
        ok: true,
        status: 201,
        headers: { get: () => null },
        json: async () => ({ publicId: "prj_new", name: "checkout" }),
      };
    };
    const project = await createProject({ ...OPTIONS, fetchImpl }, "checkout");
    expect(JSON.parse(sent!)).toEqual({ name: "checkout" });
    expect(project).toEqual({ publicId: "prj_new", name: "checkout" });
  });

  it("rejects responses without a project id", async () => {
    await expect(
      createProject(
        { ...OPTIONS, fetchImpl: jsonFetch(201, { name: "checkout" }) },
        "checkout",
      ),
    ).rejects.toMatchObject({ code: "response/invalid" });
  });
});
