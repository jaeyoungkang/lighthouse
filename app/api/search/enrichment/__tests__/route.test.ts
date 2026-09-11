import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchEnrichmentCommandV1,
  SEARCH_BACKGROUND_COMMAND_VERSION,
} from "@/app/domain/search-background-transport";
import { UnauthenticatedError } from "@/app/server/auth/auth-errors";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import {
  buildMaximalProducedSearchMetadata,
  buildOversizedSearchMetadata,
} from "../../__tests__/search-metadata-ingress.fixture";

const { enrichSearchCommand, enrichSearchSnapshot, requireOwnerPrincipalAuth } = vi.hoisted(() => ({
  enrichSearchCommand: vi.fn(),
  enrichSearchSnapshot: vi.fn(),
  requireOwnerPrincipalAuth: vi.fn(),
}));
const { observeSearchBackgroundTransport } = vi.hoisted(() => ({
  observeSearchBackgroundTransport: vi.fn(),
}));

vi.mock("@/app/server/domain-access/search-enrichment-access", () => ({
  enrichSearchCommand,
  enrichSearchSnapshot,
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth,
}));

vi.mock("@/app/server/operational/search-background-transport-observation", () => ({
  observeSearchBackgroundTransport,
}));

const authContext = {
  db: {},
  source: "moonlight_scholar",
  user: { id: "principal-1", email: "pilot@example.com" },
} as const;

const metadata: SearchMetadata = {
  type: "search",
  query: "graph retrieval",
  total: 1,
  papers: [
    {
      paperId: "paper-1",
      title: "Graph Retrieval",
      abstract: "abstract",
      year: 2025,
      citationCount: 3,
      url: "https://example.com/paper-1",
      authors: [{ name: "Author 1" }],
      referenceIds: [],
      citationIds: [],
    },
  ],
};

describe("stateless search enrichment route", () => {
  beforeEach(() => {
    enrichSearchSnapshot.mockReset();
    enrichSearchCommand.mockReset();
    requireOwnerPrincipalAuth.mockReset();
    observeSearchBackgroundTransport.mockReset();
    requireOwnerPrincipalAuth.mockResolvedValue(authContext);
  });

  it("returns a v1 delta for the route-specific command", async () => {
    const command = buildSearchEnrichmentCommandV1(metadata);
    const result = {
      schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
      target: command.target,
      delta: {
        papers: [{ paperId: "paper-1", abstract: "abstract", authors: [{ name: "Author 1" }] }],
        abstractHydration: { status: "ready" as const },
      },
      updatedAt: "2026-08-05T00:00:00.000Z",
    };
    enrichSearchCommand.mockResolvedValueOnce(result);
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/api/search/enrichment", {
        method: "POST",
        body: JSON.stringify(command),
      }),
    );

    expect(response.status).toBe(200);
    expect(enrichSearchCommand).toHaveBeenCalledWith(command, expect.any(AbortSignal), authContext);
    await expect(response.json()).resolves.toEqual(result);
    expect(enrichSearchSnapshot).not.toHaveBeenCalled();
    expect(observeSearchBackgroundTransport).toHaveBeenCalledTimes(1);
    expect(observeSearchBackgroundTransport).toHaveBeenCalledWith("enrichment", "v1");
  });

  it("enriches a route-owned search snapshot without a persisted route payload id", async () => {
    const result = {
      metadata: {
        ...metadata,
        graphSupport: {
          status: "ready" as const,
          samplePaperIds: ["paper-1"],
          edges: [],
        },
      },
      updatedAt: "2026-07-05T00:00:00.000Z",
      hadSignal: false,
    };
    enrichSearchSnapshot.mockResolvedValueOnce(result);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/search/enrichment", {
        method: "POST",
        body: JSON.stringify({
          query: "graph retrieval",
          metadata,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(enrichSearchSnapshot).toHaveBeenCalledWith(
      {
        query: "graph retrieval",
        metadata,
      },
      expect.any(AbortSignal),
      authContext,
    );
    expect(await response.json()).toEqual(result);
    expect(observeSearchBackgroundTransport).toHaveBeenCalledTimes(1);
    expect(observeSearchBackgroundTransport).toHaveBeenCalledWith("enrichment", "legacy");
  });

  it("accepts the canonical combined result pool at route ingress", async () => {
    const maximalMetadata = buildMaximalProducedSearchMetadata();
    const result = {
      metadata: maximalMetadata,
      updatedAt: "2026-08-05T00:00:00.000Z",
      hadSignal: false,
    };
    enrichSearchSnapshot.mockResolvedValueOnce(result);
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/api/search/enrichment", {
        method: "POST",
        body: JSON.stringify({ query: maximalMetadata.query, metadata: maximalMetadata }),
      }),
    );

    expect(response.status).toBe(200);
    expect(enrichSearchSnapshot).toHaveBeenCalledWith(
      { query: maximalMetadata.query, metadata: maximalMetadata },
      expect.any(AbortSignal),
      authContext,
    );
  });

  it("rejects one paper beyond the canonical combined result pool", async () => {
    const maximalMetadata = buildMaximalProducedSearchMetadata();
    const oversizedMetadata = buildOversizedSearchMetadata(maximalMetadata);
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/api/search/enrichment", {
        method: "POST",
        body: JSON.stringify({ query: oversizedMetadata.query, metadata: oversizedMetadata }),
      }),
    );

    expect(response.status).toBe(400);
    expect(enrichSearchSnapshot).not.toHaveBeenCalled();
    expect(observeSearchBackgroundTransport).not.toHaveBeenCalled();
  });

  it("rejects payloads without snapshot metadata", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/search/enrichment", {
        method: "POST",
        body: JSON.stringify({ documentId: "search-1" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(enrichSearchSnapshot).not.toHaveBeenCalled();
  });

  it("rejects one byte beyond the route body frontier before enrichment work", async () => {
    const { POST } = await import("../route");
    const maxBytes = getRouteBodyLimit("app/api/search/enrichment/route.ts").maxBytes;

    const response = await POST(
      new Request("http://localhost/api/search/enrichment", {
        method: "POST",
        body: "{}",
        headers: { "content-length": String(maxBytes + 1) },
      }),
    );

    expect(response.status).toBe(413);
    expect(enrichSearchCommand).not.toHaveBeenCalled();
    expect(enrichSearchSnapshot).not.toHaveBeenCalled();
    expect(observeSearchBackgroundTransport).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests before body read or enrichment work", async () => {
    requireOwnerPrincipalAuth.mockRejectedValue(new UnauthenticatedError());
    let bodyRead = false;
    const request = {
      headers: new Headers(),
      signal: new AbortController().signal,
      get body() {
        bodyRead = true;
        throw new Error("body should not be read");
      },
    } as unknown as Request;
    const { POST } = await import("../route");

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(bodyRead).toBe(false);
    expect(enrichSearchSnapshot).not.toHaveBeenCalled();
    expect(observeSearchBackgroundTransport).not.toHaveBeenCalled();
  });
});
