import { describe, expect, it } from "vitest";

import {
  analyzeReviewRetentionStream,
  buildReviewRetentionReport,
  RETENTION_CANDIDATES,
  REVIEW_RETENTION_REPORT_SCHEMA,
  type ReviewRetentionOwner,
} from "@/scripts/mission-control/lib/review-retention-report";

const OWNER: ReviewRetentionOwner = {
  kind: "evidence-ledger",
  ledgerPath: "docs/contracts/story-chain/evidence-ledgers/example.ledger.yaml",
  currentRefs: ["acceptance-check:example-current"],
  appliedAspects: ["aspect:example-current"],
};

function review(
  date: string,
  options: {
    ref?: string;
    verdict?: "met" | "not-met" | "unknown";
    text?: string;
  } = {},
): string {
  const ref = options.ref ?? "acceptance-check:example-old";
  return [
    `#### ${date} — review`,
    "",
    options.text ?? "",
    "```yaml",
    `date: ${date}`,
    "acs:",
    `  - ${ref}`,
    "acReviewedRevision:",
    "  - 1",
    "fixtureRef: fixture",
    "runCommitSha: 0123456789abcdef",
    `observedOutput: ${"evidence ".repeat(12)}`,
    "gaps:",
    "  - reject: none",
    `verdict: ${options.verdict ?? "met"}`,
    "```",
    "",
  ].join("\n");
}

