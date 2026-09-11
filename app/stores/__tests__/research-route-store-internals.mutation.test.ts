import { describe, expect, it } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import {
  advanceReactionGeneration,
  advanceUpdatedAtAfterCurrent,
  getPersistedLatestReaction,
  getPersistedReactionHistory,
  reconcileActiveReactionHistory,
  syncActiveReactionCards,
} from "@/app/stores/research-route-store-internals";
import {
  createSearchVisibleWindowActions,
  resolveNextSearchVisibleWindow,
  type SearchVisibleWindowState,
} from "@/app/stores/research-route-store-search-visible-window";

function reaction(id: string): RouteAiComment {
  return {
    id,
    title: `Reaction ${id}`,
    body: `Body ${id}`,
    chips: [],
    timestamp: `2026-07-10T00:00:0${id}.000Z`,
  };
}

function searchView(): ResearchRoutePayload {
  return {
    id: "search-1",
    type: "search",
    title: "Search",
    content: "",
    createdBy: "user",
    metadata: { type: "search", query: "agents", papers: [], total: 0 },
    reaction: null,
    refs: [],
    ownerPrincipalId: "owner-1",
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };
}

describe("research-route active-session helpers", () => {
  it("strictly advances freshness for equal and older proposed timestamps", () => {
    const current = "2026-07-10T00:00:05.000Z";
    expect(advanceUpdatedAtAfterCurrent(current, "2026-07-10T00:00:06.000Z")).toBe(
      "2026-07-10T00:00:06.000Z",
    );
    expect(advanceUpdatedAtAfterCurrent(current, current)).toBe("2026-07-10T00:00:05.001Z");
    expect(advanceUpdatedAtAfterCurrent(current, "2026-07-10T00:00:01.000Z")).toBe(
      "2026-07-10T00:00:05.001Z",
    );
    expect(advanceUpdatedAtAfterCurrent("not-a-date", "2026-07-10T00:00:06.000Z")).toBe(
      "2026-07-10T00:00:06.000Z",
    );
    expect(Date.parse(advanceUpdatedAtAfterCurrent("not-a-date", "also-not-a-date"))).not.toBeNaN();
  });

  it("hydrates persisted history and latest reaction", () => {
    const first = reaction("1");
    const second = reaction("2");
    const third = reaction("3");
    const view = { ...searchView(), reaction: third, reactionHistory: [first, second, third] };

    expect(getPersistedReactionHistory(view)).toEqual([first, second, third]);
    expect(getPersistedLatestReaction(view)).toEqual(third);
    expect(getPersistedReactionHistory({ ...view, reactionHistory: [] })).toEqual([third]);
    expect(getPersistedReactionHistory({ ...view, reaction: null, reactionHistory: [] })).toEqual(
      [],
    );
  });

  it("preserves active history across metadata patches and refreshes the current block", () => {
    const first = reaction("1");
    const second = reaction("2");
    const refreshed = { ...first, body: "Refreshed" };

    expect(
      reconcileActiveReactionHistory({
        view: searchView(),
        currentReaction: refreshed,
        previousHistory: [first],
      }),
    ).toEqual([refreshed]);
    expect(
      reconcileActiveReactionHistory({
        view: { ...searchView(), reaction: first },
        currentReaction: null,
        previousHistory: [],
      }),
    ).toEqual([first]);
    expect(
      reconcileActiveReactionHistory({
        view: { ...searchView(), reaction: first },
        currentReaction: first,
        previousHistory: [],
      }),
    ).toEqual([first]);
    expect(
      reconcileActiveReactionHistory({
        view: { ...searchView(), reaction: first },
        currentReaction: second,
        previousHistory: [],
      }),
    ).toEqual([second]);
    const third = reaction("3");
    expect(
      reconcileActiveReactionHistory({
        view: {
          ...searchView(),
          reaction: third,
          reactionHistory: [first, second, third],
        },
        currentReaction: third,
        previousHistory: [],
      }),
    ).toEqual([first, second, third]);
    expect(
      reconcileActiveReactionHistory({
        view: { ...searchView(), reaction: null, reactionHistory: [] },
        currentReaction: first,
        previousHistory: [],
      }),
    ).toEqual([first]);
    expect(
      reconcileActiveReactionHistory({
        view: searchView(),
        currentReaction: null,
        previousHistory: [first],
      }),
    ).toEqual([first]);
    expect(
      reconcileActiveReactionHistory({
        view: searchView(),
        currentReaction: reaction("3"),
        previousHistory: [first, reaction("2")],
      }),
    ).toEqual([first, reaction("2")]);
  });

  it("replaces, refreshes, and clears active reaction cards", () => {
    const first = reaction("1");
    const second = reaction("2");
    expect(syncActiveReactionCards({ history: [], reaction: first })).toEqual([first]);
    expect(syncActiveReactionCards({ history: [first], reaction: second })).toEqual([second]);
    expect(
      syncActiveReactionCards({
        history: [first],
        reaction: { ...first, body: "Refreshed" },
      }),
    ).toEqual([{ ...first, body: "Refreshed" }]);
    expect(syncActiveReactionCards({ history: [first], reaction: null })).toEqual([]);
    expect(syncActiveReactionCards({ history: [first, second], reaction: second })).toEqual([
      first,
      second,
    ]);
    const third = reaction("3");
    expect(syncActiveReactionCards({ history: [first, second, third], reaction: third })).toEqual([
      first,
      second,
      third,
    ]);
    expect(syncActiveReactionCards({ history: [first, second], reaction: reaction("3") })).toEqual([
      reaction("3"),
    ]);
  });

  it("advances the scalar reaction generation only for clear completions", () => {
    expect(advanceReactionGeneration(4, false)).toBe(4);
    expect(advanceReactionGeneration(4, true)).toBe(5);
  });
});

describe("research-route scalar visible window", () => {
  it("rejects stale execution writers and resets counts for a new result key", () => {
    const current = { executionId: "exec-2", resultKey: "a", visibleCount: 12 };
    expect(
      resolveNextSearchVisibleWindow({
        activeExecutionId: "exec-2",
        current,
        expectedExecutionId: "exec-1",
        resultKey: "a",
        next: 30,
      }),
    ).toBe(current);
    expect(
      resolveNextSearchVisibleWindow({
        activeExecutionId: "exec-2",
        current,
        expectedExecutionId: "exec-2",
        resultKey: "b",
        next: (count) => count + 5,
      }),
    ).toEqual({ executionId: "exec-2", resultKey: "b", visibleCount: 15 });
  });

  it("updates only the active execution through the store action", () => {
    let state: SearchVisibleWindowState = {
      activeExecutionId: "exec-1",
      searchVisibleWindow: null,
      setSearchVisibleCount: () => undefined,
    };
    const actions = createSearchVisibleWindowActions((update) => {
      state = { ...state, ...(typeof update === "function" ? update(state) : update) };
    });
    actions.setSearchVisibleCount("exec-1", "query-a", 12);
    actions.setSearchVisibleCount("exec-1", "query-a", (count) => count + 5);
    actions.setSearchVisibleCount("stale", "query-a", 99);

    expect(state.searchVisibleWindow).toEqual({
      executionId: "exec-1",
      resultKey: "query-a",
      visibleCount: 17,
    });
  });
});
