import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  derivePromiseExperience,
  isAcceptanceCheckRef,
  isAspectRef,
  isExperienceRef,
  isIntentCheckRef,
  isMomentRef,
  isPromiseRef,
  requirePromiseExperience,
} from "@/app/domain/story-chain";
import {
  StoryChainParseError,
  parseAspectFile,
  parseExperienceFile,
  parseMomentFile,
  parsePromiseFile,
  resolvePromiseParents,
  resolveEvidenceLedger,
} from "@/app/server/services/story-chain/parser";
import {
  type EvidenceLedgerV2Data,
  parseEvidenceLedgerV2,
  serializeEvidenceLedgerV2,
} from "@/app/server/services/story-chain/evidence-ledger-v2";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const PROMISE_PATH = path.join(
  REPO_ROOT,
  "docs/contracts/story-chain/promises/search-reaction-summarizes-terrain.md",
);
const ASPECT_PATH = path.join(
  REPO_ROOT,
  "docs/contracts/story-chain/aspects/visible-explanation-sufficiency.md",
);
const EXPERIENCE_PATH = path.join(
  REPO_ROOT,
  "docs/contracts/story-chain/experiences/research-and-discovery.md",
);
const MOMENT_PATH = path.join(
  REPO_ROOT,
  "docs/contracts/story-chain/moments/search-results-first-review.md",
);
const SPEC_PATH = path.join(
  REPO_ROOT,
  "docs/contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml",
);

function loadPromise() {
  return parsePromiseFile({
    source: readFileSync(PROMISE_PATH, "utf8"),
    file: PROMISE_PATH,
  });
}

function loadAspect() {
  return parseAspectFile({
    source: readFileSync(ASPECT_PATH, "utf8"),
    file: ASPECT_PATH,
  });
}

function loadExperience() {
  return parseExperienceFile({
    source: readFileSync(EXPERIENCE_PATH, "utf8"),
    file: EXPERIENCE_PATH,
  });
}

function loadMoment() {
  return parseMomentFile({
    source: readFileSync(MOMENT_PATH, "utf8"),
    file: MOMENT_PATH,
  });
}

function loadEvidenceLedger() {
  return parseEvidenceLedgerV2({
    source: readFileSync(SPEC_PATH, "utf8"),
    file: SPEC_PATH,
  });
}

const SYNTHETIC_LEDGER: EvidenceLedgerV2Data = {
  schemaVersion: 2,
  slug: "synthetic",
  review: "reviews/synthetic.reviews.md",
  sourcePromises: ["promise:search-reaction-summarizes-terrain"],
  appliedAspects: ["aspect:visible-explanation-sufficiency"],
  intent: {
    mode: "explicit",
    checks: [
      {
        key: "promise:search-reaction-summarizes-terrain#intent-check:result-set-terrain-is-not-query-repetition",
        evidence: "live judge synthetic",
      },
    ],
    delegations: [],
  },
  acceptanceChecks: [
    {
      key: "promise:search-reaction-summarizes-terrain#acceptance-check:search-reaction-summarizes-terrain-host-gap-action",
      assertion: "vitest synthetic",
      executionRefs: ["execution:synthetic"],
      scenarios: [],
    },
  ],
  executions: [
    {
      id: "execution:synthetic",
      kind: "vitest",
      files: ["app/synthetic.test.ts"],
    },
  ],
  implementationContracts: ["app/synthetic.ts"],
  verdict: "unknown",
};

function loadSyntheticLedger() {
  return parseEvidenceLedgerV2({
    source: serializeEvidenceLedgerV2(SYNTHETIC_LEDGER),
    file: "synthetic.ledger.yaml",
  });
}

