import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type { StoryChain } from "@/app/server/services/story-chain/loader";
import { loadStoryChain } from "@/app/server/services/story-chain/loader";
import { parseReviewFile, type ReviewEntry } from "@/app/server/services/story-chain/review-parser";

export const REVIEW_RETENTION_REPORT_SCHEMA = "review-retention-report/v1";
export const APPROVED_KEEP_GENERATIONS = 3;
export const RETENTION_CANDIDATES = [1, 2, 3, 5, 10] as const;
export const FOUNDATIONAL_EXEMPT_SLUGS = ["product-boundary", "runtime-contract"] as const;

export type ReviewRetentionAuthorityReason =
  | "current-ref"
  | "current-aspect"
  | "current-reader-compatibility"
  | "foundational-exempt"
  | "unmapped-owner";

export interface ReviewRetentionOwner {
  kind: "evidence-ledger" | "foundational-exempt" | "unmapped";
  ledgerPath?: string;
  currentRefs: string[];
  appliedAspects: string[];
}

export interface ReviewRetentionGeneration {
  id: string;
  date: string;
  physicalIndex: number;
  headingLine: string;
  lineCount: number;
  byteCount: number;
  verdict?: string;
  grandfathered: boolean;
  citedRefs: string[];
  authorityReasons: ReviewRetentionAuthorityReason[];
  authorityRefs: string[];
  authorityAspects: string[];
}

export interface ReviewRetentionScenario {
  keepGenerations: number;
  rawKeepGenerationIds: string[];
  exceptionKeepGenerationIds: string[];
  effectiveKeepGenerationIds: string[];
  wouldDisposeGenerationIds: string[];
}

export interface ReviewRetentionStream {
  slug: string;
  path: string;
  owner: ReviewRetentionOwner;
  generationCount: number;
  lineCount: number;
  byteCount: number;
  chronologicalLatestGenerationId?: string;
  physicalLastGenerationId?: string;
  orderingHazard: boolean;
  unresolvedGenerationCount: number;
  currentUnresolvedGenerationCount: number;
  generations: ReviewRetentionGeneration[];
  scenarios: ReviewRetentionScenario[];
}

export interface ReviewRetentionCandidateSummary {
  keepGenerations: number;
  rawKeep: number;
  authorityExceptions: number;
  effectiveKeep: number;
  wouldDispose: number;
}

export interface ReviewRetentionCadence {
  intervalSampleCount: number;
  sameDayTransitionCount: number;
  medianDays?: number;
  p75Days?: number;
  p90Days?: number;
  maxDays?: number;
}

export interface ReviewRetentionReport {
  schema: typeof REVIEW_RETENTION_REPORT_SCHEMA;
  generatedAt: string;
  repositoryRevision: string;
  dirty: boolean;
  policy: {
    approvedKeepGenerations: typeof APPROVED_KEEP_GENERATIONS;
    candidateKeepGenerations: number[];
    ordering: "date-desc-then-later-physical-entry";
    mutation: "disabled";
    gate: "disabled";
    foundationalExemptSlugs: string[];
  };
  population: {
    directory: string;
    streamCount: number;
    generationCount: number;
    lineCount: number;
    byteCount: number;
    orderingHazardStreamCount: number;
    foundationalExemptStreamCount: number;
    unmappedStreamCount: number;
    unresolvedGenerationCount: number;
    currentUnresolvedGenerationCount: number;
  };
  cadence: ReviewRetentionCadence;
  candidates: ReviewRetentionCandidateSummary[];
  streams: ReviewRetentionStream[];
}

export interface BuildReviewRetentionReportOptions {
  generatedAt?: string;
  repositoryRevision?: string;
  dirty?: boolean;
  chain?: StoryChain;
}

interface GenerationChunk {
  text: string;
}

const DATED_REVIEW_HEADING_RE = /^####\s+(\d{4}-\d{2}-\d{2})\b.*$/gm;

function countLinesLikeWc(source: string): number {
  return source.match(/\n/g)?.length ?? 0;
}

function splitGenerationChunks(source: string): GenerationChunk[] {
  const matches = [...source.matchAll(DATED_REVIEW_HEADING_RE)];
  return matches.map((match, index) => ({
    text: source.slice(match.index, matches[index + 1]?.index ?? source.length),
  }));
}

