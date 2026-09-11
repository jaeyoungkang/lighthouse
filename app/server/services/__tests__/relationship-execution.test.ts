import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SEARCH_CONDITION_REQUEST_TARGET_MAX_BYTES,
  utf8ByteLength,
  validateSearchConditionUrl,
} from "@/app/lib/search-condition-url-budget";
import { buildRelationshipSeedFromUrlParams } from "@/app/server/services/relationship-execution";

describe("relationship execution", () => {
  it("builds the seed paper from URL params without repository access", () => {
    const input = buildRelationshipSeedFromUrlParams("citation", {
      seedPaperId: "paper-1",
      seedPaperTitle: "Graph Retrieval",
      seedPaperYear: "2024",
      seedPaperUrl: "https://example.com/paper-1",
      seedPaperCitations: "7",
    });

    expect(input).toMatchObject({
      canonicalKey:
        "seedPaperId=paper-1&seedPaperTitle=Graph+Retrieval&seedPaperYear=2024&seedPaperUrl=https%3A%2F%2Fexample.com%2Fpaper-1&seedPaperCitations=7",
      seedPaper: {
        paperId: "paper-1",
        title: "Graph Retrieval",
        abstract: null,
        year: 2024,
        citationCount: 7,
        url: "https://example.com/paper-1",
        authors: [],
      },
    });

    const source = readFileSync(
      path.join(process.cwd(), "app/server/services/relationship-execution.ts"),
      "utf8",
    );
    expect(source).not.toContain("@/app/server/repository");
    expect(source).not.toContain("app/server/repository");
  });

  it("keeps citation and similar request-target limits independent before parsing", () => {
    const params = new URLSearchParams({
      seedPaperId: "paper-1",
      seedPaperTitle: "Paper",
      seedPaperCitations: "1",
    });
    const baseBytes = utf8ByteLength(`/similar?${params.toString()}`);
    params.set(
      "seedPaperCitations",
      `${"0".repeat(SEARCH_CONDITION_REQUEST_TARGET_MAX_BYTES - baseBytes)}1`,
    );

    expect(validateSearchConditionUrl("similar", params).ok).toBe(true);
    expect(validateSearchConditionUrl("citation", params)).toEqual({
      ok: false,
      reason: "request-target-limit",
    });
    expect(
      buildRelationshipSeedFromUrlParams("similar", Object.fromEntries(params)),
    ).not.toBeNull();
    expect(buildRelationshipSeedFromUrlParams("citation", Object.fromEntries(params))).toBeNull();
  });

  it("rejects oversized metadata before building canonical identity", () => {
    expect(
      buildRelationshipSeedFromUrlParams("citation", {
        seedPaperId: "paper",
        seedPaperTitle: "a".repeat(769),
      }),
    ).toBeNull();
  });
});
