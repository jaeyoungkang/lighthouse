// review-parser.ts — parses Sufficiency Review entries inside
// `docs/contracts/story-chain/evidence-ledgers/reviews/*.reviews.md` and
// enforces the yaml-block schema declared by
// `promise:alignment-coherence-gate#acceptance-check:alignment-coherence-gate-review-yaml-schema`.
//
// Cutoff (acceptance-check:alignment-coherence-gate-review-cutoff-migration):
// prose-only entries dated before `REVIEW_SCHEMA_CUTOFF_DATE` are implicit
// and skip schema enforcement. Any entry with a ```yaml fenced block is
// parsed and validated against the current schema.

import { createHash } from "node:crypto";

import { traceabilityNodePrefix } from "@/app/domain/story-chain";

import { parseFrontmatter, readList } from "./parser-shared";

export const REVIEW_SCHEMA_CUTOFF_DATE = "2026-05-06";
export const REVIEW_OWNER_BOUNDARY_CUTOFF_DATE = "2026-07-22";
export const REVIEW_OBSERVED_OUTPUT_MIN_CHARS = 80;
export const REVIEW_VALID_VERDICTS: ReadonlySet<string> = new Set(["met", "not-met", "unknown"]);

const YAML_FENCE_RE = /```yaml\s*\n([\s\S]*?)```/;
const ACCEPTANCE_CHECK_PREFIX = traceabilityNodePrefix("acceptance-check");
const INTENT_CHECK_PREFIX = traceabilityNodePrefix("intent-check");
const PROMISE_PREFIX = traceabilityNodePrefix("promise");
const PROMISE_REF_PATTERN = new RegExp(
  `${PROMISE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([a-z0-9][a-z0-9-]*)`,
  "g",
);

export class ReviewParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewParseError";
  }
}

export interface ReviewYamlBlock {
  date?: string;
  acs: string[];
  acReviewedRevision: number[];
  fixtureRef?: string;
  runCommitSha?: string;
  observedOutput?: string;
  gaps: string[];
  verdict?: string;
}

export interface ReviewEntry {
  sourcePath?: string;
  date: string;
  headingLine: string;
  yaml: ReviewYamlBlock | null;
  sourceFingerprint?: string;
  // True only when the entry is an implicit prose-only pre-cutoff entry.
  grandfathered: boolean;
}

export function parseReviewFile(source: string, file: string): ReviewEntry[] {
  const entries: ReviewEntry[] = [];
  // Split at lines that match `#### YYYY-MM-DD ...`. We walk manually so we
  // can carry the heading line into each entry chunk.
  const lines = source.split(/\r?\n/);
  let currentHeading: string | null = null;
  let currentDate: string | null = null;
  let currentBody: string[] = [];
  const flush = () => {
    if (currentHeading && currentDate) {
      entries.push(buildEntry(currentDate, currentHeading, currentBody.join("\n"), file));
    }
  };
  for (const line of lines) {
    const m = line.match(/^####\s+(\d{4}-\d{2}-\d{2})\b/);
    if (m) {
      flush();
      currentDate = m[1];
      currentHeading = line;
      currentBody = [];
      continue;
    }
    if (currentHeading) currentBody.push(line);
  }
  flush();
  return entries;
}

function buildEntry(date: string, headingLine: string, body: string, file: string): ReviewEntry {
  const sourceFingerprint = createHash("sha256").update(`${headingLine}\n${body}`).digest("hex");
  const yamlMatch = body.match(YAML_FENCE_RE);
  if (yamlMatch) {
    const yaml = parseReviewYaml(yamlMatch[1], `${file}: ${headingLine.trim()}`);
    return {
      sourcePath: file,
      date,
      headingLine,
      yaml,
      sourceFingerprint,
      grandfathered: false,
    };
  }
  if (date < REVIEW_SCHEMA_CUTOFF_DATE) {
    return {
      sourcePath: file,
      date,
      headingLine,
      yaml: null,
      sourceFingerprint,
      grandfathered: true,
    };
  }
  return {
    sourcePath: file,
    date,
    headingLine,
    yaml: null,
    sourceFingerprint,
    grandfathered: false,
  };
}

function parseReviewYaml(raw: string, where: string): ReviewYamlBlock {
  // Only the documented subset is supported by the Sufficiency Review schema.
  // Multi-line scalars (`|`, `>`), quoted scalars, and other YAML features
  // are out of scope — `parseFrontmatter` is a flat scalar/list reader. Reject
  // shapes it cannot honor with a clear error rather than silently dropping
  // data. See `docs/contracts/story-chain/promises/alignment-coherence-gate.md`
  // (acceptance-check:alignment-coherence-gate-review-yaml-schema).
  for (const rawLine of raw.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const scalarMatch = rawLine.match(/^[A-Za-z][A-Za-z0-9_-]*\s*:\s*(.*)$/);
    if (!scalarMatch) continue;
    const value = scalarMatch[1].trim();
    if (value === "|" || value === ">") {
      throw new ReviewParseError(
        `${where}: yaml block uses unsupported multi-line scalar (\`|\` / \`>\`). Use a single-line scalar instead.`,
      );
    }
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      throw new ReviewParseError(
        `${where}: yaml block uses quoted scalars. Use unquoted single-line scalars in this subset.`,
      );
    }
  }
  const map = parseFrontmatter(raw);
  const allowedKeys = new Set([
    "date",
    "acs",
    "acReviewedRevision",
    "fixtureRef",
    "runCommitSha",
    "observedOutput",
    "gaps",
    "verdict",
  ]);
  for (const key of map.keys()) {
    if (!allowedKeys.has(key)) {
      throw new ReviewParseError(
        `${where}: yaml.${key} is not supported. Convert the entry to the full review schema instead.`,
      );
    }
  }
  const acs = readList(map, "acs");
  const acRevisionsRaw = readList(map, "acReviewedRevision");
  const acReviewedRevision: number[] = acRevisionsRaw.map((value) => {
    if (!/^\d+$/.test(value)) {
      throw new ReviewParseError(
        `${where}: acReviewedRevision item "${value}" must be a positive integer`,
      );
    }
    const parsed = Number(value);
    if (parsed < 1) {
      throw new ReviewParseError(`${where}: acReviewedRevision item must be ≥ 1`);
    }
    return parsed;
  });
  const date = readScalarField(map, "date");
  const fixtureRef = readScalarField(map, "fixtureRef");
  const runCommitSha = readScalarField(map, "runCommitSha");
  const observedOutput = readScalarField(map, "observedOutput");
  const gaps = readList(map, "gaps");
  const verdict = readScalarField(map, "verdict");
  return {
    date,
    acs,
    acReviewedRevision,
    fixtureRef,
    runCommitSha,
    observedOutput,
    gaps,
    verdict,
  };
}