describe("story-chain parser — positive load of canonical fixtures", () => {
  it("parses experience scope without introducing a new top-level node type", () => {
    const experience = loadExperience();
    expect(experience.id).toBe("experience:research-and-discovery");
    expect(experience.scope).toBe("core-product");
  });

  it("parses the example promise with a Moment parent and derives its Experience", () => {
    const promise = loadPromise();
    expect(promise.id).toBe("promise:search-reaction-summarizes-terrain");
    expect(isPromiseRef(promise.id)).toBe(true);
    expect(promise.slug).toBe("search-reaction-summarizes-terrain");
    expect(promise).not.toHaveProperty("experience");
    expect(isMomentRef(promise.moment)).toBe(true);
    expect(promise.moment).toBe("moment:search-results-first-review");
    const experience = derivePromiseExperience(promise, [loadMoment()]);
    expect(experience).toBe("experience:research-and-discovery");
    expect(isExperienceRef(experience ?? "")).toBe(true);
    expect(requirePromiseExperience(promise, [loadMoment()], [loadExperience()]).id).toBe(
      "experience:research-and-discovery",
    );
    expect(promise.lane).toBe("search");
    expect(promise.status).toBe("propagated");
    expect(promise.verdict).toBe("met");
  });

  it("parses IntentCheck blocks with rubric fields, distinct from AcceptanceCheck", () => {
    const promise = loadPromise();
    expect(promise.intentChecks).toHaveLength(2);
    const ic = promise.intentChecks.find(
      (intentCheck) => intentCheck.id === "intent-check:result-set-terrain-is-not-query-repetition",
    );
    expect(ic).toBeDefined();
    if (!ic) throw new Error("terrain intent check not parsed");
    expect(isIntentCheckRef(ic.id)).toBe(true);
    expect(ic.whyLiveJudge.length).toBeGreaterThan(0);
    expect(ic.answerCriteria.length).toBeGreaterThan(0);
    expect(ic.linkedAcceptanceChecks).toContain(
      "acceptance-check:search-reaction-summarizes-terrain-host-gap-action",
    );
    // Sanity: IntentCheck fields the AcceptanceCheck shape does not have.
    expect(ic).toHaveProperty("whyLiveJudge");
    expect(ic).toHaveProperty("answerCriteria");
  });

  it("parses AcceptanceCheck blocks without rubric fields", () => {
    const promise = loadPromise();
    expect(promise.acceptanceChecks).toHaveLength(7);
    for (const ac of promise.acceptanceChecks) {
      expect(isAcceptanceCheckRef(ac.id)).toBe(true);
      expect(ac).not.toHaveProperty("whyLiveJudge");
      expect(ac).not.toHaveProperty("answerCriteria");
      expect(ac.runCommand).toMatch(/vitest/);
    }
    expect(promise.acceptanceChecks.map((ac) => ac.id)).toEqual([
      "acceptance-check:search-reaction-summarizes-terrain-host-gap-action",
      "acceptance-check:search-reaction-summarizes-terrain-generation-boundary",
      "acceptance-check:reaction-respond-format",
      "acceptance-check:search-reaction-structured-generation-boundary",
      "acceptance-check:search-reaction-summarizes-terrain-representative-badges",
      "acceptance-check:search-reaction-summarizes-terrain-library-grounding",
      "acceptance-check:search-reaction-summarizes-terrain-input-paper-cap",
    ]);
  });

  it("parses the canonical aspect with appliesTo refs (now wider after Phase 2)", () => {
    const aspect = loadAspect();
    expect(isAspectRef(aspect.id)).toBe(true);
    // The Phase 2 canonical visible-explanation-sufficiency aspect spans every
    // promise that produces a user-visible explanation surface, not only the
    // Phase 1 search-reaction example.
    expect(aspect.appliesTo).toContain("promise:search-reaction-summarizes-terrain");
    expect(aspect.appliesTo.length).toBeGreaterThan(1);
    expect(aspect.verdict).toBe("met");
    expect(aspect.whyDeclaration.length).toBeGreaterThan(0);
  });

  it("parses the canonical evidence ledger covering its source promises", () => {
    const ledger = loadEvidenceLedger();
    expect(ledger.sourcePromises).toEqual(["promise:search-reaction-summarizes-terrain"]);
    expect(ledger.verdict).toBe("met");
  });

  it("parses a synthetic evidence ledger with 1 intent + 1 acceptance entry", () => {
    const ledger = loadSyntheticLedger();
    expect(ledger.sourcePromises).toEqual(["promise:search-reaction-summarizes-terrain"]);
    expect(ledger.appliedAspects).toEqual(["aspect:visible-explanation-sufficiency"]);
    expect(ledger.intentCheckEntries).toHaveLength(1);
    expect(ledger.acceptanceCheckEntries).toHaveLength(1);
    expect(ledger.verdict).toBe("unknown");
    expect(ledger.implementationContracts.length).toBeGreaterThan(0);
  });

  it("resolveEvidenceLedger succeeds against a synthetic 1-promise / 1-aspect ledger", () => {
    const promise = loadPromise();
    const aspect = loadAspect();
    const ledger = loadSyntheticLedger();
    expect(() => {
      resolveEvidenceLedger(ledger, { promises: [promise], aspects: [aspect] });
    }).not.toThrow();
  });
});

