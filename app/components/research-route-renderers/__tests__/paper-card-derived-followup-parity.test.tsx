import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { CitationLineageView } from "@/app/components/research-route-renderers/CitationLineageView";
import { GraphNeighborsView } from "@/app/components/research-route-renderers/GraphNeighborsView";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

const analysis: AIAnalysis = {
  summary: "이 논문은 자동 연구 에이전트가 연구 산출물을 만들 수 있다고 본다.",
  objective: "자동 연구 에이전트의 가능성을 보인다.",
  methodology: "멀티 에이전트 파이프라인을 사용한다.",
  results: "자동화된 연구 산출물을 만든다.",
  keywords: ["autonomous research agents"],
  semanticProfile: {
    claim: "자동 연구 에이전트가 연구 산출물을 만들 수 있다고 본다.",
    topics: ["autonomous research agents"],
    method: "멀티 에이전트 파이프라인",
    finding: "자동화된 연구 산출물",
    quotedBasis: {
      claim: "research agents can create outputs",
      topics: ["autonomous research agents"],
      method: "multi-agent pipeline",
      finding: "automated research outputs",
    },
  },
  stanceProfile: {
    mainPosition: "자동 연구 에이전트가 연구 산출물을 만들 수 있다고 본다.",
    debateAxis: "자동 연구 산출물의 신뢰성과 평가 기준",
    limitations: "표본이 단일 도메인에 한정되어 일반화 근거가 약하다.",
    counterSearchQueries: [
      {
        query: "autonomous research agents reliability critique",
        rationale: "자동 연구 산출물의 신뢰성 논의를 찾는다.",
        basis: "automated research outputs",
      },
    ],
  },
  confidence: "high",
  evidenceMap: {},
};

const paper: SearchMetadata["papers"][number] = {
  paperId: "paper-1",
  title: "The AI Scientist",
  abstract: "abstract",
  year: 2024,
  citationCount: 10,
  url: "https://example.com/paper-1",
  authors: [{ name: "Author 1" }],
  openAccessPdf: null,
  doi: null,
  inlineAnalysis: {
    version: INLINE_ANALYSIS_VERSION,
    inputFingerprint: "a".repeat(64),
    analysis,
    source: "abstract",
  },
};

function baseDocument(type: "citation_lineage" | "graph_neighbors"): ResearchRoutePayload {
  const now = "2026-06-09T00:00:00.000Z";
  const seedPaper = {
    paperId: "seed-1",
    title: "Attention Is All You Need",
    abstract: "seed abstract",
    year: 2017,
    citationCount: 1000,
    url: "https://example.com/seed-1",
    authors: [{ name: "Vaswani" }],
    openAccessPdf: null,
    doi: null,
  };
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: `${type}-doc`,
    type,
    title: type === "citation_lineage" ? "인용 계보" : "비슷한 논문",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    metadata:
      type === "citation_lineage"
        ? {
            type,
            seedPaper,
            referenceIds: [paper.paperId],
            citationIds: [],
            papers: [paper],
            total: 1,
          }
        : {
            type,
            seedPaper,
            papers: [paper],
            total: 1,
            coCited: [{ shared: 3, paper }],
            coupled: [],
          },
    reaction: null,
  } as ResearchRoutePayload;
}

async function renderDocument(document: ResearchRoutePayload) {
  const container = globalThis.document.createElement("div");
  root = createRoot(container);
  useResearchRouteStore.getState().setCurrentView(document, "test-execution:123");
  await act(async () => {
    root?.render(
      document.type === "citation_lineage" ? (
        <CitationLineageView document={document} />
      ) : (
        <GraphNeighborsView document={document} />
      ),
    );
    await Promise.resolve();
  });
  return container;
}