function readScalarField(map: Map<string, string | string[]>, key: string): string | undefined {
  const value = map.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function validateReviewAcRef(
  ac: string,
  where: string,
  context: ReviewValidationContext | undefined,
  entryDate: string,
): void {
  if (ac.startsWith(ACCEPTANCE_CHECK_PREFIX)) {
    if (context?.knownAcceptanceCheckIds && !context.knownAcceptanceCheckIds.has(ac)) {
      throw new ReviewParseError(
        `${where}: yaml.acs item "${ac}" does not resolve to any AcceptanceCheck declared in the Story Chain`,
      );
    }
    if (
      entryDate >= REVIEW_OWNER_BOUNDARY_CUTOFF_DATE &&
      context?.ownedAcceptanceCheckIds &&
      !context.ownedAcceptanceCheckIds.has(ac)
    ) {
      throw new ReviewParseError(
        `${where}: yaml.acs item "${ac}" is outside ${context.ownershipLabel ?? "this Evidence Ledger"}'s Source Promises. Keep the AC ref and reviewed revision in its owning ledger; reference downstream impact in prose only.`,
      );
    }
    return;
  }
  if (ac.startsWith(INTENT_CHECK_PREFIX)) {
    if (context?.knownIntentCheckIds && !context.knownIntentCheckIds.has(ac)) {
      throw new ReviewParseError(
        `${where}: yaml.acs item "${ac}" does not resolve to any IntentCheck declared in the Story Chain`,
      );
    }
    if (
      entryDate >= REVIEW_OWNER_BOUNDARY_CUTOFF_DATE &&
      context?.ownedIntentCheckIds &&
      !context.ownedIntentCheckIds.has(ac)
    ) {
      throw new ReviewParseError(
        `${where}: yaml.acs item "${ac}" is outside ${context.ownershipLabel ?? "this Evidence Ledger"}'s Source Promises. Keep the IC ref and verdict in its owning ledger; reference downstream impact in prose only.`,
      );
    }
    return;
  }
  throw new ReviewParseError(
    `${where}: yaml.acs item "${ac}" must be an acceptance-check: or intent-check: ref`,
  );
}

export interface ReviewValidationContext {
  // Set of fully-qualified `acceptance-check:<promise>-<suffix>` IDs known to
  // the Story Chain. When provided, the validator resolves yaml.acs entries
  // against this set so a review citing a typoed slug fails fast instead of
  // being silently ignored by drift detection.
  knownAcceptanceCheckIds?: ReadonlySet<string>;
  // Set of fully-qualified `intent-check:<slug>` IDs likewise.
  knownIntentCheckIds?: ReadonlySet<string>;
  // AC/IC refs owned by the Evidence Ledger whose sibling review file is
  // being validated. New review entries may not revision-sync foreign owners;
  // historical entries before REVIEW_OWNER_BOUNDARY_CUTOFF_DATE remain
  // readable without rewriting dated evidence.
  ownedAcceptanceCheckIds?: ReadonlySet<string>;
  ownedIntentCheckIds?: ReadonlySet<string>;
  ownershipLabel?: string;
  legacyProseReviewFingerprints?: ReadonlyMap<string, string>;
}

export function validateReviewEntry(
  entry: ReviewEntry,
  file: string,
  context?: ReviewValidationContext,
): void {
  if (entry.grandfathered) return;
  const preservedFingerprint = context?.legacyProseReviewFingerprints?.get(entry.date);
  if (!entry.yaml && preservedFingerprint === entry.sourceFingerprint) return;
  const where = `${file}: ${entry.headingLine.trim()}`;
  if (!entry.yaml) {
    throw new ReviewParseError(
      `${where}: review entry on/after ${REVIEW_SCHEMA_CUTOFF_DATE} must carry a \`\`\`yaml block`,
    );
  }
  const yaml = entry.yaml;
  if (!yaml.date) {
    throw new ReviewParseError(`${where}: yaml.date is required (YYYY-MM-DD)`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yaml.date)) {
    throw new ReviewParseError(
      `${where}: yaml.date "${yaml.date}" must be a YYYY-MM-DD calendar date`,
    );
  }
  if (yaml.date !== entry.date) {
    throw new ReviewParseError(
      `${where}: yaml.date "${yaml.date}" must match the entry heading date "${entry.date}"`,
    );
  }
  if (yaml.acs.length === 0) {
    throw new ReviewParseError(`${where}: yaml.acs must list at least one AC ref`);
  }
  for (const ac of yaml.acs) {
    validateReviewAcRef(ac, where, context, entry.date);
  }
  // Only acceptance-check refs need a parallel revision entry. Intent-check
  // refs do not carry meaningful revisions, so they are reviewed as named
  // refs without a revision pair.
  const acceptanceRefCount = yaml.acs.filter((ref) =>
    ref.startsWith(ACCEPTANCE_CHECK_PREFIX),
  ).length;
  if (yaml.acReviewedRevision.length !== acceptanceRefCount) {
    throw new ReviewParseError(
      `${where}: yaml.acReviewedRevision length (${String(yaml.acReviewedRevision.length)}) must match the number of acceptance-check refs in yaml.acs (${String(acceptanceRefCount)}). intent-check refs do not require a revision pair.`,
    );
  }
  if (!yaml.fixtureRef) {
    throw new ReviewParseError(`${where}: yaml.fixtureRef is required`);
  }
  if (!yaml.runCommitSha) {
    throw new ReviewParseError(`${where}: yaml.runCommitSha is required`);
  }
  if (!yaml.observedOutput) {
    throw new ReviewParseError(`${where}: yaml.observedOutput is required`);
  }
  if (yaml.observedOutput.length < REVIEW_OBSERVED_OUTPUT_MIN_CHARS) {
    throw new ReviewParseError(
      `${where}: yaml.observedOutput is ${String(yaml.observedOutput.length)} chars (minimum ${String(REVIEW_OBSERVED_OUTPUT_MIN_CHARS)})`,
    );
  }
  if (yaml.gaps.length === 0) {
    throw new ReviewParseError(
      `${where}: yaml.gaps must list at least one entry (use "adopt: <reason>" or "reject: <reason>")`,
    );
  }
  for (const gap of yaml.gaps) {
    if (!/^(adopt|reject):\s+\S/.test(gap)) {
      throw new ReviewParseError(
        `${where}: yaml.gaps item "${gap}" must start with "adopt: " or "reject: " followed by a reason`,
      );
    }
  }
  if (!yaml.verdict || !REVIEW_VALID_VERDICTS.has(yaml.verdict)) {
    throw new ReviewParseError(
      `${where}: yaml.verdict must be one of ${[...REVIEW_VALID_VERDICTS].join(", ")} (got "${yaml.verdict ?? ""}")`,
    );
  }
  validateReviewSectionHeaderPromiseConsistency(entry, where);
  validateReviewObservedOutputAcCountConsistency(entry, where);
}

// Section headers like `#### 2026-05-04 — Intent absorbed for \`promise:foo\``
// must use the same promise slug that the yaml.acs entries reference. This
// catches structural drift where a section header declares one promise but the
// acs list references unrelated ACs (see #38 follow-up; pre-existing legacy
// pattern across gap-report-surface and moonlight-handoff reviews).
//
// Only fires when the header names exactly one `promise:X` ref — multi-promise
// section headers (e.g., "Intent absorbed for 4 deterministic search promises
// (`promise:a` + `promise:b`)") legitimately carry cross-promise absorption
// pointers in acs and are skipped.
function validateReviewSectionHeaderPromiseConsistency(entry: ReviewEntry, where: string): void {
  if (!entry.yaml) return;
  const headerPromiseRefs = extractHeaderPromiseRefs(entry.headingLine);
  if (headerPromiseRefs.length !== 1) return;
  const acceptanceAcs = entry.yaml.acs.filter((ref) => ref.startsWith(ACCEPTANCE_CHECK_PREFIX));
  if (acceptanceAcs.length === 0) return;
  const headerSlug = headerPromiseRefs[0].slice(PROMISE_PREFIX.length);
  for (const ac of acceptanceAcs) {
    const acRest = ac.slice(ACCEPTANCE_CHECK_PREFIX.length);
    if (!acRest.startsWith(`${headerSlug}-`)) {
      throw new ReviewParseError(
        `${where}: yaml.acs entry "${ac}" does not belong to promise:${headerSlug} named in the section header. Either fix the acs list to match the header promise or split this review into one section per promise.`,
      );
    }
  }
}

function extractHeaderPromiseRefs(headingLine: string): string[] {
  const refs = new Set<string>();
  const matches = headingLine.matchAll(PROMISE_REF_PATTERN);
  for (const match of matches) refs.add(`${PROMISE_PREFIX}${match[1]}`);
  return [...refs];
}

// observedOutput claims with explicit "all N" quantifier like "all 9
// Acceptance Checks" or "all 6 ACs" must match the acceptance-check count in
// yaml.acs. The "all" quantifier is a confident scope claim that should match
// the listed scope. Looser "N ACs" mentions are tolerated (upstream/total/
// representative).
//
// The comparison filters yaml.acs to acceptance-check entries only, so a
// mixed list (acceptance-check + intent-check) still passes when the prose
// says "all N Acceptance Checks and all M Intent Checks" — N must match the
// acceptance-check count, not the total acs length.
//
// Catches the drift class CodeRabbit flagged on presence-bot reviews (claim
// said 9 while acceptance-check entries listed 12).
function validateReviewObservedOutputAcCountConsistency(entry: ReviewEntry, where: string): void {
  if (!entry.yaml || !entry.yaml.observedOutput) return;
  const observed = entry.yaml.observedOutput;
  const patterns = [/\ball\s+(\d+)\s+Acceptance\s+Checks?\b/i, /\ball\s+(\d+)\s+ACs?\b/i];
  const acsLen = entry.yaml.acs.filter((ref) => ref.startsWith(ACCEPTANCE_CHECK_PREFIX)).length;
  for (const pattern of patterns) {
    const match = observed.match(pattern);
    if (!match) continue;
    const claimed = Number.parseInt(match[1], 10);
    if (Number.isFinite(claimed) && claimed !== acsLen) {
      throw new ReviewParseError(
        `${where}: yaml.observedOutput claims "${match[0]}" but yaml.acs lists ${String(acsLen)} acceptance-check entries. Update the prose count or the acs list so they agree.`,
      );
    }
    return;
  }
}

export function parseAndValidateReviewFile(
  source: string,
  file: string,
  context?: ReviewValidationContext,
): ReviewEntry[] {
  const entries = parseReviewFile(source, file);
  for (const entry of entries) {
    validateReviewEntry(entry, file, context);
  }
  if (context?.legacyProseReviewFingerprints) {
    const expected = [...context.legacyProseReviewFingerprints.entries()];
    const preserved = entries
      .filter((entry) => !entry.yaml && !entry.grandfathered)
      .map((entry) => [entry.date, entry.sourceFingerprint] as const)
      .filter(
        ([date, fingerprint]) => context.legacyProseReviewFingerprints?.get(date) === fingerprint,
      );
    const preservesExactSequence =
      preserved.length === expected.length &&
      preserved.every(
        ([date, fingerprint], index) =>
          date === expected[index]?.[0] && fingerprint === expected[index]?.[1],
      );
    if (!preservesExactSequence) {
      throw new ReviewParseError(
        `${file}: migrated prose review history must preserve each registered fingerprint exactly once and in order`,
      );
    }
  }
  return entries;
}
