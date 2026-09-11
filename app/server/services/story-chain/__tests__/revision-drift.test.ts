import { describe, expect, it } from "vitest";

import type { AcceptanceCheck } from "@/app/domain/story-chain";
import {
  detectRevisionDrift,
  hasRevisionDrift,
} from "@/app/server/services/story-chain/revision-drift";
import type { ReviewEntry } from "@/app/server/services/story-chain/review-parser";

function ac(id: string, revision: number | undefined): AcceptanceCheck {
  return {
    id: `acceptance-check:${id}`,
    description: "x",
    evidence: "x",
    revision,
  };
}

function review(date: string, acs: string[], revisions: number[]): ReviewEntry {
  return {
    date,
    headingLine: `#### ${date} — fixture`,
    grandfathered: false,
    yaml: {
      acs: acs.map((id) => `acceptance-check:${id}`),
      acReviewedRevision: revisions,
      gaps: [],
    },
  };
}

describe("revision-drift detection (promise:alignment-coherence-gate AC revision-drift-soft)", () => {
  it("returns no signals when reviewedRevision matches currentRevision", () => {
    const checks = [ac("foo", 1), ac("bar", 2)];
    const reviews = [review("2026-05-15", ["foo", "bar"], [1, 2])];
    expect(detectRevisionDrift(checks, reviews)).toEqual([]);
    expect(hasRevisionDrift(detectRevisionDrift(checks, reviews))).toBe(false);
  });

  it("returns a signal when reviewedRevision lags currentRevision", () => {
    const checks = [ac("foo", 3)];
    const reviews = [review("2026-05-15", ["foo"], [1])];
    const signals = detectRevisionDrift(checks, reviews);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      acId: "acceptance-check:foo",
      reviewedRevision: 1,
      currentRevision: 3,
      reviewDate: "2026-05-15",
    });
    expect(hasRevisionDrift(signals)).toBe(true);
  });

  it("uses the most recent review entry per AC", () => {
    const checks = [ac("foo", 2)];
    const reviews = [
      review("2026-05-15", ["foo"], [1]), // stale
      review("2026-06-01", ["foo"], [2]), // newer; should win
    ];
    expect(detectRevisionDrift(checks, reviews)).toEqual([]);
  });

  it("aligns acReviewedRevision with acceptance-check refs even when intent-check refs are interleaved", () => {
    const checks = [ac("foo", 2)];
    // yaml.acs has [intent, ac] but acReviewedRevision only has the AC's
    // entry. Drift detection must filter to acceptance-check refs first.
    const reviews: ReviewEntry[] = [
      {
        date: "2026-05-15",
        headingLine: "#### 2026-05-15 — fixture",
        grandfathered: false,
        yaml: {
          acs: ["intent-check:foo-quality", "acceptance-check:foo"],
          acReviewedRevision: [1], // parallel only to acceptance-check entries
          gaps: [],
        },
      },
    ];
    const signals = detectRevisionDrift(checks, reviews);
    expect(signals).toHaveLength(1);
    expect(signals[0].acId).toBe("acceptance-check:foo");
    expect(signals[0].reviewedRevision).toBe(1);
    expect(signals[0].currentRevision).toBe(2);
  });

  it("breaks same-day review ties by file order (later entry wins)", () => {
    const checks = [ac("foo", 2)];
    // Two entries on the same day for the same AC: the second one in file
    // order is the newer same-day update and should win.
    const reviews = [
      review("2026-05-15", ["foo"], [1]), // stale
      review("2026-05-15", ["foo"], [2]), // refreshed same day; should win
    ];
    expect(detectRevisionDrift(checks, reviews)).toEqual([]);
  });

  it("ignores grandfathered review entries", () => {
    const checks = [ac("foo", 2)];
    const grandfathered: ReviewEntry = {
      date: "2026-05-15",
      headingLine: "#### 2026-05-15 — grandfathered",
      grandfathered: true,
      yaml: null,
    };
    expect(detectRevisionDrift(checks, [grandfathered])).toEqual([]);
  });

  it("ignores ACs without a declared revision (auto-grandfathered)", () => {
    const checks = [ac("foo", undefined)];
    const reviews = [review("2026-05-15", ["foo"], [1])];
    expect(detectRevisionDrift(checks, reviews)).toEqual([]);
  });

  it("ignores ACs whose review entry has no acReviewedRevision item", () => {
    const checks = [ac("foo", 2), ac("bar", 2)];
    // Only `foo` has a revision recorded; `bar` is left out.
    const reviews = [review("2026-05-15", ["foo"], [2])];
    expect(detectRevisionDrift(checks, reviews)).toEqual([]);
  });
});
