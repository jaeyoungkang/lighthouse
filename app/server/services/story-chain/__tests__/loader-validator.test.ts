import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  STORY_CHAIN_DIR_REL,
  type StoryChain,
  loadStoryChain,
} from "@/app/server/services/story-chain/loader";
import { StoryChainParseError } from "@/app/server/services/story-chain/parser-shared";
import { validateStoryChain } from "@/app/server/services/story-chain/validator";
import {
  assertCanonicalRepositoryIntegrity,
  assertNonContractAndLegacyLedgerBoundaries,
  assertTraceabilityCardinalityPolicyFailures,
  defaultTraceabilityCardinality,
  makeChainSkeleton,
  makeEmptyChain,
  makeServicePolicyMatrix,
  makeTempRepo,
  writeServicePolicyMatrixFile,
} from "@/app/server/services/story-chain/__tests__/loader-validator-audit-helpers";

function makeCoreExperience(): StoryChain["experiences"][number] {
  return {
    id: "experience:e1",
    slug: "e1",
    title: "E1",
    scope: "core-product",
    servicePolicyCoverage: "complete",
    servicePolicyCoverageReview:
      "docs/contracts/story-chain/service-policy-coverage/test.matrix.yaml",
  };
}

function writeServicePolicyExperience(chainRoot: string, reviewRef: string): void {
  writeFileSync(
    path.join(chainRoot, "experiences", "research.md"),
    `---
id: experience:research
slug: research
title: Research
scope: core-product
servicePolicyCoverage: unresolved
servicePolicyCoverageReview: ${reviewRef}
---
`,
  );
}

