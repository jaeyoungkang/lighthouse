// Story Chain loader. Walks
// `docs/contracts/story-chain/{experiences,moments,promises,aspects,evidence-ledgers}/`
// and returns parsed model objects so the validator can check the whole
// graph. This is the only chain.
//
// The loader fails loudly when the chain root or any required subdirectory
// is missing. Earlier drafts swallowed missing-directory errors and returned
// empty arrays — that turned the validator into a silent-green gate any
// time the chain dir was deleted, renamed, or moved. The current behavior is
// strict on purpose: if you intend to disable the chain, retire the gate
// from package.json explicitly rather than letting the directory
// disappearance carry that meaning.

import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import {
  type Aspect,
  type Experience,
  type Moment,
  type PromiseDeclaration,
  type EvidenceLedger,
  RELEASE_VERDICT_DOC_END,
  RELEASE_VERDICT_DOC_START,
  type ServicePolicyCoverageMatrix,
  type StoryChainScenario,
  type TraceabilityCardinalityPolicy,
  renderReleaseVerdictDocumentBlock,
} from "@/app/domain/story-chain";

import { parseAspectFile, parseExperienceFile, parseMomentFile, parsePromiseFile } from "./parser";
import { StoryChainParseError } from "./parser-shared";
import { parseEvidenceLedgerRecord } from "./evidence-ledger-record";
import { resolveEvidenceLedgerRecord } from "./evidence-ledger-resolver";
import { parseAndValidateReviewFile, type ReviewEntry } from "./review-parser";
import { parseScenarioCatalog } from "./scenario-catalog";
import { parseServicePolicyCoverageMatrix } from "./service-policy-matrix";

export const STORY_CHAIN_DIR_REL = "docs/contracts/story-chain";

export const REQUIRED_SUBDIRS = [
  "experiences",
  "moments",
  "promises",
  "aspects",
  "evidence-ledgers",
  "service-policy-coverage",
] as const;

const LEGACY_PROSE_REVIEW_FINGERPRINTS = new Map<string, ReadonlyMap<string, string>>([
  [
    "knowledge-map-followup-surface.reviews.md",
    new Map([
      ["2026-07-19", "4481fbc21e5c7d591fb6f8373d4401de68b8dab72a0eb89e8fb041487f6b6c94"],
      ["2026-07-06", "23fab7670e21dc035d26aaffef8231eac5492f3a19afe24b564872d0f6fb134c"],
      ["2026-06-23", "778bf2a92352f47750bd4390fbd579ba6aad92d01fc31ea79dd9a6c6588352fb"],
      ["2026-06-08", "daf143222c80bb0a6d5406e5e978d656934c075d1e5131336547599107b8a359"],
    ]),
  ],
  [
    "paper-card-action-loading-feedback.reviews.md",
    new Map([["2026-06-08", "cd18d7f60ecd02c3c4b2d1a945325affe93196f12439a8962562264b570bd4b3"]]),
  ],
  [
    "paper-card-list-windowing.reviews.md",
    new Map([["2026-06-08", "0b3afaf3c0b88fbd52e7ed69ab268009e4260a4bb0dc41c9c85b62fe4c6bbf4f"]]),
  ],
]);

// Preserve exact pre-boundary Sufficiency Review evidence when a current AC is
// semantically renamed. Post-boundary entries still fail ownership validation
// because retired refs are not part of the ledger's current Source Promise ACs.
const HISTORICAL_REVIEW_ACCEPTANCE_CHECK_IDS = new Map<string, ReadonlySet<string>>([
  [
    "alignment-audit.reviews.md",
    new Set([
      "acceptance-check:release-verdict-aspect-integration-release-verdict-three-component-shape",
    ]),
  ],
]);

export interface StoryChain {
  scenarios: StoryChainScenario[];
  experiences: Experience[];
  moments: Moment[];
  promises: PromiseDeclaration[];
  aspects: Aspect[];
  evidenceLedgers: EvidenceLedger[];
  servicePolicyMatrices: ServicePolicyCoverageMatrix[];
  traceabilityCardinality: TraceabilityCardinalityPolicy;
  // Sufficiency Review entries parsed across every `evidence-ledgers/reviews/
  // *.reviews.md` file. Surfaced so the snapshot can compute revision drift
  // (`detectRevisionDrift`) per Promise and drop the stage to `verify` when
  // an AC's `revision` outpaces the latest review's `acReviewedRevision`.
  reviewEntries: ReviewEntry[];
}

