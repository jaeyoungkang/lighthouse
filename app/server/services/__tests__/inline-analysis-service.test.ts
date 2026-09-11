import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeJudgment } from "@/app/server/ai-generation/judgment";
import { analyzePapersInline } from "@/app/server/services/inline-analysis-service";

vi.mock("@/app/server/ai-generation/gemini", () => ({
  GEMINI_MODEL: "gemini-test",
}));

vi.mock("@/app/server/ai-generation/judgment", () => ({
  executeJudgment: vi.fn(),
  isTransientLlmFailoverError: (error: unknown) =>
    error instanceof Error &&
    "failureClass" in error &&
    error.failureClass === "transient_failover_exhausted",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inline analysis service", () => {
  it("propagates the owner deadline signal into structured generation", async () => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      papers: [
        {
          paperId: "p1",
          claim: null,
          topics: [],
          method: null,
          finding: null,
          quotedBasis: { claim: null, topics: [], method: null, finding: null },
        },
      ],
    });
    const signal = new AbortController().signal;

    await analyzePapersInline(
      [
        {
          paperId: "p1",
          title: "Paper 1",
          abstract: "Paper 1 abstract",
          year: 2024,
          citationCount: 10,
          url: "https://example.com/p1",
          authors: ["Author 1"],
        },
      ],
      { signal },
    );

    expect(executeJudgment).toHaveBeenCalledWith(expect.objectContaining({ signal }));
  });

  it("treats omitted batch papers as terminal instead of fabricating placeholders", async () => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      papers: [
        {
          paperId: "p1",
          claim: null,
          topics: ["scientific discovery"],
          method: null,
          finding: null,
          quotedBasis: {
            claim: null,
            topics: ["scientific discovery"],
            method: null,
            finding: null,
          },
        },
      ],
    });

    await expect(
      analyzePapersInline([
        {
          paperId: "p1",
          title: "Paper 1",
          abstract: "Paper 1 abstract",
          year: 2024,
          citationCount: 10,
          url: "https://example.com/p1",
          authors: ["Author 1"],
        },
        {
          paperId: "p2",
          title: "Paper 2",
          abstract: "Paper 2 abstract",
          year: 2024,
          citationCount: 8,
          url: "https://example.com/p2",
          authors: ["Author 2"],
        },
      ]),
    ).rejects.toMatchObject({ name: "InlineAnalysisTerminalGenerationError" });
  });

  it("stores quoted basis alongside nullable semantic fields without forcing hallucinated text", async () => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      papers: [
        {
          paperId: "p1",
          claim: null,
          topics: ["large language models"],
          method: "에이전트 파이프라인을 사용한다.",
          finding: null,
          quotedBasis: {
            claim: null,
            topics: ["large language models"],
            method: "agent pipeline",
            finding: null,
          },
        },
      ],
    });

    const results = await analyzePapersInline([
      {
        paperId: "p1",
        title: "Paper 1",
        abstract: "Paper 1 abstract",
        year: 2024,
        citationCount: 10,
        url: "https://example.com/p1",
        authors: ["Author 1"],
      },
    ]);

    expect(results[0]).toBeDefined();
    const result = results[0];
    expect(result.analysis.semanticProfile.claim).toBeNull();
    expect(result.analysis.semanticProfile.method).toBe("에이전트 파이프라인을 사용한다.");
    expect(result.analysis.semanticProfile.quotedBasis.method).toBe("agent pipeline");
    expect(result.analysis.evidenceMap.method).toBe("agent pipeline");
  });

  it("uses the primary gemini model and passes usage ledger for inline batch analysis", async () => {
    const usageLedger = { record: vi.fn() };
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      papers: [
        {
          paperId: "p1",
          claim: null,
          topics: ["scientific discovery"],
          method: null,
          finding: null,
          quotedBasis: {
            claim: null,
            topics: ["scientific discovery"],
            method: null,
            finding: null,
          },
        },
      ],
    });

    await analyzePapersInline(
      [
        {
          paperId: "p1",
          title: "Paper 1",
          abstract: "Paper 1 abstract",
          year: 2024,
          citationCount: 10,
          url: "https://example.com/p1",
          authors: ["Author 1"],
        },
      ],
      { usageLedger },
    );

    expect(executeJudgment).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-test",
        usageLedger,
      }),
    );
  });
});