function generationId(entry: ReviewEntry, physicalIndex: number): string {
  return `${entry.date}#${String(physicalIndex + 1)}`;
}

function byChronologicalRecency(
  a: ReviewRetentionGeneration,
  b: ReviewRetentionGeneration,
): number {
  const dateDiff = b.date.localeCompare(a.date);
  return dateDiff !== 0 ? dateDiff : b.physicalIndex - a.physicalIndex;
}

function addAuthorityReason(
  generation: ReviewRetentionGeneration,
  reason: ReviewRetentionAuthorityReason,
): void {
  if (!generation.authorityReasons.includes(reason)) {
    generation.authorityReasons.push(reason);
  }
}

function findLatestGeneration(
  chronological: readonly ReviewRetentionGeneration[],
  predicate: (generation: ReviewRetentionGeneration) => boolean,
): ReviewRetentionGeneration | undefined {
  return chronological.find(predicate);
}

function buildScenarios(
  chronological: readonly ReviewRetentionGeneration[],
  candidates: readonly number[],
): ReviewRetentionScenario[] {
  const authorityIds = new Set(
    chronological
      .filter((generation) => generation.authorityReasons.length > 0)
      .map((generation) => generation.id),
  );

  return candidates.map((keepGenerations) => {
    const rawIds = new Set(
      chronological.slice(0, keepGenerations).map((generation) => generation.id),
    );
    const exceptionIds = new Set([...authorityIds].filter((id) => !rawIds.has(id)));
    const effectiveIds = new Set([...rawIds, ...authorityIds]);
    return {
      keepGenerations,
      rawKeepGenerationIds: chronological
        .filter((generation) => rawIds.has(generation.id))
        .map((generation) => generation.id),
      exceptionKeepGenerationIds: chronological
        .filter((generation) => exceptionIds.has(generation.id))
        .map((generation) => generation.id),
      effectiveKeepGenerationIds: chronological
        .filter((generation) => effectiveIds.has(generation.id))
        .map((generation) => generation.id),
      wouldDisposeGenerationIds: chronological
        .filter((generation) => !effectiveIds.has(generation.id))
        .map((generation) => generation.id),
    };
  });
}

export function analyzeReviewRetentionStream(input: {
  slug: string;
  relativePath: string;
  source: string;
  owner: ReviewRetentionOwner;
  candidates?: readonly number[];
}): ReviewRetentionStream {
  const entries = parseReviewFile(input.source, input.relativePath);
  const chunks = splitGenerationChunks(input.source);
  if (entries.length !== chunks.length) {
    throw new Error(
      `${input.relativePath}: review parser returned ${String(entries.length)} entries but retention chunking found ${String(chunks.length)}`,
    );
  }

  const generations = entries.map((entry, physicalIndex): ReviewRetentionGeneration => {
    const chunk = chunks[physicalIndex].text;
    return {
      id: generationId(entry, physicalIndex),
      date: entry.date,
      physicalIndex: physicalIndex + 1,
      headingLine: entry.headingLine,
      lineCount: countLinesLikeWc(chunk),
      byteCount: Buffer.byteLength(chunk),
      verdict: entry.yaml?.verdict,
      grandfathered: entry.grandfathered,
      citedRefs: entry.yaml?.acs ?? [],
      authorityReasons: [],
      authorityRefs: [],
      authorityAspects: [],
    };
  });
  const chronological = [...generations].sort(byChronologicalRecency);

  if (input.owner.kind === "foundational-exempt") {
    for (const generation of generations) {
      addAuthorityReason(generation, "foundational-exempt");
    }
  } else if (input.owner.kind === "unmapped") {
    for (const generation of generations) {
      addAuthorityReason(generation, "unmapped-owner");
    }
  } else {
    const citedCurrentRefs = input.owner.currentRefs.filter((ref) =>
      generations.some((generation) => generation.citedRefs.includes(ref)),
    );
    for (const ref of citedCurrentRefs) {
      const generation = findLatestGeneration(chronological, (candidate) =>
        candidate.citedRefs.includes(ref),
      );
      if (!generation) continue;
      addAuthorityReason(generation, "current-ref");
      generation.authorityRefs.push(ref);
    }

    for (const aspect of input.owner.appliedAspects) {
      const generation = findLatestGeneration(chronological, (candidate) => {
        const chunk = chunks[candidate.physicalIndex - 1].text;
        return chunk.includes(aspect);
      });
      if (!generation) continue;
      addAuthorityReason(generation, "current-aspect");
      generation.authorityAspects.push(aspect);
    }

    const physicalLast = generations.at(-1);
    if (physicalLast) {
      addAuthorityReason(physicalLast, "current-reader-compatibility");
    }
  }

  for (const generation of generations) {
    generation.authorityReasons.sort();
    generation.authorityRefs.sort();
    generation.authorityAspects.sort();
  }

  const chronologicalLatest = chronological.at(0);
  const physicalLast = generations.at(-1);
  const unresolved = generations.filter(
    (generation) => generation.verdict === "unknown" || generation.verdict === "not-met",
  );
  const currentUnresolved = unresolved.filter(
    (generation) => generation.authorityReasons.length > 0,
  );

  return {
    slug: input.slug,
    path: input.relativePath,
    owner: input.owner,
    generationCount: generations.length,
    lineCount: countLinesLikeWc(input.source),
    byteCount: Buffer.byteLength(input.source),
    chronologicalLatestGenerationId: chronologicalLatest?.id,
    physicalLastGenerationId: physicalLast?.id,
    orderingHazard:
      chronologicalLatest !== undefined &&
      physicalLast !== undefined &&
      chronologicalLatest.id !== physicalLast.id,
    unresolvedGenerationCount: unresolved.length,
    currentUnresolvedGenerationCount: currentUnresolved.length,
    generations: chronological,
    scenarios: buildScenarios(chronological, input.candidates ?? RETENTION_CANDIDATES),
  };
}

