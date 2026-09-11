import path from "node:path";

import { z } from "zod";
import { parse as parseYaml } from "yaml";

import {
  type PromiseRef,
  type ServicePolicyCoverageMatrix,
  type ServicePolicyMatrixFamily,
  type ServicePolicyMatrixItem,
} from "@/app/domain/story-chain";

import { StoryChainParseError } from "./parser-shared";

export const SCHOLAR_SEARCH_COVERAGE_PROFILE_ID = "scholar-search-reference-v1";
export const SCHOLAR_SEARCH_REFERENCE_ENTRY_COUNT = 54;
export const SCHOLAR_SEARCH_REQUIRED_FAMILIES = [
  "query-processing",
  "pagination",
  "trust-context",
  "paper-use-state-restoration",
  "access-failure-ux",
  "measurement-release",
] as const;
const SCHOLAR_SEARCH_REFERENCE_RANGES = [
  ["query-processing", 1, 9, 4],
  ["pagination", 10, 19, 13],
  ["trust-context", 20, 28, 22],
  ["paper-use-state-restoration", 29, 37, 33],
  ["access-failure-ux", 38, 47, 42],
  ["measurement-release", 48, 54, 51],
] as const;
const SCHOLAR_SEARCH_REFERENCE_ATOMS = `
query-length:1 query-year-forwarding:2 query-sort-forwarding:3 query-url-state:4
query-identifier-detection:5 query-identifier-exact-route:6 query-exact-result-distinction:7
query-help-disclosure:8 query-spelling-correction:9 pagination-provider-limit:10
pagination-initial-window:11 pagination-local-more:12 pagination-provider-capability:13
pagination-request-offset:14 pagination-more-fetch:15 pagination-beyond-first-window:16
pagination-total-mode:17 pagination-next-metadata:18 pagination-position-restore:19
trust-card-metadata:20 trust-external-links:21 trust-provider-metadata:22
trust-source-freshness-display:23 trust-freshness-unknown:24 trust-ranking-reason:25
trust-partial-retrieval:26 trust-citation-unknown:27 trust-local-facets:28
use-title-and-pdf-actions:29 use-pdf-library-save:30 use-duplicate-save-recovery:31
use-url-conditions:32 use-back-navigation:33 use-destination-label:34 use-pdf-verification:35
use-landing-only-save:36 use-reader-failure-recovery:36 use-exact-result-snapshot:37
access-session-auth:38 access-beta-gate:39 access-loading-error-empty:40
access-local-filter-empty:41 access-error-retry:42 access-empty-vs-hydration-failure:43
access-provider-partial:44 access-error-specific-guidance:45 access-retryability:46
access-next-action-choice:47 measurement-entry-event:48 measurement-open-save-events:49
measurement-provider-observability:50 measurement-test-coverage:51
measurement-known-item-fixtures:52 measurement-release-thresholds:53
measurement-automatic-go-no-go:54
`
  .trim()
  .split(/\s+/u);
export const SERVICE_POLICY_MATRIX_ROW_SCHEMA = [
  "id",
  "referenceEntries",
  "referenceObservation",
  "observation",
  "reconciliation",
  "fact",
  "evidenceSource",
  "evidencePath",
  "evidenceLocator",
  "responsibilitySurfaces",
  "disposition",
  "dispositionRationale",
  "canonicalOwner",
  "authorityRefs",
  "sourcePromises",
  "verificationRefs",
  "decisionRef",
  "followUp",
] as const;

const nonEmpty = z.string().trim().min(1);
const evidenceSourceSchema = z
  .object({
    id: nonEmpty,
    repository: nonEmpty,
    revision: z.string().regex(/^[0-9a-f]{40}$/u),
    path: nonEmpty,
  })
  .strict();
const matrixItemSchema = z
  .object({
    id: nonEmpty,
    referenceEntries: z.array(z.number().int().positive()).min(1),
    referenceObservation: z.enum(["met", "not-met"]),
    observation: z.enum(["met", "not-met", "unknown"]),
    reconciliation: z.enum(["unchanged", "changed-since-audit", "current-unknown"]),
    fact: nonEmpty,
    evidence: z
      .array(z.object({ source: nonEmpty, path: nonEmpty, locator: nonEmpty }).strict())
      .min(1),
    responsibilitySurfaces: z
      .array(
        z.enum([
          "provider",
          "moonlight-runtime",
          "moonlight-ui",
          "moonlight-operations",
          "lighthouse-story-chain",
          "lighthouse-quality-gate",
        ]),
      )
      .min(1),
    disposition: z.enum(["owned", "rejected", "unresolved"]),
    dispositionRationale: nonEmpty,
    canonicalOwner: nonEmpty,
    authorityRefs: z.array(nonEmpty).min(1),
    sourcePromises: z.array(
      z.custom<PromiseRef>(
        (value) => typeof value === "string" && value.startsWith("promise:"),
        "must be a Promise ref",
      ),
    ),
    verificationRefs: z.array(nonEmpty),
    decisionRef: nonEmpty.optional(),
    followUp: nonEmpty,
  })
  .strict()
  .superRefine((item, context) => {
    if ((item.observation === "unknown") !== (item.reconciliation === "current-unknown")) {
      context.addIssue({
        code: "custom",
        path: ["reconciliation"],
        message: "unknown observation and current-unknown reconciliation must agree",
      });
    }
    if (item.disposition === "rejected" && !item.decisionRef) {
      context.addIssue({
        code: "custom",
        path: ["decisionRef"],
        message: "rejected disposition requires decisionRef",
      });
    }
  });
const matrixSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: nonEmpty,
    experience: z.custom<`experience:${string}`>(
      (value) => typeof value === "string" && value.startsWith("experience:"),
      "must be an Experience ref",
    ),
    serviceType: nonEmpty,
    reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    reference: nonEmpty,
    rowSchema: z.array(nonEmpty),
    coverageProfile: z
      .object({
        id: nonEmpty,
        referenceEntryCount: z.number().int().positive(),
        requiredFamilies: z.array(nonEmpty).min(1),
      })
      .strict(),
    sources: z.array(evidenceSourceSchema).min(1),
    families: z
      .array(
        z
          .object({
            id: nonEmpty,
            label: nonEmpty,
            expectedCapability: nonEmpty,
            mapsToLenses: z.array(nonEmpty).min(1),
            rows: nonEmpty,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

function ensureUnique(values: readonly string[], label: string, file: string): void {
  if (new Set(values).size !== values.length) {
    throw new StoryChainParseError(`${file}: ${label} must not contain duplicates`);
  }
}

function listCell(value: string): string[] {
  return value === "-" ? [] : value.split(";").map((entry) => entry.trim());
}

function parseRows(rows: string, familyId: string, file: string) {
  return rows
    .split("\n")
    .map((row) => row.trimEnd())
    .filter((row) => row.trim().length > 0 && !row.trimStart().startsWith("#"))
    .map((row, index) => {
      const cells = row.split("\t");
      if (cells.length !== SERVICE_POLICY_MATRIX_ROW_SCHEMA.length) {
        throw new StoryChainParseError(
          `${file}: ${familyId} row ${String(index + 1)} must have ${String(SERVICE_POLICY_MATRIX_ROW_SCHEMA.length)} tab-separated cells`,
        );
      }
      const [
        id,
        referenceEntries,
        referenceObservation,
        observation,
        reconciliation,
        fact,
        evidenceSource,
        evidencePath,
        evidenceLocator,
        responsibilitySurfaces,
        disposition,
        dispositionRationale,
        canonicalOwner,
        authorityRefs,
        sourcePromises,
        verificationRefs,
        decisionRef,
        followUp,
      ] = cells as [string, ...string[]];
      const item = matrixItemSchema.safeParse({
        id,
        referenceEntries: listCell(referenceEntries).map(Number),
        referenceObservation,
        observation,
        reconciliation,
        fact,
        evidence: [{ source: evidenceSource, path: evidencePath, locator: evidenceLocator }],
        responsibilitySurfaces: listCell(responsibilitySurfaces),
        disposition,
        dispositionRationale,
        canonicalOwner,
        authorityRefs: listCell(authorityRefs),
        sourcePromises: listCell(sourcePromises),
        verificationRefs: listCell(verificationRefs),
        ...(decisionRef === "-" ? {} : { decisionRef }),
        followUp,
      });
      if (!item.success) {
        const issue = item.error.issues[0];
        throw new StoryChainParseError(
          `${file}: ${familyId}/${id || String(index + 1)} ${issue.path.join(".")}: ${issue.message}`,
        );
      }
      return item.data;
    });
}

function validateMatrixItemReferences(
  item: ServicePolicyMatrixItem,
  input: { sourceIds: ReadonlySet<string>; referenceEntryCount: number; file: string },
): void {
  ensureUnique(item.responsibilitySurfaces, `${item.id} responsibility surfaces`, input.file);
  for (const entry of item.referenceEntries) {
    if (entry > input.referenceEntryCount) {
      throw new StoryChainParseError(`${input.file}: ${item.id} reference entry is out of range`);
    }
  }
  for (const evidence of item.evidence) {
    if (!input.sourceIds.has(evidence.source)) {
      throw new StoryChainParseError(
        `${input.file}: ${item.id} evidence references unknown source "${evidence.source}"`,
      );
    }
  }
}

function validateReferenceCoverage(
  matrix: Pick<ServicePolicyCoverageMatrix, "coverageProfile" | "sources">,
  families: ServicePolicyMatrixFamily[],
  file: string,
): void {
  const sourceIds = new Set(matrix.sources.map((source) => source.id));
  const items = families.flatMap((family) => family.items);
  for (const item of items) {
    validateMatrixItemReferences(item, {
      sourceIds,
      referenceEntryCount: matrix.coverageProfile.referenceEntryCount,
      file,
    });
  }
  const coveredEntries = new Set(items.flatMap((item) => item.referenceEntries));
  const missingEntries = Array.from(
    { length: matrix.coverageProfile.referenceEntryCount },
    (_, index) => index + 1,
  ).filter((entry) => !coveredEntries.has(entry));
  if (missingEntries.length > 0) {
    throw new StoryChainParseError(
      `${file}: reference coverage is missing entries: ${missingEntries.join(", ")}`,
    );
  }
}

function validateScholarReferenceFamily(
  family: ServicePolicyMatrixFamily,
  range: (typeof SCHOLAR_SEARCH_REFERENCE_RANGES)[number],
  file: string,
): void {
  const [familyId, first, last, metThrough] = range;
  for (const item of family.items) {
    const [entry] = item.referenceEntries;
    if (item.referenceEntries.length !== 1 || !entry || entry < first || entry > last) {
      throw new StoryChainParseError(
        `${file}: ${item.id} must preserve one atomic ${familyId} reference entry`,
      );
    }
    const expectedObservation = entry <= metThrough ? "met" : "not-met";
    if (item.referenceObservation !== expectedObservation) {
      throw new StoryChainParseError(
        `${file}: ${item.id} reference observation does not match entry ${String(entry)}`,
      );
    }
  }
}

function validateScholarSearchProfile(
  matrix: Pick<ServicePolicyCoverageMatrix, "coverageProfile">,
  families: ServicePolicyMatrixFamily[],
  file: string,
): void {
  if (matrix.coverageProfile.id !== SCHOLAR_SEARCH_COVERAGE_PROFILE_ID) return;
  if (
    matrix.coverageProfile.referenceEntryCount !== SCHOLAR_SEARCH_REFERENCE_ENTRY_COUNT ||
    matrix.coverageProfile.requiredFamilies.join("\n") !==
      SCHOLAR_SEARCH_REQUIRED_FAMILIES.join("\n")
  ) {
    throw new StoryChainParseError(
      `${file}: scholar search profile requires 54 entries and the canonical six families`,
    );
  }
  for (const range of SCHOLAR_SEARCH_REFERENCE_RANGES) {
    const family = families.find((candidate) => candidate.id === range[0]);
    if (!family) {
      throw new StoryChainParseError(`${file}: scholar search profile is missing ${range[0]}`);
    }
    validateScholarReferenceFamily(family, range, file);
  }
  const actualAtoms = families.flatMap((family) =>
    family.items.map((item) => `${item.id}:${item.referenceEntries.join(";")}`),
  );
  if (actualAtoms.join("\n") !== SCHOLAR_SEARCH_REFERENCE_ATOMS.join("\n")) {
    throw new StoryChainParseError(
      `${file}: scholar search profile must preserve the canonical reference atom map`,
    );
  }
}

export function parseServicePolicyCoverageMatrix(input: {
  source: string;
  file: string;
}): ServicePolicyCoverageMatrix {
  let raw: unknown;
  try {
    raw = parseYaml(input.source);
  } catch (error) {
    throw new StoryChainParseError(
      `${input.file}: invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const result = matrixSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new StoryChainParseError(
      `${input.file}: ${issue.path.join(".") || "matrix"}: ${issue.message}`,
    );
  }
  const matrix = result.data;
  if (matrix.rowSchema.join("\n") !== SERVICE_POLICY_MATRIX_ROW_SCHEMA.join("\n")) {
    throw new StoryChainParseError(`${input.file}: rowSchema does not match schemaVersion 1`);
  }
  ensureUnique(
    matrix.sources.map((source) => source.id),
    "source ids",
    input.file,
  );
  ensureUnique(matrix.coverageProfile.requiredFamilies, "required family ids", input.file);
  ensureUnique(
    matrix.families.map((family) => family.id),
    "family ids",
    input.file,
  );
  const families = matrix.families.map((family) => ({
    id: family.id,
    label: family.label,
    expectedCapability: family.expectedCapability,
    mapsToLenses: family.mapsToLenses,
    items: parseRows(family.rows, family.id, input.file),
  }));
  const itemIds = families.flatMap((family) => family.items.map((item) => item.id));
  ensureUnique(itemIds, "item ids", input.file);

  const familyIds = families.map((family) => family.id);
  if (familyIds.join("\n") !== matrix.coverageProfile.requiredFamilies.join("\n")) {
    throw new StoryChainParseError(
      `${input.file}: families must match coverageProfile.requiredFamilies in canonical order`,
    );
  }
  validateReferenceCoverage(matrix, families, input.file);
  validateScholarSearchProfile(matrix, families, input.file);
  const { rowSchema: _rowSchema, ...matrixWithoutRows } = matrix;
  void _rowSchema;
  return { ...matrixWithoutRows, families, path: path.normalize(input.file) };
}
