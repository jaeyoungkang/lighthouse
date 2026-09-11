import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchRouteRuntime } from "@/app/components/research/ResearchRouteRuntime";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

vi.mock("@/app/components/research/ResearchRouteLayout", () => ({
  ResearchRouteLayout: () => <div data-testid="research-route-layout" />,
}));

let root: Root | null = null;
const originalFetch = globalThis.fetch;

function createSearchView(
  id = "search-1",
  options: { includePapers?: boolean } = {},
): ResearchRoutePayload {
  const includePapers = options.includePapers ?? true;
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id,
    type: "search",
    title: id === "search-1" ? "검색: AI for Science" : "검색: The AI Scientist-v2",
    content: "search content",
    createdBy: "user",
    reaction: null,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-04-11T00:00:00.000Z",
    metadata: {
      type: "search",
      query: id === "search-1" ? "AI for Science" : "The AI Scientist-v2",
      total: includePapers ? 1 : 0,
      papers: includePapers
        ? [
            {
              paperId: `${id}-paper`,
              title: "AI for Science survey",
              abstract: "Survey paper",
              year: 2026,
              authors: [{ name: "A. Researcher" }],
              citationCount: 10,
              url: "https://example.com/paper",
              reviewed: false,
            },
          ]
        : [],
    },
  };
}

function resetStores() {
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useReactionActionStore.getState().unregisterSendMessage();
}

function fetchInputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function parseJsonBody(init?: RequestInit): unknown {
  if (typeof init?.body !== "string") return null;
  return JSON.parse(init.body) as unknown;
}

describe("ResearchRouteRuntime generation targeting", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    resetStores();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    resetStores();
  });

  it("sends the current route-owned viewSnapshot for automatic reaction generation", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchInputUrl(input);
      const snapshotId = decodeURIComponent(url.split("/api/route-ai-comments/generate/")[1] ?? "");
      requests.push({
        url,
        body: parseJsonBody(init),
      });
      return Promise.resolve(Response.json({ snapshotId, snapshotKind: "search", reaction: null }));
    }) as typeof fetch;
    const container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <ResearchRouteRuntime
          renderViewBody={() => null}
          runtimeId="principal-1"
          initialView={createSearchView("search-1")}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      useReactionActionStore.getState().emitSystemEvent("user_search", "", "search-1");
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1300);
    });

    const request = requests.find((entry) =>
      entry.url.includes("/api/route-ai-comments/generate/search-1"),
    );
    expect(requests).toHaveLength(1);
    expect(request?.body).toMatchObject({
      trigger: "user_search",
      viewSnapshot: {
        snapshotId: "search-1",
        snapshotKind: "search",
        title: "검색: AI for Science",
      },
    });
    expect(request?.body).not.toHaveProperty("documentContext");
    expect(request?.body).not.toHaveProperty("ownerPrincipalId");
  });

  it("ignores generation events for a non-current target route payload", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = fetchInputUrl(input);
      const snapshotId = decodeURIComponent(url.split("/api/route-ai-comments/generate/")[1] ?? "");
      return Promise.resolve(Response.json({ snapshotId, snapshotKind: "search", reaction: null }));
    });
    globalThis.fetch = fetchMock as typeof fetch;
    const container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <ResearchRouteRuntime
          renderViewBody={() => null}
          runtimeId="principal-1"
          initialView={createSearchView("search-1", { includePapers: false })}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      useReactionActionStore.getState().emitSystemEvent("user_search", "", "search-2");
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1300);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
