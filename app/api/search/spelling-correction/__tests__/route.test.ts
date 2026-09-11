import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchSpellingCorrectionCommandV1,
  SEARCH_BACKGROUND_COMMAND_VERSION,
} from "@/app/domain/search-background-transport";
import { UnauthenticatedError } from "@/app/server/auth/auth-errors";
import { __resetRouteIngressAdmissionForTests } from "@/app/server/operational/route-ingress-admission";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import {
  buildMaximalProducedSearchMetadata,
  buildOversizedSearchMetadata,
} from "../../__tests__/search-metadata-ingress.fixture";

const { requireOwnerPrincipalAuth, resolveSearchSpellingCorrection } = vi.hoisted(() => ({
  requireOwnerPrincipalAuth: vi.fn(),
  resolveSearchSpellingCorrection: vi.fn(),
}));
const { observeSearchBackgroundTransport } = vi.hoisted(() => ({
  observeSearchBackgroundTransport: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth,
}));

vi.mock("@/app/server/services/search-spelling-correction-service", () => ({
  resolveSearchSpellingCorrection,
}));

vi.mock("@/app/server/operational/search-background-transport-observation", () => ({
  observeSearchBackgroundTransport,
}));

const metadata: SearchMetadata = {
  type: "search",
  query: "langauge model",
  papers: [],
  total: 0,
};

function request(body: BodyInit, headers?: HeadersInit): Request {
  return new Request("https://lighthouse.example.com/api/search/spelling-correction", {
    method: "POST",
    body,
    headers,
  });
}

