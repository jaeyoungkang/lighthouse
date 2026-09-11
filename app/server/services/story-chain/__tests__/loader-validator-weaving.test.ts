import { describe, expect, it } from "vitest";

import type { StoryChain } from "@/app/server/services/story-chain/loader";
import { validateStoryChain } from "@/app/server/services/story-chain/validator";
import {
  defaultTraceabilityCardinality,
  makeServicePolicyMatrix,
} from "@/app/server/services/story-chain/__tests__/loader-validator-audit-helpers";

function makeWeaveChain(options: {
  promiseAspects: `aspect:${string}`[];
  aspectAppliesTo: `promise:${string}`[];
}): StoryChain {
  return {
    scenarios: [{ id: "scenario:test", label: "Test" }],
    experiences: [
      {
        id: "experience:e1",
        slug: "e1",
        title: "E1",
        scope: "core-product",
        servicePolicyCoverage: "complete",
        servicePolicyCoverageReview:
          "docs/contracts/story-chain/service-policy-coverage/test.matrix.yaml",
      },
    ],
    moments: [
      {
        id: "moment:m1",
        slug: "m1",
        title: "M1",
        experience: "experience:e1",
      },
    ],
    promises: [
      {
        id: "promise:p1",
        slug: "p1",
        title: "P1",
        moment: "moment:m1",
        lane: "search",
        status: "draft",
        aspects: options.promiseAspects,
        intentChecks: [],
        acceptanceChecks: [
          {
            id: "acceptance-check:dummy",
            description: "x",
            evidence: "x",
          },
        ],
        coveringLedgers: [],
        verdict: "unknown",
        promiseStatement: "",
      },
    ],
    aspects: [
      {
        id: "aspect:a1",
        slug: "a1",
        title: "A1",
        whyDeclaration: "",
        appliesTo: options.aspectAppliesTo,
        coveringLedger: null,
        verdict: "unverified",
      },
    ],
    evidenceLedgers: [
      {
        path: "absorbed.ledger.yaml",
        schemaVersion: 2,
        slug: "absorbed",
        reviewPath: "reviews/absorbed.reviews.md",
        intentMode: "absorbed",
        sourcePromises: ["promise:p1"],
        appliedAspects: [],
        intentCheckEntries: [],
        intentDelegations: [],
        acceptanceCheckEntries: [
          {
            key: "promise:p1#acceptance-check:dummy",
            check: "acceptance-check:dummy",
            evidence: "x",
            executionRefs: ["execution:x"],
            sourcePromise: "promise:p1",
            scenarioRefs: ["scenario:test"],
          },
        ],
        executions: [{ id: "execution:x", kind: "vitest", files: ["app/x.test.ts"] }],
        implementationContracts: [],
        verdict: "unknown",
      },
    ],
    servicePolicyMatrices: [makeServicePolicyMatrix()],
    traceabilityCardinality: defaultTraceabilityCardinality(),
    reviewEntries: [],
  };
}

describe("validateStoryChain — aspect/promise reciprocal weaving (issue #193)", () => {
  it("throws when an aspect's appliesTo names a promise that does not declare the aspect back", () => {
    const chain = makeWeaveChain({ promiseAspects: [], aspectAppliesTo: ["promise:p1"] });
    expect(() => validateStoryChain(chain)).toThrow(
      /does not declare the aspect back in its aspects list/,
    );
  });

  it("throws when a promise declares an aspect whose appliesTo pointcut omits the promise", () => {
    const chain = makeWeaveChain({ promiseAspects: ["aspect:a1"], aspectAppliesTo: [] });
    expect(() => validateStoryChain(chain)).toThrow(
      /appliesTo pointcut does not include this promise/,
    );
  });

  it("passes when promise.aspects and aspect.appliesTo mirror each other", () => {
    const chain = makeWeaveChain({
      promiseAspects: ["aspect:a1"],
      aspectAppliesTo: ["promise:p1"],
    });
    expect(() => validateStoryChain(chain)).not.toThrow();
  });
});