describe("loadStoryChain — missing directory failure modes", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = makeTempRepo();
  });
  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it("throws when the story-chain root directory is missing", () => {
    // No story-chain dir created at all.
    expect(() => loadStoryChain(repoRoot)).toThrow(StoryChainParseError);
    expect(() => loadStoryChain(repoRoot)).toThrow(/story-chain root directory is missing/);
  });

  it("throws when a required subdirectory is missing", () => {
    makeChainSkeleton(repoRoot);
    rmSync(path.join(repoRoot, STORY_CHAIN_DIR_REL, "promises"), { recursive: true });
    expect(() => loadStoryChain(repoRoot)).toThrow(/story-chain\/promises directory is missing/);
  });

  it("throws when a required directory path is occupied by a file", () => {
    makeChainSkeleton(repoRoot);
    const promisesPath = path.join(repoRoot, STORY_CHAIN_DIR_REL, "promises");
    rmSync(promisesPath, { recursive: true });
    writeFileSync(promisesPath, "not a directory\n");

    expect(() => loadStoryChain(repoRoot)).toThrow(
      /story-chain\/promises path .* is not a directory/,
    );
  });

  it("throws when the current Sufficiency Review owner directory is missing", () => {
    const chainRoot = makeChainSkeleton(repoRoot);
    rmSync(path.join(chainRoot, "evidence-ledgers", "reviews"), { recursive: true });
    expect(() => loadStoryChain(repoRoot)).toThrow(
      /story-chain\/evidence-ledgers\/reviews directory is missing/,
    );
  });

  it("loads an empty-but-complete skeleton without throwing at the loader layer", () => {
    // Loader owns structure; the validator owns graph emptiness.
    makeChainSkeleton(repoRoot);
    const chain = loadStoryChain(repoRoot);
    expect(chain.experiences).toHaveLength(0);
    expect(chain.moments).toHaveLength(0);
    expect(chain.promises).toHaveLength(0);
    expect(chain.aspects).toHaveLength(0);
    expect(chain.evidenceLedgers).toHaveLength(0);
  });

  it("rejects release-verdict documentation that drops a canonical domain dimension", () => {
    makeChainSkeleton(repoRoot);
    const missionControlPath = path.join(repoRoot, "docs", "mission-control.md");
    const source = readFileSync(missionControlPath, "utf8");
    writeFileSync(missionControlPath, source.replace("- Service Policy Coverage;\n", ""));
    expect(() => loadStoryChain(repoRoot)).toThrow(
      /Release Verdict dimensions drifted from the domain-owned four-dimension contract/,
    );
  });

  it("ignores non-contract files but rejects a legacy Markdown Evidence Ledger", () => {
    const chainRoot = makeChainSkeleton(repoRoot);
    assertNonContractAndLegacyLedgerBoundaries(repoRoot, chainRoot);
  });

  it("rejects missing and malformed traceability cardinality policy", () => {
    const chainRoot = makeChainSkeleton(repoRoot);
    assertTraceabilityCardinalityPolicyFailures(repoRoot, chainRoot);
  });

  it("requires every scenario heading to use a semantic scenario ref", () => {
    const chainRoot = makeChainSkeleton(repoRoot);
    writeFileSync(
      path.join(chainRoot, "scenario-catalog.md"),
      "# Scenario catalog\n\n### 시나리오 C1: legacy coordinate\n",
    );
    expect(() => loadStoryChain(repoRoot)).toThrow(
      /scenario heading must use "scenario:<semantic-slug>: <label>"/,
    );
  });

  it("rejects references to scenarios that are not declared by an active heading", () => {
    const chainRoot = makeChainSkeleton(repoRoot);
    writeFileSync(
      path.join(chainRoot, "scenario-catalog.md"),
      "# Scenario catalog\n\n### 시나리오 scenario:active: Active\n\nSee scenario:retired.\n",
    );
    expect(() => loadStoryChain(repoRoot)).toThrow(
      /scenario reference "scenario:retired" is not declared by an active scenario heading/,
    );
  });

  it("rejects a local service policy review pointer that does not resolve", () => {
    const chainRoot = makeChainSkeleton(repoRoot);
    writeServicePolicyExperience(chainRoot, "docs/decisions/missing-service-policy-review.md");

    expect(() => loadStoryChain(repoRoot)).toThrow(
      /servicePolicyCoverageReview does not exist: docs\/decisions\/missing-service-policy-review\.md/,
    );
  });

  it("rejects local service policy review pointers outside docs or through symlinks", () => {
    const chainRoot = makeChainSkeleton(repoRoot);
    const outsideReview = path.join(repoRoot, "outside-review.matrix.yaml");
    writeServicePolicyMatrixFile(outsideReview, "experience:research");
    writeServicePolicyExperience(chainRoot, "docs/../outside-review.matrix.yaml");
    expect(() => loadStoryChain(repoRoot)).toThrow(/must resolve inside the repository docs/);

    const matrixDir = path.join(chainRoot, "service-policy-coverage");
    symlinkSync(outsideReview, path.join(matrixDir, "service-policy-review.matrix.yaml"));
    writeServicePolicyExperience(
      chainRoot,
      "docs/contracts/story-chain/service-policy-coverage/service-policy-review.matrix.yaml",
    );
    expect(() => loadStoryChain(repoRoot)).toThrow(/regular non-symlink file/);

    rmSync(path.join(matrixDir, "service-policy-review.matrix.yaml"));
    writeServicePolicyMatrixFile(
      path.join(matrixDir, "service-policy-review.matrix.yaml"),
      "experience:research",
    );
    expect(() => loadStoryChain(repoRoot)).not.toThrow();

    const outsideDir = path.join(repoRoot, "outside-decisions");
    mkdirSync(outsideDir);
    writeServicePolicyMatrixFile(
      path.join(outsideDir, "review.matrix.yaml"),
      "experience:research",
    );
    symlinkSync(outsideDir, path.join(repoRoot, "docs", "linked-decisions"));
    writeServicePolicyExperience(chainRoot, "docs/linked-decisions/review.matrix.yaml");
    expect(() => loadStoryChain(repoRoot)).toThrow(/remain inside the real repository docs/);
  });
});

describe("loadStoryChain + validateStoryChain — canonical repository integration", () => {
  it("loads every current owner and returns a summary derived from the same graph", () => {
    assertCanonicalRepositoryIntegrity(process.cwd());
  });
});

describe("validateStoryChain — empty graph failure modes", () => {
  it("throws when every category is empty (deleted-content scenario)", () => {
    expect(() => validateStoryChain(makeEmptyChain())).toThrow(StoryChainParseError);
    expect(() => validateStoryChain(makeEmptyChain())).toThrow(
      /zero experiences, zero moments, zero promises, zero aspects, zero evidence ledgers/,
    );
  });

  it("throws when promises is empty (no work declared)", () => {
    // Provide non-empty parents/aspects/ledgers but zero promises — still must fail.
    const chain = makeEmptyChain({
      experiences: [makeCoreExperience()],
      moments: [
        {
          id: "moment:m1",
          slug: "m1",
          title: "M1",
          experience: "experience:e1",
        },
      ],
      aspects: [
        {
          id: "aspect:a1",
          slug: "a1",
          title: "A1",
          whyDeclaration: "",
          appliesTo: [],
          coveringLedger: null,
          verdict: "unverified",
        },
      ],
      evidenceLedgers: [
        {
          path: "x.ledger.yaml",
          schemaVersion: 2,
          slug: "x",
          reviewPath: "reviews/x.reviews.md",
          intentMode: "absorbed",
          sourcePromises: [],
          appliedAspects: [],
          intentCheckEntries: [],
          intentDelegations: [],
          acceptanceCheckEntries: [],
          executions: [],
          implementationContracts: [],
          verdict: "unknown",
        },
      ],
    });
    expect(() => validateStoryChain(chain)).toThrow(/zero promises/);
  });
});

