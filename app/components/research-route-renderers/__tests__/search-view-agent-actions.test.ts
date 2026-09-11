import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildGapReportCreationRequest,
  openGapNetworkFromSearchView,
} from "@/app/components/research-route-renderers/search-view-agent-actions";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";
import {
  GAP_REPORT_REQUEST_MAX_BYTES,
  serializeGapReportRequest,
  utf8ByteLength,
} from "@/app/lib/gap-report-input-budget";

function createDetachedWindowMock(options: { assignFails?: boolean; openerFails?: boolean } = {}) {
  const detachedWindow = {
    close: vi.fn(),
    location: {
      assign: options.assignFails
        ? vi.fn(() => {
            throw new Error("assign failed");
          })
        : vi.fn(),
    },
    opener: window,
  } as unknown as Window & {
    close: ReturnType<typeof vi.fn>;
    location: { assign: ReturnType<typeof vi.fn> };
  };
  if (options.openerFails) {
    Object.defineProperty(detachedWindow, "opener", {
      configurable: true,
      get: () => window,
      set: () => {
        throw new Error("opener failed");
      },
    });
  }
  return {
    detachedWindow,
    close: detachedWindow.close,
    assign: detachedWindow.location.assign,
  };
}

function createSearchMetadata(paperCount: number): SearchMetadata {
  return {
    type: "search",
    query: "agent memory",
    total: paperCount,
    papers: Array.from({ length: paperCount }, (_unused, index) => ({
      paperId: `paper-${String(index + 1)}`,
      title: `Paper ${String(index + 1)}`,
      abstract: `abstract ${String(index + 1)}`,
      year: 2024,
      citationCount: paperCount - index,
      url: `https://example.com/paper-${String(index + 1)}`,
      authors: [{ name: "Alice" }],
    })),
  };
}

function createSearchView(metadata: SearchMetadata): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "검색: agent memory",
    content: "",
    createdBy: "user",
    metadata,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
  };
}

function createFetchMockWithGapReport(gapReportId: string) {
  return vi.fn<typeof fetch>((input) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url === "/api/gap-reports") {
      return Promise.resolve(
        new Response(JSON.stringify({ gapReportId, status: "pending" }), {
          status: 202,
        }),
      );
    }
    return Promise.resolve(new Response(null, { status: 204 }));
  });
}