describe("review retention report", () => {
  it("uses date order and preserves the physical-last reader carrier", () => {
    const source = [
      review("2026-07-03"),
      review("2026-07-01", { ref: "acceptance-check:example-current" }),
      review("2026-07-02", { text: "aspect:example-current" }),
    ].join("\n");

    const result = analyzeReviewRetentionStream({
      slug: "example",
      relativePath: "reviews/example.reviews.md",
      source,
      owner: OWNER,
      candidates: [1],
    });

    expect(result.chronologicalLatestGenerationId).toBe("2026-07-03#1");
    expect(result.physicalLastGenerationId).toBe("2026-07-02#3");
    expect(result.orderingHazard).toBe(true);
    expect(result.scenarios[0].effectiveKeepGenerationIds).toEqual([
      "2026-07-03#1",
      "2026-07-02#3",
      "2026-07-01#2",
    ]);
    expect(result.scenarios[0].wouldDisposeGenerationIds).toEqual([]);
  });

  it("lets the later physical entry win a same-day authority tie", () => {
    const source = [
      review("2026-07-03", { ref: "acceptance-check:example-current" }),
      review("2026-07-03", {
        ref: "acceptance-check:example-current",
        text: "aspect:example-current",
      }),
      review("2026-07-01"),
    ].join("\n");

    const result = analyzeReviewRetentionStream({
      slug: "example",
      relativePath: "reviews/example.reviews.md",
      source,
      owner: OWNER,
      candidates: [1],
    });

    expect(result.chronologicalLatestGenerationId).toBe("2026-07-03#2");
    expect(result.generations[0].authorityRefs).toEqual(["acceptance-check:example-current"]);
    expect(result.generations[0].authorityAspects).toEqual(["aspect:example-current"]);
  });

  it("keeps every foundational generation outside the N window", () => {
    const source = [
      review("2026-07-01"),
      review("2026-07-02"),
      review("2026-07-03"),
      review("2026-07-04"),
    ].join("\n");

    const result = analyzeReviewRetentionStream({
      slug: "product-boundary",
      relativePath: "reviews/product-boundary.reviews.md",
      source,
      owner: {
        kind: "foundational-exempt",
        currentRefs: [],
        appliedAspects: [],
      },
      candidates: [1],
    });

    expect(result.scenarios[0].effectiveKeepGenerationIds).toHaveLength(4);
    expect(result.scenarios[0].wouldDisposeGenerationIds).toEqual([]);
    expect(
      result.generations.every((generation) =>
        generation.authorityReasons.includes("foundational-exempt"),
      ),
    ).toBe(true);
  });

  it("fails closed by retaining every generation when the owner is unmapped", () => {
    const source = [review("2026-07-01"), review("2026-07-02"), review("2026-07-03")].join("\n");

    const result = analyzeReviewRetentionStream({
      slug: "unmapped",
      relativePath: "reviews/unmapped.reviews.md",
      source,
      owner: {
        kind: "unmapped",
        currentRefs: [],
        appliedAspects: [],
      },
      candidates: [1],
    });

    expect(result.scenarios[0].effectiveKeepGenerationIds).toHaveLength(3);
    expect(result.scenarios[0].wouldDisposeGenerationIds).toEqual([]);
    expect(
      result.generations.every((generation) =>
        generation.authorityReasons.includes("unmapped-owner"),
      ),
    ).toBe(true);
  });

  it("does not preserve a historical unresolved generation without authority", () => {
    const source = [
      review("2026-07-01", { verdict: "unknown" }),
      review("2026-07-02"),
      review("2026-07-03"),
      review("2026-07-04", {
        ref: "acceptance-check:example-current",
        text: "aspect:example-current",
      }),
    ].join("\n");

    const result = analyzeReviewRetentionStream({
      slug: "example",
      relativePath: "reviews/example.reviews.md",
      source,
      owner: OWNER,
      candidates: [1],
    });

    expect(result.unresolvedGenerationCount).toBe(1);
    expect(result.currentUnresolvedGenerationCount).toBe(0);
    expect(result.scenarios[0].wouldDisposeGenerationIds).toEqual([
      "2026-07-03#3",
      "2026-07-02#2",
      "2026-07-01#1",
    ]);
  });

  it("does not mutate the supplied source", () => {
    const source = review("2026-07-04", {
      ref: "acceptance-check:example-current",
      text: "aspect:example-current",
    });
    const before = Buffer.from(source);

    analyzeReviewRetentionStream({
      slug: "example",
      relativePath: "reviews/example.reviews.md",
      source,
      owner: OWNER,
    });

    expect(Buffer.from(source).equals(before)).toBe(true);
  });

  it("keeps empty streams and scenario set arithmetic deterministic", () => {
    const empty = analyzeReviewRetentionStream({
      slug: "empty",
      relativePath: "reviews/empty.reviews.md",
      source: "# No dated review entries\n",
      owner: OWNER,
      candidates: [1],
    });
    expect(empty).toMatchObject({
      generationCount: 0,
      chronologicalLatestGenerationId: undefined,
      physicalLastGenerationId: undefined,
      orderingHazard: false,
      unresolvedGenerationCount: 0,
      currentUnresolvedGenerationCount: 0,
    });
    expect(empty.scenarios).toEqual([
      {
        keepGenerations: 1,
        rawKeepGenerationIds: [],
        exceptionKeepGenerationIds: [],
        effectiveKeepGenerationIds: [],
        wouldDisposeGenerationIds: [],
      },
    ]);

    const source = [
      review("2026-07-01"),
      review("2026-07-02", { ref: "acceptance-check:example-current" }),
      review("2026-07-03"),
      review("2026-07-04"),
    ].join("\n");
    const result = analyzeReviewRetentionStream({
      slug: "example",
      relativePath: "reviews/example.reviews.md",
      source,
      owner: OWNER,
      candidates: [1, 3],
    });
    expect(result.scenarios).toEqual([
      {
        keepGenerations: 1,
        rawKeepGenerationIds: ["2026-07-04#4"],
        exceptionKeepGenerationIds: ["2026-07-02#2"],
        effectiveKeepGenerationIds: ["2026-07-04#4", "2026-07-02#2"],
        wouldDisposeGenerationIds: ["2026-07-03#3", "2026-07-01#1"],
      },
      {
        keepGenerations: 3,
        rawKeepGenerationIds: ["2026-07-04#4", "2026-07-03#3", "2026-07-02#2"],
        exceptionKeepGenerationIds: [],
        effectiveKeepGenerationIds: ["2026-07-04#4", "2026-07-03#3", "2026-07-02#2"],
        wouldDisposeGenerationIds: ["2026-07-01#1"],
      },
    ]);
  });

  it("builds a repository report with internally consistent owners, totals, cadence, and candidates", () => {
    const report = buildReviewRetentionReport(process.cwd(), {
      generatedAt: "2026-08-03T00:00:00.000Z",
      repositoryRevision: "0123456789abcdef",
      dirty: false,
    });

    expect(report.schema).toBe(REVIEW_RETENTION_REPORT_SCHEMA);
    expect(report.generatedAt).toBe("2026-08-03T00:00:00.000Z");
    expect(report.repositoryRevision).toBe("0123456789abcdef");
    expect(report.dirty).toBe(false);
    expect(report.policy.candidateKeepGenerations).toEqual([...RETENTION_CANDIDATES]);
    expect(report.policy.mutation).toBe("disabled");
    expect(report.policy.gate).toBe("disabled");
    expect(report.streams.length).toBeGreaterThan(0);
    expect(report.population.streamCount).toBe(report.streams.length);
    expect(report.population.generationCount).toBe(
      report.streams.reduce((total, stream) => total + stream.generationCount, 0),
    );
    expect(report.population.lineCount).toBe(
      report.streams.reduce((total, stream) => total + stream.lineCount, 0),
    );
    expect(report.population.byteCount).toBe(
      report.streams.reduce((total, stream) => total + stream.byteCount, 0),
    );
    expect(report.population.orderingHazardStreamCount).toBe(
      report.streams.filter((stream) => stream.orderingHazard).length,
    );
    expect(report.population.foundationalExemptStreamCount).toBe(
      report.streams.filter((stream) => stream.owner.kind === "foundational-exempt").length,
    );
    expect(report.population.unmappedStreamCount).toBe(
      report.streams.filter((stream) => stream.owner.kind === "unmapped").length,
    );
    expect(report.candidates.map((candidate) => candidate.keepGenerations)).toEqual([
      ...RETENTION_CANDIDATES,
    ]);
    for (const candidate of report.candidates) {
      expect(candidate.effectiveKeep).toBe(candidate.rawKeep + candidate.authorityExceptions);
      expect(candidate.effectiveKeep + candidate.wouldDispose).toBe(
        report.population.generationCount,
      );
    }
    expect(report.cadence.intervalSampleCount).toBeGreaterThan(0);
    expect(report.streams.some((stream) => stream.owner.kind === "evidence-ledger")).toBe(true);
    expect(report.streams.some((stream) => stream.owner.kind === "foundational-exempt")).toBe(true);
  });
});