describe("validateStoryChain — Evidence Ledger v2 intent modes", () => {
  it("throws when an explicit ledger has zero Intent Check entries", () => {
    const chain = makeEmptyChain({
      experiences: [makeCoreExperience()],
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
          aspects: [],
          intentChecks: [],
          acceptanceChecks: [],
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
          appliesTo: [],
          coveringLedger: null,
          verdict: "unverified",
        },
      ],
      evidenceLedgers: [
        {
          path: "explicit-but-empty.ledger.yaml",
          schemaVersion: 2,
          slug: "explicit-but-empty",
          reviewPath: "reviews/explicit-but-empty.reviews.md",
          intentMode: "explicit",
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
              scenarioRefs: [],
            },
          ],
          executions: [{ id: "execution:x", kind: "vitest", files: ["app/x.test.ts"] }],
          implementationContracts: [],
          verdict: "unknown",
        },
      ],
    });
    expect(() => validateStoryChain(chain)).toThrow(/zero Intent Check entries/);
  });

  it("throws when an explicit ledger has zero Acceptance Check entries", () => {
    const chain = makeEmptyChain({
      experiences: [makeCoreExperience()],
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
          aspects: [],
          intentChecks: [],
          acceptanceChecks: [],
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
          appliesTo: [],
          coveringLedger: null,
          verdict: "unverified",
        },
      ],
      evidenceLedgers: [
        {
          path: "explicit-no-ac.ledger.yaml",
          schemaVersion: 2,
          slug: "explicit-no-ac",
          reviewPath: "reviews/explicit-no-ac.reviews.md",
          intentMode: "explicit",
          sourcePromises: ["promise:p1"],
          appliedAspects: [],
          intentCheckEntries: [
            {
              key: "promise:p1#intent-check:dummy",
              id: "intent-check:dummy",
              evidence: "x",
              sourcePromise: "promise:p1",
            },
          ],
          intentDelegations: [],
          acceptanceCheckEntries: [],
          executions: [],
          implementationContracts: [],
          verdict: "unknown",
        },
      ],
    });
    expect(() => validateStoryChain(chain)).toThrow(/zero Acceptance Check entries/);
  });

  it("accepts absorbed mode without Intent Checks when AC coverage is present", () => {
    const chain = makeEmptyChain({
      scenarios: [{ id: "scenario:test", label: "Test" }],
      experiences: [makeCoreExperience()],
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
          aspects: [],
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
          appliesTo: [],
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
    });
    expect(() => validateStoryChain(chain)).not.toThrow();
  });
});

