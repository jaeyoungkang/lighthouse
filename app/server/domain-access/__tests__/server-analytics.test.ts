import { beforeEach, describe, expect, it, vi } from "vitest";

const trackCanonicalEventMock =
  vi.fn<(name: string, payload: unknown) => Promise<{ ok: boolean }>>();

vi.mock("@/app/server/domain-access/analytics-event-access", () => ({
  getAnalyticsEventRouterForTrustedServer: vi.fn(() => ({
    trackCanonicalEvent: trackCanonicalEventMock,
  })),
}));

describe("trackServerEvent canonical bridge", () => {
  beforeEach(() => {
    trackCanonicalEventMock.mockReset();
    trackCanonicalEventMock.mockResolvedValue({ ok: true });
  });

  it("does not duplicate committed search analytics because the client owns that boundary", async () => {
    const { trackServerEvent } = await import("../server-analytics");

    trackServerEvent("user@example.com", "search_executed", {
      owner_principal_id: "principal-1",
      document_id: "search-1",
      query: "graph retrieval",
      result_count: 12,
      sort: "relevance",
      query_context: "query_transition",
    });

    expect(trackCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("emits only canonical vendor-sink events for server analytics", async () => {
    const { trackServerEvent } = await import("../server-analytics");

    trackServerEvent("user@example.com", "document_deleted", { document_id: "doc-1" });
    trackServerEvent("user@example.com", "paper_reviewed", {
      paper_id: "paper-1",
      title: "Paper",
    });
    trackServerEvent("user@example.com", "paper_review_removed", { paper_id: "paper-1" });

    expect(trackCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("records committed invited-access membership operations without the invited email", async () => {
    const { trackAdminInvitedAccessMembershipSynced } = await import("../server-analytics");

    await trackAdminInvitedAccessMembershipSynced("admin-1", "remove");

    expect(trackCanonicalEventMock).toHaveBeenCalledWith(
      "governance.invited_access_membership.synced",
      {
        actor: { type: "operator", id: "admin-1" },
        properties: { operation: "remove" },
      },
    );
    expect(JSON.stringify(trackCanonicalEventMock.mock.calls[0])).not.toContain(
      "pilot@example.com",
    );
    expect(JSON.stringify(trackCanonicalEventMock.mock.calls[0])).not.toContain("admin@corca.ai");
  });

  it("does not mirror server delivery events into the product journey", async () => {
    const { trackServerEvent } = await import("../server-analytics");

    trackServerEvent("user@example.com", "pdf_opened", {
      owner_principal_id: "principal-1",
      document_id: "pdf-1",
      paper_id: "paper-1",
      title: "Paper",
    });
    trackServerEvent("user@example.com", "gap_report_created", {
      owner_principal_id: "principal-1",
      document_id: "gap-1",
      source_snapshot_id: "search-1",
    });
    trackServerEvent("user@example.com", "citation_lineage_opened", {
      owner_principal_id: "principal-1",
      document_id: "citation-1",
      seed_paper_id: "paper-1",
      seed_paper_title: "Paper",
      reference_count: 2,
      citation_count: 3,
      result_count: 5,
    });

    expect(trackCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("does not mirror research terms served because the client owns the viewed boundary", async () => {
    const { trackServerEvent } = await import("../server-analytics");

    trackServerEvent("reader@example.com", "research_terms_served", {
      owner_principal_id: "principal-1",
      document_id: "search-1",
      phase: "initial",
      source: "llm",
      candidate_count: 0,
    });

    expect(trackCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("continues to ignore incomplete legacy research terms served signals", async () => {
    const { trackServerEvent } = await import("../server-analytics");

    trackServerEvent("reader@example.com", "research_terms_served", {
      owner_principal_id: "principal-1",
      document_id: "search-1",
    });

    expect(trackCanonicalEventMock).not.toHaveBeenCalled();
  });

  it("preserves citation delivery failure as a separate legacy trace", async () => {
    const { trackServerEvent } = await import("../server-analytics");

    trackServerEvent("user@example.com", "citation_lineage_failed", {
      owner_principal_id: "principal-1",
      seed_paper_id: "paper-1",
      reason: "request_failed",
    });

    expect(trackCanonicalEventMock).toHaveBeenCalledTimes(1);
    const [name, payload] = trackCanonicalEventMock.mock.calls[0];
    expect(name).toBe("product.citation_lineage.failed");
    expect(payload).toEqual({
      actor: { type: "user", id: "user@example.com" },
      subject: { ownerPrincipalId: "principal-1", paperId: "paper-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        paperId: "paper-1",
        reason: "request_failed",
      },
    });
  });

  it("mirrors the graph neighbors failure signal with owner-principal and seed paper ids only", async () => {
    const { trackServerEvent } = await import("../server-analytics");

    trackServerEvent("user@example.com", "graph_neighbors_failed", {
      owner_principal_id: "principal-1",
      seed_paper_id: "paper-1",
    });

    expect(trackCanonicalEventMock).toHaveBeenCalledTimes(1);
    const [name, payload] = trackCanonicalEventMock.mock.calls[0];
    expect(name).toBe("product.graph_neighbors.failed");
    expect(payload).toEqual({
      actor: { type: "user", id: "user@example.com" },
      subject: { ownerPrincipalId: "principal-1", paperId: "paper-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        paperId: "paper-1",
      },
    });
  });

  it("mirrors the graph neighbors viewed signal with co-cited / coupled counts as behavior metadata", async () => {
    const { trackServerEvent } = await import("../server-analytics");

    trackServerEvent("user@example.com", "graph_neighbors_viewed", {
      owner_principal_id: "principal-1",
      document_id: "graph-1",
      seed_paper_id: "paper-1",
      co_cited_count: 4,
      coupled_count: 6,
    });

    expect(trackCanonicalEventMock).toHaveBeenCalledTimes(1);
    const [name, payload] = trackCanonicalEventMock.mock.calls[0];
    expect(name).toBe("product.graph_neighbors.viewed");
    expect(payload).toEqual({
      actor: { type: "user", id: "user@example.com" },
      subject: {
        ownerPrincipalId: "principal-1",
        documentId: "graph-1",
        paperId: "paper-1",
      },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "graph-1",
        paperId: "paper-1",
        coCitedCount: 4,
        coupledCount: 6,
      },
    });
  });
});
