import { describe, expect, it } from "vitest";

import type { ReviewEntry } from "@/app/server/services/story-chain/review-parser";
import { extractLatestAspectReview } from "@/scripts/mission-control/lib/aspect-verdict";

function review(
  date: string,
  options: {
    heading?: string;
    observedOutput?: string;
    gaps?: string[];
    verdict?: "met" | "not-met" | "unknown";
  } = {},
): ReviewEntry {
  return {
    sourcePath: "/repo/reviews/example.reviews.md",
    date,
    headingLine: options.heading ?? `#### ${date} — review`,
    yaml: {
      date,
      acs: ["acceptance-check:example"],
      acReviewedRevision: [1],
      observedOutput: options.observedOutput,
      gaps: options.gaps ?? [],
      verdict: options.verdict,
    },
    grandfathered: false,
  };
}

describe("extractLatestAspectReview — typed review graph", () => {
  it("returns the latest typed entry that names the Aspect", () => {
    const result = extractLatestAspectReview(
      [
        review("2026-01-15", {
          heading: "#### 2026-01-15 — aspect:foo first review",
          verdict: "not-met",
        }),
        review("2026-02-01", {
          observedOutput: "aspect:foo is woven into the current surface",
          verdict: "met",
        }),
        review("2026-02-10", {
          heading: "#### 2026-02-10 — aspect:other unrelated",
          verdict: "not-met",
        }),
      ],
      "aspect:foo",
    );
    expect(result).toEqual({ date: "2026-02-01", verdict: "met" });
  });

  it("finds an Aspect reference in structured gaps and defaults a missing verdict", () => {
    expect(
      extractLatestAspectReview(
        [review("2026-03-01", { gaps: ["adopt: aspect:foo remains covered"] })],
        "aspect:foo",
      ),
    ).toEqual({ date: "2026-03-01", verdict: "unknown" });
  });

  it("returns undefined when no typed review entry names the Aspect", () => {
    expect(
      extractLatestAspectReview(
        [review("2026-02-10", { heading: "#### 2026-02-10 — aspect:other" })],
        "aspect:foo",
      ),
    ).toBeUndefined();
  });

  it("ignores grandfathered prose-only entries", () => {
    const grandfathered: ReviewEntry = {
      sourcePath: "/repo/reviews/example.reviews.md",
      date: "2026-01-01",
      headingLine: "#### 2026-01-01 — aspect:foo historical prose",
      yaml: null,
      grandfathered: true,
    };
    expect(extractLatestAspectReview([grandfathered], "aspect:foo")).toBeUndefined();
  });
});