describe("story-chain parser — authority guarantees (negative tests)", () => {
  // Helper: clone the canonical promise fixture and mutate before parsing.
  const PROMISE_SOURCE = readFileSync(PROMISE_PATH, "utf8");

  it("slug carries no hierarchy — a slug starting with 'pdf' does not change lane", () => {
    // Even when the slug contains "pdf-something", the parser must derive lane
    // from the explicit frontmatter `lane:` field.
    const swapped = PROMISE_SOURCE.replace(
      "slug: search-reaction-summarizes-terrain",
      "slug: pdf-something-that-looks-like-pdf-lane",
    )
      .replace(
        "id: promise:search-reaction-summarizes-terrain",
        "id: promise:pdf-something-that-looks-like-pdf-lane",
      )
      .replaceAll(
        "acceptance-check:search-reaction-summarizes-terrain-",
        "acceptance-check:pdf-something-that-looks-like-pdf-lane-",
      );
    const promise = parsePromiseFile({ source: swapped, file: "test.md" });
    expect(promise.lane).toBe("search");
    expect(promise.slug).toBe("pdf-something-that-looks-like-pdf-lane");
  });

  it("rejects a duplicate Promise-level experience parent ref", () => {
    const broken = PROMISE_SOURCE.replace(
      /^moment:/m,
      "experience: experience:research-and-discovery\nmoment:",
    );
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(
      /must not declare "experience"/,
    );
  });

  it("fails required Experience derivation when the Promise Moment is missing", () => {
    expect(() => requirePromiseExperience(loadPromise(), [], [loadExperience()])).toThrow(
      /cannot derive Experience from missing Moment/,
    );
  });

  it("fails required Experience derivation when the Moment points to an undeclared Experience", () => {
    expect(() => requirePromiseExperience(loadPromise(), [loadMoment()], [])).toThrow(
      /derived Experience experience:research-and-discovery .* is not declared/,
    );
  });

  it("missing moment parent ref throws", () => {
    const broken = PROMISE_SOURCE.replace(/^moment: moment:search-results-first-review$/m, "");
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(
      StoryChainParseError,
    );
  });

  it("rejects an aspects entry that uses an intent-check ref instead of aspect", () => {
    const broken = PROMISE_SOURCE.replace(
      "  - aspect:visible-explanation-sufficiency",
      "  - intent-check:something-wrong",
    );
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(/aspect ref/);
  });

  it("rejects an IntentCheck without a 'why live judge' justification", () => {
    const broken = PROMISE_SOURCE.replace(/- why live judge:[^\n]+\n/, "");
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(/why live judge/);
  });

  it("rejects an IntentCheck without 'answer criteria'", () => {
    const broken = PROMISE_SOURCE.replace(/- answer criteria:[^\n]+\n/, "");
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(/answer criteria/);
  });

  it.each([
    ["question", /- question:[^\n]+\n/, /missing "question"/],
    ["evidence", /- evidence:[^\n]+\n/, /missing "evidence"/],
  ])("rejects an IntentCheck without %s", (_field, pattern, expected) => {
    const broken = PROMISE_SOURCE.replace(pattern, "");
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(expected);
  });

  it.each([
    ["description", /- description:[^\n]+\n/, /missing "description"/],
    ["evidence", /- evidence:[^\n]+\n/, /missing "evidence"/],
  ])("rejects an AcceptanceCheck without %s", (_field, pattern, expected) => {
    const firstAcceptanceCheck = PROMISE_SOURCE.indexOf("## Acceptance Checks");
    const prefix = PROMISE_SOURCE.slice(0, firstAcceptanceCheck);
    const brokenBody = PROMISE_SOURCE.slice(firstAcceptanceCheck).replace(pattern, "");
    expect(() => parsePromiseFile({ source: prefix + brokenBody, file: "test.md" })).toThrow(
      expected,
    );
  });

  it("rejects an AcceptanceCheck that contaminates rubric fields", () => {
    // Inject a `why live judge` field into the first acceptance-check block.
    // This is the boundary that keeps IntentCheck and AcceptanceCheck from
    // sliding into one merged "check" type.
    const broken = PROMISE_SOURCE.replace(
      "### acceptance-check:search-reaction-summarizes-terrain-host-gap-action\n\n- description:",
      "### acceptance-check:search-reaction-summarizes-terrain-host-gap-action\n\n- why live judge: contraband rubric\n- description:",
    );
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(
      /must not carry "why live judge" or "answer criteria"/,
    );
  });

  it("rejects when an intent-check block is filed under '## Acceptance Checks'", () => {
    // Move the intent-check block under the acceptance-checks section.
    const broken = PROMISE_SOURCE.replace(
      "## Acceptance Checks",
      "## Acceptance Checks\n\n### intent-check:contraband\n\n- question: should fail\n- evidence: x\n- why live judge: x\n- answer criteria: x\n",
    );
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(
      /Acceptance Checks/,
    );
  });

  it("rejects when an IntentCheck links to a non-existent acceptance check", () => {
    // Add a phantom link to the IntentCheck's linked-acceptance-checks list
    // while leaving frontmatter and the declared acceptance check blocks
    // intact, so the only failure is the unresolved cross-link.
    const broken = PROMISE_SOURCE.replace(
      "- linked acceptance checks:\n  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action",
      "- linked acceptance checks:\n  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action\n  - acceptance-check:does-not-exist-anywhere",
    );
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(
      /links unknown acceptance-check/,
    );
  });

  it("rejects an unknown lane value", () => {
    const broken = PROMISE_SOURCE.replace("lane: search", "lane: SEARCH");
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(/lane "SEARCH"/);
  });

  it("rejects an unknown verdict value (unknown is allowed, 'maybe' is not)", () => {
    const broken = PROMISE_SOURCE.replace("verdict: met", "verdict: maybe");
    expect(() => parsePromiseFile({ source: broken, file: "test.md" })).toThrow(/verdict "maybe"/);
  });

  it("rejects an unknown Promise status and a missing Promise statement", () => {
    expect(() =>
      parsePromiseFile({
        source: PROMISE_SOURCE.replace("status: propagated", "status: maybe"),
        file: "test.md",
      }),
    ).toThrow(/status "maybe"/);
    expect(() =>
      parsePromiseFile({
        source: PROMISE_SOURCE.replace("## Promise", "## Not The Promise"),
        file: "test.md",
      }),
    ).toThrow('missing "## Promise" section');
  });

  it("rejects frontmatter check refs without matching blocks", () => {
    expect(() =>
      parsePromiseFile({
        source: PROMISE_SOURCE.replace(
          "  - intent-check:result-set-terrain-is-not-query-repetition",
          "  - intent-check:not-declared",
        ),
        file: "test.md",
      }),
    ).toThrow(/intentChecks ref .* has no matching/);
    expect(() =>
      parsePromiseFile({
        source: PROMISE_SOURCE.replace(
          "  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action",
          "  - acceptance-check:not-declared",
        ),
        file: "test.md",
      }),
    ).toThrow(/acceptanceChecks ref .* has no matching/);
  });

  it("resolveEvidenceLedger fails when source promise is not in the promise set", () => {
    const ledger = loadSyntheticLedger();
    expect(() => {
      resolveEvidenceLedger(ledger, { promises: [], aspects: [loadAspect()] });
    }).toThrow(/source promise/);
  });

  it("resolveEvidenceLedger fails when applied aspect is not declared", () => {
    const ledger = loadSyntheticLedger();
    expect(() => {
      resolveEvidenceLedger(ledger, { promises: [loadPromise()], aspects: [] });
    }).toThrow(/applied aspect/);
  });
});

