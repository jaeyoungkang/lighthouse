// Closes `promise:alignment-coherence-gate#acceptance-check:alignment-coherence-gate-revision-drift-soft`
// at the snapshot wiring layer. The detection logic itself is covered by
// `app/server/services/story-chain/__tests__/revision-drift.test.ts`; this
// suite locks the `buildRevisionDriftIndex` glue between the StoryChain
// shape and the per-Promise drift signal map that drives `classifyStage`.

import { describe, expect, it } from "vitest";
import { buildRevisionDriftIndex } from "@/scripts/mission-control/lib/intent-traceability-revision-drift";
import type { StoryChain } from "@/app/server/services/story-chain/loader";
import { TRACEABILITY_NODE_PREFIXES, type PromiseDeclaration } from "@/app/domain/story-chain";
import type { ReviewEntry } from "@/app/server/services/story-chain/review-parser";

function makePromise(overrides: Partial<PromiseDeclaration> = {}): PromiseDeclaration {
  return {
    id: "promise:fixture",
    slug: "fixture",
    title: "Fixture Promise",
    moment: "moment:m1",
    lane: "admin",
    status: "draft",
    aspects: [],
    intentChecks: [],
    acceptanceChecks: [
      {
        id: "acceptance-check:fixture-ac1",
        description: "ac1",
        evidence: "ev",
        revision: 2,
      },
    ],
    coveringLedgers: [],
    verdict: "unknown",
    promiseStatement: "",
    ...overrides,
  };
}

function makeReview(overrides: {
  date?: string;
  acs?: string[];
  acReviewedRevision?: number[];
  grandfathered?: boolean;
}): ReviewEntry {
  const grandfathered = overrides.grandfathered ?? false;
  return {
    date: overrides.date ?? "2026-05-07",
    headingLine: `#### ${overrides.date ?? "2026-05-07"} fixture`,
    grandfathered,
    yaml: grandfathered
      ? null
      : {
          acs: overrides.acs ?? ["acceptance-check:fixture-ac1"],
          acReviewedRevision: overrides.acReviewedRevision ?? [1],
          gaps: [],
        },
  };
}

function makeChain(overrides: Partial<StoryChain>): StoryChain {
  return {
    scenarios: [],
    experiences: [],
    moments: [],
    promises: [],
    aspects: [],
    evidenceLedgers: [],
    servicePolicyMatrices: [],
    traceabilityCardinality: {
      version: 1,
      nodeTypes: { ...TRACEABILITY_NODE_PREFIXES },
      relations: [],
      deferredVerificationTriggers: [],
    },
    reviewEntries: [],
    ...overrides,
  };
}

describe("buildRevisionDriftIndex (snapshot wiring for revision-drift)", () => {
  it("emits a signal for the promise whose AC outpaces the latest review's acReviewedRevision", () => {
    const chain = makeChain({
      promises: [makePromise()],
      reviewEntries: [makeReview({ acReviewedRevision: [1] })],
    });
    const index = buildRevisionDriftIndex(chain);
    expect(index.has("promise:fixture")).toBe(true);
    const signals = index.get("promise:fixture");
    expect(signals).toHaveLength(1);
    expect(signals?.[0]).toMatchObject({
      acId: "acceptance-check:fixture-ac1",
      reviewedRevision: 1,
      currentRevision: 2,
    });
  });

  it("emits no signal when the latest review's acReviewedRevision matches the current AC revision", () => {
    const chain = makeChain({
      promises: [makePromise()],
      reviewEntries: [makeReview({ acReviewedRevision: [2] })],
    });
    expect(buildRevisionDriftIndex(chain).size).toBe(0);
  });

  it("does not bleed review entries from one promise's AC ids into a different promise", () => {
    // Reviewer mentions only promise:fixture's AC. promise:other has its own
    // AC that is not in any review yet — drift detection must skip that
    // promise (no relevant entries) instead of erroneously claiming drift.
    const promiseFixture = makePromise();
    const promiseOther = makePromise({
      id: "promise:other",
      slug: "other",
      acceptanceChecks: [
        {
          id: "acceptance-check:other-ac1",
          description: "ac1",
          evidence: "ev",
          revision: 5,
        },
      ],
    });
    const chain = makeChain({
      promises: [promiseFixture, promiseOther],
      reviewEntries: [
        makeReview({ acs: ["acceptance-check:fixture-ac1"], acReviewedRevision: [1] }),
      ],
    });
    const index = buildRevisionDriftIndex(chain);
    expect(index.has("promise:fixture")).toBe(true);
    expect(index.has("promise:other")).toBe(false);
  });

  it("ignores review entries entirely (yaml is null)", () => {
    const chain = makeChain({
      promises: [makePromise()],
      reviewEntries: [makeReview({ grandfathered: true })],
    });
    expect(buildRevisionDriftIndex(chain).size).toBe(0);
  });

  it("returns an empty index when the chain has no promises with revision-bearing ACs", () => {
    const chain = makeChain({
      promises: [
        makePromise({
          acceptanceChecks: [
            // AC without revision is auto-grandfathered.
            { id: "acceptance-check:fixture-unrevisioned-ac", description: "x", evidence: "x" },
          ],
        }),
      ],
      reviewEntries: [
        makeReview({
          acs: ["acceptance-check:fixture-unrevisioned-ac"],
          acReviewedRevision: [],
        }),
      ],
    });
    expect(buildRevisionDriftIndex(chain).size).toBe(0);
  });
});
