/** Selects every eligible paper from the prehydrated library-neighbor band. */
import { paperMatchesYearFilter } from "@/app/domain/search-year-range";
import { normalizeLookupTitle, type MappedPaper } from "./search-service";

export function selectNeighborhoodSupplements(params: {
  keywordPapers: readonly MappedPaper[];
  neighborhood: ReadonlyMap<string, number>;
  prehydratedCandidates: readonly MappedPaper[];
  year?: string;
}): { supplementPapers: MappedPaper[] } {
  if (params.neighborhood.size === 0) return { supplementPapers: [] };

  const keywordIds = new Set(params.keywordPapers.map((paper) => paper.paperId));
  const occupiedTitleFamilies = new Set(
    params.keywordPapers
      .map((paper) => normalizeLookupTitle(paper.title))
      .filter((title) => title.length > 0),
  );
  const admittedPaperIds = new Set<string>();
  const admittedTitleFamilies = new Set<string>();
  const candidates = params.prehydratedCandidates
    .filter((paper) => !keywordIds.has(paper.paperId))
    .filter((paper) => !params.year || paperMatchesYearFilter(paper.year, params.year))
    .sort(
      (left, right) =>
        (params.neighborhood.get(right.paperId) ?? 0) -
        (params.neighborhood.get(left.paperId) ?? 0),
    )
    .filter((paper) => {
      if (admittedPaperIds.has(paper.paperId)) return false;
      admittedPaperIds.add(paper.paperId);
      const titleFamily = normalizeLookupTitle(paper.title);
      if (!titleFamily) return true;
      if (occupiedTitleFamilies.has(titleFamily) || admittedTitleFamilies.has(titleFamily)) {
        return false;
      }
      admittedTitleFamilies.add(titleFamily);
      return true;
    });

  return {
    supplementPapers: candidates,
  };
}
