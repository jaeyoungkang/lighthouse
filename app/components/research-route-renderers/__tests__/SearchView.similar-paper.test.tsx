import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import {
  createPaper,
  createSearchMetadata,
  createSearchView,
  createSearchViewRenderHarness,
} from "./search-view-test-support";

const { mockPathname, mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: { value: "/search" },
  mockPush: vi.fn(),
  mockSearchParams: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname.value,
  useSearchParams: () => mockSearchParams.value,
}));

vi.mock("@amplitude/unified", () => ({
  getDeviceId: vi.fn(),
  getSessionId: vi.fn(),
  getUserId: vi.fn(),
  Identify: vi.fn(),
  identify: vi.fn(),
  initAll: vi.fn(),
  reset: vi.fn(),
  track: vi.fn(),
}));

const sendBeaconMock = vi.fn<(url: string | URL, data?: BodyInit | null) => boolean>(() => true);
const searchViewHarness = createSearchViewRenderHarness();

// The pushed `/search?q=` entry URL, parsed for exact-param assertions.
function pushedSearchEntryUrl(): { pathname: string; params: Record<string, string> } {
  expect(mockPush).toHaveBeenCalledTimes(1);
  const [pathname = "", search = ""] = (mockPush.mock.calls[0][0] as string).split("?");
  return { pathname, params: Object.fromEntries(new URLSearchParams(search)) };
}

// seed 논문의 정체성·표시 맥락은 `/search?q=` entry URL 파라미터로 운반된다.
// destination route가 이를 ephemeral search metadata로 보존하며 saved id route로
// 승격하지 않는다 (abstract·authors는 URL에 싣지 않는다).
const EXPECTED_SIMILAR_SEED_ENTRY_PARAMS = {
  q: "Attention Is All You Need",
  entry: "similar",
  seedPaperId: "paper-1",
  seedPaperTitle: "Attention Is All You Need",
  seedPaperYear: "2017",
  seedPaperUrl: "https://example.com/paper-1",
  seedPaperCitations: "1000",
} as const;

