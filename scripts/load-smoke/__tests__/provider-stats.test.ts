import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createLoadSmokeProviderFixture, type ProviderFixtureStats } from "../provider-fixture";
import {
  assertCleanProviderFixtureBaseline,
  assertSafeProviderStatsUrl,
  buildProviderFixtureEvidence,
  parseProviderFixtureStats,
  readProviderFixtureStats,
  validateProviderFixtureEvidence,
} from "../provider-stats";

const activeServers: Server[] = [];

function emptyStats(overrides: Partial<ProviderFixtureStats> = {}): ProviderFixtureStats {
  return {
    profile: "healthy",
    configuredDelayMs: 0,
    configuredPaperCount: 3,
    searchRequests: 0,
    inFlight: 0,
    maxInFlight: 0,
    responses: { success: 0, rateLimited: 0, serverError: 0 },
    ...overrides,
  };
}

async function startFixture() {
  const fixture = createLoadSmokeProviderFixture({ profile: "healthy", paperCount: 3 });
  activeServers.push(fixture.server);
  await new Promise<void>((resolve, reject) => {
    fixture.server.once("error", reject);
    fixture.server.listen(0, "127.0.0.1", resolve);
  });
  const address = fixture.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${String(address.port)}`;
  return { baseUrl, statsUrl: `${baseUrl}/__stats` };
}

function searchFixture(baseUrl: string, query: string): Promise<Response> {
  return fetch(`${baseUrl}/api/v3/search/papers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: { text: query }, page: { size: 3 } }),
  });
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