describe("inline analysis prompt contract", () => {
  it("instructs abstract-based analysis to avoid promoting novelty wording as field-level signal", async () => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      papers: [
        {
          paperId: "p1",
          claim: "저자가 주장한 초록 기반 주장",
          topics: ["thermal boundary layer control"],
          method: "실험과 수치해석을 결합한다.",
          finding: null,
          quotedBasis: {
            claim: "we propose",
            topics: ["thermal boundary layer"],
            method: "experimental and numerical",
            finding: null,
          },
        },
      ],
    });

    await analyzePapersInline([
      {
        paperId: "p1",
        title: "Novel Thermal Boundary Layer Control",
        abstract:
          "We introduce a novel method for thermal boundary layer control using experimental and numerical analysis.",
        year: 2024,
        citationCount: 10,
        url: "https://example.com/p1",
        authors: ["Author 1"],
      },
    ]);

    const prompt = vi.mocked(executeJudgment).mock.calls[0]?.[0].prompt;
    expect(prompt).toContain("localizedTitle");
    expect(prompt).not.toContain("conclusion");
    expect(prompt).toContain("제목의 한국어화이며 논문 요약이 아니다");
    expect(prompt).toContain('"novel", "first", "new", "state-of-the-art"');
    expect(prompt).toContain("저자 홍보 표현이나 일회성 수식어");
    expect(prompt).toContain("초록에서 주장하는 바를 abstract 기반 주장으로만 정리");
    expect(prompt).toContain("분야 전체의 중요도나 반복성을 단정하지 않는다");
  });

  it("extracts paper-specific different-position search candidates without claiming they exist", async () => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      papers: [
        {
          paperId: "p1",
          claim: "Article 234를 연안국 규제 권한으로 해석한다.",
          topics: ["unclos article 234", "arctic navigation"],
          method: "조약 해석을 수행한다.",
          finding: null,
          stanceProfile: {
            mainPosition: "Article 234가 북극 항행 규제를 정당화한다고 본다.",
            debateAxis: "연안국 환경 규제와 항행 자유의 균형",
            limitations: "제목·초록만으로는 연안국의 실제 집행 범위를 확정하기 어렵다.",
            counterSearchQueries: [
              {
                query:
                  "UNCLOS article 234 freedom of navigation due regard 항행 자유의 다른 해석을 찾는다.",
                rationale: "검색식에 섞인 설명문은 후보 전체를 제외해야 한다.",
                basis: "freedom of navigation",
              },
              {
                query: "UNCLOS article 234 異なる見解を探す",
                rationale: "비라틴 설명문이 섞인 후보도 제외해야 한다.",
                basis: "freedom of navigation",
              },
              {
                query: "  ＵＮＣＬＯＳ   article ２３４ freedom of navigation due regard  ",
                rationale: "항행 자유와 due regard 관점의 다른 해석을 찾는다.",
                basis: "freedom of navigation",
              },
            ],
          },
          quotedBasis: {
            claim: "Article 234",
            topics: ["UNCLOS", "Arctic"],
            method: "treaty interpretation",
            finding: null,
          },
        },
      ],
    });

    const results = await analyzePapersInline([
      {
        paperId: "p1",
        title: "Article 234 and Arctic Navigation",
        abstract:
          "This article interprets UNCLOS Article 234 in relation to Arctic navigation and freedom of navigation.",
        year: 2024,
        citationCount: 10,
        url: "https://example.com/p1",
        authors: ["Author 1"],
      },
    ]);

    const prompt = vi.mocked(executeJudgment).mock.calls[0]?.[0].prompt;
    expect(prompt).toContain("stanceProfile");
    expect(prompt).toContain("stanceProfile.limitations");
    expect(prompt).toContain("반박 논문이 실제로 존재한다고 단정하지 말고");
    expect(prompt).toContain("논문 제목 그대로 + critique 형식에 기대지 말고");
    expect(prompt).toContain("4-8개 핵심 용어로 된 compact keyword query");
    expect(prompt).toContain("precise query와 broader fallback query를 섞는다");
    expect(prompt).toContain("query에는 검색 provider에 바로 전달할 영어 검색식만");
    expect(prompt).toContain("한국어 설명은 rationale에만 넣는다");
    expect(results[0]?.analysis.stanceProfile).toMatchObject({
      mainPosition: "Article 234가 북극 항행 규제를 정당화한다고 본다.",
      debateAxis: "연안국 환경 규제와 항행 자유의 균형",
      limitations: "제목·초록만으로는 연안국의 실제 집행 범위를 확정하기 어렵다.",
      counterSearchQueries: [
        {
          query: "UNCLOS article 234 freedom of navigation due regard",
          rationale: "항행 자유와 due regard 관점의 다른 해석을 찾는다.",
          basis: "freedom of navigation",
        },
      ],
    });
    expect(results[0]?.analysis.stanceProfile?.counterSearchQueries).toHaveLength(1);
  });

  it("extracts result while suppressing abstract conclusions without quoted basis", async () => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      papers: [
        {
          paperId: "p1",
          claim: "새 retrieval agent 구성을 제안한다.",
          topics: ["retrieval agents"],
          method: "검색 로그와 benchmark 평가를 결합한다.",
          finding: "긴 문맥 질의에서 baseline보다 높은 성공률을 보였다.",
          conclusion: "검색 agent 설계에는 메모리 선택 정책이 중요하다고 결론낸다.",
          quotedBasis: {
            claim: "we propose",
            topics: ["retrieval agents"],
            method: "search logs and benchmark",
            finding: "higher success rate",
            conclusion: null,
          },
        },
      ],
    });

    const results = await analyzePapersInline([
      {
        paperId: "p1",
        title: "Retrieval Agents",
        abstract: "We propose retrieval agents and conclude memory selection policy is important.",
        year: 2024,
        citationCount: 10,
        url: "https://example.com/p1",
        authors: ["Author 1"],
      },
    ]);

    expect(results[0]?.analysis.semanticProfile.finding).toBe(
      "긴 문맥 질의에서 baseline보다 높은 성공률을 보였다.",
    );
    expect(results[0]?.analysis.semanticProfile.conclusion).toBeNull();
    expect(results[0]?.analysis.evidenceMap.conclusion).toBeUndefined();
  });
});