// The click navigates immediately (no client-side placeholder round trip); drain a few
// microtasks so track and store updates settle before asserting.
async function openDifferentPositionSearch(
  container: ParentNode,
  eventInit: MouseEventInit = {},
  eventType = "click",
) {
  const card = container.querySelector('[data-testid="search-result-card"]');
  expect(card).toBeTruthy();
  await act(async () => {
    card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  const panel = container.querySelector('[data-testid="different-position-panel"]');
  const action = panel?.querySelector('[data-testid="different-position-search-action"]');
  expect(action).toBeTruthy();
  await act(async () => {
    action?.dispatchEvent(new MouseEvent(eventType, { bubbles: true, ...eventInit }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// The pushed/opened `/search?q=` entry URL, parsed for exact-param assertions.
function parseSearchEntryUrl(url: string): { pathname: string; params: Record<string, string> } {
  const [pathname = "", search = ""] = url.split("?");
  return { pathname, params: Object.fromEntries(new URLSearchParams(search)) };
}

// `다른 입장` 목적지는 query를 독립 검색 조건으로 취급한다. 출발 논문·입장·쟁점
// trace는 URL이나 destination metadata로 운반하지 않는다.
function expectedDifferentPositionEntryParams(query: string): Record<string, string> {
  return {
    q: query,
    entry: "position",
  };
}

beforeEach(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  mockPush.mockClear();
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  useReactionActionStore.getState().registerSendMessage(vi.fn());
  vi.stubGlobal("fetch", vi.fn());
  Object.defineProperty(globalThis.navigator, "sendBeacon", {
    configurable: true,
    value: vi.fn(() => true),
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  window.localStorage.clear();
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  useReactionActionStore.getState().unregisterSendMessage();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("derived paper card follow-up parity", () => {
  it.each(["citation_lineage", "graph_neighbors"] as const)(
    "resets expanded paper-card detail when the %s document identity changes",
    async (type) => {
      const firstDocument = baseDocument(type);
      const container = await renderDocument(firstDocument);
      const card = container.querySelector('[data-testid="search-result-card"]');

      await act(async () => {
        card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
      });
      expect(
        container
          .querySelector('[data-testid="search-result-card-disclosure"]')
          ?.getAttribute("aria-expanded"),
      ).toBe("true");

      const nextDocument = { ...baseDocument(type), id: `${type}-next-doc` };
      await act(async () => {
        useResearchRouteStore
          .getState()
          .setCurrentView(nextDocument, "test-execution:document-transition");
        root?.render(
          type === "citation_lineage" ? (
            <CitationLineageView document={nextDocument} />
          ) : (
            <GraphNeighborsView document={nextDocument} />
          ),
        );
        await Promise.resolve();
      });

      expect(
        container
          .querySelector('[data-testid="search-result-card-disclosure"]')
          ?.getAttribute("aria-expanded"),
      ).toBe("false");
    },
  );

  it.each(["citation_lineage", "graph_neighbors"] as const)(
    "routes different-position searches from %s paper cards in the current window",
    async (type) => {
      const document = baseDocument(type);
      const query = "autonomous research agents reliability critique";
      const container = await renderDocument(document);

      await openDifferentPositionSearch(container);

      // 다른 입장 후보 클릭은 서버 왕복 없이 즉시 `/search?q=` entry URL을 현재
      // 창에 push한다(메인 검색창과 동일한 즉시-이동 모델). 목적지 route가 URL
      // 조건에서 검색을 실행한다.
      expect(
        vi
          .mocked(fetch)
          .mock.calls.map(([input]) => getRequestUrl(input))
          .filter((url) => url.startsWith("/api/search")),
      ).toEqual([]);
      expect(mockPush).toHaveBeenCalledTimes(1);
      const { pathname, params } = parseSearchEntryUrl(mockPush.mock.calls[0][0] as string);
      expect(pathname).toBe("/search");
      expect(params).toEqual(expectedDifferentPositionEntryParams(query));
    },
  );

  it.each(["citation_lineage", "graph_neighbors"] as const)(
    "opens modified different-position searches from %s paper cards in a new window",
    async (type) => {
      const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
      const document = baseDocument(type);
      const query = "autonomous research agents reliability critique";
      const container = await renderDocument(document);

      await openDifferentPositionSearch(container, { ctrlKey: true });

      // Detached activation opens the SAME transient entry URL in a new window
      // and does not also push it in the current window.
      expect(mockPush).not.toHaveBeenCalled();
      expect(
        vi
          .mocked(fetch)
          .mock.calls.map(([input]) => getRequestUrl(input))
          .filter((url) => url.startsWith("/api/search")),
      ).toEqual([]);
      expect(openSpy).toHaveBeenCalledTimes(1);
      const [openedUrl, target, features] = openSpy.mock.calls[0];
      expect(target).toBe("_blank");
      expect(features).toBe("noopener,noreferrer");
      const { pathname, params } = parseSearchEntryUrl(openedUrl as string);
      expect(pathname).toBe("/search");
      expect(params).toEqual(expectedDifferentPositionEntryParams(query));
    },
  );

  it("opens middle-click different-position searches in a new window", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const query = "autonomous research agents reliability critique";
    const container = await renderDocument(baseDocument("graph_neighbors"));

    await openDifferentPositionSearch(container, { button: 1 }, "auxclick");

    expect(mockPush).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [openedUrl, target, features] = openSpy.mock.calls[0];
    expect(target).toBe("_blank");
    expect(features).toBe("noopener,noreferrer");
    const { pathname, params } = parseSearchEntryUrl(openedUrl as string);
    expect(pathname).toBe("/search");
    expect(params).toEqual(expectedDifferentPositionEntryParams(query));
  });
});