describe("load-smoke provider stats binding", () => {
  it("binds a fresh fixture window and derives request amplification", async () => {
    const { baseUrl, statsUrl } = await startFixture();
    const baseline = await readProviderFixtureStats(statsUrl);
    assertCleanProviderFixtureBaseline(baseline);

    await Promise.all([searchFixture(baseUrl, "first"), searchFixture(baseUrl, "followup")]);
    const final = await readProviderFixtureStats(statsUrl);
    const evidence = buildProviderFixtureEvidence(statsUrl, baseline, final, 1);

    expect(evidence).toMatchObject({
      source: "loopback-provider-fixture",
      attribution: "zero-baseline",
      completedJourneys: 1,
      requestsPerCompletedJourney: 2,
      final: {
        profile: "healthy",
        configuredPaperCount: 3,
        searchRequests: 2,
        inFlight: 0,
        responses: { success: 2, rateLimited: 0, serverError: 0 },
      },
    });
    expect(() => {
      validateProviderFixtureEvidence(evidence);
    }).not.toThrow();
  });

  it("rejects a reused fixture because its provider calls cannot be attributed", async () => {
    const { baseUrl, statsUrl } = await startFixture();
    await searchFixture(baseUrl, "stale");

    await expect(readProviderFixtureStats(statsUrl)).resolves.toMatchObject({ searchRequests: 1 });
    expect(() => {
      assertCleanProviderFixtureBaseline({
        profile: "healthy",
        configuredDelayMs: 350,
        configuredPaperCount: 3,
        searchRequests: 1,
        inFlight: 0,
        maxInFlight: 1,
        responses: { success: 1, rateLimited: 0, serverError: 0 },
      });
    }).toThrow("fresh zero baseline");
  });

  it("rejects every non-zero baseline counter independently", () => {
    for (const stale of [
      emptyStats({ searchRequests: 1 }),
      emptyStats({ inFlight: 1 }),
      emptyStats({ maxInFlight: 1 }),
      emptyStats({ responses: { success: 1, rateLimited: 0, serverError: 0 } }),
      emptyStats({ responses: { success: 0, rateLimited: 1, serverError: 0 } }),
      emptyStats({ responses: { success: 0, rateLimited: 0, serverError: 1 } }),
    ]) {
      expect(() => {
        assertCleanProviderFixtureBaseline(stale);
      }).toThrow("fresh zero baseline");
    }
  });

  it("rejects a non-successful stats response before parsing its body", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "unavailable" }));
    });
    activeServers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;

    await expect(
      readProviderFixtureStats(`http://127.0.0.1:${String(address.port)}/__stats`),
    ).rejects.toThrow("provider fixture stats returned HTTP 503");
  });

  it("accepts only the exact loopback HTTP stats endpoint", () => {
    expect(assertSafeProviderStatsUrl("http://127.0.0.1:43123/__stats")).toBe(
      "http://127.0.0.1:43123/__stats",
    );
    expect(() => assertSafeProviderStatsUrl("https://127.0.0.1:43123/__stats")).toThrow(
      "HTTP on a loopback host",
    );
    expect(() => assertSafeProviderStatsUrl("http://example.com/__stats")).toThrow(
      "HTTP on a loopback host",
    );
    expect(() => assertSafeProviderStatsUrl("http://127.0.0.1:43123/search")).toThrow(
      "fixture /__stats endpoint exactly",
    );
    for (const url of [
      "not-a-url",
      "http://127.0.0.1:43123/__stats?stale=1",
      "http://127.0.0.1:43123/__stats#fragment",
      "http://user:secret@127.0.0.1:43123/__stats",
    ]) {
      expect(() => assertSafeProviderStatsUrl(url)).toThrow();
    }
  });

  it("rejects malformed or internally inconsistent fixture stats", () => {
    expect(() => parseProviderFixtureStats({ profile: "healthy" })).toThrow(
      "responses must be an object",
    );
    const baseline = {
      profile: "healthy" as const,
      configuredDelayMs: 350,
      configuredPaperCount: 3,
      searchRequests: 0,
      inFlight: 0,
      maxInFlight: 0,
      responses: { success: 0, rateLimited: 0, serverError: 0 },
    };
    expect(() =>
      buildProviderFixtureEvidence(
        "http://127.0.0.1:43123/__stats",
        baseline,
        {
          ...baseline,
          searchRequests: 2,
          maxInFlight: 1,
          responses: { success: 1, rateLimited: 0, serverError: 0 },
        },
        1,
      ),
    ).toThrow("internally inconsistent");
  });

  it("rejects malformed identity and counter fields before building evidence", () => {
    for (const malformed of [
      null,
      [],
      { ...emptyStats(), profile: "timeout" },
      { ...emptyStats(), configuredDelayMs: -1 },
      { ...emptyStats(), configuredPaperCount: 0 },
      { ...emptyStats(), searchRequests: 1.5 },
      { ...emptyStats(), inFlight: -1 },
      { ...emptyStats(), maxInFlight: -1 },
      { ...emptyStats(), responses: null },
      { ...emptyStats(), responses: [] },
      { ...emptyStats(), responses: { success: -1, rateLimited: 0, serverError: 0 } },
      { ...emptyStats(), responses: { success: 0, rateLimited: 0.5, serverError: 0 } },
    ]) {
      expect(() => parseProviderFixtureStats(malformed)).toThrow();
    }
  });

  it("rejects changed fixture identity, unfinished work, and impossible counters", () => {
    const baseline = emptyStats();
    const final = emptyStats({
      searchRequests: 2,
      maxInFlight: 1,
      responses: { success: 2, rateLimited: 0, serverError: 0 },
    });

    for (const changed of [
      { ...final, profile: "delay" as const },
      { ...final, configuredDelayMs: 1 },
      { ...final, configuredPaperCount: 2 },
    ]) {
      expect(() =>
        buildProviderFixtureEvidence("http://127.0.0.1:43123/__stats", baseline, changed, 1),
      ).toThrow("configuration changed");
    }
    for (const inconsistent of [
      { ...final, inFlight: 1 },
      { ...final, responses: { success: 1, rateLimited: 0, serverError: 0 } },
      { ...final, maxInFlight: 3 },
      {
        ...final,
        maxInFlight: 0,
      },
    ]) {
      expect(() =>
        buildProviderFixtureEvidence("http://127.0.0.1:43123/__stats", baseline, inconsistent, 1),
      ).toThrow("internally inconsistent");
    }
    for (const completedJourneys of [0, 1.5]) {
      expect(() =>
        buildProviderFixtureEvidence(
          "http://127.0.0.1:43123/__stats",
          baseline,
          final,
          completedJourneys,
        ),
      ).toThrow("positive completedJourneys");
    }
  });

  it("rejects forged source, attribution, and amplification fields", () => {
    const baseline = emptyStats();
    const final = emptyStats({
      searchRequests: 2,
      maxInFlight: 1,
      responses: { success: 2, rateLimited: 0, serverError: 0 },
    });
    const evidence = buildProviderFixtureEvidence(
      "http://127.0.0.1:43123/__stats",
      baseline,
      final,
      1,
    );

    for (const forged of [
      { ...evidence, source: "external-provider" },
      { ...evidence, attribution: "reused-baseline" },
      { ...evidence, requestsPerCompletedJourney: 1 },
    ]) {
      expect(() => {
        validateProviderFixtureEvidence(forged as typeof evidence);
      }).toThrow("derived fields are inconsistent");
    }
  });

  it("accepts boundary-consistent failure counts and derives a non-unit amplification ratio", () => {
    const baseline = emptyStats();
    const oneRequest = emptyStats({
      searchRequests: 1,
      maxInFlight: 1,
      responses: { success: 0, rateLimited: 1, serverError: 0 },
    });
    expect(() =>
      buildProviderFixtureEvidence("http://127.0.0.1:43123/__stats", baseline, oneRequest, 1),
    ).not.toThrow();
    expect(() =>
      buildProviderFixtureEvidence("http://127.0.0.1:43123/__stats", baseline, emptyStats(), 1),
    ).not.toThrow();

    const amplified = buildProviderFixtureEvidence(
      "http://127.0.0.1:43123/__stats",
      baseline,
      emptyStats({
        searchRequests: 4,
        maxInFlight: 2,
        responses: { success: 2, rateLimited: 1, serverError: 1 },
      }),
      2,
    );
    expect(amplified.requestsPerCompletedJourney).toBe(2);
  });
});