describe("inline analysis response handling", () => {
  it("accepts schema-normalized batch responses and preserves semantic fields", async () => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      papers: [
        {
          paperId: "p1",
          claim: "주장",
          topics: ["scientific discovery"],
          method: "방법",
          finding: null,
          quotedBasis: {
            claim: "claim evidence",
            topics: ["scientific discovery"],
            method: "method evidence",
            finding: null,
          },
        },
      ],
    });

    const results = await analyzePapersInline([
      {
        paperId: "p1",
        title: "Paper 1",
        abstract: "Paper 1 abstract",
        year: 2024,
        citationCount: 10,
        url: "https://example.com/p1",
        authors: ["Author 1"],
      },
    ]);

    expect(results[0]?.analysis.semanticProfile.claim).toBe("주장");
    expect(results[0]?.analysis.semanticProfile.topics).toEqual(["scientific discovery"]);
    expect(results[0]?.analysis.confidence).toBe("medium");
  });

  it("does not fan a failed batch out into same-provider per-paper calls", async () => {
    vi.mocked(executeJudgment).mockRejectedValueOnce(new Error("invalid batch"));

    await expect(
      analyzePapersInline([
        {
          paperId: "p1",
          title: "Paper 1",
          abstract: "Paper 1 abstract",
          year: 2024,
          citationCount: 10,
          url: "https://example.com/p1",
          authors: ["Author 1"],
        },
        {
          paperId: "p2",
          title: "Paper 2",
          abstract: "Paper 2 abstract",
          year: 2024,
          citationCount: 8,
          url: "https://example.com/p2",
          authors: ["Author 2"],
        },
      ]),
    ).rejects.toMatchObject({ name: "InlineAnalysisTerminalGenerationError" });
    expect(executeJudgment).toHaveBeenCalledTimes(1);

    const batchOutputSchema = vi.mocked(executeJudgment).mock.calls[0]?.[0].outputSchema;
    expect(
      batchOutputSchema?.safeParse([
        {
          paperId: "p1",
          claim: "논문 1 주장",
          topics: ["topic one"],
          method: "논문 1 방법",
          finding: null,
          quotedBasis: {
            claim: "claim one",
            topics: ["topic one"],
            method: "method one",
            finding: null,
          },
        },
      ]).success,
    ).toBe(true);
    expect(batchOutputSchema?.safeParse({ papers: [{ paperId: 1 }] }).success).toBe(false);
  });
});