describe("resolvePromiseParents — Experience/Moment existence", () => {
  it("passes when no parent lists are supplied (Phase 1 transitional behavior)", () => {
    const promise = loadPromise();
    expect(() => {
      resolvePromiseParents(promise, {});
    }).not.toThrow();
  });

  it("returns the Experience derived from the declared Moment", () => {
    const promise = loadPromise();
    expect(
      resolvePromiseParents(promise, {
        experiences: ["experience:research-and-discovery"],
        moments: [loadMoment()],
      }),
    ).toBe("experience:research-and-discovery");
  });

  it("throws when the Moment's Experience is not declared", () => {
    const promise = loadPromise();
    expect(() => {
      resolvePromiseParents(promise, {
        experiences: ["experience:some-other-experience"],
        moments: [loadMoment()],
      });
    }).toThrow(/derived experience parent/);
  });

  it("throws when the Promise's Moment is not declared", () => {
    const promise = loadPromise();
    expect(() => {
      resolvePromiseParents(promise, {
        experiences: ["experience:research-and-discovery"],
        moments: [{ ...loadMoment(), id: "moment:some-other-moment" }],
      });
    }).toThrow(/moment parent/);
  });

  it("resolveEvidenceLedger propagates derived Experience errors", () => {
    const promise = loadPromise();
    const aspect = loadAspect();
    const ledger = loadSyntheticLedger();
    expect(() => {
      resolveEvidenceLedger(ledger, {
        promises: [promise],
        aspects: [aspect],
        experiences: ["experience:wrong-one-only"],
        moments: [loadMoment()],
      });
    }).toThrow(/derived experience parent/);
  });
});