function ownerForSlug(chain: StoryChain, repoRoot: string, slug: string): ReviewRetentionOwner {
  if ((FOUNDATIONAL_EXEMPT_SLUGS as readonly string[]).includes(slug)) {
    return {
      kind: "foundational-exempt",
      currentRefs: [],
      appliedAspects: [],
    };
  }

  const ledger = chain.evidenceLedgers.find(
    (candidate) => path.basename(candidate.path) === `${slug}.ledger.yaml`,
  );
  if (!ledger) {
    return {
      kind: "unmapped",
      currentRefs: [],
      appliedAspects: [],
    };
  }

  const promiseById = new Map(chain.promises.map((promise) => [promise.id, promise]));
  const currentRefs = ledger.sourcePromises.flatMap((promiseRef) => {
    const promise = promiseById.get(promiseRef);
    if (!promise) return [];
    return [
      ...promise.acceptanceChecks.map((check) => check.id),
      ...promise.intentChecks.map((check) => check.id),
    ];
  });
  return {
    kind: "evidence-ledger",
    ledgerPath: path.relative(repoRoot, ledger.path),
    currentRefs: [...new Set(currentRefs)].sort(),
    appliedAspects: [...new Set(ledger.appliedAspects)].sort(),
  };
}

function percentile(sorted: readonly number[], proportion: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const index = Math.ceil(proportion * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function buildCadence(streams: readonly ReviewRetentionStream[]): ReviewRetentionCadence {
  const positiveIntervals: number[] = [];
  let sameDayTransitionCount = 0;
  for (const stream of streams) {
    const ascending = [...stream.generations].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      return dateDiff !== 0 ? dateDiff : a.physicalIndex - b.physicalIndex;
    });
    for (let index = 1; index < ascending.length; index += 1) {
      const previous = Date.parse(`${ascending[index - 1].date}T00:00:00Z`);
      const current = Date.parse(`${ascending[index].date}T00:00:00Z`);
      const interval = Math.round((current - previous) / 86_400_000);
      if (interval === 0) {
        sameDayTransitionCount += 1;
      } else if (interval > 0) {
        positiveIntervals.push(interval);
      }
    }
  }
  positiveIntervals.sort((a, b) => a - b);
  return {
    intervalSampleCount: positiveIntervals.length,
    sameDayTransitionCount,
    medianDays: percentile(positiveIntervals, 0.5),
    p75Days: percentile(positiveIntervals, 0.75),
    p90Days: percentile(positiveIntervals, 0.9),
    maxDays: positiveIntervals.at(-1),
  };
}

