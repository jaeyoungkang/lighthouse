import { describe, expect, it } from "vitest";

import { latestReviewEntry } from "../review-entry-currentness";
import type { ReviewEntry } from "../review-parser";

function entry(date: string, verdict: "met" | "not-met" | "unknown"): ReviewEntry {
  return {
    date,
    headingLine: `#### ${date}`,
    grandfathered: false,
    yaml: {
      fixtureRef: "fixture",
      acs: [],
      acReviewedRevision: [],
      observedOutput: "output",
      gaps: [],
      verdict,
    },
  };
}

describe("review currentness", () => {
  it("selects the newest date regardless of physical file order", () => {
    const oldestMet = entry("2026-07-01", "met");
    const newestUnknown = entry("2026-08-02", "unknown");

    expect(latestReviewEntry([newestUnknown, oldestMet])?.yaml?.verdict).toBe("unknown");
    expect(latestReviewEntry([oldestMet, newestUnknown])?.yaml?.verdict).toBe("unknown");
  });

  it("uses the later physical entry as the same-day tie breaker", () => {
    expect(
      latestReviewEntry([entry("2026-08-02", "met"), entry("2026-08-02", "not-met")])?.yaml
        ?.verdict,
    ).toBe("not-met");
  });
});
