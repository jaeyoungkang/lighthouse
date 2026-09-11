// revision-drift.ts — pure detection helper for
// `promise:alignment-coherence-gate#acceptance-check:alignment-coherence-gate-revision-drift-soft`.
//
// Given a Promise's Acceptance Checks (with `revision`) and the latest yaml-
// schema Sufficiency Review entries (with `acReviewedRevision[]`), returns
// the per-AC drift signals: ACs whose currently-declared revision is greater
// than the most recent review's recorded revision.
//
// Stage drop and admin-board rendering are wired by the snapshot consumer.
// This file owns the detection contract only.

import { traceabilityNodePrefix, type AcceptanceCheck } from "@/app/domain/story-chain";
import type { ReviewEntry } from "./review-parser";

const ACCEPTANCE_CHECK_PREFIX = traceabilityNodePrefix("acceptance-check");

export interface RevisionDriftSignal {
  acId: string;
  reviewedRevision: number;
  currentRevision: number;
  reviewDate: string;
}

export function detectRevisionDrift(
  acceptanceChecks: ReadonlyArray<AcceptanceCheck>,
  reviewEntries: ReadonlyArray<ReviewEntry>,
): RevisionDriftSignal[] {
  const acRevisionById = new Map<string, number>();
  for (const ac of acceptanceChecks) {
    if (typeof ac.revision === "number") acRevisionById.set(ac.id, ac.revision);
  }
  // Prefer most recent review entry per AC. Sort entries by date desc; on
  // same-day ties, the entry that appears later in the file wins (it is the
  // most recent same-day update).
  const indexed = reviewEntries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !entry.grandfathered && entry.yaml !== null);
  const sorted = indexed
    .sort((a, b) => {
      const dateDiff = b.entry.date.localeCompare(a.entry.date);
      if (dateDiff !== 0) return dateDiff;
      return b.index - a.index;
    })
    .map(({ entry }) => entry);
  const seen = new Set<string>();
  const signals: RevisionDriftSignal[] = [];
  for (const entry of sorted) {
    if (!entry.yaml) continue;
    // acReviewedRevision is a parallel array to the *acceptance-check* refs
    // only (intent-check refs do not carry a revision). Filter first, then
    // index — otherwise a yaml.acs list that interleaves intent-check and
    // acceptance-check entries would misalign with acReviewedRevision[i].
    const acceptanceRefs = entry.yaml.acs.filter((ref) => ref.startsWith(ACCEPTANCE_CHECK_PREFIX));
    for (let i = 0; i < acceptanceRefs.length; i += 1) {
      const acId = acceptanceRefs[i];
      if (seen.has(acId)) continue;
      seen.add(acId);
      const reviewedRevision = entry.yaml.acReviewedRevision[i];
      const currentRevision = acRevisionById.get(acId);
      if (
        typeof currentRevision === "number" &&
        typeof reviewedRevision === "number" &&
        reviewedRevision < currentRevision
      ) {
        signals.push({
          acId,
          reviewedRevision,
          currentRevision,
          reviewDate: entry.date,
        });
      }
    }
  }
  return signals;
}

// Stage decision: Promise verdict is `verify` (not `met`) when at least one
// drift signal exists, regardless of the underlying review verdict. The drop
// is soft — admin board renders the stale flag, but PR gates do not block.
export function hasRevisionDrift(signals: ReadonlyArray<RevisionDriftSignal>): boolean {
  return signals.length > 0;
}