describe("SearchView similar paper flow", () => {
  beforeEach(() => {
    searchViewHarness.setup();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    useLibraryAvailabilityStore.setState({ available: false });
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams();
    mockPush.mockClear();
    vi.stubGlobal("fetch", vi.fn());
    // track()이 fetch 대신 beacon을 쓰게 해 "no fetch" 단언이 immediate route navigation만 본다.
    sendBeaconMock.mockClear();
    Object.defineProperty(globalThis.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconMock,
    });
  });

  afterEach(() => {
    searchViewHarness.cleanup();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    useLibraryAvailabilityStore.setState({ available: false });
    Reflect.deleteProperty(globalThis.navigator, "sendBeacon");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("navigates immediately to the seeded search entry URL in the current window", async () => {
    const searchDocument = createSearchView();

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:161");
    const container = searchViewHarness.render(searchDocument);
    const similarButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "비슷한 논문",
    );

    expect(similarButton).toBeTruthy();
    if (!similarButton) {
      throw new Error("expected similar-paper button");
    }

    await act(async () => {
      similarButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    // 비슷한 논문 클릭은 서버 왕복 없이 즉시 entry URL로 이동한다. 검색 실행
    // ownership는 목적지 `/search?q=` entry route의 서버가 소유한다.
    const state = useResearchRouteStore.getState();
    expect(state.currentView?.id).toBe(searchDocument.id);
    expect(fetch).not.toHaveBeenCalled();
    const { pathname, params } = pushedSearchEntryUrl();
    expect(pathname).toBe("/search");
    expect(params).toEqual(EXPECTED_SIMILAR_SEED_ENTRY_PARAMS);

    // similar_papers_discovery 클라이언트 이벤트는 canonical ingress로 함께 발화된다.
    const eventsBeacon = sendBeaconMock.mock.calls.find(
      ([url, body]) => url === "/api/analytics-events" && body instanceof Blob && body.size > 0,
    );
    expect(eventsBeacon).toBeTruthy();
    const eventPayloads = await Promise.all(
      sendBeaconMock.mock.calls.map(async ([, body]) => (body instanceof Blob ? body.text() : "")),
    );
    expect(eventPayloads.some((payload) => payload.includes('"similar_papers_opened"'))).toBe(true);
  });

  it("falls back to the title when a similar-paper seed only has a legacy analysis", async () => {
    const stalePaper: SearchMetadata["papers"][number] = {
      ...createPaper(),
      reviewed: false,
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION - 1,
        inputFingerprint: "a".repeat(64),
        analysis: {
          semanticProfile: { topics: ["stale-topic"] },
        } as never,
        source: "abstract",
      },
    };
    const searchDocument = createSearchView({
      metadata: createSearchMetadata({ papers: [stalePaper] }),
    });

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:stale-similar");
    const container = searchViewHarness.render(searchDocument);
    const similarButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "비슷한 논문",
    );

    await act(async () => {
      similarButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(pushedSearchEntryUrl().params.q).toBe("Attention Is All You Need");
  });

  it("drops retired basis state without carrying reviewed papers in the similar entry URL", async () => {
    useLibraryAvailabilityStore.setState({ available: true });
    const searchDocument = createSearchView();

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:199");
    const container = searchViewHarness.render(searchDocument);
    const similarButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "비슷한 논문",
    );

    expect(similarButton).toBeTruthy();
    if (!similarButton) {
      throw new Error("expected similar-paper button");
    }

    await act(async () => {
      similarButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    // 단일 결과 모델에서는 basis 상태를 싣지 않고, 선택된 라이브러리 논문 id도
    // availability 마커(lib=1) 외에 어떤 형태로도 실리지 않는다.
    expect(fetch).not.toHaveBeenCalled();
    const { pathname, params } = pushedSearchEntryUrl();
    expect(pathname).toBe("/search");
    expect(params).toEqual({
      ...EXPECTED_SIMILAR_SEED_ENTRY_PARAMS,
      lib: "1",
    });
  });

  it("routes to the seeded search entry URL even when the same paper was clicked before", async () => {
    const searchDocument = createSearchView();

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:231");
    const container = searchViewHarness.render(searchDocument);
    const similarButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "비슷한 논문",
    );

    if (!similarButton) {
      throw new Error("expected similar-paper button");
    }

    await act(async () => {
      similarButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    const state = useResearchRouteStore.getState();
    expect(state.currentView?.id).toBe(searchDocument.id);
    const { pathname, params } = pushedSearchEntryUrl();
    expect(pathname).toBe("/search");
    expect(params).toEqual(EXPECTED_SIMILAR_SEED_ENTRY_PARAMS);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps retired basis state out of the seeded search entry URL", async () => {
    useLibraryAvailabilityStore.setState({ available: true });
    const searchDocument = createSearchView();
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:258");
    const container = searchViewHarness.render(searchDocument);
    const similarButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "비슷한 논문",
    );

    if (!similarButton) {
      throw new Error("expected similar-paper button");
    }

    await act(async () => {
      similarButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).not.toHaveBeenCalled();
    const { pathname, params } = pushedSearchEntryUrl();
    expect(pathname).toBe("/search");
    expect(params).toMatchObject({
      ...EXPECTED_SIMILAR_SEED_ENTRY_PARAMS,
    });
    expect(params).not.toHaveProperty("personalize");
  });

  it("drops retired basis state before library availability is known", async () => {
    const searchDocument = createSearchView();
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:286");
    const container = searchViewHarness.render(searchDocument);
    const similarButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "비슷한 논문",
    );

    if (!similarButton) {
      throw new Error("expected similar-paper button");
    }

    await act(async () => {
      similarButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).not.toHaveBeenCalled();
    const { pathname, params } = pushedSearchEntryUrl();
    expect(pathname).toBe("/search");
    expect(params).toMatchObject({
      ...EXPECTED_SIMILAR_SEED_ENTRY_PARAMS,
    });
    expect(params).not.toHaveProperty("personalize");
    expect(params).not.toHaveProperty("lib");
  });

  it("routes similar-paper expansion in the current window without changing current ResearchRoutePayload", async () => {
    const searchDocument = createSearchView();

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:315");
    const container = searchViewHarness.render(searchDocument);
    const similarButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "비슷한 논문",
    );

    if (!similarButton) {
      throw new Error("expected similar-paper button");
    }

    await act(async () => {
      similarButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState().currentView?.id).toBe(searchDocument.id);
    expect(fetch).not.toHaveBeenCalled();
    const { pathname, params } = pushedSearchEntryUrl();
    expect(pathname).toBe("/search");
    expect(params).toEqual(EXPECTED_SIMILAR_SEED_ENTRY_PARAMS);
  });
});
