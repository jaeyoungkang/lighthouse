import { afterEach, expect, it, vi } from "vitest";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { openGapNetworkFromSearchView } from "../search-view-agent-actions";

const ACTIVE_REPORT_ID = "11111111-1111-4111-8111-111111111111";

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
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("routes a rejected detached command to the active report", async () => {
  const metadata: SearchMetadata = {
    type: "search",
    query: "agent memory",
    total: 1,
    papers: [
      {
        paperId: "paper-1",
        title: "Agent Memory",
        abstract: "abstract",
        year: 2025,
        citationCount: 1,
        url: "https://example.com/paper-1",
        authors: [{ name: "Author" }],
      },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: "another gap report is still being calculated",
            code: "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT",
            action: "wait-and-retry",
            retryable: true,
            retryAfterSeconds: 34,
            metadata: { activeGapReportId: ACTIVE_REPORT_ID },
          }),
          { status: 429, headers: { "Retry-After": "34" } },
        ),
      ),
    ),
  );
  const assign = vi.fn();
  const close = vi.fn();
  const detachedWindow = {
    close,
    location: { assign },
    opener: null,
  } as unknown as Window;
  vi.spyOn(window, "open").mockReturnValue(detachedWindow);

  openGapNetworkFromSearchView(createSearchView(metadata), metadata);
  await vi.waitFor(() => {
    expect(assign).toHaveBeenCalledWith(`/gap/${ACTIVE_REPORT_ID}?admission=blocked`);
  });
  expect(close).not.toHaveBeenCalled();
});
