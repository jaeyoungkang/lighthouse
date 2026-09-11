// Per-Promise revision drift index for the snapshot.
//
// Closes the snapshot side of
// `promise:alignment-coherence-gate#acceptance-check:alignment-coherence-gate-revision-drift-soft`.
// `buildIntentTraceabilitySnapshot` consumes this map to (a) drop a row's
// `stage` to `verify` when signals exist and (b) surface
// `row.staleRevisions` so the admin board renders the stale flag.

import type { StoryChain } from "@/app/server/services/story-chain/loader";
import {
  detectRevisionDrift,
  type RevisionDriftSignal,
} from "@/app/server/services/story-chain/revision-drift";

export function buildRevisionDriftIndex(chain: StoryChain): Map<string, RevisionDriftSignal[]> {
  const index = new Map<string, RevisionDriftSignal[]>();
  for (const promise of chain.promises) {
    const acIds = new Set<string>(promise.acceptanceChecks.map((ac) => ac.id));
    if (acIds.size === 0) continue;
    const relevantEntries = chain.reviewEntries.filter(
      (entry) => entry.yaml !== null && entry.yaml.acs.some((ref) => acIds.has(ref)),
    );
    if (relevantEntries.length === 0) continue;
    const signals = detectRevisionDrift(promise.acceptanceChecks, relevantEntries);
    if (signals.length > 0) index.set(promise.id, signals);
  }
  return index;
}
