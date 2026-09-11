import { describe, expect, it, vi } from "vitest";
import { executeJudgment } from "@/app/server/ai-generation/judgment";
import { normalizeSearchQueryClauses } from "@/app/server/services/query-clause-normalization-service";

vi.mock("@/app/server/ai-generation/judgment", () => ({
  executeJudgment: vi.fn(),
}));

describe("query clause normalization service", () => {
  it("keeps comma-separated concepts in one deterministic clause without an LLM call", () => {
    const clauses = normalizeSearchQueryClauses(
      "Towards end-to-end automation of AI research, the ai scientist",
    );

    expect(executeJudgment).not.toHaveBeenCalled();
    expect(clauses).toEqual([
      {
        rawClause: "Towards end-to-end automation of AI research, the ai scientist",
        normalizedClause: "end-to-end automation of AI research, the ai scientist",
        role: "other",
        isExtractive: true,
        derivedExpansions: [],
      },
    ]);
  });

  it("splits only explicit semicolon and newline separators", () => {
    expect(
      normalizeSearchQueryClauses("machine learning, climate change; policy\neducation"),
    ).toEqual([
      {
        rawClause: "machine learning, climate change",
        normalizedClause: "machine learning, climate change",
        role: "other",
        isExtractive: true,
        derivedExpansions: [],
      },
      {
        rawClause: "policy",
        normalizedClause: "policy",
        role: "other",
        isExtractive: true,
        derivedExpansions: [],
      },
      {
        rawClause: "education",
        normalizedClause: "education",
        role: "other",
        isExtractive: true,
        derivedExpansions: [],
      },
    ]);
  });

  it("keeps single long queries deterministic instead of waiting on Gemini", () => {
    const clauses = normalizeSearchQueryClauses("large language model agents lifelong learning");

    expect(executeJudgment).not.toHaveBeenCalled();
    expect(clauses).toEqual([
      {
        rawClause: "large language model agents lifelong learning",
        normalizedClause: "large language model agents lifelong learning",
        role: "other",
        isExtractive: true,
        derivedExpansions: [],
      },
    ]);
  });
});
