import { describe, expect, it } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { researchRoutePayloadMetadataSchema } from "@/app/domain/research-route-payload-schema";
import {
  buildSearchResultBasisBadge,
  buildSearchViewBodyViewModel,
} from "@/app/components/research-route-renderers/search-view.helpers";
import { resolveDefaultSearchSortOption, sortSearchPapers } from "@/app/lib/search-paper-sort";

const papers: SearchMetadata["papers"] = [
  { id: "a", title: "Agent Memory Search", year: 2020, cites: 1 },
  { id: "b", title: "Planning Systems", year: 2024, cites: 9 },
  { id: "c", title: "Agent Retrieval", year: 2018, cites: 5 },
  { id: "d", title: "Agent Memory Planning", year: 2021, cites: 2 },
  { id: "e", title: "Remote Haptics for Cinema", year: 2019, cites: 3 },
].map(({ id, title, year, cites }) => ({
  paperId: id,
  title,
  abstract: null,
  year,
  citationCount: cites,
  url: "",
  authors: [],
}));
// a,b,c are query (keyword) results in provider order; d,e are injected
// library-near supplements. d has the single highest interest weight.
const interestWeights = { a: 100, c: 200, d: 9999, e: 5000 };
const libraryOnlyPaperIds = ["d", "e"];

describe("search-view sort: active combined interest ranking", () => {
  const combinedInterestWeights = {
    a: 0.5,
    b: 0.333,
    c: 0.7,
    d: 0.4,
    e: 0.15,
  };

  it("sorts equal-max combined scores without putting every library-only paper first", () => {
    expect(
      sortSearchPapers(
        papers,
        "interest",
        combinedInterestWeights,
        libraryOnlyPaperIds,
        "agent memory",
        "combined_score",
      ).map((paper) => paper.paperId),
    ).toEqual(["c", "a", "d", "b", "e"]);
    expect(
      sortSearchPapers(
        papers,
        "relevance",
        combinedInterestWeights,
        libraryOnlyPaperIds,
        "agent memory",
        "combined_score",
      ).map((paper) => paper.paperId),
    ).toEqual(["a", "b", "c"]);
  });

  it("uses fused weights for sorting while positive library evidence owns proximity markers", () => {
    const metadata: SearchMetadata = {
      type: "search",
      query: "agent memory",
      total: papers.length,
      papers,
      sortOption: "interest",
      libraryContext: {
        folders: [{ name: "내 연구" }],
        signalPresent: true,
        interestWeights: { c: 2, d: 1, e: 1 },
        combinedRankWeights: combinedInterestWeights,
        libraryOnlyPaperIds,
        rankingMode: "combined_score",
      },
    };

    const parsed = researchRoutePayloadMetadataSchema.parse(metadata);
    expect(parsed.type).toBe("search");
    if (parsed.type !== "search") {
      throw new Error("expected search metadata");
    }

    const view = buildSearchViewBodyViewModel({
      metadata: parsed,
      visibleCount: 10,
      analysisProgressMap: new Map(),
    });
    expect(view.visiblePapers.map((paper) => paper.paperId)).toEqual(["c", "a", "d", "b", "e"]);
    expect(
      buildSearchResultBasisBadge({ metadata: parsed, paper: papers[0], personalize: true }),
    ).toBeNull();
    expect(
      buildSearchResultBasisBadge({ metadata: parsed, paper: papers[2], personalize: true }),
    ).toMatchObject({ label: "내 연구와 가까움" });
    expect(
      buildSearchResultBasisBadge({ metadata: parsed, paper: papers[3], personalize: true }),
    ).toMatchObject({ label: "내 연구와 가까움" });
  });
});

