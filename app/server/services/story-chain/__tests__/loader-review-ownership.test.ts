import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { renderReleaseVerdictDocumentBlock } from "@/app/domain/story-chain";
import {
  REQUIRED_SUBDIRS,
  STORY_CHAIN_DIR_REL,
  loadStoryChain,
} from "@/app/server/services/story-chain/loader";
import { serializeEvidenceLedgerV2 } from "@/app/server/services/story-chain/evidence-ledger-v2";
import { REVIEW_OWNER_BOUNDARY_CUTOFF_DATE } from "@/app/server/services/story-chain/review-parser";

const OBSERVED = "x".repeat(90);

function promiseSource(slug: string): string {
  return `---
id: promise:${slug}
slug: ${slug}
title: ${slug}
moment: moment:test
lane: other
status: propagated
acceptanceChecks:
  - acceptance-check:${slug}-axis
verdict: met
---

# ${slug}

## Promise

The promise exists for an ownership fixture.

## Intent Checks

No Intent Checks.

## Acceptance Checks

### acceptance-check:${slug}-axis

- description: The fixture keeps this check with its declaring Promise.
- evidence: covered by the fixture ledger.
- revision: 1
`;
}

function ledgerSource(includeReview = true): string {
  return serializeEvidenceLedgerV2({
    schemaVersion: 2,
    slug: "owner",
    ...(includeReview ? { review: "reviews/owner.reviews.md" } : {}),
    sourcePromises: ["promise:owner"],
    appliedAspects: [],
    intent: { mode: "absorbed", checks: [], delegations: [] },
    acceptanceChecks: [
      {
        key: "promise:owner#acceptance-check:owner-axis",
        assertion: "fixture evidence",
        executionRefs: ["execution:fixture"],
        scenarios: [],
      },
    ],
    executions: [{ id: "execution:fixture", kind: "vitest", files: ["app/fixture.test.ts"] }],
    implementationContracts: ["app/fixture.ts"],
    verdict: "met",
  });
}

function reviewSource(date: string): string {
  return `### Sufficiency Review

#### ${date} — foreign owner fixture

\`\`\`yaml
date: ${date}
acs:
  - acceptance-check:foreign-axis
acReviewedRevision:
  - 1
fixtureRef: fixture
runCommitSha: abc123def456
observedOutput: ${OBSERVED}
gaps:
  - reject: Fixture has no unresolved product gap.
verdict: met
\`\`\`
`;
}

interface RepoOptions {
  reviewName?: string;
  skipReviewFile?: boolean;
  foundationalSidecar?: boolean;
  legacyLedgerName?: string;
}

function makeRepo(reviewDate: string, options: RepoOptions = {}): string {
  const repoRoot = mkdtempSync(path.join(tmpdir(), "story-chain-review-owner-"));
  const chainRoot = path.join(repoRoot, STORY_CHAIN_DIR_REL);
  for (const subdir of REQUIRED_SUBDIRS) {
    mkdirSync(path.join(chainRoot, subdir), { recursive: true });
  }
  writeFileSync(
    path.join(chainRoot, "traceability-cardinality.json"),
    JSON.stringify({ version: 1, relations: [], deferredVerificationTriggers: [] }),
  );
  writeFileSync(
    path.join(repoRoot, "docs", "mission-control.md"),
    renderReleaseVerdictDocumentBlock(),
  );
  writeFileSync(path.join(chainRoot, "scenario-catalog.md"), "# Scenario catalog\n");
  writeFileSync(path.join(chainRoot, "promises", "owner.md"), promiseSource("owner"));
  writeFileSync(path.join(chainRoot, "promises", "foreign.md"), promiseSource("foreign"));
  writeFileSync(
    path.join(chainRoot, "evidence-ledgers", "owner.ledger.yaml"),
    ledgerSource(!options.reviewName || options.reviewName === "owner.reviews.md"),
  );
  if (options.legacyLedgerName) {
    writeFileSync(
      path.join(chainRoot, "evidence-ledgers", options.legacyLedgerName),
      "# Legacy operational ledger\n",
    );
  }
  if (options.foundationalSidecar) {
    mkdirSync(path.join(chainRoot, "evidence-ledgers", "foundational"), { recursive: true });
    writeFileSync(
      path.join(chainRoot, "evidence-ledgers", "foundational", "foundational.md"),
      "---\nfoundational: true\n---\n\n# Foundational fixture\n",
    );
  }
  mkdirSync(path.join(chainRoot, "evidence-ledgers", "reviews"), { recursive: true });
  if (!options.skipReviewFile) {
    writeFileSync(
      path.join(chainRoot, "evidence-ledgers", "reviews", options.reviewName ?? "owner.reviews.md"),
      reviewSource(reviewDate),
    );
  }
  return repoRoot;
}