describe("search ResearchRoutePayload gap-network action", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens the created gap report in a new window by default", async () => {
    const metadata = createSearchMetadata(3);
    const fetchMock = createFetchMockWithGapReport("gap-report-1");
    vi.stubGlobal("fetch", fetchMock);
    const { detachedWindow, assign, close } = createDetachedWindowMock();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(detachedWindow);

    openGapNetworkFromSearchView(createSearchView(metadata), metadata);

    expect(openSpy).toHaveBeenCalledWith("/gap?opening=1", "_blank");

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(assign).toHaveBeenCalledWith("/gap/gap-report-1");
    expect(close).not.toHaveBeenCalled();
  });

  it("keeps the source surface pending only while gap report creation is in flight", async () => {
    const metadata = createSearchMetadata(3);
    let resolveFetch: (response: Response | PromiseLike<Response>) => void = () => {
      throw new Error("fetch resolver was not initialized");
    };
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const { detachedWindow } = createDetachedWindowMock();
    vi.spyOn(window, "open").mockReturnValue(detachedWindow);
    const pendingStates: boolean[] = [];

    openGapNetworkFromSearchView(createSearchView(metadata), metadata, undefined, undefined, {
      onPendingChange: (isPending) => {
        pendingStates.push(isPending);
      },
    });

    expect(pendingStates).toEqual([true]);
    resolveFetch(
      new Response(JSON.stringify({ gapReportId: "gap-report-1", status: "pending" }), {
        status: 202,
      }),
    );

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(pendingStates).toEqual([true, false]);
  });

  it("falls back without retaining opener when detached target cannot clear opener", async () => {
    const metadata = createSearchMetadata(3);
    const fetchMock = createFetchMockWithGapReport("gap-report-1");
    vi.stubGlobal("fetch", fetchMock);
    const { detachedWindow, close } = createDetachedWindowMock({ openerFails: true });
    const openSpy = vi
      .spyOn(window, "open")
      .mockReturnValueOnce(detachedWindow)
      .mockReturnValue(null);

    openGapNetworkFromSearchView(createSearchView(metadata), metadata);

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenNthCalledWith(1, "/gap?opening=1", "_blank");
    expect(openSpy).toHaveBeenNthCalledWith(
      2,
      "/gap/gap-report-1",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("closes the detached target and falls back when target navigation fails", async () => {
    const metadata = createSearchMetadata(3);
    const fetchMock = createFetchMockWithGapReport("gap-report-1");
    vi.stubGlobal("fetch", fetchMock);
    const { detachedWindow, close } = createDetachedWindowMock({ assignFails: true });
    const openSpy = vi
      .spyOn(window, "open")
      .mockReturnValueOnce(detachedWindow)
      .mockReturnValue(null);

    openGapNetworkFromSearchView(createSearchView(metadata), metadata);

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenNthCalledWith(1, "/gap?opening=1", "_blank");
    expect(openSpy).toHaveBeenNthCalledWith(
      2,
      "/gap/gap-report-1",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("closes the detached target when gap report creation fails", async () => {
    const metadata = createSearchMetadata(3);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response(JSON.stringify({ error: "failed" }), { status: 500 })),
      ),
    );
    const { detachedWindow, close } = createDetachedWindowMock();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(detachedWindow);

    openGapNetworkFromSearchView(createSearchView(metadata), metadata);

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("serializes only the top 40 scoped source papers into the snapshot creation request", async () => {
    const metadata = createSearchMetadata(45);
    metadata.papers[0] = {
      ...metadata.papers[0],
      reviewed: true,
      reviewedAt: "2026-07-12T00:00:00.000Z",
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        source: "abstract",
        analysis: {
          summary: "viewer summary",
          objective: "viewer claim",
          methodology: "viewer method",
          results: "viewer finding",
          keywords: ["private"],
          semanticProfile: {
            claim: "viewer claim",
            topics: ["private"],
            method: "viewer method",
            finding: "viewer finding",
            quotedBasis: {
              claim: null,
              topics: [],
              method: null,
              finding: null,
            },
          },
          confidence: "high",
          evidenceMap: {},
        },
      },
    };
    const navigate = vi.fn();
    const fetchMock = createFetchMockWithGapReport("gap-report-1");
    vi.stubGlobal("fetch", fetchMock);

    openGapNetworkFromSearchView(
      createSearchView(metadata),
      metadata,
      navigate,
      metadata.papers.map((paper) => paper.paperId),
    );

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gap-reports",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const gapRequest = fetchMock.mock.calls.find(([url]) => url === "/api/gap-reports");
    expect(gapRequest).toBeDefined();
    const requestInit = gapRequest?.[1];
    if (typeof requestInit?.body !== "string") {
      throw new Error("gap-network request body missing");
    }
    const requestBody = JSON.parse(requestInit.body) as {
      sourcePaperIds: string[];
      papers: unknown[];
      sort?: unknown;
      year?: unknown;
    };
    expect(requestBody.sourcePaperIds).toHaveLength(40);
    expect(requestBody.sourcePaperIds[0]).toBe("paper-1");
    expect(requestBody.sourcePaperIds[39]).toBe("paper-40");
    expect(requestBody.sourcePaperIds).not.toContain("paper-41");
    expect(requestBody.papers).toHaveLength(40);
    expect(requestBody.papers[0]).not.toHaveProperty("reviewed");
    expect(requestBody.papers[0]).not.toHaveProperty("reviewedAt");
    expect(requestBody.papers[0]).not.toHaveProperty("inlineAnalysis");
    expect(requestBody).not.toHaveProperty("sort");
    expect(requestBody).not.toHaveProperty("year");
    expect(navigate).toHaveBeenCalledWith("/gap/gap-report-1");
  });
});

describe("gap report request normalization", () => {
  it("normalizes exceptional graph-neighbor metadata before it reaches the gap route", () => {
    const metadata = createSearchMetadata(2);
    metadata.papers[0] = {
      ...metadata.papers[0],
      authors: Array.from({ length: 101 }, (_, index) => ({ name: `Author ${String(index)}` })),
      openAccessPdf: { url: "https://example.com/private.pdf" },
      doi: "10.1000/output-inert",
    };
    metadata.papers.push({ ...metadata.papers[0], title: "duplicate provider row" });
    metadata.graphSupport = {
      version: 2,
      source: "episteme-paper-neighborhood",
      basis: "graph_neighbor_snapshot",
      status: "ready",
      samplePaperIds: ["paper-1", "paper-1", "paper-2"],
      paperScores: {
        "paper-1": {
          defaultScore: 10,
          graphScore: 10,
          semanticScore: null,
          sharedCiters: 10,
          sharedRefs: 5,
          seedCount: 2,
          sources: ["co-cited:seed", "co-cited:seed", "coupled:seed"],
        },
        "paper-2": {
          defaultScore: 8,
          graphScore: 8,
          semanticScore: null,
          sharedCiters: 4,
          sharedRefs: 2,
          seedCount: 1,
          sources: ["co-cited:seed"],
        },
      },
      generatedAt: "2026-07-14T00:00:00.000Z",
    };

    const body = buildGapReportCreationRequest(createSearchView(metadata), metadata);

    expect(body.papers).toHaveLength(2);
    expect(body.papers[0]).toMatchObject({ authors: [], openAccessPdf: null, doi: null });
    expect(body.graphSupport?.samplePaperIds).toEqual(["paper-1", "paper-2"]);
    expect(body.graphSupport?.paperScores["paper-1"]?.sources).toHaveLength(2);
    expect(new Set(body.graphSupport?.paperScores["paper-1"]?.sources).size).toBe(2);
    expect(body.graphSupport?.paperScores["paper-2"]?.sources).toEqual(["__gap_source_1"]);
  });

  it("keeps the maximum production snapshot envelope inside the UTF-8 route budget", () => {
    const metadata = createSearchMetadata(40);
    metadata.query = "질의".repeat(1_000);
    metadata.papers = metadata.papers.map((paper, index) => ({
      ...paper,
      title: "제목".repeat(2_000),
      abstract: "초록".repeat(5_000),
      url: `https://example.com/${"u".repeat(3_000)}`,
      authors: Array.from({ length: 101 }, (_, authorIndex) => ({
        name: `Author ${String(authorIndex)}`,
      })),
      referenceIds: Array.from(
        { length: 1_000 },
        (_, relationIndex) => `참고-${String(index)}-${String(relationIndex)}-${"가".repeat(100)}`,
      ),
      citationIds: Array.from(
        { length: 1_000 },
        (_, relationIndex) => `인용-${String(index)}-${String(relationIndex)}-${"나".repeat(100)}`,
      ),
    }));
    metadata.graphSupport = {
      version: 2,
      source: "episteme-paper-neighborhood",
      basis: "graph_neighbor_snapshot",
      status: "ready",
      samplePaperIds: metadata.papers.map((paper) => paper.paperId),
      paperScores: Object.fromEntries(
        metadata.papers.map((paper, paperIndex) => [
          paper.paperId,
          {
            defaultScore: 10,
            graphScore: 10,
            semanticScore: null,
            sharedCiters: 10,
            sharedRefs: 5,
            seedCount: 2,
            sources: Array.from(
              { length: 150 },
              (_, sourceIndex) =>
                `출처-${String(paperIndex)}-${String(sourceIndex)}-${"다".repeat(100)}`,
            ),
          },
        ]),
      ),
      generatedAt: "2026-07-14T00:00:00.000Z".repeat(10),
    };

    const serialized = serializeGapReportRequest(
      buildGapReportCreationRequest(createSearchView(metadata), metadata),
    );

    expect(utf8ByteLength(serialized)).toBeLessThanOrEqual(GAP_REPORT_REQUEST_MAX_BYTES);
  });
});
