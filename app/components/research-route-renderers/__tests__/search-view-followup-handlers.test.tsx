import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchTermHandler } from "@/app/components/research-route-renderers/search-view-followup-handlers";
import {
  SearchFollowupActivationProvider,
  useSearchFollowupActivation,
} from "@/app/components/research/search-followup-activation";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";

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

type TermHandler = ReturnType<typeof useSearchTermHandler>;
let capturedHandler: TermHandler | null = null;
let capturedActivation: ReturnType<typeof useSearchFollowupActivation> | null = null;

function captureHandler(handler: TermHandler) {
  capturedHandler = handler;
}

function Harness() {
  const handler = useSearchTermHandler();
  const activation = useSearchFollowupActivation();
  useEffect(() => {
    captureHandler(handler);
    capturedActivation = activation;
  }, [activation, handler]);
  return null;
}

function mountHarness() {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(
      <SearchFollowupActivationProvider>
        <Harness />
      </SearchFollowupActivationProvider>,
    );
  });
}

function pushedRoute(): string {
  expect(mockPush).toHaveBeenCalledTimes(1);
  const route: unknown = mockPush.mock.calls[0]?.[0];
  if (typeof route !== "string") {
    throw new Error("expected a pushed entry route string");
  }
  return route;
}

// Parse the transient `/search?q=` entry URL so seed/basis params can be
// asserted exactly, in the order-independent form.
function entryParams(route: string): Record<string, string> {
  const [pathname, search = ""] = route.split("?");
  expect(pathname).toBe("/search");
  return Object.fromEntries(new URLSearchParams(search));
}

beforeEach(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  mockPush.mockClear();
  window.history.pushState({}, "", "/search?q=agent+memory");
  capturedHandler = null;
  useLibraryAvailabilityStore.setState({ available: false });
  // The term click navigates immediately — no client-side placeholder POST — so nothing in
  // these tests may hit the network.
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  capturedHandler = null;
  capturedActivation = null;
  useLibraryAvailabilityStore.setState({ available: false });
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useSearchTermHandler immediate route navigation", () => {
  it("rejects raw term query overflow before trimming whitespace", () => {
    mountHarness();

    act(() => {
      capturedHandler?.(`${"a".repeat(192)} `, {
        termSeed: {
          sourceQuery: "source",
          term: "term",
          candidateType: "direct",
          supportCount: 1,
        },
      });
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(capturedActivation?.conditionUrlRejected).toBe(true);
  });

  it("pushes the query-format search route immediately without waiting for a search POST", () => {
    mountHarness();

    act(() => {
      capturedHandler?.("scientific discovery");
    });

    // The click navigates synchronously to the `/search?q=` entry URL
    // (aspect:immediate-navigation) — no client-side placeholder round trip. The
    // destination route executes from URL params. A plain keyword carries no
    // seed params.
    expect(fetch).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=scientific+discovery&entry=term");
    expect(capturedActivation?.pending).toEqual(
      expect.objectContaining({
        route: "/search?q=scientific+discovery&entry=term",
        query: "scientific discovery",
        originLocation: "/search?q=agent+memory",
      }),
    );
  });

  it("pushes the same entry URL even when it resolves to the current route", () => {
    window.history.pushState({}, "", "/search?q=scientific+discovery&entry=term");
    mountHarness();

    act(() => {
      capturedHandler?.("scientific discovery");
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=scientific+discovery&entry=term");
    expect(capturedActivation?.pending).toBeNull();
  });

  it("carries known library availability without a result-basis preference", () => {
    useLibraryAvailabilityStore.setState({ available: true });
    mountHarness();

    act(() => {
      capturedHandler?.("scientific discovery");
    });

    // The client-known availability rides the entry URL as `lib=1` so the
    // route execution does not re-resolve the library context. There is one
    // automatic result model, and selected library papers never ride the URL.
    expect(fetch).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=scientific+discovery&lib=1&entry=term");
    expect(pushedRoute()).not.toContain("corpus-202");
  });

  it("drops retired basis state on keyword routes", () => {
    useLibraryAvailabilityStore.setState({ available: true });
    mountHarness();

    act(() => {
      capturedHandler?.("scientific discovery");
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=scientific+discovery&lib=1&entry=term");
    expect(pushedRoute()).not.toContain("corpus-202");
  });

  it("does not add retired basis state before library availability is known", () => {
    mountHarness();

    act(() => {
      capturedHandler?.("scientific discovery");
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=scientific+discovery&entry=term");
  });

  it("carries a research term seed on the transient entry URL", () => {
    mountHarness();
    const termSeed = {
      sourceQuery: "ai for science",
      term: "scientific discovery",
      candidateType: "direct" as const,
      supportCount: 2,
    };

    act(() => {
      capturedHandler?.("scientific discovery", { termSeed });
    });

    // The seed rides the entry URL params and is preserved in ephemeral search
    // metadata. It is not promoted into a saved id route.
    expect(fetch).not.toHaveBeenCalled();
    expect(entryParams(pushedRoute())).toEqual({
      q: "scientific discovery",
      entry: "term",
      termSourceQuery: "ai for science",
      term: "scientific discovery",
      termType: "direct",
      termSupport: "2",
    });
  });

  it("opens modified research term searches in a new window while preserving the seed carry", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    mountHarness();
    const termSeed = {
      sourceQuery: "ai for science",
      term: "scientific discovery",
      candidateType: "direct" as const,
      supportCount: 2,
    };

    act(() => {
      capturedHandler?.("scientific discovery", { termSeed }, { metaKey: true });
    });

    // A detached (Ctrl/Cmd/middle) click opens the same transient entry URL in
    // a new browser tab — still no client-side placeholder round trip. The seed still rides
    // the entry URL params.
    expect(mockPush).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(
      "/search?q=scientific+discovery&entry=term&termSourceQuery=ai+for+science&term=scientific+discovery&termType=direct&termSupport=2",
      "_blank",
      "noopener,noreferrer",
    );
    expect(capturedActivation?.pending).toBeNull();
  });

  it("opens a different-position query without source provenance", () => {
    mountHarness();

    act(() => {
      capturedHandler?.("autonomous research agents reliability critique", {
        entry: "position",
      });
    });

    // Source paper, stance, and debate-axis provenance remain origin-only.
    expect(fetch).not.toHaveBeenCalled();
    expect(entryParams(pushedRoute())).toEqual({
      q: "autonomous research agents reliability critique",
      entry: "position",
    });
    expect(capturedActivation?.pending).toEqual(
      expect.objectContaining({
        query: "autonomous research agents reliability critique",
      }),
    );
  });

  it("clears the keyword activation when the route push throws", () => {
    mockPush.mockImplementationOnce(() => {
      throw new Error("push failed");
    });
    mountHarness();

    expect(() => {
      act(() => {
        capturedHandler?.("scientific discovery");
      });
    }).toThrow("push failed");

    expect(capturedActivation?.pending).toBeNull();
  });

  it("ignores empty or whitespace-only terms", () => {
    mountHarness();

    act(() => {
      capturedHandler?.("   ");
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