describe("Experience, Moment, and Aspect parser boundaries", () => {
  it("rejects unknown Experience scope and wrong parent ref kinds", () => {
    const experienceSource = readFileSync(EXPERIENCE_PATH, "utf8");
    expect(() =>
      parseExperienceFile({
        source: experienceSource.replace("scope: core-product", "scope: core"),
        file: "experience.md",
      }),
    ).toThrow(/experience scope "core"/);

    expect(() =>
      parseExperienceFile({
        source: experienceSource.replace(
          "servicePolicyCoverage: unresolved",
          "servicePolicyCoverage: assumed",
        ),
        file: "experience.md",
      }),
    ).toThrow(/servicePolicyCoverage "assumed" must be one of complete, unresolved/);

    const momentSource = readFileSync(MOMENT_PATH, "utf8");
    expect(() =>
      parseMomentFile({
        source: momentSource.replace(
          "experience: experience:research-and-discovery",
          "experience: promise:not-an-experience",
        ),
        file: "moment.md",
      }),
    ).toThrow(/experience ref/);
  });

  it("trims Aspect why prose and rejects a non-Promise appliesTo ref", () => {
    const aspectSource = readFileSync(ASPECT_PATH, "utf8");
    const padded = aspectSource.replace("## Why\n", "## Why\n\n   ");
    expect(parseAspectFile({ source: padded, file: "aspect.md" }).whyDeclaration).toBe(
      loadAspect().whyDeclaration,
    );
    expect(() =>
      parseAspectFile({
        source: aspectSource.replace(
          "  - promise:search-reaction-summarizes-terrain",
          "  - aspect:not-a-promise",
        ),
        file: "aspect.md",
      }),
    ).toThrow(/promise ref/);
  });
});

describe("resolveEvidenceLedger — Promise ↔ Aspect reciprocal weaving", () => {
  it("succeeds when promise.aspects and aspect.appliesTo both name each other", () => {
    const promise = loadPromise();
    const aspect = loadAspect();
    const ledger = loadSyntheticLedger();
    expect(() => {
      resolveEvidenceLedger(ledger, { promises: [promise], aspects: [aspect] });
    }).not.toThrow();
  });

  it("throws when the ledger weaves an aspect the promise never declared", () => {
    const promise = loadPromise();
    const aspect = loadAspect();
    const ledger = loadSyntheticLedger();
    // Strip the aspect from the promise's declared aspects without changing
    // the aspect's appliesTo. The ledger still cites the aspect, so the
    // weaving is one-sided.
    const promiseWithoutAspect = { ...promise, aspects: [] };
    expect(() => {
      resolveEvidenceLedger(ledger, {
        promises: [promiseWithoutAspect],
        aspects: [aspect],
      });
    }).toThrow(/is not declared on source promise/);
  });

  it("throws when the aspect.appliesTo does not include the promise (one-sided pointcut)", () => {
    const promise = loadPromise();
    const aspect = loadAspect();
    const ledger = loadSyntheticLedger();
    const aspectWithoutPointcut = { ...aspect, appliesTo: [] };
    expect(() => {
      resolveEvidenceLedger(ledger, {
        promises: [promise],
        aspects: [aspectWithoutPointcut],
      });
    }).toThrow(/appliesTo does not include source promise/);
  });
});

describe("story-chain — Promise and EvidenceLedger remain structurally distinct", () => {
  it("Promise type does not declare implementationContracts or execution fields", () => {
    // Compile-time guarantee surfaced as a runtime type assertion. The Promise
    // shape carries `verdict` (a single status), but the heavy weaving record
    // (implementationContracts + structured executions) lives only on EvidenceLedger.
    const promise = loadPromise();
    expect(promise).not.toHaveProperty("implementationContracts");
    expect(promise).not.toHaveProperty("executions");
    expect(promise).toHaveProperty("promiseStatement");
  });

  it("EvidenceLedger does not declare promiseStatement or status fields", () => {
    const ledger = loadEvidenceLedger();
    expect(ledger).not.toHaveProperty("promiseStatement");
    expect(ledger).not.toHaveProperty("status");
    expect(ledger).toHaveProperty("implementationContracts");
    expect(ledger).toHaveProperty("executions");
  });
});
