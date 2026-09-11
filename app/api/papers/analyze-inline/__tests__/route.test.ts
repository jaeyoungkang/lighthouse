import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { INLINE_ANALYSIS_ROUTE_DEADLINE_MS } from "@/app/domain/analysis";
import { POST } from "../route";

const { requireOwnerPrincipalAuthMock, resolveInlineAnalysisMock } = vi.hoisted(() => ({
  requireOwnerPrincipalAuthMock: vi.fn(),
  resolveInlineAnalysisMock: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth: requireOwnerPrincipalAuthMock,
}));

vi.mock("@/app/server/domain-access/inline-analysis-access", () => ({
  resolveInlineAnalysis: resolveInlineAnalysisMock,
}));

describe("inline analysis route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerPrincipalAuthMock.mockResolvedValue({
      db: { source: "owner-db" },
      user: { id: "user-1", email: "user@example.com" },
    });
    resolveInlineAnalysisMock.mockResolvedValue([
      {
        paperId: "paper-1",
        source: "abstract",
        analysis: {
          summary: "summary",
          objective: "objective",
          methodology: "methodology",
          results: "results",
          keywords: [],
          semanticProfile: {
            claim: null,
            topics: [],
            method: null,
            finding: null,
            quotedBasis: {
              claim: null,
              topics: [],
              method: null,
              finding: null,
            },
          },
          confidence: "medium",
          evidenceMap: {},
        },
      },
    ]);
  });

  it("delegates papers to current-principal inline analysis access", async () => {
    const routeStartedAt = Date.now();
    const response = await POST(
      new NextRequest("http://localhost/api/papers/analyze-inline", {
        method: "POST",
        body: JSON.stringify({
          papers: [
            {
              paperId: "paper-1",
              title: "Paper 1",
              abstract: "Abstract 1",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(requireOwnerPrincipalAuthMock).toHaveBeenCalledTimes(1);
    expect(resolveInlineAnalysisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deadlineAt: expect.any(Number) as number,
        retryCommand: "automatic",
        signal: expect.any(AbortSignal) as AbortSignal,
        papers: [
          expect.objectContaining({
            paperId: "paper-1",
            title: "Paper 1",
            abstract: "Abstract 1",
          }),
        ],
      }),
    );
    const resolveCalls = resolveInlineAnalysisMock.mock.calls as Array<[{ deadlineAt: number }]>;
    const deadlineAt = resolveCalls[0]?.[0].deadlineAt;
    expect(deadlineAt).toBeGreaterThanOrEqual(routeStartedAt + INLINE_ANALYSIS_ROUTE_DEADLINE_MS);
    expect(deadlineAt).toBeLessThanOrEqual(Date.now() + INLINE_ANALYSIS_ROUTE_DEADLINE_MS);
  });

  it("forwards the explicit retry command through the runtime parser", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/papers/analyze-inline", {
        method: "POST",
        body: JSON.stringify({
          papers: [{ paperId: "paper-1", title: "Paper 1", abstract: "Abstract 1" }],
          retryCommand: "explicit_retry",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(resolveInlineAnalysisMock).toHaveBeenCalledWith(
      expect.objectContaining({ retryCommand: "explicit_retry" }),
    );
  });

  it("rejects a retry command outside the canonical contract", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/papers/analyze-inline", {
        method: "POST",
        body: JSON.stringify({
          papers: [{ paperId: "paper-1", title: "Paper 1", abstract: "Abstract 1" }],
          retryCommand: "retry_later",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(resolveInlineAnalysisMock).not.toHaveBeenCalled();
  });

  it("rejects more papers than the UI contract allows", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/papers/analyze-inline", {
        method: "POST",
        body: JSON.stringify({
          papers: Array.from({ length: 6 }, (_, index) => ({
            paperId: `paper-${String(index)}`,
            title: `Paper ${String(index)}`,
            abstract: `Abstract ${String(index)}`,
          })),
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(requireOwnerPrincipalAuthMock).toHaveBeenCalledTimes(1);
    expect(resolveInlineAnalysisMock).not.toHaveBeenCalled();
  });

  it("ignores paper metadata outside the canonical prompt input", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/papers/analyze-inline", {
        method: "POST",
        body: JSON.stringify({
          papers: [
            {
              paperId: "paper-1",
              title: "Paper 1",
              abstract: "Abstract 1",
              year: 2024,
              citationCount: 22_562,
              url: "https://example.com/paper-1",
              authors: Array.from({ length: 279 }, (_, index) => `Author ${String(index + 1)}`),
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(resolveInlineAnalysisMock).toHaveBeenCalledWith(
      expect.objectContaining({
        papers: [
          {
            paperId: "paper-1",
            title: "Paper 1",
            abstract: "Abstract 1",
            year: 2024,
          },
        ],
      }),
    );
  });

  it("rejects oversized paper fields before domain access", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/papers/analyze-inline", {
        method: "POST",
        body: JSON.stringify({
          papers: [{ paperId: "paper-1", title: "Paper 1", abstract: "a".repeat(80_001) }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(requireOwnerPrincipalAuthMock).toHaveBeenCalledTimes(1);
    expect(resolveInlineAnalysisMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized request body after authentication", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/papers/analyze-inline", {
        method: "POST",
        headers: { "content-length": String(4_000_001) },
        body: "{}",
      }),
    );

    expect(response.status).toBe(413);
    expect(requireOwnerPrincipalAuthMock).toHaveBeenCalledTimes(1);
    expect(resolveInlineAnalysisMock).not.toHaveBeenCalled();
  });
});
