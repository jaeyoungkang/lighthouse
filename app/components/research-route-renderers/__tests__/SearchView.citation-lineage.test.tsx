import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCitationSeedPageRoute } from "@/app/lib/api-routes";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  createPaper,
  createSearchMetadata,
  createSearchView,
  createSearchViewRenderHarness,
} from "./search-view-test-support";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

let sendBeaconMock: ReturnType<typeof vi.fn>;
const searchViewHarness = createSearchViewRenderHarness();

function createCitationSearchMetadata(overrides: Partial<SearchMetadata> = {}): SearchMetadata {
  return createSearchMetadata({
    papers: [createPaper({ abstract: "", referenceIds: ["ref-1", "ref-2"] })],
    ...overrides,
  });
}

function createCitationSearchView(metadata = createCitationSearchMetadata()) {
  return createSearchView({
    metadata,
    timestamp: "2026-04-13T00:00:00.000Z",
  });
}

function citationPostCalls(fetchMock: ReturnType<typeof vi.mocked<typeof fetch>>) {
  return fetchMock.mock.calls.filter(([, init]) => init && init.method === "POST");
}

const citationSeedRoute = buildCitationSeedPageRoute(createCitationSearchMetadata().papers[0]);
if (!citationSeedRoute.ok) throw new Error("citation seed fixture must be valid");
const CITATION_SEED_ROUTE = citationSeedRoute.route;

describe("SearchView citation lineage flow", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "");
    searchViewHarness.setup();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useReactionActionStore.getState().registerSendMessage(vi.fn());
    mockPush.mockClear();
    vi.stubGlobal("fetch", vi.fn());
    sendBeaconMock = vi.fn(() => true);
    Object.defineProperty(globalThis.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeaconMock,
    });
  });

  afterEach(() => {
    searchViewHarness.cleanup();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useReactionActionStore.getState().unregisterSendMessage();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("navigates to the citation seed route and leaves execution to the destination", async () => {
    const sendMessage = vi.fn();
    useReactionActionStore.getState().registerSendMessage(sendMessage);
    const searchDocument = createCitationSearchView();
    const fetchMock = vi.mocked(fetch);

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:119");
    const container = searchViewHarness.render(searchDocument);
    const citationButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("인용 1"),
    );
    if (!citationButton) {
      throw new Error("expected citation lineage button");
    }

    await act(async () => {
      citationButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    // 클릭 즉시 seed route로 이동한다. origin currentView/route condition/generation
    // state는 그대로 두고 목적지 Search-first route가 실행을 소유한다.
    expect(mockPush).toHaveBeenCalledWith(CITATION_SEED_ROUTE);
    expect(citationPostCalls(fetchMock)).toHaveLength(0);
    expect(useResearchRouteStore.getState().currentView?.type).toBe("search");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("tracks lazy citation lineage clicks with provider counts instead of empty ID arrays", async () => {
    const metadata = createCitationSearchMetadata({
      papers: [
        {
          paperId: "123",
          title: "Lazy Lineage Paper",
          abstract: "",
          year: 2024,
          citationCount: 88,
          url: "https://example.com/123",
          authors: [{ name: "Author" }],
          referenceIds: [],
          referenceCount: 66,
          citationIds: [],
        },
      ],
    });
    const searchDocument = createCitationSearchView(metadata);

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:160");
    const container = searchViewHarness.render(searchDocument);
    const citationButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("인용 88"),
    );
    if (!citationButton) {
      throw new Error("expected lazy citation lineage button");
    }

    await act(async () => {
      citationButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const beaconPayloads = await Promise.all(
      sendBeaconMock.mock.calls.map(async ([, body]) => (body instanceof Blob ? body.text() : "")),
    );
    expect(
      beaconPayloads.some(
        (payload) =>
          payload.includes('"citation_lineage_opened"') &&
          payload.includes('"reference_count":66') &&
          payload.includes('"citation_count":88'),
      ),
    ).toBe(true);
  });

  it("navigates to the citation seed route even when a citation doc for the same seed already exists", async () => {
    const sendMessage = vi.fn();
    useReactionActionStore.getState().registerSendMessage(sendMessage);
    const metadata = createCitationSearchMetadata();
    const searchDocument = createCitationSearchView(metadata);
    const fetchMock = vi.mocked(fetch);

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:195");
    const container = searchViewHarness.render(searchDocument);
    const citationButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("인용 1"),
    );
    if (!citationButton) {
      throw new Error("expected citation lineage button");
    }

    await act(async () => {
      citationButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    // 클라이언트는 dedup하지 않고 seed route로 이동한다. 현재 tab은 불변.
    expect(mockPush).toHaveBeenCalledWith(CITATION_SEED_ROUTE);
    expect(citationPostCalls(fetchMock)).toHaveLength(0);
    expect(useResearchRouteStore.getState().currentView?.id ?? null).toBe(searchDocument.id);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("opens the citation seed route in a new window for detached clicks", async () => {
    const sendMessage = vi.fn();
    const openWindow = vi.fn();
    vi.stubGlobal("open", openWindow);
    useReactionActionStore.getState().registerSendMessage(sendMessage);
    const searchDocument = createCitationSearchView();
    const fetchMock = vi.mocked(fetch);

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:224");
    const container = searchViewHarness.render(searchDocument);
    const citationButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("인용 1"),
    );
    if (!citationButton) {
      throw new Error("expected citation lineage button");
    }

    await act(async () => {
      citationButton.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
      await Promise.resolve();
    });

    expect(openWindow).toHaveBeenCalledWith(CITATION_SEED_ROUTE, "_blank", "noopener,noreferrer");
    expect(mockPush).not.toHaveBeenCalled();
    expect(citationPostCalls(fetchMock)).toHaveLength(0);
    expect(useResearchRouteStore.getState().currentView?.type).toBe("search");
    expect(useResearchRouteStore.getState().currentView?.id ?? null).toBe(searchDocument.id);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("disables the citation lineage entry point when both referenceIds and citationIds are empty", () => {
    const searchDocument = createCitationSearchView(
      createCitationSearchMetadata({
        papers: [
          createPaper({
            abstract: "",
            citationCount: 0,
            referenceCount: 0,
            referenceIds: [],
            citationIds: [],
          }),
        ],
      }),
    );

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:261");
    const container = searchViewHarness.render(searchDocument);
    const citationButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("인용 정보 없음"),
    );

    expect(citationButton).toBeTruthy();
    expect(citationButton?.hasAttribute("disabled")).toBe(true);
  });
});
