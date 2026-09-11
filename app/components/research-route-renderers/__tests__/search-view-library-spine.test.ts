import { describe, expect, it } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { sortSearchPapers } from "@/app/lib/search-paper-sort";
import {
  SEARCH_LIBRARY_FIRST_SCREEN_SUPPLEMENT_LIMIT,
  SEARCH_RESULTS_INITIAL_VISIBLE_COUNT,
} from "@/app/lib/constants";
import { canCompeteInLibraryInterestPool } from "@/app/lib/search-paper-sort";

// @promise promise:search-nonascii-library-relevance
// @aspect aspect:library-grounded-research
// @check acceptance-check:search-nonascii-library-relevance-korean-overlap
// Legacy snapshot compatibility only: these fixtures omit `combined_score` and
// preserve the historical reader. Current searches use one combined pool.

function paper(
  id: string,
  title: string,
  opts: { abstract?: string; year?: number; cites?: number } = {},
): SearchMetadata["papers"][number] {
  return {
    paperId: id,
    title,
    abstract: opts.abstract ?? null,
    year: opts.year ?? 2020,
    citationCount: opts.cites ?? 0,
    url: "",
    authors: [],
  };
}

const order = (
  papers: SearchMetadata["papers"],
  weights: Record<string, number>,
  libraryOnly: string[],
  query: string,
) => sortSearchPapers(papers, "interest", weights, libraryOnly, query).map((p) => p.paperId);

