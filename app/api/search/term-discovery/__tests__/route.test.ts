import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchTermDiscoveryCommandV1,
  SEARCH_BACKGROUND_COMMAND_VERSION,
} from "@/app/domain/search-background-transport";
import { UnauthenticatedError } from "@/app/server/auth/auth-errors";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import {
  buildMaximalProducedSearchMetadata,
  buildOversizedSearchMetadata,
} from "../../__tests__/search-metadata-ingress.fixture";

const { requireOwnerPrincipalAuthMock } = vi.hoisted(() => ({
  requireOwnerPrincipalAuthMock: vi.fn(),
}));

const { getOwnedDocumentMock, updateOwnedDocumentMock } = vi.hoisted(() => ({
  getOwnedDocumentMock: vi.fn(),
  updateOwnedDocumentMock: vi.fn(),
}));

const { hydrateSearchMetadataWithCachedInlineAnalysisMock } = vi.hoisted(() => ({
  hydrateSearchMetadataWithCachedInlineAnalysisMock: vi.fn(),
}));

const { observeSearchBackgroundTransportMock } = vi.hoisted(() => ({
  observeSearchBackgroundTransportMock: vi.fn(),
}));

const {
  applyGraphSupportToEnglishTermCandidatesMock,
  projectSearchTermDiscoveryPapersFromCachedMetadataMock,
  runSearchTermDiscoveryOnProjectionMock,
  runSearchTermDiscoveryOnMetadataMock,
  shouldRunSearchTermDiscoveryMock,
} = vi.hoisted(() => ({
  applyGraphSupportToEnglishTermCandidatesMock: vi.fn(),
  projectSearchTermDiscoveryPapersFromCachedMetadataMock: vi.fn(),
  runSearchTermDiscoveryOnProjectionMock: vi.fn(),
  runSearchTermDiscoveryOnMetadataMock: vi.fn(),
  shouldRunSearchTermDiscoveryMock: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth: requireOwnerPrincipalAuthMock,
}));

vi.mock("@/app/server/domain-access/gap-report-access", () => ({
  getOwnedDocument: getOwnedDocumentMock,
  updateOwnedDocument: updateOwnedDocumentMock,
}));

vi.mock("@/app/server/domain-access/inline-analysis-access", () => ({
  hydrateSearchMetadataWithCachedInlineAnalysis: hydrateSearchMetadataWithCachedInlineAnalysisMock,
}));

vi.mock("@/app/server/operational/search-background-transport-observation", () => ({
  observeSearchBackgroundTransport: observeSearchBackgroundTransportMock,
}));

vi.mock("@/app/server/services/search-term-discovery", () => ({
  applyGraphSupportToEnglishTermCandidates: applyGraphSupportToEnglishTermCandidatesMock,
  projectSearchTermDiscoveryPapersFromCachedMetadata:
    projectSearchTermDiscoveryPapersFromCachedMetadataMock,
  runSearchTermDiscoveryOnProjection: runSearchTermDiscoveryOnProjectionMock,
  runSearchTermDiscoveryOnMetadata: runSearchTermDiscoveryOnMetadataMock,
  shouldRunSearchTermDiscovery: shouldRunSearchTermDiscoveryMock,
}));

function searchMetadata(overrides: Partial<SearchMetadata> = {}): SearchMetadata {
  return {
    type: "search",
    query: "AI for Science",
    papers: [
      {
        paperId: "paper-1",
        title: "Paper 1",
        abstract: "Abstract 1",
        year: 2026,
        citationCount: 1,
        url: "https://example.com/paper-1",
        authors: [],
        reviewed: false,
      },
    ],
    total: 1,
    englishTermDiscovery: {
      status: "pending",
      source: "llm",
    },
    ...overrides,
  };
}

function resetRouteMocks(): void {
  vi.clearAllMocks();
  requireOwnerPrincipalAuthMock.mockResolvedValue({
    db: { source: "moonlight-admin-db" },
    user: {
      id: "app-user-1",
      email: "pilot@example.com",
    },
  });
  shouldRunSearchTermDiscoveryMock.mockReturnValue(true);
  hydrateSearchMetadataWithCachedInlineAnalysisMock.mockImplementation(
    (params: { metadata: SearchMetadata }) => Promise.resolve(params.metadata),
  );
  projectSearchTermDiscoveryPapersFromCachedMetadataMock.mockImplementation(
    (metadata: SearchMetadata) => metadata.papers,
  );
}

