import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect } from "vitest";

import {
  TRACEABILITY_NODE_PREFIXES,
  renderReleaseVerdictDocumentBlock,
} from "@/app/domain/story-chain";
import { SERVICE_POLICY_MATRIX_ROW_SCHEMA } from "@/app/server/services/story-chain/service-policy-matrix";
import {
  REQUIRED_SUBDIRS,
  STORY_CHAIN_DIR_REL,
  type StoryChain,
  loadStoryChain,
} from "@/app/server/services/story-chain/loader";
import { validateStoryChain } from "@/app/server/services/story-chain/validator";

export function makeTempRepo(): string {
  return mkdtempSync(path.join(tmpdir(), "story-chain-loader-"));
}

export function makeChainSkeleton(repoRoot: string): string {
  const chainRoot = path.join(repoRoot, STORY_CHAIN_DIR_REL);
  for (const sub of REQUIRED_SUBDIRS) {
    mkdirSync(path.join(chainRoot, sub), { recursive: true });
  }
  mkdirSync(path.join(chainRoot, "evidence-ledgers", "reviews"), { recursive: true });
  writeFileSync(path.join(chainRoot, "scenario-catalog.md"), "# Scenario catalog\n");
  writeFileSync(
    path.join(chainRoot, "traceability-cardinality.json"),
    JSON.stringify(defaultTraceabilityCardinality(), null, 2),
  );
  writeFileSync(
    path.join(repoRoot, "docs", "mission-control.md"),
    `# Mission Control\n\n${renderReleaseVerdictDocumentBlock()}\n`,
  );
  return chainRoot;
}

export function makeServicePolicyMatrix(
  experience: `experience:${string}` = "experience:e1",
): StoryChain["servicePolicyMatrices"][number] {
  return {
    path: "docs/contracts/story-chain/service-policy-coverage/test.matrix.yaml",
    schemaVersion: 1,
    id: "service-policy-matrix:test",
    experience,
    serviceType: "test",
    reviewedAt: "2026-08-28",
    reference: "https://example.test/reference",
    coverageProfile: { id: "test", referenceEntryCount: 1, requiredFamilies: ["test"] },
    sources: [
      {
        id: "test-source",
        repository: "jaeyoungkang/lighthouse",
        revision: "7a3ed3e3ba7378ee098dc6d088afd2bd91b35808",
        path: "app/test.ts",
      },
    ],
    families: [
      {
        id: "test",
        label: "Test",
        expectedCapability: "Test capability",
        mapsToLenses: ["test"],
        items: [
          {
            id: "test-item",
            referenceEntries: [1],
            referenceObservation: "met",
            observation: "met",
            reconciliation: "unchanged",
            fact: "The test policy is present.",
            evidence: [{ source: "test-source", path: "app/test.ts", locator: "fixture" }],
            responsibilitySurfaces: ["moonlight-operations"],
            disposition: "owned",
            dispositionRationale: "The fixture owner is explicit.",
            canonicalOwner: "test-owner",
            authorityRefs: ["docs/test.md"],
            sourcePromises: [],
            verificationRefs: ["app/test.ts"],
            followUp: "Recheck when the fixture changes.",
          },
        ],
      },
    ],
  };
}

export function writeServicePolicyMatrixFile(
  file: string,
  experience: `experience:${string}`,
): void {
  const { path: _path, families, ...matrix } = makeServicePolicyMatrix(experience);
  void _path;
  writeFileSync(
    file,
    JSON.stringify({
      ...matrix,
      rowSchema: SERVICE_POLICY_MATRIX_ROW_SCHEMA,
      families: families.map(({ items, ...family }) => ({
        ...family,
        rows: items
          .map((item) =>
            [
              item.id,
              item.referenceEntries.join(";"),
              item.referenceObservation,
              item.observation,
              item.reconciliation,
              item.fact,
              item.evidence[0]?.source,
              item.evidence[0]?.path,
              item.evidence[0]?.locator,
              item.responsibilitySurfaces.join(";"),
              item.disposition,
              item.dispositionRationale,
              item.canonicalOwner,
              item.authorityRefs.join(";"),
              item.sourcePromises.join(";") || "-",
              item.verificationRefs.join(";") || "-",
              item.decisionRef ?? "-",
              item.followUp,
            ].join("\t"),
          )
          .join("\n"),
      })),
    }),
  );
}

