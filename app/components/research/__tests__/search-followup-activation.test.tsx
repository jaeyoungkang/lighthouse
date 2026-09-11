import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SEARCH_FOLLOWUP_ACTIVATION_STALE_TIMEOUT_MS,
  SearchFollowupActivationProvider,
  type PendingSearchFollowupActivation,
  useSearchFollowupActivation,
} from "@/app/components/research/search-followup-activation";

let root: Root | null = null;
let activationContext: ReturnType<typeof useSearchFollowupActivation> | null = null;

function Probe() {
  const context = useSearchFollowupActivation();
  useEffect(() => {
    activationContext = context;
  }, [context]);
  return null;
}

function mountProvider() {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(
      <SearchFollowupActivationProvider>
        <Probe />
      </SearchFollowupActivationProvider>,
    );
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  activationContext = null;
  vi.useRealTimers();
});

describe("search follow-up activation lifecycle", () => {
  it("does not create feedback for an exact same-route no-op", () => {
    mountProvider();

    let activation = undefined;
    act(() => {
      activation = activationContext?.startActivation({
        route: "/search?q=agent+memory&entry=term",
        query: "agent memory",
        originLocation: "/search?q=agent+memory&entry=term",
      });
    });

    expect(activation).toBeNull();
    expect(activationContext?.pending).toBeNull();
  });

  it("reports an oversized condition without starting navigation", () => {
    mountProvider();

    act(() => {
      activationContext?.reportConditionUrlRejected();
    });

    expect(activationContext?.conditionUrlRejected).toBe(true);
    expect(activationContext?.pending).toBeNull();
  });

  it("clears a condition rejection when a valid navigation starts", () => {
    mountProvider();
    act(() => {
      activationContext?.reportConditionUrlRejected();
    });
    act(() => {
      activationContext?.startActivation({
        route: "/search?q=valid",
        query: "valid",
        originLocation: "/search",
      });
    });

    expect(activationContext?.conditionUrlRejected).toBe(false);
    expect(activationContext?.pending?.route).toBe("/search?q=valid");
  });

  it("clears a condition rejection for a valid same-route no-op", () => {
    mountProvider();
    act(() => {
      activationContext?.reportConditionUrlRejected();
    });
    act(() => {
      activationContext?.startActivation({
        route: "/search?q=valid",
        query: "valid",
        originLocation: "/search?q=valid",
      });
    });

    expect(activationContext?.conditionUrlRejected).toBe(false);
    expect(activationContext?.pending).toBeNull();
  });

  it("clears a condition rejection when a caller accepts a valid detached route", () => {
    mountProvider();
    act(() => {
      activationContext?.reportConditionUrlRejected();
    });
    act(() => {
      activationContext?.acceptConditionUrl();
    });

    expect(activationContext?.conditionUrlRejected).toBe(false);
    expect(activationContext?.pending).toBeNull();
  });

  it("does not let an older cleanup clear a newer keyword activation", () => {
    vi.useFakeTimers();
    mountProvider();
    let first: PendingSearchFollowupActivation | null | undefined = null;
    let second: PendingSearchFollowupActivation | null | undefined = null;
    act(() => {
      first = activationContext?.startActivation({
        route: "/search?q=first&entry=term",
        query: "first",
        originLocation: "/search?q=origin",
      });
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
      second = activationContext?.startActivation({
        route: "/search?q=second&entry=term",
        query: "second",
        originLocation: "/search?q=origin",
      });
    });

    act(() => {
      activationContext?.clearIfStillPending(first);
      vi.advanceTimersByTime(SEARCH_FOLLOWUP_ACTIVATION_STALE_TIMEOUT_MS - 10_000);
    });

    expect(activationContext?.pending).toEqual(second);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(activationContext?.pending).toBeNull();
  });

  it("keeps the journey root and links a new search context to its parent", () => {
    mountProvider();
    act(() => {
      activationContext?.registerAnalyticsContext({
        journeyContextId: "journey-root",
        searchContextId: "search-parent",
      });
    });

    act(() => {
      activationContext?.startActivation({
        route: "/search?q=next&entry=requery",
        query: "next",
        originLocation: "/search?q=current",
      });
    });

    expect(activationContext?.pending?.analyticsContext).toMatchObject({
      journeyContextId: "journey-root",
      parentSearchContextId: "search-parent",
    });
    expect(activationContext?.pending?.analyticsContext?.searchContextId).not.toBe("search-parent");

    const firstDestination = activationContext?.pending?.analyticsContext;
    expect(firstDestination).toBeDefined();
    if (!firstDestination) throw new Error("first destination context missing");
    act(() => {
      activationContext?.registerAnalyticsContext(firstDestination);
    });
    act(() => {
      activationContext?.startActivation({
        route: "/search?q=third&entry=requery",
        query: "third",
        originLocation: "/search?q=next&entry=requery",
      });
    });

    expect(activationContext?.pending?.analyticsContext).toMatchObject({
      journeyContextId: "journey-root",
      parentSearchContextId: firstDestination.searchContextId,
    });
    expect(activationContext?.pending?.analyticsContext?.searchContextId).not.toBe(
      firstDestination.searchContextId,
    );
  });

  it("carries the same search context into a relationship branch", () => {
    mountProvider();
    act(() => {
      activationContext?.registerAnalyticsContext({
        journeyContextId: "journey-root",
        searchContextId: "search-current",
      });
    });

    act(() => {
      activationContext?.startActivation({
        route: "/citation?seedPaperId=42",
        query: "",
        originLocation: "/search?q=current",
      });
    });

    expect(activationContext?.pending?.analyticsContext).toEqual({
      journeyContextId: "journey-root",
      searchContextId: "search-current",
    });
  });

  it("cancels the stale timer and drops activation state when its shell owner unmounts", () => {
    vi.useFakeTimers();
    mountProvider();
    act(() => {
      activationContext?.startActivation({
        route: "/search?q=next&entry=term",
        query: "next",
        originLocation: "/search?q=origin",
      });
    });
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      root?.unmount();
    });
    root = null;
    activationContext = null;

    expect(vi.getTimerCount()).toBe(0);
  });
});
