// Aspect verdict — read each `kind: aspect` declaration's latest Sufficiency
// Review entry from its covering ledger and classify (`met | not-met | unknown`).
//
// Mirror of how Intent verdict reads Intent Check Sufficiency Review verdicts:
// own verdict = α Coverage ∧ β Wovenness, materialized as a dated entry per
// Aspect inside the covering ledger's `### Sufficiency Review` block.

import path, { resolve } from "node:path";
import { loadStoryChain, type StoryChain } from "@/app/server/services/story-chain/loader";
import type { ReviewEntry } from "@/app/server/services/story-chain/review-parser";
import { latestReviewEntry } from "@/app/server/services/story-chain/review-entry-currentness";

export type AspectVerdict = "met" | "not-met" | "unknown";

export interface AspectVerdictRow {
  aspectRef: string;
  title: string;
  coveringLedger: string | null;
  /** absent if no covering ledger or no entry naming this Aspect exists */
  latestReviewDate?: string;
  /** undefined when there is no entry; "unknown" when entry has no Verdict line */
  latestReviewVerdict?: AspectVerdict;
  /** human-readable note on why the verdict is missing/blocked */
  status: AspectStatus;
}

export type AspectStatus =
  | "met"
  /** entry exists but verdict is not-met */
  | "not-met"
  /** entry exists but verdict line says unknown OR is absent */
  | "unknown"
  /** covering ledger missing OR no entry naming this Aspect */
  | "unverified";

export interface AspectVerdictReport {
  rows: AspectVerdictRow[];
  /** counts derived from rows, parallel to Intent summary fields */
  metCount: number;
  notMetCount: number;
  unknownCount: number;
  unverifiedCount: number;
}

export function buildAspectVerdictReport(repoRoot: string = process.cwd()): AspectVerdictReport {
  return buildAspectVerdictReportFromStoryChain(loadStoryChain(repoRoot), repoRoot);
}

export function buildAspectVerdictReportFromStoryChain(
  chain: StoryChain,
  repoRoot: string = process.cwd(),
): AspectVerdictReport {
  const rows: AspectVerdictRow[] = chain.aspects.map((aspect) => {
    const coveringLedger = aspect.coveringLedger;
    if (!coveringLedger) {
      return {
        aspectRef: aspect.id,
        title: aspect.title,
        coveringLedger: null,
        status: "unverified",
      };
    }
    const ledgerPath = path.normalize(resolve(repoRoot, coveringLedger));
    const ledger = chain.evidenceLedgers.find(
      (candidate) => path.normalize(candidate.path) === ledgerPath,
    );
    if (!ledger) {
      return {
        aspectRef: aspect.id,
        title: aspect.title,
        coveringLedger,
        status: "unverified",
      };
    }
    if (!ledger.reviewPath) {
      return {
        aspectRef: aspect.id,
        title: aspect.title,
        coveringLedger,
        status: "unverified",
      };
    }
    const reviewPath = path.normalize(path.join(path.dirname(ledger.path), ledger.reviewPath));
    const review = extractLatestAspectReview(
      chain.reviewEntries.filter(
        (entry) => entry.sourcePath && path.normalize(entry.sourcePath) === reviewPath,
      ),
      aspect.id,
    );
    if (!review) {
      return {
        aspectRef: aspect.id,
        title: aspect.title,
        coveringLedger,
        status: "unverified",
      };
    }
    const status: AspectStatus =
      review.verdict === "met" ? "met" : review.verdict === "not-met" ? "not-met" : "unknown";
    return {
      aspectRef: aspect.id,
      title: aspect.title,
      coveringLedger,
      latestReviewDate: review.date,
      latestReviewVerdict: review.verdict,
      status,
    };
  });

  return {
    rows,
    metCount: rows.filter((r) => r.status === "met").length,
    notMetCount: rows.filter((r) => r.status === "not-met").length,
    unknownCount: rows.filter((r) => r.status === "unknown").length,
    unverifiedCount: rows.filter((r) => r.status === "unverified").length,
  };
}

export function extractLatestAspectReview(
  entries: readonly ReviewEntry[],
  aspectRef: string,
): AspectReviewEntry | undefined {
  const entry = latestReviewEntry(entries, (entry) => {
    const yaml = entry.yaml;
    if (!yaml) return false;
    return [entry.headingLine, yaml.fixtureRef ?? "", yaml.observedOutput ?? "", ...yaml.gaps].some(
      (value) => value.includes(aspectRef),
    );
  });
  return entry
    ? {
        date: entry.date,
        verdict: (entry.yaml?.verdict ?? "unknown") as AspectVerdict,
      }
    : undefined;
}

export interface AspectReviewEntry {
  date?: string;
  verdict: AspectVerdict;
}
