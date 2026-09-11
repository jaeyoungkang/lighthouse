/**
 * Library-grounded research — interest projection (pure, no I/O).
 *
 * Projects a reader's precomputed library neighborhood onto a search result
 * pool. The result pool stays stored in provider order; this only computes the
 * per-paper interest weight that the client-side `interest` view sort reads.
 * Matching is direct: `paper.paperId` IS the Episteme corpus_id (the graph
 * primitive `lookupGraphNeighborsForPaper` uses `seedPaper.paperId` as the
 * corpusId), so it lines up with the neighborhood map's keys.
 *
 * @aspect aspect:library-grounded-research
 * @promise promise:search-results-fast-window
 */
import type { LibraryContext } from "./library-context-source";

export interface LibraryInterestRanking {
  /** paperId → interest weight, for result papers that overlap the neighborhood. */
  interestWeights: Record<string, number>;
  /** How many result papers sit in the reader's library neighborhood. */
  matchedCount: number;
  /** Collections that anchored the neighborhood, for visible basis + grounding. */
  folders: { name: string }[];
}

/**
 * Computes the interest weight projection for a result pool. Papers not in the
 * neighborhood are simply absent from `interestWeights` (the client treats a
 * missing weight as 0, so they sort below matched papers while keeping their
 * provider order among themselves). When nothing overlaps, `matchedCount` is 0
 * and the caller degrades to ordinary provider-relevance search.
 */
export function rankByLibraryInterest(
  papers: readonly { paperId: string }[],
  libraryContext: Pick<LibraryContext, "neighborhood" | "folders">,
): LibraryInterestRanking {
  const interestWeights: Record<string, number> = {};
  for (const paper of papers) {
    const weight = libraryContext.neighborhood[paper.paperId];
    if (typeof weight === "number" && weight > 0) {
      interestWeights[paper.paperId] = weight;
    }
  }
  return {
    interestWeights,
    matchedCount: Object.keys(interestWeights).length,
    folders: libraryContext.folders.map((folder) => ({ name: folder.name })),
  };
}