describe("validateStoryChain — absorbed intent mode", () => {
  type LedgerLiteral = StoryChain["evidenceLedgers"][number];
  function makeAbsorbedChain(overrides: {
    extraPromiseIds?: string[];
    promiseIntentChecks?: StoryChain["promises"][number]["intentChecks"];
    ledgerIntentEntries?: LedgerLiteral["intentCheckEntries"];
    ledgerAcceptanceEntries?: LedgerLiteral["acceptanceCheckEntries"];
    ledgerSourcePromises?: LedgerLiteral["sourcePromises"];
  }): StoryChain {
    const extraIds = overrides.extraPromiseIds ?? [];
    const allPromiseIds = ["promise:p1", ...extraIds] as const;
    const sourcePromises =
      overrides.ledgerSourcePromises ??
      (allPromiseIds as unknown as LedgerLiteral["sourcePromises"]);
    return {
      scenarios: [{ id: "scenario:test", label: "Test" }],
      experiences: [makeCoreExperience()],
      moments: [
        {
          id: "moment:m1",
          slug: "m1",
          title: "M1",
          experience: "experience:e1",
        },
      ],
      promises: allPromiseIds.map((id) => ({
        id: id as StoryChain["promises"][number]["id"],
        slug: id.slice("promise:".length),
        title: id,
        moment: "moment:m1",
        lane: "search",
        status: "draft",
        aspects: [],
        intentChecks: id === "promise:p1" ? (overrides.promiseIntentChecks ?? []) : [],
        acceptanceChecks: [
          {
            id: `acceptance-check:${id.slice("promise:".length)}-ac1` as StoryChain["promises"][number]["acceptanceChecks"][number]["id"],
            description: "x",
            evidence: "x",
          },
        ],
        coveringLedgers: [],
        verdict: "unknown",
        promiseStatement: "",
      })),
      aspects: [
        {
          id: "aspect:a1",
          slug: "a1",
          title: "A1",
          whyDeclaration: "",
          appliesTo: [],
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
          sourcePromises,
          appliedAspects: [],
          intentCheckEntries: overrides.ledgerIntentEntries ?? [],
          intentDelegations: [],
          acceptanceCheckEntries:
            overrides.ledgerAcceptanceEntries ??
            allPromiseIds.map((id) => {
              const check =
                `acceptance-check:${id.slice("promise:".length)}-ac1` as LedgerLiteral["acceptanceCheckEntries"][number]["check"];
              return {
                key: `${id}#${check}` as LedgerLiteral["acceptanceCheckEntries"][number]["key"],
                check,
                evidence: "x",
                executionRefs: ["execution:x"],
                sourcePromise:
                  id as LedgerLiteral["acceptanceCheckEntries"][number]["sourcePromise"],
                scenarioRefs: id === "promise:p1" ? ["scenario:test"] : [],
              };
            }),
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

  it("accepts zero Intent Check entries when intent is absorbed and every source promise has AC coverage", () => {
    const chain = makeAbsorbedChain({});
    const summary = validateStoryChain(chain);
    expect(summary.absorbedIntentLedgerCount).toBe(1);
    expect(summary.explicitIntentLedgerCount).toBe(0);
    expect(summary.delegatedIntentLedgerCount).toBe(0);
  });

  it("requires a service policy coverage status and review on core-product Experiences", () => {
    const missingStatus = makeAbsorbedChain({});
    delete missingStatus.experiences[0]?.servicePolicyCoverage;
    expect(() => validateStoryChain(missingStatus)).toThrow(
      /must declare servicePolicyCoverage before composing its Story Chain bundle/,
    );

    const missingReview = makeAbsorbedChain({});
    delete missingReview.experiences[0]?.servicePolicyCoverageReview;
    expect(() => validateStoryChain(missingReview)).toThrow(
      /must cite servicePolicyCoverageReview/,
    );

    const malformedReview = makeAbsorbedChain({});
    if (!malformedReview.experiences[0]) throw new Error("expected fixture Experience");
    malformedReview.experiences[0].servicePolicyCoverageReview = "reviewed somewhere";
    expect(() => validateStoryChain(malformedReview)).toThrow(
      /must point to a versioned Story Chain \*\.matrix\.yaml file/,
    );

    const aggregateMismatch = makeAbsorbedChain({});
    const firstItem = aggregateMismatch.servicePolicyMatrices[0]?.families[0]?.items[0];
    firstItem.disposition = "unresolved";
    expect(() => validateStoryChain(aggregateMismatch)).toThrow(
      /servicePolicyCoverage complete does not match Matrix aggregate unresolved/,
    );

    const orphanMatrix = makeAbsorbedChain({});
    orphanMatrix.experiences[0] = { ...orphanMatrix.experiences[0], scope: "governance" };
    expect(() => validateStoryChain(orphanMatrix)).toThrow(/must be a core-product Experience/);
  });

  it("rejects an active scenario with no owning Evidence Ledger entry", () => {
    const chain = makeAbsorbedChain({});
    chain.scenarios.push({ id: "scenario:unowned", label: "Unowned" });
    expect(() => validateStoryChain(chain)).toThrow(
      /scenario_evidence_coverage: scenario:unowned -> evidence-ledger-entry: cardinality 0 violates 1\.\.\*/,
    );
  });

  it("rejects an Evidence Ledger scenario ref outside the active catalog", () => {
    const chain = makeAbsorbedChain({});
    const entry = chain.evidenceLedgers[0]?.acceptanceCheckEntries[0];
    entry.scenarioRefs = ["scenario:not-active"];
    expect(() => validateStoryChain(chain)).toThrow(/scenario:not-active.*not active/);
  });

  it("rejects duplicate active scenario ids", () => {
    const chain = makeAbsorbedChain({});
    chain.scenarios.push({ id: "scenario:test", label: "Duplicate" });
    expect(() => validateStoryChain(chain)).toThrow(/scenarios: duplicate id "scenario:test"/);
  });

  it("requires nodeTypes to match the validator's known node type set", () => {
    const missing = makeAbsorbedChain({});
    const withoutScenario = { ...missing.traceabilityCardinality.nodeTypes } as Partial<
      typeof missing.traceabilityCardinality.nodeTypes
    >;
    delete withoutScenario.scenario;
    missing.traceabilityCardinality.nodeTypes =
      withoutScenario as typeof missing.traceabilityCardinality.nodeTypes;
    expect(() => validateStoryChain(missing)).toThrow(
      /nodeTypes must match validator node types \(missing: scenario; unexpected: none\)/,
    );

    const unexpected = makeAbsorbedChain({});
    unexpected.traceabilityCardinality.nodeTypes = {
      ...unexpected.traceabilityCardinality.nodeTypes,
      run: "run:",
    } as typeof unexpected.traceabilityCardinality.nodeTypes;
    expect(() => validateStoryChain(unexpected)).toThrow(
      /nodeTypes must match validator node types \(missing: none; unexpected: run\)/,
    );
  });

  it("throws when an intent-absorbed ledger still has zero Acceptance Check entries — AC ≥ 1 stays mandatory across both subtypes", () => {
    const chain = makeAbsorbedChain({ ledgerAcceptanceEntries: [] });
    expect(() => validateStoryChain(chain)).toThrow(/zero Acceptance Check entries/);
  });

  it("throws when an intent-absorbed ledger still cites Intent Check entries — the absorption claim is incompatible with citing live-judge ICs on the same ledger", () => {
    const chain = makeAbsorbedChain({
      ledgerIntentEntries: [
        {
          key: "promise:p1#intent-check:should-not-be-here",
          id: "intent-check:should-not-be-here",
          evidence: "x",
          sourcePromise: "promise:p1",
        },
      ],
    });
    expect(() => validateStoryChain(chain)).toThrow(
      /absorbed intent mode cites.*Intent Check entries/,
    );
  });

  it("throws when an intent-absorbed ledger's source promise still declares formal IntentCheck blocks — absorption claim must match promise reality", () => {
    const chain = makeAbsorbedChain({
      promiseIntentChecks: [
        {
          id: "intent-check:still-on-promise",
          question: "q",
          evidence: "x",
          whyLiveJudge: "x",
          linkedAcceptanceChecks: [],
          answerCriteria: "x",
        },
      ],
    });
    expect(() => validateStoryChain(chain)).toThrow(
      /absorbed intent mode cannot cover.*formal Intent Checks/,
    );
  });

  // Phase 3C-6.1 — Guard 1: per-source-promise AC coverage on absorbed ledgers.
  it("throws when an intent-absorbed multi-promise ledger has zero AC entries for one of its source promises (Guard 1 — per-source-promise AC coverage)", () => {
    const chain = makeAbsorbedChain({
      extraPromiseIds: ["promise:p2"],
      // Override AC entries to cover only p1, leaving p2 uncovered.
      ledgerAcceptanceEntries: [
        {
          key: "promise:p1#acceptance-check:p1-ac1" as LedgerLiteral["acceptanceCheckEntries"][number]["key"],
          check: "acceptance-check:p1-ac1",
          evidence: "x",
          executionRefs: ["execution:x"],
          sourcePromise: "promise:p1",
          scenarioRefs: [],
        },
      ],
    });
    expect(() => validateStoryChain(chain)).toThrow(/carry zero Acceptance Check entries/);
  });
});

describe("validateStoryChain — missing-ledger emptiness mode", () => {
  it("throws when evidence ledgers is empty (no weaving record)", () => {
    const chain = makeEmptyChain({
      experiences: [makeCoreExperience()],
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
          aspects: [],
          intentChecks: [],
          acceptanceChecks: [],
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
          appliesTo: [],
          coveringLedger: null,
          verdict: "unverified",
        },
      ],
    });
    expect(() => validateStoryChain(chain)).toThrow(/zero evidence ledgers/);
  });
});