export interface LoadStoryChainOptions {
  reviewFilesToSkip?: ReadonlySet<string>;
}

function ensureDirectory(dir: string, label: string): void {
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(dir);
  } catch {
    throw new StoryChainParseError(
      `loader: ${label} directory is missing at "${dir}". Restore the directory before validating Story Chain.`,
    );
  }
  if (!stat.isDirectory()) {
    throw new StoryChainParseError(`loader: ${label} path "${dir}" exists but is not a directory.`);
  }
}

function listMarkdownFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .map((name) => path.join(dir, name))
    .sort();
}

function listEvidenceLedgerFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const legacyLedgers = entries.filter((name) => name.endsWith(".ledger.md"));
  if (legacyLedgers.length > 0) {
    throw new StoryChainParseError(
      `loader: legacy Markdown Evidence Ledger(s) found at story-chain/evidence-ledgers root: ${legacyLedgers.join(", ")}. Operational ledgers must use *.ledger.yaml; move human-only Markdown under foundational/.`,
    );
  }
  return entries
    .filter((name) => name.endsWith(".ledger.yaml"))
    .map((name) => path.join(dir, name))
    .sort();
}

function listServicePolicyMatrixFiles(dir: string, docsRoot: string): string[] {
  if (!isPathWithin(realpathSync(docsRoot), realpathSync(dir))) {
    throw new StoryChainParseError(
      "loader: service-policy-coverage directory must remain inside the real repository docs directory",
    );
  }
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".matrix.yaml"))
    .map((name) => path.join(dir, name))
    .sort();
  for (const file of files) {
    const fileStat = lstatSync(file);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new StoryChainParseError(
        `loader: Service Policy Coverage Matrix must be a regular non-symlink file: ${file}`,
      );
    }
  }
  return files;
}

function isPathWithin(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function validateServicePolicyReviewFiles(
  repoRoot: string,
  experiences: Experience[],
  matrices: ServicePolicyCoverageMatrix[],
): void {
  const docsRoot = path.resolve(repoRoot, "docs");
  for (const experience of experiences) {
    const reviewRef = experience.servicePolicyCoverageReview;
    if (!reviewRef?.startsWith("docs/")) continue;

    const [repoRelativePath] = reviewRef.split("#", 1);
    if (!repoRelativePath) continue;
    const reviewPath = path.resolve(repoRoot, repoRelativePath);
    if (!isPathWithin(docsRoot, reviewPath)) {
      throw new StoryChainParseError(
        `${experience.id}: servicePolicyCoverageReview must resolve inside the repository docs directory`,
      );
    }

    let reviewStat: ReturnType<typeof lstatSync>;
    try {
      reviewStat = lstatSync(reviewPath);
    } catch {
      throw new StoryChainParseError(
        `${experience.id}: servicePolicyCoverageReview does not exist: ${repoRelativePath}`,
      );
    }
    if (!reviewStat.isFile() || reviewStat.isSymbolicLink()) {
      throw new StoryChainParseError(
        `${experience.id}: servicePolicyCoverageReview must resolve to a regular non-symlink file: ${repoRelativePath}`,
      );
    }
    const realRepoRoot = realpathSync(repoRoot);
    const realDocsRoot = realpathSync(docsRoot);
    const realReviewPath = realpathSync(reviewPath);
    if (!isPathWithin(realRepoRoot, realDocsRoot) || !isPathWithin(realDocsRoot, realReviewPath)) {
      throw new StoryChainParseError(
        `${experience.id}: servicePolicyCoverageReview must remain inside the real repository docs directory: ${repoRelativePath}`,
      );
    }
    if (!repoRelativePath.endsWith(".matrix.yaml")) {
      throw new StoryChainParseError(
        `${experience.id}: local servicePolicyCoverageReview must point to a versioned *.matrix.yaml file`,
      );
    }
    if (!matrices.some((matrix) => path.resolve(matrix.path) === path.resolve(reviewPath))) {
      throw new StoryChainParseError(
        `${experience.id}: servicePolicyCoverageReview is not loaded as a Service Policy Coverage Matrix: ${repoRelativePath}`,
      );
    }
  }
}

function validateReleaseVerdictDocumentation(repoRoot: string): void {
  const source = readFileSync(path.join(repoRoot, "docs", "mission-control.md"), "utf8");
  const start = source.indexOf(RELEASE_VERDICT_DOC_START);
  const end = source.indexOf(RELEASE_VERDICT_DOC_END);
  if (start < 0 || end < start) {
    throw new StoryChainParseError(
      "docs/mission-control.md: Release Verdict must contain the canonical dimension markers",
    );
  }
  const actual = source.slice(start, end + RELEASE_VERDICT_DOC_END.length);
  if (actual !== renderReleaseVerdictDocumentBlock()) {
    throw new StoryChainParseError(
      "docs/mission-control.md: Release Verdict dimensions drifted from the domain-owned four-dimension contract",
    );
  }
}

function loadTraceabilityCardinality(root: string): TraceabilityCardinalityPolicy {
  const policyPath = path.join(root, "traceability-cardinality.json");
  try {
    return JSON.parse(readFileSync(policyPath, "utf8")) as TraceabilityCardinalityPolicy;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new StoryChainParseError(
        `loader: traceability-cardinality.json is not valid JSON: ${error.message}`,
      );
    }
    throw new StoryChainParseError(
      `loader: traceability-cardinality.json is missing at "${policyPath}". Restore the file or remove the cardinality gate explicitly.`,
    );
  }
}