export function defaultTraceabilityCardinality(): StoryChain["traceabilityCardinality"] {
  return {
    version: 1,
    nodeTypes: { ...TRACEABILITY_NODE_PREFIXES },
    relations: [
      {
        name: "scenario_evidence_coverage",
        from: "scenario",
        to: "evidence-ledger-entry",
        count: "0..* -> 1..*",
        description: "Every active scenario has evidence.",
      },
      {
        name: "experience_moments",
        from: "experience",
        to: "moment",
        count: "1 -> 1..*",
        description: "Every Moment belongs to exactly one Experience.",
      },
      {
        name: "moment_promises",
        from: "moment",
        to: "promise",
        count: "1 -> 1..*",
        description: "Every Promise belongs to exactly one Moment.",
      },
      {
        name: "promise_acceptance_checks",
        from: "promise",
        to: "acceptance-check",
        count: "1 -> 1..*",
        description: "Every Promise has at least one Acceptance Check.",
      },
      {
        name: "promise_evidence_ledgers",
        from: "promise",
        to: "evidence-ledger",
        count: "1..* -> 1..*",
        description: "Every Promise is covered by at least one Evidence Ledger.",
      },
      {
        name: "acceptance_check_evidence",
        from: "acceptance-check",
        to: "evidence-ledger-entry",
        count: "1 -> 1..*",
        description: "Every Acceptance Check is cited by at least one evidence entry.",
      },
    ],
    deferredVerificationTriggers: [],
  };
}

export function makeEmptyChain(overrides: Partial<StoryChain> = {}): StoryChain {
  const servicePolicyMatrices =
    overrides.servicePolicyMatrices ??
    (overrides.experiences ?? [])
      .filter((experience) => experience.scope === "core-product")
      .map((experience) => makeServicePolicyMatrix(experience.id));
  return {
    scenarios: [],
    experiences: [],
    moments: [],
    promises: [],
    aspects: [],
    evidenceLedgers: [],
    traceabilityCardinality: defaultTraceabilityCardinality(),
    reviewEntries: [],
    ...overrides,
    servicePolicyMatrices,
  };
}

export function assertNonContractAndLegacyLedgerBoundaries(
  repoRoot: string,
  chainRoot: string,
): void {
  writeFileSync(path.join(chainRoot, "promises", "_template.md"), "ignored\n");
  writeFileSync(path.join(chainRoot, "promises", "notes.txt"), "ignored\n");
  writeFileSync(path.join(chainRoot, "evidence-ledgers", "notes.yaml"), "ignored\n");
  expect(loadStoryChain(repoRoot).promises).toEqual([]);
  expect(loadStoryChain(repoRoot).evidenceLedgers).toEqual([]);

  writeFileSync(path.join(chainRoot, "evidence-ledgers", "legacy.ledger.md"), "legacy\n");
  expect(() => loadStoryChain(repoRoot)).toThrow("legacy Markdown Evidence Ledger");
}

export function assertTraceabilityCardinalityPolicyFailures(
  repoRoot: string,
  chainRoot: string,
): void {
  const policyPath = path.join(chainRoot, "traceability-cardinality.json");
  writeFileSync(policyPath, "not-json\n");
  expect(() => loadStoryChain(repoRoot)).toThrow("is not valid JSON");

  rmSync(policyPath);
  expect(() => loadStoryChain(repoRoot)).toThrow("traceability-cardinality.json is missing");
}

export function assertCanonicalRepositoryIntegrity(repoRoot: string): void {
  const chain = loadStoryChain(repoRoot);
  const summary = validateStoryChain(chain);
  const countByVerdict = (values: readonly { verdict: "met" | "not-met" | "unknown" }[]) => ({
    met: values.filter((value) => value.verdict === "met").length,
    "not-met": values.filter((value) => value.verdict === "not-met").length,
    unknown: values.filter((value) => value.verdict === "unknown").length,
  });

  expect([
    chain.scenarios.length,
    chain.experiences.length,
    chain.moments.length,
    chain.promises.length,
    chain.aspects.length,
    chain.evidenceLedgers.length,
    chain.reviewEntries.length,
  ]).not.toContain(0);
  expect(summary).toEqual({
    scenarioCount: chain.scenarios.length,
    experienceCount: chain.experiences.length,
    momentCount: chain.moments.length,
    promiseCount: chain.promises.length,
    aspectCount: chain.aspects.length,
    evidenceLedgerCount: chain.evidenceLedgers.length,
    explicitIntentLedgerCount: chain.evidenceLedgers.filter(
      (ledger) => ledger.intentMode === "explicit",
    ).length,
    absorbedIntentLedgerCount: chain.evidenceLedgers.filter(
      (ledger) => ledger.intentMode === "absorbed",
    ).length,
    delegatedIntentLedgerCount: chain.evidenceLedgers.filter(
      (ledger) => ledger.intentMode === "delegated",
    ).length,
    promisesByVerdict: countByVerdict(chain.promises),
    ledgersByVerdict: countByVerdict(chain.evidenceLedgers),
    traceabilityRelationCount: chain.traceabilityCardinality.relations.length,
  });
}