describe("search term discovery v1 route", () => {
  beforeEach(resetRouteMocks);

  it("returns a v1 term delta from the prompt projection", async () => {
    const initialMetadata = searchMetadata();
    const command = await buildSearchTermDiscoveryCommandV1(initialMetadata);
    const inputFingerprint = command.promptPapers[0]?.inputFingerprint;
    if (!inputFingerprint) throw new Error("expected an exact cache identity");
    const cachedPromptPapers = command.promptPapers.map((paper) => ({
      ...paper,
      semanticProfile: {
        topics: "scientific discovery",
        method: "evaluation",
        claim: null,
        finding: null,
      },
    }));
    projectSearchTermDiscoveryPapersFromCachedMetadataMock.mockReturnValueOnce(cachedPromptPapers);
    const delta = {
      englishTermCandidates: [],
      englishTermDiscovery: {
        status: "ready" as const,
        source: "llm" as const,
        generatedAt: "2026-08-05T00:00:00.000Z",
      },
    };
    runSearchTermDiscoveryOnProjectionMock.mockResolvedValueOnce(delta);
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/api/search/term-discovery", {
        method: "POST",
        body: JSON.stringify(command),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
      target: command.target,
      delta,
      updatedAt: expect.any(String) as unknown,
    });
    expect(runSearchTermDiscoveryOnMetadataMock).not.toHaveBeenCalled();
    expect(hydrateSearchMetadataWithCachedInlineAnalysisMock).toHaveBeenCalledWith({
      db: { source: "moonlight-admin-db" },
      metadata: expect.objectContaining({
        type: "search",
        query: command.target.query,
        total: command.promptPapers.length,
        papers: command.promptPapers.map((paper) => ({
          ...paper,
          citationCount: 0,
          url: "",
          authors: [],
        })),
      }) as unknown,
      signal: expect.any(AbortSignal) as unknown,
      cacheInputFingerprintByPaperId: new Map([["paper-1", inputFingerprint]]),
    });
    expect(runSearchTermDiscoveryOnProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: command.target.query,
        papers: cachedPromptPapers,
      }),
    );
    expect(observeSearchBackgroundTransportMock).toHaveBeenCalledTimes(1);
    expect(observeSearchBackgroundTransportMock).toHaveBeenCalledWith("term_discovery", "v1");
  });
});