describe("legacy library-grounded snapshot reader: relevance-gated spine", () => {
  it("requires both query overlap and a concrete query constraint", () => {
    expect(
      canCompeteInLibraryInterestPool({
        paper: paper("qualified", "Economic Violence and Coercive Control"),
        query: "economic violence coercive",
      }),
    ).toBe(true);
    expect(
      canCompeteInLibraryInterestPool({
        paper: paper("one-overlap", "Economic Growth and Monetary Policy"),
        query: "economic violence coercive",
      }),
    ).toBe(false);
    expect(
      canCompeteInLibraryInterestPool({
        paper: paper("generic-only", "LLM Safety Benchmark"),
        query: "LLM safety economic violence",
      }),
    ).toBe(false);
    expect(
      canCompeteInLibraryInterestPool({
        paper: paper("no-query", "Any paper"),
      }),
    ).toBe(true);
  });

  it("never places a supplement outside the keyword result window at rank 0, even with an enormous weight", () => {
    // supplement-first-screen-bound: rank ceiling.
    const papers = [
      paper("kw1", "Economic Violence in Intimate Partner Relationships", {
        abstract: "coercive economic control violence",
        cites: 40,
      }),
      paper("kw2", "Coercive Control and Financial Abuse", {
        abstract: "intimate partner violence financial",
        cites: 25,
      }),
      paper("sp1", "Economic Growth and Monetary Policy", { abstract: "macroeconomic growth" }),
    ];
    const result = order(papers, { sp1: 999_999, kw1: 5 }, ["sp1"], "economic violence");
    expect(result[0]).not.toBe("sp1");
    expect(["kw1", "kw2"]).toContain(result[0]);
  });

  it("admits at most SEARCH_LIBRARY_FIRST_SCREEN_SUPPLEMENT_LIMIT supplements into the initial window", () => {
    // supplement-first-screen-bound: first-screen cap.
    const kw = Array.from({ length: 8 }, (_, i) => {
      const n = String(i + 1);
      return paper(`kw${n}`, `graph neural networks study ${n}`, { cites: 10 });
    });
    const sp = Array.from({ length: 5 }, (_, i) => {
      const n = String(i + 1);
      return paper(`sp${n}`, `graph neural networks survey ${n}`, { cites: 100 });
    });
    const weights = Object.fromEntries(sp.map((p, i) => [p.paperId, 100_000 - i]));
    const libraryOnly = sp.map((p) => p.paperId);

    const result = order([...kw, ...sp], weights, libraryOnly, "graph neural networks");
    const firstScreen = result.slice(0, SEARCH_RESULTS_INITIAL_VISIBLE_COUNT);
    const supplementsInWindow = firstScreen.filter((id) => libraryOnly.includes(id)).length;

    expect(result).toEqual([
      "kw1",
      "kw2",
      "sp1",
      "kw3",
      "kw4",
      "sp2",
      "kw5",
      "kw6",
      "sp3",
      "kw7",
      "kw8",
      "sp4",
      "sp5",
    ]);
    expect(supplementsInWindow).toBe(SEARCH_LIBRARY_FIRST_SCREEN_SUPPLEMENT_LIMIT);
  });

  it("fills a scarce-keyword first screen with query-relevant supplements only, never deferred ones", () => {
    // supplement-first-screen-bound (scarce-spine scope): with too few keyword
    // results to fill the window, the cap gives way to floor-passing (query-relevant)
    // supplements — but rank 0 stays keyword and off-topic/deferred supplements never
    // reach the window (the original over-display case does not recur).
    const kw = [
      paper("kw1", "Economic Violence in Intimate Partner Relationships", {
        abstract: "coercive economic control violence",
        cites: 40,
      }),
    ];
    const qualified = Array.from({ length: 12 }, (_, i) => {
      const n = String(i + 1);
      return paper(`q${n}`, `Economic Abuse and Coercive Control Study ${n}`, {
        abstract: "economic abuse violence coercive",
        cites: 10,
      });
    });
    const deferred = Array.from({ length: 3 }, (_, i) => {
      const n = String(i + 1);
      return paper(`d${n}`, `Quantum Computing Architectures ${n}`, {
        abstract: "qubit superconducting circuits",
        cites: 900,
      });
    });
    const libraryOnly = [...qualified, ...deferred].map((p) => p.paperId);
    const weights = Object.fromEntries(libraryOnly.map((id, i) => [id, 100_000 - i]));

    const result = order(
      [...kw, ...qualified, ...deferred],
      weights,
      libraryOnly,
      "economic violence",
    );
    const deferredIds = new Set(deferred.map((p) => p.paperId));

    expect(result[0]).toBe("kw1"); // rank 0 stays keyword even when the spine is scarce
    // Airtight invariant: a floor-failing (off-topic) supplement never ranks above
    // any keyword result or any floor-passing supplement — they always sort last.
    const lastNonDeferred = Math.max(...result.map((id, i) => (deferredIds.has(id) ? -1 : i)));
    const firstDeferred = Math.min(...result.map((id, i) => (deferredIds.has(id) ? i : Infinity)));
    expect(firstDeferred).toBeGreaterThan(lastNonDeferred);
    // With enough query-relevant results to fill it, the window carries no off-topic supplement.
    const firstScreen = result.slice(0, SEARCH_RESULTS_INITIAL_VISIBLE_COUNT);
    expect(firstScreen.filter((id) => deferredIds.has(id))).toHaveLength(0);
  });

  it("defers every supplement below the keyword spine for an untokenizable (Korean) query", () => {
    // nonascii-supplement-defer: FB-W3-02 (T08) — "경제적 폭력".
    const papers = [
      paper("kw1", "Economic Violence in Intimate Partner Relationships", { cites: 40 }),
      paper("kw2", "Coercive Control and Financial Abuse", { cites: 25 }),
      paper("sp1", "Economic Growth and Monetary Policy", { abstract: "macroeconomic policy" }),
    ];
    // Korean query yields no deterministic tokens, so the high-weight supplement
    // cannot be verified against the query and must sit below every keyword result.
    expect(order(papers, { sp1: 999_999 }, ["sp1"], "경제적 폭력")).toEqual(["kw1", "kw2", "sp1"]);
  });

  it("keeps a famous off-topic library supplement below the relevant keyword hits (T08, English)", () => {
    // nonascii-supplement-defer / supplement-first-screen-bound regression, English form:
    // a high-citation macro paper that shares only 'economic' must not lead and must
    // not outrank the genuine keyword results.
    const papers = [
      paper("kw1", "Economic Violence in Intimate Partner Relationships", {
        abstract: "coercive economic control violence",
        cites: 40,
        year: 2021,
      }),
      paper("kw2", "Coercive Control and Financial Abuse", {
        abstract: "intimate partner violence financial",
        cites: 25,
        year: 2022,
      }),
      paper("sp-villain", "Macroeconomic Indicators: A Review", {
        abstract: "economic indicators gdp review",
        cites: 800,
        year: 2012,
      }),
      paper("sp-related", "Economic Dimensions of Coercive Control", {
        abstract: "economic abuse coercive control intimate violence",
        cites: 30,
        year: 2023,
      }),
    ];
    const result = order(
      papers,
      { "sp-villain": 9_999, "sp-related": 400 },
      ["sp-villain", "sp-related"],
      "economic violence",
    );
    expect(result[0]).toBe("kw1");
    expect(result.indexOf("kw1")).toBeLessThan(result.indexOf("sp-villain"));
    expect(result.indexOf("kw2")).toBeLessThan(result.indexOf("sp-villain"));
  });

  it("admits a Korean-overlap supplement while deferring an off-topic Korean supplement", () => {
    const papers = [
      paper("kw1", "경제적 폭력과 통제 연구", { cites: 20 }),
      paper("kw2", "경제적 학대 피해 연구", { cites: 10 }),
      paper("sp-related", "경제적 폭력의 관계 통제", { cites: 500 }),
      paper("sp-off-topic", "양자 컴퓨팅 회로 설계", { cites: 900 }),
    ];

    expect(
      order(
        papers,
        { "sp-related": 500, "sp-off-topic": 900 },
        ["sp-related", "sp-off-topic"],
        "경제적 폭력",
      ),
    ).toEqual(["kw1", "kw2", "sp-related", "sp-off-topic"]);
  });

  it("falls back to interest-weight order when the legacy snapshot has no keyword spine", () => {
    const papers = [
      paper("sp-low", "Economic Violence Field Note"),
      paper("sp-high", "Economic Violence Survey"),
    ];

    expect(
      order(papers, { "sp-low": 10, "sp-high": 20 }, ["sp-low", "sp-high"], "economic violence"),
    ).toEqual(["sp-high", "sp-low"]);
  });
});