describe("spelling correction route ingress", () => {
  beforeEach(() => {
    __resetRouteIngressAdmissionForTests();
    requireOwnerPrincipalAuth.mockReset();
    resolveSearchSpellingCorrection.mockReset();
    observeSearchBackgroundTransport.mockReset();
    requireOwnerPrincipalAuth.mockResolvedValue({
      db: {},
      source: "moonlight_scholar",
      user: { id: "principal-1", email: "pilot@example.com" },
    });
    resolveSearchSpellingCorrection.mockResolvedValue(null);
  });

  it("returns 401 before touching an unauthenticated request body or LLM", async () => {
    requireOwnerPrincipalAuth.mockRejectedValue(new UnauthenticatedError());
    let bodyRead = false;
    const unreadableRequest = {
      headers: new Headers(),
      signal: new AbortController().signal,
      get body() {
        bodyRead = true;
        throw new Error("body should not be read");
      },
    } as unknown as Request;
    const { POST } = await import("../route");

    const response = await POST(unreadableRequest);

    expect(response.status).toBe(401);
    expect(bodyRead).toBe(false);
    expect(resolveSearchSpellingCorrection).not.toHaveBeenCalled();
    expect(observeSearchBackgroundTransport).not.toHaveBeenCalled();
  });

  it("distinguishes malformed JSON as 400 and oversized transport as 413", async () => {
    const { POST } = await import("../route");

    const malformed = await POST(request("{"));
    const oversized = await POST(
      request("{}", {
        "content-length": "524289",
      }),
    );

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(413);
    expect(resolveSearchSpellingCorrection).not.toHaveBeenCalled();
    expect(observeSearchBackgroundTransport).not.toHaveBeenCalled();
  });

  it("returns 429 after validation but before invoking more LLM work", async () => {
    const { POST } = await import("../route");
    for (let index = 0; index < 12; index += 1) {
      const response = await POST(request(JSON.stringify({ query: metadata.query, metadata })));
      expect(response.status).toBe(200);
    }
    const response = await POST(request(JSON.stringify({ query: metadata.query, metadata })));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({
      code: "SEARCH_SPELLING_CORRECTION_RATE_LIMITED",
      error: "spelling correction request limit exceeded",
    });
    expect(resolveSearchSpellingCorrection).toHaveBeenCalledTimes(12);
    expect(observeSearchBackgroundTransport).toHaveBeenCalledTimes(13);
    expect(observeSearchBackgroundTransport).toHaveBeenCalledWith("spelling_correction", "legacy");
  });

  it.each([
    ["missing fields", {}],
    ["blank query", { query: " ", metadata }],
    ["oversized query", { query: "q".repeat(501), metadata }],
    ["unknown field", { query: metadata.query, metadata, unexpected: true }],
  ] as const)("rejects %s before admission or LLM work", async (_label, payload) => {
    const { POST } = await import("../route");

    const response = await POST(request(JSON.stringify(payload)));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "SEARCH_SPELLING_CORRECTION_INVALID",
      error: "invalid spelling correction payload",
    });
    expect(resolveSearchSpellingCorrection).not.toHaveBeenCalled();
    expect(observeSearchBackgroundTransport).not.toHaveBeenCalled();
  });

  it("returns null without LLM work when the request query differs from the snapshot", async () => {
    const { POST } = await import("../route");

    const response = await POST(request(JSON.stringify({ query: "different query", metadata })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ correctedQuery: null });
    expect(resolveSearchSpellingCorrection).not.toHaveBeenCalled();
    expect(observeSearchBackgroundTransport).toHaveBeenCalledTimes(1);
    expect(observeSearchBackgroundTransport).toHaveBeenCalledWith("spelling_correction", "legacy");
  });

  it("recovers an existing snapshot correction without more LLM work", async () => {
    const correctedMetadata: SearchMetadata = {
      ...metadata,
      spellingCorrection: {
        originalQuery: metadata.query,
        correctedQuery: "language model",
      },
    };
    const { POST } = await import("../route");

    const response = await POST(
      request(JSON.stringify({ query: metadata.query, metadata: correctedMetadata })),
    );

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      correctedQuery: "language model",
      metadata: correctedMetadata,
    });
    expect(typeof (body as { updatedAt?: unknown }).updatedAt).toBe("string");
    expect(resolveSearchSpellingCorrection).not.toHaveBeenCalled();
  });

  it("returns null when the LLM finds no correction", async () => {
    const { POST } = await import("../route");

    const response = await POST(request(JSON.stringify({ query: metadata.query, metadata })));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ correctedQuery: null });
    expect(resolveSearchSpellingCorrection).toHaveBeenCalledWith(
      metadata.query,
      expect.any(AbortSignal),
    );
  });

  it("returns a v1 correction delta without full metadata", async () => {
    resolveSearchSpellingCorrection.mockResolvedValueOnce("language model");
    const command = buildSearchSpellingCorrectionCommandV1(metadata.query);
    const { POST } = await import("../route");

    const response = await POST(request(JSON.stringify(command)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
      target: command.target,
      delta: {
        spellingCorrection: {
          originalQuery: metadata.query,
          correctedQuery: "language model",
        },
      },
      updatedAt: expect.any(String) as unknown,
    });
    expect(observeSearchBackgroundTransport).toHaveBeenCalledTimes(1);
    expect(observeSearchBackgroundTransport).toHaveBeenCalledWith("spelling_correction", "v1");
  });

  it("accepts the canonical combined result pool at route ingress", async () => {
    const maximalMetadata = buildMaximalProducedSearchMetadata();
    const body = JSON.stringify({ query: maximalMetadata.query, metadata: maximalMetadata });
    expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(
      getRouteBodyLimit("app/api/search/spelling-correction/route.ts").maxBytes,
    );
    const { POST } = await import("../route");

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(resolveSearchSpellingCorrection).toHaveBeenCalledWith(
      maximalMetadata.query,
      expect.any(AbortSignal),
    );
  });

  it("rejects one paper beyond the canonical combined result pool", async () => {
    const maximalMetadata = buildMaximalProducedSearchMetadata();
    const oversizedMetadata = buildOversizedSearchMetadata(maximalMetadata);
    const { POST } = await import("../route");

    const response = await POST(
      request(JSON.stringify({ query: oversizedMetadata.query, metadata: oversizedMetadata })),
    );

    expect(response.status).toBe(400);
    expect(resolveSearchSpellingCorrection).not.toHaveBeenCalled();
  });

  it("returns the correction and updated snapshot from one admitted LLM call", async () => {
    resolveSearchSpellingCorrection.mockResolvedValueOnce("language model");
    const { POST } = await import("../route");

    const response = await POST(request(JSON.stringify({ query: metadata.query, metadata })));

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      correctedQuery: "language model",
      metadata: {
        ...metadata,
        spellingCorrection: {
          originalQuery: metadata.query,
          correctedQuery: "language model",
        },
      },
    });
    expect(typeof (body as { updatedAt?: unknown }).updatedAt).toBe("string");
    expect(resolveSearchSpellingCorrection).toHaveBeenCalledTimes(1);
  });
});