export function loadStoryChain(repoRoot: string, options: LoadStoryChainOptions = {}): StoryChain {
  const root = path.join(repoRoot, STORY_CHAIN_DIR_REL);
  ensureDirectory(root, "story-chain root");
  for (const sub of REQUIRED_SUBDIRS) {
    ensureDirectory(path.join(root, sub), `story-chain/${sub}`);
  }

  validateReleaseVerdictDocumentation(repoRoot);
  const experiences = listMarkdownFiles(path.join(root, "experiences")).map((file) =>
    parseExperienceFile({ source: readFileSync(file, "utf8"), file }),
  );
  const servicePolicyMatrices = listServicePolicyMatrixFiles(
    path.join(root, "service-policy-coverage"),
    path.join(repoRoot, "docs"),
  ).map((file) => parseServicePolicyCoverageMatrix({ source: readFileSync(file, "utf8"), file }));
  validateServicePolicyReviewFiles(repoRoot, experiences, servicePolicyMatrices);
  const moments = listMarkdownFiles(path.join(root, "moments")).map((file) =>
    parseMomentFile({ source: readFileSync(file, "utf8"), file }),
  );
  const promises = listMarkdownFiles(path.join(root, "promises")).map((file) =>
    parsePromiseFile({ source: readFileSync(file, "utf8"), file }),
  );
  const aspects = listMarkdownFiles(path.join(root, "aspects")).map((file) =>
    parseAspectFile({ source: readFileSync(file, "utf8"), file }),
  );
  const evidenceLedgers = listEvidenceLedgerFiles(path.join(root, "evidence-ledgers")).map((file) =>
    resolveEvidenceLedgerRecord(
      parseEvidenceLedgerRecord({ source: readFileSync(file, "utf8"), file }),
      file,
    ),
  );
  const scenarioCatalogPath = path.join(root, "scenario-catalog.md");
  let scenarios: StoryChainScenario[];
  try {
    scenarios = parseScenarioCatalog(
      readFileSync(scenarioCatalogPath, "utf8"),
      scenarioCatalogPath,
    );
  } catch (error) {
    if (error instanceof StoryChainParseError) throw error;
    throw new StoryChainParseError(
      `loader: scenario-catalog.md is missing at "${scenarioCatalogPath}". Restore the active scenario universe before validating Story Chain.`,
    );
  }
  const traceabilityCardinality = loadTraceabilityCardinality(root);
  // Sufficiency Review files are validated for cutoff + yaml schema and
  // their parsed entries are surfaced on the StoryChain return shape so
  // snapshot.ts can compute revision drift per Promise. The validator
  // resolves yaml.acs refs against the known AC and Intent Check IDs
  // collected from all parsed Promises so a typoed slug fails fast.
  const knownAcceptanceCheckIds = new Set<string>();
  const knownIntentCheckIds = new Set<string>();
  const promiseById = new Map(promises.map((promise) => [promise.id, promise]));
  for (const promise of promises) {
    for (const ac of promise.acceptanceChecks) knownAcceptanceCheckIds.add(ac.id);
    for (const ic of promise.intentChecks) knownIntentCheckIds.add(ic.id);
  }
  const reviewOwnershipByPath = new Map<
    string,
    {
      ownedAcceptanceCheckIds: ReadonlySet<string>;
      ownedIntentCheckIds: ReadonlySet<string>;
      ownershipLabel: string;
    }
  >();
  const reviewPathsWithUnresolvedOwners = new Set<string>();
  for (const ledger of evidenceLedgers) {
    if (!ledger.reviewPath) continue;
    const normalizedReviewPath = path.normalize(
      path.join(path.dirname(ledger.path), ledger.reviewPath),
    );
    if (!existsSync(normalizedReviewPath)) {
      throw new StoryChainParseError(
        `${ledger.path}: Sufficiency Review pointer does not exist: ${ledger.reviewPath}`,
      );
    }
    const ownedPromises = ledger.sourcePromises
      .map((ref) => promiseById.get(ref))
      .filter((promise): promise is PromiseDeclaration => promise !== undefined);
    if (ownedPromises.length !== ledger.sourcePromises.length) {
      // Let the graph resolver report the invalid Source Promise rather than
      // masking it with a review-owner error during the earlier parse phase.
      reviewPathsWithUnresolvedOwners.add(normalizedReviewPath);
      continue;
    }
    reviewOwnershipByPath.set(normalizedReviewPath, {
      ownedAcceptanceCheckIds: new Set(
        ownedPromises.flatMap((promise) => promise.acceptanceChecks.map((check) => check.id)),
      ),
      ownedIntentCheckIds: new Set(
        ownedPromises.flatMap((promise) => promise.intentChecks.map((check) => check.id)),
      ),
      ownershipLabel: ledger.path,
    });
  }
  const reviewsDir = path.join(root, "evidence-ledgers", "reviews");
  ensureDirectory(reviewsDir, "story-chain/evidence-ledgers/reviews");
  const reviewEntries: ReviewEntry[] = [];
  for (const file of readdirSync(reviewsDir)
    .filter((n) => n.endsWith(".reviews.md"))
    .map((n) => path.join(reviewsDir, n))
    .filter((file) => !options.reviewFilesToSkip?.has(file))) {
    const normalizedFile = path.normalize(file);
    const knownAcceptanceCheckIdsForFile = new Set(knownAcceptanceCheckIds);
    for (const historicalId of HISTORICAL_REVIEW_ACCEPTANCE_CHECK_IDS.get(path.basename(file)) ??
      []) {
      knownAcceptanceCheckIdsForFile.add(historicalId);
    }
    const ownership = reviewOwnershipByPath.get(normalizedFile);
    const unmatchedOwnership =
      !ownership && !reviewPathsWithUnresolvedOwners.has(normalizedFile)
        ? {
            ownedAcceptanceCheckIds: new Set<string>(),
            ownedIntentCheckIds: new Set<string>(),
            ownershipLabel: `a matching Evidence Ledger for ${path.basename(file)}`,
          }
        : undefined;
    const entries = parseAndValidateReviewFile(readFileSync(file, "utf8"), file, {
      knownAcceptanceCheckIds: knownAcceptanceCheckIdsForFile,
      knownIntentCheckIds,
      legacyProseReviewFingerprints: LEGACY_PROSE_REVIEW_FINGERPRINTS.get(path.basename(file)),
      ...ownership,
      ...unmatchedOwnership,
    });
    reviewEntries.push(...entries);
  }
  return {
    scenarios,
    experiences,
    moments,
    promises,
    aspects,
    evidenceLedgers,
    servicePolicyMatrices,
    traceabilityCardinality,
    reviewEntries,
  };
}
