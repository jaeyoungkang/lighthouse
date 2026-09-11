import { describe, expect, it } from "vitest";
import { analysisSchema } from "@/app/domain/research-route-payload-schema";
import { StanceProfileSchema } from "@/app/lib/schemas";

describe("StanceProfileSchema different-position query boundary", () => {
  it("keeps an English provider query while allowing a Korean rationale", () => {
    const stanceProfile = StanceProfileSchema.parse({
      mainPosition: "연안국 규제 권한을 넓게 해석한다.",
      debateAxis: "환경 규제와 항행 자유의 균형",
      counterSearchQueries: [
        {
          query: "  ＵＮＣＬＯＳ   article ２３４ freedom of navigation due regard  ",
          rationale: "항행 자유 관점의 다른 해석을 찾는다.",
          basis: "freedom of navigation",
        },
      ],
    });

    expect(stanceProfile.counterSearchQueries).toEqual([
      {
        query: "UNCLOS article 234 freedom of navigation due regard",
        rationale: "항행 자유 관점의 다른 해석을 찾는다.",
        basis: "freedom of navigation",
      },
    ]);
  });

  it("drops candidates whose provider query contains non-English explanatory prose", () => {
    const stanceProfile = StanceProfileSchema.parse({
      mainPosition: null,
      debateAxis: null,
      counterSearchQueries: [
        {
          query: "UNCLOS article 234 critique 항행 자유 관점의 논문을 찾는다.",
          rationale: "혼합 검색식",
          basis: null,
        },
        {
          query: "북극 항행 자유와 연안국 규제",
          rationale: "한국어 검색식",
          basis: null,
        },
        {
          query: "UNCLOS article 234 不同立场的论文",
          rationale: "중국어 설명문이 섞인 검색식",
          basis: null,
        },
        {
          query: "UNCLOS article 234 異なる見解を探す",
          rationale: "일본어 설명문이 섞인 검색식",
          basis: null,
        },
        {
          query: "UNCLOS article 234 другая позиция",
          rationale: "러시아어 설명문이 섞인 검색식",
          basis: null,
        },
        {
          query: "AI διαφορετική άποψη",
          rationale: "그리스어 설명문이 섞인 검색식",
          basis: null,
        },
        {
          query: "méthode de recherche critique",
          rationale: "비영어 Latin 설명문",
          basis: null,
        },
        {
          query: "UNCLOS article 234 coastal state regulation navigation freedom",
          rationale: "검색 제공자에 전달할 영어 검색식",
          basis: null,
        },
        {
          query: "IL-1β opposing evidence neuroinflammation",
          rationale: "영어 학술 검색어의 Greek scientific token은 유지한다.",
          basis: null,
        },
        {
          query: "αβ T cell differentiation opposing evidence",
          rationale: "연속된 두 Greek 문자로 된 학술 token은 유지한다.",
          basis: null,
        },
        {
          query: "γδ T cell receptor alternative mechanism",
          rationale: "면역학의 표준 학술 token은 유지한다.",
          basis: null,
        },
        {
          query: "αβγ receptor signaling opposing evidence",
          rationale: "세 Greek 문자로 된 과학 표기는 유지한다.",
          basis: null,
        },
        {
          query: "ℓ1 regularization robustness opposing evidence",
          rationale: "NFKC로 Latin으로 정규화되는 학술 표기는 유지한다.",
          basis: null,
        },
      ],
    });

    expect(stanceProfile.counterSearchQueries.map((candidate) => candidate.query)).toEqual([
      "UNCLOS article 234 coastal state regulation navigation freedom",
      "IL-1β opposing evidence neuroinflammation",
      "αβ T cell differentiation opposing evidence",
      "γδ T cell receptor alternative mechanism",
      "αβγ receptor signaling opposing evidence",
      "l1 regularization robustness opposing evidence",
    ]);
  });

  it("applies the same query boundary when parsing cached analysis payloads", () => {
    const analysis = analysisSchema.parse({
      summary: "summary",
      objective: "objective",
      methodology: "methodology",
      results: "results",
      keywords: ["topic"],
      semanticProfile: {
        claim: "claim",
        topics: ["topic"],
        method: "method",
        finding: "finding",
        quotedBasis: {
          claim: "claim",
          topics: ["topic"],
          method: "method",
          finding: "finding",
        },
      },
      stanceProfile: {
        mainPosition: null,
        debateAxis: null,
        counterSearchQueries: [
          {
            query: "critical perspective 批判的论证を探す",
            rationale: "캐시 경계에서도 비라틴 설명문을 제외한다.",
            basis: null,
          },
          {
            query: "  ｃｒｉｔｉｃａｌ   perspective competing interpretation evidence  ",
            rationale: "대안적 해석을 찾는다.",
            basis: null,
          },
        ],
      },
      confidence: "medium",
      evidenceMap: {},
    });

    expect(analysis.stanceProfile.counterSearchQueries.map((candidate) => candidate.query)).toEqual(
      ["critical perspective competing interpretation evidence"],
    );
  });

  it("defaults limitations to null for cached payloads without the field", () => {
    const stanceProfile = StanceProfileSchema.parse({
      mainPosition: null,
      debateAxis: null,
      counterSearchQueries: [],
    });

    expect(stanceProfile.limitations).toBeNull();

    const analysis = analysisSchema.parse({
      summary: "summary",
      objective: "objective",
      methodology: "methodology",
      results: "results",
      keywords: ["topic"],
      semanticProfile: {
        claim: "claim",
        topics: ["topic"],
        method: "method",
        finding: "finding",
        quotedBasis: {
          claim: "claim",
          topics: ["topic"],
          method: "method",
          finding: "finding",
        },
      },
      stanceProfile: {
        mainPosition: null,
        debateAxis: null,
        counterSearchQueries: [],
      },
      confidence: "medium",
      evidenceMap: {},
    });

    expect(analysis.stanceProfile.limitations).toBeNull();
  });
});
