import { describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import GapDocumentPage from "@/app/(research)/gap/[id]/page";

const GAP_REPORT_ID = "00000000-0000-4000-8000-000000000123";

const {
  getGapNetworkViewMock,
  notFoundMock,
  redirectMock,
  researchRouteRuntimeMock,
  resolveCurrentUserMock,
} = vi.hoisted(() => ({
  getGapNetworkViewMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("not-found");
  }),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  researchRouteRuntimeMock: vi.fn(() => <div data-testid="research-route-runtime" />),
  resolveCurrentUserMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

vi.mock("@/app/components/research/ResearchRouteRuntime", () => ({
  ResearchRouteRuntime: researchRouteRuntimeMock,
}));

vi.mock("@/app/server/domain-access/gap-report-access", () => ({
  getGapNetworkView: getGapNetworkViewMock,
}));

vi.mock("@/app/server/auth/identity", () => ({
  resolveCurrentUser: resolveCurrentUserMock,
}));

function createStaleNoGapDocument(id: string): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id,
    type: "gap_network",
    title: "연구 공백: AI for Science",
    content: "",
    createdBy: "user",
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: "search-1",
      query: "AI for Science",
      papers: [
        {
          paperId: "paper-1",
          title: "Paper 1",
          abstract: "abstract",
          year: 2026,
          citationCount: 1,
          url: "https://example.com/paper-1",
          authors: [{ name: "Author" }],
        },
      ],
      gapNetworkBuild: {
        core: "ready",
        enrichment: "pending",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      gapNetworkReport: {
        clusters: [
          {
            id: "cluster-1",
            label: "AI for Science",
            color: "#000000",
            paperCount: 1,
            concepts: [],
          },
        ],
        conceptEdges: [],
        gapPairs: [],
        metrics: {
          clusterCount: 1,
          totalPaperCount: 1,
          totalEdgeCount: 1,
          gapPairCount: 0,
        },
        insight: {
          hypotheses: [],
        },
      },
    },
    reaction: null,
    refs: ["search-1"],
    viewerPrincipalId: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
  };
}

describe("gap ResearchRoutePayload stale core route", () => {
  it("does not read a shared gap report for an unauthenticated viewer", async () => {
    resolveCurrentUserMock.mockResolvedValue(null);

    const result = await GapDocumentPage({
      params: Promise.resolve({ id: GAP_REPORT_ID }),
    });

    expect(result).toBeNull();
    expect(getGapNetworkViewMock).not.toHaveBeenCalled();
  });

  it("renders a persisted gap route without refreshing stale core evidence", async () => {
    const staleDocument = createStaleNoGapDocument(GAP_REPORT_ID);
    resolveCurrentUserMock.mockResolvedValue({ id: "user-1", email: "user-1@example.com" });
    getGapNetworkViewMock.mockResolvedValue(staleDocument);

    const result = await GapDocumentPage({
      params: Promise.resolve({ id: staleDocument.id }),
    });

    expect(result).toMatchObject({
      props: {
        runtimeId: "user-1",
        initialView: staleDocument,
      },
    });
  });

  it("passes an admission rejection entry signal to the persisted gap runtime", async () => {
    const activeDocument = createStaleNoGapDocument(GAP_REPORT_ID);
    resolveCurrentUserMock.mockResolvedValue({ id: "user-1", email: "user-1@example.com" });
    getGapNetworkViewMock.mockResolvedValue(activeDocument);

    const result = await GapDocumentPage({
      params: Promise.resolve({ id: activeDocument.id }),
      searchParams: Promise.resolve({ admission: "blocked" }),
    });

    expect(result).toMatchObject({
      props: {
        runtimeId: "user-1",
        initialView: activeDocument,
        gapAdmissionBlocked: true,
      },
    });
  });

  it("renders a stale no-gap ResearchRoutePayload as an observer-only page artifact", async () => {
    const staleDocument = createStaleNoGapDocument(GAP_REPORT_ID);
    resolveCurrentUserMock.mockResolvedValue({ id: "user-1", email: "user-1@example.com" });
    getGapNetworkViewMock.mockResolvedValue(staleDocument);

    const result = await GapDocumentPage({
      params: Promise.resolve({ id: staleDocument.id }),
    });

    if (result == null) {
      throw new Error("expected route element");
    }
    const routeElement = result as { props: { initialView: ResearchRoutePayload } };
    const initialDocument = routeElement.props.initialView;
    expect(initialDocument.id).toBe(staleDocument.id);
    expect(initialDocument).toMatchObject({
      type: "gap_network",
      metadata: {
        type: "gap_network",
        sourceSnapshotId: "search-1",
      },
    });
    expect(
      initialDocument.metadata.type === "gap_network"
        ? initialDocument.metadata.gapNetworkBuild
        : null,
    ).toMatchObject({ core: "ready", enrichment: "pending" });
  });
});