function repositoryIdentity(repoRoot: string): { repositoryRevision: string; dirty: boolean } {
  const repositoryRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const dirty =
    execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim().length > 0;
  return { repositoryRevision, dirty };
}

export function buildReviewRetentionReport(
  repoRoot: string,
  options: BuildReviewRetentionReportOptions = {},
): ReviewRetentionReport {
  const reviewsDirectory = path.join(
    repoRoot,
    "docs/contracts/story-chain/evidence-ledgers/reviews",
  );
  const chain = options.chain ?? loadStoryChain(repoRoot);
  const identity =
    options.repositoryRevision !== undefined && options.dirty !== undefined
      ? {
          repositoryRevision: options.repositoryRevision,
          dirty: options.dirty,
        }
      : repositoryIdentity(repoRoot);

  const streams = readdirSync(reviewsDirectory)
    .filter((name) => name.endsWith(".reviews.md"))
    .sort()
    .map((name) => {
      const slug = name.replace(/\.reviews\.md$/, "");
      const absolutePath = path.join(reviewsDirectory, name);
      const relativePath = path.relative(repoRoot, absolutePath);
      return analyzeReviewRetentionStream({
        slug,
        relativePath,
        source: readFileSync(absolutePath, "utf8"),
        owner: ownerForSlug(chain, repoRoot, slug),
      });
    });

  const candidates = RETENTION_CANDIDATES.map((keepGenerations) => {
    const scenarios = streams.map((stream) => {
      const scenario = stream.scenarios.find(
        (candidate) => candidate.keepGenerations === keepGenerations,
      );
      if (!scenario) {
        throw new Error(`${stream.path}: missing retention scenario N=${String(keepGenerations)}`);
      }
      return scenario;
    });
    return {
      keepGenerations,
      rawKeep: scenarios.reduce(
        (total, scenario) => total + scenario.rawKeepGenerationIds.length,
        0,
      ),
      authorityExceptions: scenarios.reduce(
        (total, scenario) => total + scenario.exceptionKeepGenerationIds.length,
        0,
      ),
      effectiveKeep: scenarios.reduce(
        (total, scenario) => total + scenario.effectiveKeepGenerationIds.length,
        0,
      ),
      wouldDispose: scenarios.reduce(
        (total, scenario) => total + scenario.wouldDisposeGenerationIds.length,
        0,
      ),
    };
  });

  return {
    schema: REVIEW_RETENTION_REPORT_SCHEMA,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    ...identity,
    policy: {
      approvedKeepGenerations: APPROVED_KEEP_GENERATIONS,
      candidateKeepGenerations: [...RETENTION_CANDIDATES],
      ordering: "date-desc-then-later-physical-entry",
      mutation: "disabled",
      gate: "disabled",
      foundationalExemptSlugs: [...FOUNDATIONAL_EXEMPT_SLUGS],
    },
    population: {
      directory: path.relative(repoRoot, reviewsDirectory),
      streamCount: streams.length,
      generationCount: streams.reduce((total, stream) => total + stream.generationCount, 0),
      lineCount: streams.reduce((total, stream) => total + stream.lineCount, 0),
      byteCount: streams.reduce((total, stream) => total + stream.byteCount, 0),
      orderingHazardStreamCount: streams.filter((stream) => stream.orderingHazard).length,
      foundationalExemptStreamCount: streams.filter(
        (stream) => stream.owner.kind === "foundational-exempt",
      ).length,
      unmappedStreamCount: streams.filter((stream) => stream.owner.kind === "unmapped").length,
      unresolvedGenerationCount: streams.reduce(
        (total, stream) => total + stream.unresolvedGenerationCount,
        0,
      ),
      currentUnresolvedGenerationCount: streams.reduce(
        (total, stream) => total + stream.currentUnresolvedGenerationCount,
        0,
      ),
    },
    cadence: buildCadence(streams),
    candidates,
    streams,
  };
}
