import { describe, expect, it } from "vitest";

import {
  parseAndValidateReviewFile,
  parseReviewFile,
  REVIEW_OBSERVED_OUTPUT_MIN_CHARS,
  REVIEW_OWNER_BOUNDARY_CUTOFF_DATE,
} from "@/app/server/services/story-chain/review-parser";

const FILE = "test://reviews.md";

const VALID_OBSERVED = "x".repeat(REVIEW_OBSERVED_OUTPUT_MIN_CHARS);
const VALID_YAML = `\`\`\`yaml
date: 2026-05-15
acs:
  - acceptance-check:foo-bar
acReviewedRevision:
  - 1
fixtureRef: app/foo/__tests__/fixtures/bar.json
runCommitSha: abc123def456
observedOutput: ${VALID_OBSERVED} explaining what the judge saw and why met holds.
gaps:
  - adopt: First gap reason here.
  - reject: Second gap reason here.
verdict: met
\`\`\``;

function entry(date: string, body: string): string {
  return `#### ${date} — sample entry\n\n${body}\n`;
}

describe("review-parser cutoff + schema (promise:alignment-coherence-gate AC3 + AC4)", () => {
  it("grandfathers a pre-cutoff prose entry (AC review-cutoff-migration)", () => {
    const source = entry("2026-04-23", "- Input: prose only, no yaml block.");
    const entries = parseAndValidateReviewFile(source, FILE);
    expect(entries).toHaveLength(1);
    expect(entries[0].grandfathered).toBe(true);
    expect(entries[0].yaml).toBeNull();
  });

  it("rejects a post-cutoff entry without a yaml block (AC review-cutoff-migration)", () => {
    const source = entry("2026-05-15", "- Input: prose only after cutoff.");
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(/must carry a `+yaml block/);
  });

  it("rejects unsupported yaml fields (AC review-cutoff-migration)", () => {
    const source = entry("2026-05-15", "```yaml\nunsupportedBypass: true\n```");
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(
      /yaml\.unsupportedBypass is not supported/,
    );
  });

  it("parses a fully valid post-cutoff yaml entry (AC review-yaml-schema)", () => {
    const source = entry("2026-05-15", VALID_YAML);
    const entries = parseAndValidateReviewFile(source, FILE);
    expect(entries).toHaveLength(1);
    expect(entries[0].grandfathered).toBe(false);
    expect(entries[0].yaml?.verdict).toBe("met");
    expect(entries[0].yaml?.acs).toEqual(["acceptance-check:foo-bar"]);
  });

  it("rejects observedOutput shorter than 80 chars (AC review-yaml-schema)", () => {
    const tooShort = VALID_YAML.replace(VALID_OBSERVED, "short observation");
    const source = entry("2026-05-15", tooShort);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(/observedOutput is/);
  });

  it("rejects mismatched acs and acReviewedRevision lengths (AC review-yaml-schema)", () => {
    const mismatch = VALID_YAML.replace(
      "acReviewedRevision:\n  - 1",
      "acReviewedRevision:\n  - 1\n  - 2",
    );
    const source = entry("2026-05-15", mismatch);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(/length .* must match/);
  });

  it("rejects an unknown verdict value (AC review-yaml-schema)", () => {
    const bad = VALID_YAML.replace("verdict: met", "verdict: maybe");
    const source = entry("2026-05-15", bad);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(/verdict must be one of/);
  });

  it("rejects a malformed gap entry (AC review-yaml-schema)", () => {
    const bad = VALID_YAML.replace(
      "gaps:\n  - adopt: First gap reason here.\n  - reject: Second gap reason here.",
      "gaps:\n  - adopt: ok\n  - undecided: bad",
    );
    const source = entry("2026-05-15", bad);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(
      /must start with "adopt: " or "reject: "/,
    );
  });

  it("rejects an AC ref that is neither acceptance-check: nor intent-check: (AC review-yaml-schema)", () => {
    const bad = VALID_YAML.replace(
      "acs:\n  - acceptance-check:foo-bar",
      "acs:\n  - promise:foo-bar",
    );
    const source = entry("2026-05-15", bad);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(
      /acceptance-check: or intent-check:/,
    );
  });

  it("rejects a post-cutoff entry whose yaml block omits the date field (AC review-yaml-schema)", () => {
    const noDate = VALID_YAML.replace(/^date: 2026-05-15\n/m, "");
    const source = entry("2026-05-15", noDate);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(/yaml\.date is required/);
  });

  it("rejects a yaml date that does not match the entry heading date (AC review-yaml-schema)", () => {
    const mismatch = VALID_YAML.replace("date: 2026-05-15", "date: 2026-05-14");
    const source = entry("2026-05-15", mismatch);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(/must match the entry heading/);
  });

  it("does not require acReviewedRevision for intent-check refs (AC review-yaml-schema)", () => {
    const intentEntry = `\`\`\`yaml
date: 2026-05-15
acs:
  - acceptance-check:foo-bar
  - intent-check:foo-baz-quality
acReviewedRevision:
  - 1
fixtureRef: app/foo/__tests__/fixtures/bar.json
runCommitSha: abc123def456
observedOutput: ${VALID_OBSERVED} explaining what the judge saw and why met holds.
gaps:
  - adopt: First gap reason here.
verdict: met
\`\`\``;
    const source = entry("2026-05-15", intentEntry);
    const entries = parseAndValidateReviewFile(source, FILE);
    expect(entries[0].yaml?.acs).toContain("intent-check:foo-baz-quality");
  });

  it("rejects yaml blocks using multi-line scalars (AC review-yaml-schema, parser subset)", () => {
    const multiLine = `\`\`\`yaml
date: 2026-05-15
observedOutput: |
  multi-line block scalar that the subset parser cannot read
acs:
  - acceptance-check:foo-bar
acReviewedRevision:
  - 1
\`\`\``;
    const source = entry("2026-05-15", multiLine);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(/unsupported multi-line scalar/);
  });

  it("rejects yaml blocks using quoted scalars (AC review-yaml-schema, parser subset)", () => {
    const quoted = `\`\`\`yaml
date: 2026-05-15
fixtureRef: "quoted/path/value.json"
acs:
  - acceptance-check:foo-bar
acReviewedRevision:
  - 1
\`\`\``;
    const source = entry("2026-05-15", quoted);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(/quoted scalars/);
  });

  it("rejects acReviewedRevision item that is not a positive integer (AC ac-revision-field)", () => {
    const bad = VALID_YAML.replace("acReviewedRevision:\n  - 1", "acReviewedRevision:\n  - foo");
    const source = entry("2026-05-15", bad);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(/positive integer/);
  });

  it("parses explicit pre-cutoff yaml entries (AC review-cutoff-migration)", () => {
    const historicalYaml = `\`\`\`yaml
date: 2026-04-23
acs:
  - acceptance-check:foo-bar
acReviewedRevision:
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/reviews/search-reaction.reviews.md
runCommitSha: abc123def456
observedOutput: Historical sufficiency review preserved as prose below; source input, evidence, gaps, and verdict remain in the original dated review body.
gaps:
  - adopt: First gap reason here.
verdict: met
\`\`\``;
    const source = entry("2026-04-23", historicalYaml);
    const entries = parseAndValidateReviewFile(source, FILE);
    expect(entries).toHaveLength(1);
    expect(entries[0].grandfathered).toBe(false);
    expect(entries[0].yaml?.date).toBe("2026-04-23");
    expect(entries[0].yaml?.verdict).toBe("met");
  });

  it("rejects yaml.acs ref that does not resolve to any known AcceptanceCheck (AC review-yaml-schema)", () => {
    const source = entry("2026-05-15", VALID_YAML);
    expect(() =>
      parseAndValidateReviewFile(source, FILE, {
        knownAcceptanceCheckIds: new Set(["acceptance-check:other-promise-ac"]),
      }),
    ).toThrow(/does not resolve to any AcceptanceCheck/);
  });

  it("accepts yaml.acs ref that resolves to a known AcceptanceCheck (AC review-yaml-schema)", () => {
    const source = entry("2026-05-15", VALID_YAML);
    expect(() =>
      parseAndValidateReviewFile(source, FILE, {
        knownAcceptanceCheckIds: new Set(["acceptance-check:foo-bar"]),
      }),
    ).not.toThrow();
  });

  it("rejects a new review AC outside the ledger Source Promises", () => {
    const yaml = VALID_YAML.replaceAll("2026-05-15", REVIEW_OWNER_BOUNDARY_CUTOFF_DATE);
    const source = entry(REVIEW_OWNER_BOUNDARY_CUTOFF_DATE, yaml);
    expect(() =>
      parseAndValidateReviewFile(source, FILE, {
        knownAcceptanceCheckIds: new Set(["acceptance-check:foo-bar"]),
        ownedAcceptanceCheckIds: new Set(["acceptance-check:other-owner-axis"]),
        ownershipLabel: "foo.ledger.yaml",
      }),
    ).toThrow(/outside foo\.ledger\.yaml's Source Promises/);
  });

  it("accepts a new review AC owned by the ledger Source Promises", () => {
    const yaml = VALID_YAML.replaceAll("2026-05-15", REVIEW_OWNER_BOUNDARY_CUTOFF_DATE);
    const source = entry(REVIEW_OWNER_BOUNDARY_CUTOFF_DATE, yaml);
    expect(() =>
      parseAndValidateReviewFile(source, FILE, {
        knownAcceptanceCheckIds: new Set(["acceptance-check:foo-bar"]),
        ownedAcceptanceCheckIds: new Set(["acceptance-check:foo-bar"]),
        ownershipLabel: "foo.ledger.yaml",
      }),
    ).not.toThrow();
  });

  it("preserves pre-cutoff review history that names a foreign owner", () => {
    const source = entry("2026-07-21", VALID_YAML.replaceAll("2026-05-15", "2026-07-21"));
    expect(() =>
      parseAndValidateReviewFile(source, FILE, {
        knownAcceptanceCheckIds: new Set(["acceptance-check:foo-bar"]),
        ownedAcceptanceCheckIds: new Set(["acceptance-check:other-owner-axis"]),
        ownershipLabel: "foo.ledger.yaml",
      }),
    ).not.toThrow();
  });

  it("rejects a new review Intent Check outside the ledger Source Promises", () => {
    const yaml = VALID_YAML.replaceAll("2026-05-15", REVIEW_OWNER_BOUNDARY_CUTOFF_DATE).replace(
      "  - acceptance-check:foo-bar",
      "  - acceptance-check:foo-bar\n  - intent-check:foreign-owner-quality",
    );
    const source = entry(REVIEW_OWNER_BOUNDARY_CUTOFF_DATE, yaml);
    expect(() =>
      parseAndValidateReviewFile(source, FILE, {
        knownAcceptanceCheckIds: new Set(["acceptance-check:foo-bar"]),
        knownIntentCheckIds: new Set(["intent-check:foreign-owner-quality"]),
        ownedAcceptanceCheckIds: new Set(["acceptance-check:foo-bar"]),
        ownedIntentCheckIds: new Set(),
        ownershipLabel: "foo.ledger.yaml",
      }),
    ).toThrow(/outside foo\.ledger\.yaml's Source Promises/);
  });

  it("splits multiple entries cleanly (AC review-yaml-schema parse-only)", () => {
    const source = entry("2026-04-23", "- prose pre-cutoff.") + entry("2026-05-15", VALID_YAML);
    const entries = parseReviewFile(source, FILE);
    expect(entries).toHaveLength(2);
    expect(entries[0].grandfathered).toBe(true);
    expect(entries[1].grandfathered).toBe(false);
  });
});

describe("review-parser migrated prose compatibility", () => {
  it("allows only an explicitly fingerprinted migrated prose review", () => {
    const allowed = entry("2026-07-19", "- Input: byte-preserved migration history.");
    const fingerprint = parseReviewFile(allowed, FILE)[0].sourceFingerprint;
    if (!fingerprint) throw new Error("expected a parsed review fingerprint");
    expect(() =>
      parseAndValidateReviewFile(allowed, FILE, {
        legacyProseReviewFingerprints: new Map([["2026-07-19", fingerprint]]),
      }),
    ).not.toThrow();

    const mutated = entry("2026-07-19", "- Input: rewritten migration history.");
    expect(() =>
      parseAndValidateReviewFile(mutated, FILE, {
        legacyProseReviewFingerprints: new Map([["2026-07-19", fingerprint]]),
      }),
    ).toThrow(/must carry a `+yaml block/);

    const duplicateDate = `${allowed}\n${mutated}`;
    expect(() =>
      parseAndValidateReviewFile(duplicateDate, FILE, {
        legacyProseReviewFingerprints: new Map([["2026-07-19", fingerprint]]),
      }),
    ).toThrow(/must carry a `+yaml block/);

    const exactDuplicate = `${allowed}\n${allowed}`;
    expect(() =>
      parseAndValidateReviewFile(exactDuplicate, FILE, {
        legacyProseReviewFingerprints: new Map([["2026-07-19", fingerprint]]),
      }),
    ).toThrow(/exactly once and in order/);

    expect(() =>
      parseAndValidateReviewFile("# review history removed\n", FILE, {
        legacyProseReviewFingerprints: new Map([["2026-07-19", fingerprint]]),
      }),
    ).toThrow(/exactly once and in order/);
  });
});

describe("review-parser structural consistency (process-gap follow-up)", () => {
  function withHeader(headingLine: string, yaml: string): string {
    return `${headingLine}\n\n${yaml}\n`;
  }

  it("rejects acs whose promise prefix does not match a single-promise section header", () => {
    const yaml = `\`\`\`yaml
date: 2026-05-15
acs:
  - acceptance-check:other-promise-some-check
acReviewedRevision:
  - 1
fixtureRef: app/foo/__tests__/fixtures/bar.json
runCommitSha: abc123def456
observedOutput: ${VALID_OBSERVED} explaining what the judge saw and why met holds.
gaps:
  - adopt: First gap reason here.
  - reject: Second gap reason here.
verdict: met
\`\`\``;
    const source = withHeader("#### 2026-05-15 — Intent absorbed for `promise:foo`", yaml);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(
      /does not belong to promise:foo/,
    );
  });

  it("allows acs that belong to the single-promise section header", () => {
    const yaml = `\`\`\`yaml
date: 2026-05-15
acs:
  - acceptance-check:foo-some-axis
acReviewedRevision:
  - 1
fixtureRef: app/foo/__tests__/fixtures/bar.json
runCommitSha: abc123def456
observedOutput: ${VALID_OBSERVED} explaining what the judge saw and why met holds.
gaps:
  - adopt: First gap reason here.
  - reject: Second gap reason here.
verdict: met
\`\`\``;
    const source = withHeader("#### 2026-05-15 — Intent absorbed for `promise:foo`", yaml);
    expect(() =>
      parseAndValidateReviewFile(source, FILE, {
        knownAcceptanceCheckIds: new Set(["acceptance-check:foo-some-axis"]),
      }),
    ).not.toThrow();
  });

  it("skips the header-promise check when the section header lists multiple promises (cross-promise absorption)", () => {
    const yaml = `\`\`\`yaml
date: 2026-05-15
acs:
  - acceptance-check:third-promise-some-check
acReviewedRevision:
  - 1
fixtureRef: app/foo/__tests__/fixtures/bar.json
runCommitSha: abc123def456
observedOutput: ${VALID_OBSERVED} explaining what the judge saw and why met holds.
gaps:
  - adopt: First gap reason here.
  - reject: Second gap reason here.
verdict: met
\`\`\``;
    const source = withHeader(
      "#### 2026-05-15 — Intent absorbed for `promise:foo` + `promise:bar`",
      yaml,
    );
    expect(() =>
      parseAndValidateReviewFile(source, FILE, {
        knownAcceptanceCheckIds: new Set(["acceptance-check:third-promise-some-check"]),
      }),
    ).not.toThrow();
  });

  it('rejects observedOutput "all N Acceptance Checks" claim that does not match yaml.acs length', () => {
    const yaml = `\`\`\`yaml
date: 2026-05-15
acs:
  - acceptance-check:foo-a
  - acceptance-check:foo-b
acReviewedRevision:
  - 1
  - 1
fixtureRef: app/foo/__tests__/fixtures/bar.json
runCommitSha: abc123def456
observedOutput: α Coverage — covers all 5 Acceptance Checks but only two are listed; extra padding to satisfy minimum length here.
gaps:
  - adopt: First gap reason here.
  - reject: Second gap reason here.
verdict: met
\`\`\``;
    const source = withHeader("#### 2026-05-15 — sample entry", yaml);
    expect(() => parseAndValidateReviewFile(source, FILE)).toThrow(
      /claims "all 5 Acceptance Checks" but yaml\.acs lists 2 acceptance-check entries/,
    );
  });

  it('counts only acceptance-check entries when comparing against "all N Acceptance Checks"', () => {
    const yaml = `\`\`\`yaml
date: 2026-05-15
acs:
  - acceptance-check:foo-a
  - acceptance-check:foo-b
  - intent-check:foo-i
acReviewedRevision:
  - 1
  - 1
fixtureRef: app/foo/__tests__/fixtures/bar.json
runCommitSha: abc123def456
observedOutput: α Coverage — covers all 2 Acceptance Checks and all 1 Intent Checks against real surfaces. Extra padding to satisfy minimum length here.
gaps:
  - adopt: First gap reason here.
  - reject: Second gap reason here.
verdict: met
\`\`\``;
    const source = withHeader("#### 2026-05-15 — sample entry", yaml);
    expect(() =>
      parseAndValidateReviewFile(source, FILE, {
        knownAcceptanceCheckIds: new Set(["acceptance-check:foo-a", "acceptance-check:foo-b"]),
      }),
    ).not.toThrow();
  });

  it('tolerates non-"all" "N ACs" counts that may refer to upstream / total scope', () => {
    const yaml = `\`\`\`yaml
date: 2026-05-15
acs:
  - acceptance-check:foo-a
acReviewedRevision:
  - 1
fixtureRef: app/foo/__tests__/fixtures/bar.json
runCommitSha: abc123def456
observedOutput: α Coverage — promise originally has 20 ACs across 4 promises; this absorption pointer is enough to keep traceability green.
gaps:
  - adopt: First gap reason here.
  - reject: Second gap reason here.
verdict: met
\`\`\``;
    const source = withHeader("#### 2026-05-15 — sample entry", yaml);
    expect(() =>
      parseAndValidateReviewFile(source, FILE, {
        knownAcceptanceCheckIds: new Set(["acceptance-check:foo-a"]),
      }),
    ).not.toThrow();
  });
});
