import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { Episteme3SearchResponseSchema } from "@/app/lib/episteme3-schemas";
import {
  createLoadSmokeProviderFixture,
  DEFAULT_PROVIDER_PAPER_COUNT,
  getProviderFixturePaperId,
  MAX_PROVIDER_FIXTURE_REQUEST_BODY_BYTES,
  parseProviderFixtureArgs,
  type ProviderFixtureProfile,
} from "../provider-fixture";

const activeServers: Server[] = [];

async function startFixture(
  profile: ProviderFixtureProfile,
  delayMs = 350,
  paperCount = DEFAULT_PROVIDER_PAPER_COUNT,
) {
  const fixture = createLoadSmokeProviderFixture({ profile, delayMs, paperCount });
  activeServers.push(fixture.server);
  await new Promise<void>((resolve, reject) => {
    fixture.server.once("error", reject);
    fixture.server.listen(0, "127.0.0.1", resolve);
  });
  const address = fixture.server.address() as AddressInfo;
  return { fixture, baseUrl: `http://127.0.0.1:${String(address.port)}` };
}

afterEach(async () => {
  await Promise.all(
    activeServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    ),
  );
});

describe("load-smoke provider fixture", () => {
  it("returns a deterministic Episteme-compatible healthy search window", async () => {
    const { baseUrl } = await startFixture("healthy");

    const response = await fetch(`${baseUrl}/api/v3/search/papers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: { text: "graph retrieval", retrieval: "hybrid_rerank" },
        page: { size: 3 },
        projection: "standard",
        sort: "relevance",
      }),
    });
    const parsed = Episteme3SearchResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(parsed.items).toHaveLength(DEFAULT_PROVIDER_PAPER_COUNT);
    expect(parsed.items.map((item) => item.identifiers[0]?.value)).toEqual(
      Array.from({ length: DEFAULT_PROVIDER_PAPER_COUNT }, (_unused, index) =>
        String(getProviderFixturePaperId("graph retrieval", index)),
      ),
    );
    expect(parsed.total).toMatchObject({
      value: 3,
      relation: "exact",
      basis: "lexical_matches",
      coverage: { full: true, generation: "1" },
    });
    expect(parsed.completeness.status).toBe("complete");
  });

  it("applies the configured delay before a successful response", async () => {
    const { baseUrl } = await startFixture("delay", 30);
    const startedAt = performance.now();

    const response = await fetch(`${baseUrl}/api/v3/search/papers`, {
      method: "POST",
      body: JSON.stringify({ query: { text: "delayed" } }),
    });

    expect(response.status).toBe(200);
    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(20);
  });

  it("returns the configured maximum-cardinality search window", async () => {
    const { baseUrl } = await startFixture("healthy", 350, 40);

    const response = await fetch(`${baseUrl}/api/v3/search/papers`, {
      method: "POST",
      body: JSON.stringify({ query: { text: "max-cardinality" }, page: { size: 40 } }),
    });
    const parsed = Episteme3SearchResponseSchema.parse(await response.json());

    expect(parsed.items).toHaveLength(40);
    expect(parsed.page).toMatchObject({ size: 40, next_cursor: null });
    expect(parsed.items.at(-1)?.identifiers[0]?.value).toBe(
      String(getProviderFixturePaperId("max-cardinality", 39)),
    );
  });

  it("accepts the E3 lexical citation-sort request", async () => {
    const { baseUrl } = await startFixture("healthy", 0, 5);

    const response = await fetch(`${baseUrl}/api/v3/search/papers`, {
      method: "POST",
      body: JSON.stringify({
        query: { text: "graph", retrieval: "lexical" },
        page: { size: 2 },
        sort: "citations",
      }),
    });
    const parsed = Episteme3SearchResponseSchema.parse(await response.json());
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]?.citation_count).toBeGreaterThanOrEqual(
      parsed.items[1]?.citation_count ?? 0,
    );
  });

  it("uses the canonical query as part of controlled paper identity", async () => {
    const { baseUrl } = await startFixture("healthy", 0);

    const search = async (query: string) =>
      Episteme3SearchResponseSchema.parse(
        await fetch(`${baseUrl}/api/v3/search/papers`, {
          method: "POST",
          body: JSON.stringify({ query: { text: query } }),
        }).then((response) => response.json()),
      );
    const first = await search("first query");
    const second = await search("second query");

    expect(first.items[0]?.identifiers[0]?.value).toBe(
      String(getProviderFixturePaperId("first query", 0)),
    );
    expect(second.items[0]?.identifiers[0]?.value).toBe(
      String(getProviderFixturePaperId("second query", 0)),
    );
    expect(first.items[0]?.paper_uid).not.toBe(second.items[0]?.paper_uid);
  });

  it.each([
    ["429", 429],
    ["500", 500],
  ] as const)("returns a controlled %s provider failure", async (profile, status) => {
    const { baseUrl, fixture } = await startFixture(profile);

    const response = await fetch(`${baseUrl}/api/v3/search/papers`, {
      method: "POST",
      body: JSON.stringify({ query: { text: "failure" } }),
    });
    const body: unknown = await response.json();

    expect(response.status).toBe(status);
    expect(body).toEqual({ error: `controlled ${profile}` });
    expect(fixture.snapshotStats()).toMatchObject({
      searchRequests: 1,
      inFlight: 0,
      maxInFlight: 1,
      responses:
        profile === "429"
          ? { success: 0, rateLimited: 1, serverError: 0 }
          : { success: 0, rateLimited: 0, serverError: 1 },
    });
  });

  it.each([
    ["retired E2 search", "/search", { method: "GET" }],
    ["unknown path", "/missing", undefined],
    ["POST stats", "/__stats", { method: "POST" }],
  ] as const)(
    "rejects %s without attributing a provider request",
    async (_label, pathname, init) => {
      const { baseUrl, fixture } = await startFixture("healthy", 0);

      const response = await fetch(`${baseUrl}${pathname}`, init);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "not found" });
      expect(fixture.snapshotStats()).toMatchObject({
        searchRequests: 0,
        inFlight: 0,
        maxInFlight: 0,
        responses: { success: 0, rateLimited: 0, serverError: 0 },
      });
    },
  );

  it("counts malformed healthy requests as server errors instead of successes", async () => {
    const { baseUrl, fixture } = await startFixture("healthy", 0);

    const response = await fetch(`${baseUrl}/api/v3/search/papers`, {
      method: "POST",
      body: "{malformed",
    });

    expect(response.status).toBe(500);
    expect(fixture.snapshotStats()).toMatchObject({
      searchRequests: 1,
      inFlight: 0,
      responses: { success: 0, rateLimited: 0, serverError: 1 },
    });
  });

  it("rejects request bodies beyond the loopback fixture byte budget", async () => {
    const { baseUrl, fixture } = await startFixture("healthy", 0);

    const response = await fetch(`${baseUrl}/api/v3/search/papers`, {
      method: "POST",
      body: JSON.stringify({ query: "x".repeat(MAX_PROVIDER_FIXTURE_REQUEST_BODY_BYTES) }),
    });

    expect(response.status).toBe(413);
    expect(fixture.snapshotStats()).toMatchObject({
      searchRequests: 1,
      inFlight: 0,
      responses: { success: 0, rateLimited: 0, serverError: 1 },
    });
  });

  it("reports request counts and maximum provider in-flight work", async () => {
    const { baseUrl } = await startFixture("delay", 30);

    await Promise.all(
      Array.from({ length: 3 }, (_unused, index) =>
        fetch(`${baseUrl}/api/v3/search/papers`, {
          method: "POST",
          body: JSON.stringify({ query: { text: `request-${String(index)}` } }),
        }),
      ),
    );
    const stats: unknown = await fetch(`${baseUrl}/__stats`).then((response) => response.json());

    expect(stats).toMatchObject({
      profile: "delay",
      configuredDelayMs: 30,
      configuredPaperCount: DEFAULT_PROVIDER_PAPER_COUNT,
      searchRequests: 3,
      inFlight: 0,
      maxInFlight: 3,
      responses: { success: 3, rateLimited: 0, serverError: 0 },
    });
  });

  it("parses explicit profile, delay, paper count, and loopback port arguments", () => {
    expect(
      parseProviderFixtureArgs([
        "--profile",
        "delay",
        "--delay-ms",
        "700",
        "--paper-count",
        "40",
        "--port",
        "43124",
      ]),
    ).toEqual({ profile: "delay", delayMs: 700, paperCount: 40, port: 43_124, help: false });
    expect(parseProviderFixtureArgs(["--help"])).toEqual({
      profile: "healthy",
      delayMs: 350,
      paperCount: 3,
      port: 43_123,
      help: true,
    });
    expect(parseProviderFixtureArgs(["-h", "--delay-ms", "0", "--port", "65535"])).toMatchObject({
      help: true,
      delayMs: 0,
      port: 65_535,
    });
  });

  it("rejects unsupported profiles and unsafe numeric arguments", () => {
    expect(() => parseProviderFixtureArgs(["--profile", "timeout"])).toThrow(
      "--profile must be one of",
    );
    expect(() => parseProviderFixtureArgs(["--port", "70000"])).toThrow(
      "--port must be at most 65535",
    );
    expect(() => parseProviderFixtureArgs(["--paper-count", "41"])).toThrow(
      "--paper-count must be at most 40",
    );
    for (const args of [
      ["--port", "0"],
      ["--port", "1.5"],
      ["--delay-ms", "-1"],
      ["--delay-ms", "1.5"],
      ["--paper-count", "0"],
      ["--paper-count", "1.5"],
    ]) {
      expect(() => parseProviderFixtureArgs(args)).toThrow();
    }
    expect(() => parseProviderFixtureArgs(["--unknown"])).toThrow("unknown argument");
  });

  it("rejects invalid direct fixture options before opening a server", () => {
    for (const options of [
      { profile: "healthy" as const, delayMs: -1 },
      { profile: "healthy" as const, delayMs: 1.5 },
      { profile: "healthy" as const, paperCount: 0 },
      { profile: "healthy" as const, paperCount: 1.5 },
      { profile: "healthy" as const, paperCount: 41 },
    ]) {
      expect(() => createLoadSmokeProviderFixture(options)).toThrow();
    }
    expect(() => createLoadSmokeProviderFixture({ profile: "healthy", delayMs: 0 })).not.toThrow();
  });
});