describe("search term discovery legacy and boundary route", () => {
  beforeEach(resetRouteMocks);

  it("uses route-owned view auth for Moonlight session callers", async () => {
    const initialMetadata = searchMetadata();
    const computedMetadata = searchMetadata({
      englishTermCandidates: [
        {
          term: "scientific discovery",
          normalizedTerm: "scientific discovery",
          priority: 1,
          supportingPaperIds: ["paper-1"],
          basis: "method signal",
        },
      ] as never,
      englishTermDiscovery: {
        status: "ready",
        source: "llm",
      },
    });
    hydrateSearchMetadataWithCachedInlineAnalysisMock.mockResolvedValue(initialMetadata);
    runSearchTermDiscoveryOnMetadataMock.mockResolvedValue(computedMetadata);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/search/term-discovery", {
        method: "POST",
        body: JSON.stringify({
          query: initialMetadata.query,
          metadata: initialMetadata,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(requireOwnerPrincipalAuthMock).toHaveBeenCalledWith();
    expect(getOwnedDocumentMock).not.toHaveBeenCalled();
    expect(hydrateSearchMetadataWithCachedInlineAnalysisMock).toHaveBeenCalledWith({
      db: { source: "moonlight-admin-db" },
      metadata: initialMetadata,
    });
    const discoveryCall = runSearchTermDiscoveryOnMetadataMock.mock.calls[0]?.[0] as
      | { metadata?: SearchMetadata; phase?: string; usageLedger?: { record?: unknown } }
      | undefined;
    expect(discoveryCall).toMatchObject({
      metadata: initialMetadata,
      phase: "initial",
    });
    expect(typeof discoveryCall?.usageLedger?.record).toBe("function");
    expect(updateOwnedDocumentMock).not.toHaveBeenCalled();
    const payload = (await response.json()) as {
      metadata?: SearchMetadata;
      updatedAt?: string;
    };
    expect(payload.metadata?.englishTermDiscovery).toMatchObject({
      status: "ready",
      source: "llm",
    });
    expect(typeof payload.updatedAt).toBe("string");
    expect(observeSearchBackgroundTransportMock).toHaveBeenCalledTimes(1);
    expect(observeSearchBackgroundTransportMock).toHaveBeenCalledWith("term_discovery", "legacy");
  });

  it("accepts legacy phase and source values at the wire boundary", async () => {
    const legacyMetadata = searchMetadata({
      englishTermDiscovery: {
        status: "pending",
        source: "deterministic_fallback",
        inlineAnalysisApplied: true,
      } as never,
    });
    const computedMetadata = searchMetadata({
      englishTermDiscovery: {
        status: "ready",
        source: "llm",
      },
    });
    hydrateSearchMetadataWithCachedInlineAnalysisMock.mockImplementation(
      (params: { metadata: SearchMetadata }) => Promise.resolve(params.metadata),
    );
    runSearchTermDiscoveryOnMetadataMock.mockResolvedValue(computedMetadata);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/search/term-discovery", {
        method: "POST",
        body: JSON.stringify({
          query: legacyMetadata.query,
          metadata: legacyMetadata,
          phase: "analysis_upgrade",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const discoveryCall = runSearchTermDiscoveryOnMetadataMock.mock.calls[0]?.[0] as
      | { metadata?: SearchMetadata; phase?: string }
      | undefined;
    expect(discoveryCall?.phase).toBe("initial");
    expect(discoveryCall?.metadata?.englishTermDiscovery).toMatchObject({
      status: "pending",
    });
    expect(discoveryCall?.metadata?.englishTermDiscovery?.source).not.toBe(
      "deterministic_fallback",
    );
  });

  it("accepts the canonical combined result pool at route ingress", async () => {
    const maximalMetadata = buildMaximalProducedSearchMetadata();
    shouldRunSearchTermDiscoveryMock.mockReturnValueOnce(false);
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/api/search/term-discovery", {
        method: "POST",
        body: JSON.stringify({ query: maximalMetadata.query, metadata: maximalMetadata }),
      }),
    );

    expect(response.status).toBe(200);
    expect(hydrateSearchMetadataWithCachedInlineAnalysisMock).not.toHaveBeenCalled();
    expect(runSearchTermDiscoveryOnMetadataMock).not.toHaveBeenCalled();
  });

  it("rejects one paper beyond the canonical combined result pool", async () => {
    const maximalMetadata = buildMaximalProducedSearchMetadata();
    const oversizedMetadata = buildOversizedSearchMetadata(maximalMetadata);
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/api/search/term-discovery", {
        method: "POST",
        body: JSON.stringify({ query: oversizedMetadata.query, metadata: oversizedMetadata }),
      }),
    );

    expect(response.status).toBe(400);
    expect(hydrateSearchMetadataWithCachedInlineAnalysisMock).not.toHaveBeenCalled();
    expect(runSearchTermDiscoveryOnMetadataMock).not.toHaveBeenCalled();
  });

  it("rejects one byte beyond the route body frontier before DB or LLM work", async () => {
    const { POST } = await import("../route");
    const maxBytes = getRouteBodyLimit("app/api/search/term-discovery/route.ts").maxBytes;

    const response = await POST(
      new Request("http://localhost/api/search/term-discovery", {
        method: "POST",
        body: "{}",
        headers: { "content-length": String(maxBytes + 1) },
      }),
    );

    expect(response.status).toBe(413);
    expect(runSearchTermDiscoveryOnProjectionMock).not.toHaveBeenCalled();
    expect(observeSearchBackgroundTransportMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests before body read, DB hydration, or LLM work", async () => {
    requireOwnerPrincipalAuthMock.mockRejectedValue(new UnauthenticatedError());
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
    expect(hydrateSearchMetadataWithCachedInlineAnalysisMock).not.toHaveBeenCalled();
    expect(runSearchTermDiscoveryOnMetadataMock).not.toHaveBeenCalled();
    expect(observeSearchBackgroundTransportMock).not.toHaveBeenCalled();
  });
});