describe("search-view sort: legacy library-grounded snapshot reader", () => {
  // Every call in this block intentionally omits `rankingMode` to preserve
  // already stored pre-combined snapshots; these are not current writer rules.
  it("keeps keyword results as the spine and interleaves a matching supplement below rank 0 under interest", () => {
    // B2 (aspect:library-grounded-research): the keyword spine leads — weighted query
    // result c ahead of a (both keywordLibrary), then pure keyword b — and the
    // matching library supplement d interleaves at a bounded slot, never rank 0,
    // instead of leading the screen on its 9999 weight. e has no query overlap so it
    // defers to the bottom.
    expect(
      sortSearchPapers(
        papers,
        "interest",
        interestWeights,
        libraryOnlyPaperIds,
        "agent memory",
      ).map((p) => p.paperId),
    ).toEqual(["c", "a", "d", "b", "e"]);
  });

  it("defers library-near supplements without focused query overlap under interest", () => {
    expect(
      sortSearchPapers(
        papers,
        "interest",
        interestWeights,
        libraryOnlyPaperIds,
        "clinical fairness healthcare",
      ).map((p) => p.paperId),
    ).toEqual(["c", "a", "b", "d", "e"]);
  });

  it("shows only keyword provider results under relevance", () => {
    expect(
      sortSearchPapers(papers, "relevance", interestWeights, libraryOnlyPaperIds).map(
        (p) => p.paperId,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("reorders only the query band under citationCount; library-near supplements stay below by weight", () => {
    // Query band sorts by citations desc (b=9, c=5, a=1); d,e remain the bottom
    // band by weight desc (d=9999, e=5000) — not interleaved into the citation rank.
    expect(
      sortSearchPapers(papers, "citationCount", interestWeights, libraryOnlyPaperIds).map(
        (p) => p.paperId,
      ),
    ).toEqual(["b", "c", "a", "d", "e"]);
  });

  it("reorders only the query band under year (newest first); library-near supplements stay below by weight", () => {
    // Query band sorts by year desc (b=2024, a=2020, c=2018); d,e remain the
    // bottom band by weight desc (d=9999, e=5000) — not folded into the year rank.
    expect(
      sortSearchPapers(papers, "year", interestWeights, libraryOnlyPaperIds).map((p) => p.paperId),
    ).toEqual(["b", "a", "c", "d", "e"]);
  });

  it("reorders only the query band under yearAsc; library-near supplements keep weight order, not year order", () => {
    // Query band sorts by year asc (c=2018, a=2020, b=2024). The library-near supplements
    // stays [d,e] by weight desc — if it were year-sorted it would be [e(2019),
    // d(2021)], so this case proves the band ignores the chosen sort.
    expect(
      sortSearchPapers(papers, "yearAsc", interestWeights, libraryOnlyPaperIds).map(
        (p) => p.paperId,
      ),
    ).toEqual(["c", "a", "b", "d", "e"]);
  });

  it("requires broader overlap before a long-query library-near supplement can lead", () => {
    expect(
      sortSearchPapers(
        papers,
        "interest",
        interestWeights,
        libraryOnlyPaperIds,
        "agent memory safety fairness clinical",
      ).map((p) => p.paperId),
    ).toEqual(["c", "a", "b", "d", "e"]);
  });

  it("does not add a band when there are no library-near supplements", () => {
    expect(
      sortSearchPapers(papers, "relevance", interestWeights, []).map((p) => p.paperId),
    ).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("counts only visible provider results under relevance and the blended pool under interest", () => {
    const metadata: SearchMetadata = {
      type: "search",
      query: "agent memory",
      total: 5,
      papers,
      libraryContext: {
        folders: [{ name: "내 컬렉션" }],
        signalPresent: true,
        interestWeights,
        libraryOnlyPaperIds,
      },
    };

    const relevance = buildSearchViewBodyViewModel({
      metadata,
      visibleCount: 10,
      sortOption: "relevance",
      analysisProgressMap: new Map(),
    });
    const interest = buildSearchViewBodyViewModel({
      metadata,
      visibleCount: 10,
      sortOption: "interest",
      analysisProgressMap: new Map(),
    });

    expect(relevance.resultCount).toBe(3);
    expect(relevance.visiblePapers.map((paper) => paper.paperId)).toEqual(["a", "b", "c"]);
    expect(interest.resultCount).toBe(5);
    expect(interest.visiblePapers.map((paper) => paper.paperId)).toEqual(["c", "a", "d", "b", "e"]);
  });

  it("keeps an explicit interest sort as the hydrated default", () => {
    expect(
      resolveDefaultSearchSortOption({
        type: "search",
        query: "agent memory",
        total: 5,
        papers,
        sortOption: "interest",
      }),
    ).toBe("interest");
  });
});

describe("legacy snapshot reader: library-near domain constraint guard", () => {
  it("defers a medicine-query library-near survey that lacks the medicine constraint", () => {
    const medicinePapers: SearchMetadata["papers"] = [
      {
        paperId: "keyword-medicine",
        title: "LLM Hallucination in Medicine",
        abstract: "Clinical medicine evaluation for model answers.",
        year: 2024,
        citationCount: 10,
        url: "",
        authors: [],
      },
      {
        paperId: "keyword-clinical",
        title: "Clinical Reliability for Language Models",
        abstract: "Medicine workflows and healthcare evaluation.",
        year: 2023,
        citationCount: 8,
        url: "",
        authors: [],
      },
      {
        paperId: "near-survey",
        title: "Survey of LLM Hallucination Evaluation",
        abstract: "A general review of factuality and generation failures.",
        year: 2025,
        citationCount: 100,
        url: "",
        authors: [],
      },
      {
        paperId: "near-medicine",
        title: "Medicine Hallucination Benchmark for LLMs",
        abstract: "A clinical medicine benchmark for generated answers.",
        year: 2022,
        citationCount: 15,
        url: "",
        authors: [],
      },
    ];

    expect(
      sortSearchPapers(
        medicinePapers,
        "interest",
        {
          "keyword-medicine": 200,
          "keyword-clinical": 100,
          "near-survey": 10_000,
          "near-medicine": 5_000,
        },
        ["near-survey", "near-medicine"],
        "LLM hallucination medicine",
      ).map((p) => p.paperId),
    ).toEqual(["keyword-medicine", "keyword-clinical", "near-medicine", "near-survey"]);
    // B2: keyword spine (keyword-medicine, keyword-clinical) leads; near-medicine
    // clears the `medicine` constraint so it interleaves below the spine (not at
    // rank 0, on its 5000 weight); near-survey lacks `medicine` and defers last.
  });

  it("does not treat plural generic tokens as domain constraints", () => {
    const medicinePapers: SearchMetadata["papers"] = [
      {
        paperId: "keyword-medicine",
        title: "LLM Hallucination in Medicine",
        abstract: "Clinical medicine evaluation for model answers.",
        year: 2024,
        citationCount: 10,
        url: "",
        authors: [],
      },
      {
        paperId: "near-benchmarks",
        title: "LLM Hallucination Benchmarks",
        abstract: "A broad factuality benchmark collection.",
        year: 2025,
        citationCount: 100,
        url: "",
        authors: [],
      },
    ];

    expect(
      sortSearchPapers(
        medicinePapers,
        "interest",
        {
          "keyword-medicine": 100,
          "near-benchmarks": 10_000,
        },
        ["near-benchmarks"],
        "LLM hallucination benchmarks medicine",
      ).map((p) => p.paperId),
    ).toEqual(["keyword-medicine", "near-benchmarks"]);
  });

  it("keeps a medicine-query provider survey in the interest competition", () => {
    const medicinePapers: SearchMetadata["papers"] = [
      {
        paperId: "provider-survey",
        title: "Survey of LLM Hallucination Evaluation",
        abstract: "A general review of factuality and generation failures.",
        year: 2025,
        citationCount: 100,
        url: "",
        authors: [],
      },
      {
        paperId: "keyword-medicine",
        title: "LLM Hallucination in Medicine",
        abstract: "Clinical medicine evaluation for model answers.",
        year: 2024,
        citationCount: 10,
        url: "",
        authors: [],
      },
      {
        paperId: "near-survey",
        title: "Survey of LLM Hallucination Evaluation",
        abstract: "A general review of factuality and generation failures.",
        year: 2025,
        citationCount: 100,
        url: "",
        authors: [],
      },
    ];

    expect(
      sortSearchPapers(
        medicinePapers,
        "interest",
        {
          "provider-survey": 20_000,
          "keyword-medicine": 100,
          "near-survey": 10_000,
        },
        ["near-survey"],
        "LLM hallucination medicine",
      ).map((p) => p.paperId),
    ).toEqual(["provider-survey", "keyword-medicine", "near-survey"]);
  });

  it("keeps the keyword result ahead of a supplement even when all query tokens are constraint stopwords", () => {
    // T08 (FB-W3-02): when the query is entirely the product's own domain vocabulary
    // (`llm`, `hallucination` — all constraint stopwords), the old model let the
    // constraint gate vanish and a high-weight supplement led the screen. Under B2
    // the keyword result is the spine and stays first; the supplement interleaves below.
    const broadPapers: SearchMetadata["papers"] = [
      {
        paperId: "keyword-one",
        title: "LLM Hallucination Evaluation",
        abstract: null,
        year: 2024,
        citationCount: 10,
        url: "",
        authors: [],
      },
      {
        paperId: "near-survey",
        title: "Survey of LLM Hallucination",
        abstract: "A broad review of factuality.",
        year: 2025,
        citationCount: 100,
        url: "",
        authors: [],
      },
    ];

    expect(
      sortSearchPapers(
        broadPapers,
        "interest",
        {
          "keyword-one": 100,
          "near-survey": 10_000,
        },
        ["near-survey"],
        "LLM hallucination",
      ).map((p) => p.paperId),
    ).toEqual(["keyword-one", "near-survey"]);
  });

  it("preserves the keyword spine for short ASCII queries below the token floor", () => {
    const shortAsciiPapers: SearchMetadata["papers"] = [
      {
        paperId: "keyword-ai",
        title: "AI Systems",
        abstract: null,
        year: 2024,
        citationCount: 10,
        url: "",
        authors: [],
      },
      {
        paperId: "near-ai",
        title: "Short Query Retrieval",
        abstract: "Library-adjacent artificial intelligence search behavior.",
        year: 2025,
        citationCount: 100,
        url: "",
        authors: [],
      },
    ];

    expect(
      sortSearchPapers(
        shortAsciiPapers,
        "interest",
        {
          "keyword-ai": 100,
          "near-ai": 10_000,
        },
        ["near-ai"],
        "AI",
      ).map((p) => p.paperId),
    ).toEqual(["keyword-ai", "near-ai"]);
  });
});

describe("legacy snapshot reader: non-ASCII library relevance", () => {
  it("admits a Korean-query library-near supplement with CJK overlap", () => {
    const koreanPapers: SearchMetadata["papers"] = [
      {
        paperId: "keyword-economic-violence",
        title: "경제적 폭력 피해자의 법적 보호",
        abstract: "친밀한 관계에서 발생하는 경제 통제와 폭력 피해를 다룬다.",
        year: 2024,
        citationCount: 10,
        url: "",
        authors: [],
      },
      {
        paperId: "near-economic-violence",
        title: "친밀한 관계의 경제 폭력과 생존자 지원",
        abstract: "가정폭력 맥락에서 경제적 통제와 피해 회복을 분석한다.",
        year: 2023,
        citationCount: 40,
        url: "",
        authors: [],
      },
      {
        paperId: "near-macro",
        title: "거시경제 충격과 물가 변동",
        abstract: "금리, 통화정책, 물가 상승률을 분석한다.",
        year: 2022,
        citationCount: 90,
        url: "",
        authors: [],
      },
    ];

    expect(
      sortSearchPapers(
        koreanPapers,
        "interest",
        {
          "keyword-economic-violence": 100,
          "near-economic-violence": 10_000,
          "near-macro": 20_000,
        },
        ["near-economic-violence", "near-macro"],
        "경제적 폭력",
      ).map((p) => p.paperId),
    ).toEqual(["keyword-economic-violence", "near-economic-violence", "near-macro"]);
  });

  it("defers Korean-query supplements with only a weak CJK fragment match", () => {
    const koreanPapers: SearchMetadata["papers"] = [
      {
        paperId: "keyword-economic-violence",
        title: "경제적 폭력 피해자의 법적 보호",
        abstract: "친밀한 관계에서 발생하는 경제 통제와 폭력 피해를 다룬다.",
        year: 2024,
        citationCount: 10,
        url: "",
        authors: [],
      },
      {
        paperId: "near-macro",
        title: "거시경제 충격과 물가 변동",
        abstract: "금리, 통화정책, 물가 상승률을 분석한다.",
        year: 2022,
        citationCount: 90,
        url: "",
        authors: [],
      },
    ];

    expect(
      sortSearchPapers(
        koreanPapers,
        "interest",
        {
          "keyword-economic-violence": 100,
          "near-macro": 20_000,
        },
        ["near-macro"],
        "경제적 폭력",
      ).map((p) => p.paperId),
    ).toEqual(["keyword-economic-violence", "near-macro"]);
  });

  it("defers Korean-query supplements that match only one expanded CJK axis", () => {
    const koreanPapers: SearchMetadata["papers"] = [
      {
        paperId: "keyword-economic-violence",
        title: "경제적 폭력 피해자의 법적 보호",
        abstract: "친밀한 관계에서 발생하는 경제 통제와 폭력 피해를 다룬다.",
        year: 2024,
        citationCount: 10,
        url: "",
        authors: [],
      },
      {
        paperId: "near-economic-support",
        title: "경제적 지원 정책의 효과",
        abstract: "가구 소득과 경제적 회복을 분석한다.",
        year: 2023,
        citationCount: 80,
        url: "",
        authors: [],
      },
    ];

    expect(
      sortSearchPapers(
        koreanPapers,
        "interest",
        {
          "keyword-economic-violence": 100,
          "near-economic-support": 10_000,
        },
        ["near-economic-support"],
        "경제적 폭력",
      ).map((p) => p.paperId),
    ).toEqual(["keyword-economic-violence", "near-economic-support"]);
  });

  it("keeps one-character Korean query axes in the overlap guard", () => {
    const koreanPapers: SearchMetadata["papers"] = [
      {
        paperId: "keyword-cancer",
        title: "암 치료의 최신 임상 연구",
        abstract: "암 환자의 표적 치료와 생존율을 다룬다.",
        year: 2024,
        citationCount: 10,
        url: "",
        authors: [],
      },
      {
        paperId: "near-therapy",
        title: "심리 치료 상담 효과",
        abstract: "청소년 심리 치료와 상담 개입을 분석한다.",
        year: 2023,
        citationCount: 80,
        url: "",
        authors: [],
      },
    ];

    expect(
      sortSearchPapers(
        koreanPapers,
        "interest",
        {
          "keyword-cancer": 100,
          "near-therapy": 10_000,
        },
        ["near-therapy"],
        "암 치료",
      ).map((p) => p.paperId),
    ).toEqual(["keyword-cancer", "near-therapy"]);
  });
});