describe("loadStoryChain — Sufficiency Review Source Promise ownership", () => {
  let repoRoot: string | undefined;

  afterEach(() => {
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
    repoRoot = undefined;
  });

  it("rejects a new sibling review that revision-syncs a foreign Promise AC", () => {
    const fixtureRoot = makeRepo(REVIEW_OWNER_BOUNDARY_CUTOFF_DATE);
    repoRoot = fixtureRoot;
    expect(() => loadStoryChain(fixtureRoot)).toThrow(/outside .*Source Promises/);
  });

  it("keeps a pre-cutoff foreign-owner review readable as dated history", () => {
    const fixtureRoot = makeRepo("2026-07-21");
    repoRoot = fixtureRoot;
    expect(() => loadStoryChain(fixtureRoot)).not.toThrow();
  });

  it("rejects a post-cutoff orphan review without a matching Evidence Ledger", () => {
    const fixtureRoot = makeRepo(REVIEW_OWNER_BOUNDARY_CUTOFF_DATE, {
      reviewName: "orphan.reviews.md",
    });
    repoRoot = fixtureRoot;
    expect(() => loadStoryChain(fixtureRoot)).toThrow(/matching Evidence Ledger.*Source Promises/);
  });

  it("preserves a pre-cutoff orphan review as dated history", () => {
    const fixtureRoot = makeRepo("2026-07-21", { reviewName: "orphan.reviews.md" });
    repoRoot = fixtureRoot;
    expect(() => loadStoryChain(fixtureRoot)).not.toThrow();
  });

  it("rejects a post-cutoff foundational sidecar without Source Promises", () => {
    const fixtureRoot = makeRepo(REVIEW_OWNER_BOUNDARY_CUTOFF_DATE, {
      reviewName: "foundational.reviews.md",
      foundationalSidecar: true,
    });
    repoRoot = fixtureRoot;
    expect(() => loadStoryChain(fixtureRoot)).toThrow(/matching Evidence Ledger.*Source Promises/);
  });

  it("preserves a pre-cutoff foundational sidecar as dated history", () => {
    const fixtureRoot = makeRepo("2026-07-21", {
      reviewName: "foundational.reviews.md",
      foundationalSidecar: true,
    });
    repoRoot = fixtureRoot;
    expect(() => loadStoryChain(fixtureRoot)).not.toThrow();
  });

  it("rejects a same-slug legacy Markdown ledger beside the YAML source", () => {
    const fixtureRoot = makeRepo("2026-07-21", { legacyLedgerName: "owner.ledger.md" });
    repoRoot = fixtureRoot;
    expect(() => loadStoryChain(fixtureRoot)).toThrow(/legacy Markdown Evidence Ledger/);
  });

  it("rejects a review pointer whose sidecar does not exist", () => {
    const fixtureRoot = makeRepo("2026-07-21", { skipReviewFile: true });
    repoRoot = fixtureRoot;
    expect(() => loadStoryChain(fixtureRoot)).toThrow(/Review pointer does not exist/);
  });
});
