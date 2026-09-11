import type { ReviewEntry } from "./review-parser";

/**
 * Review files are append/prepend tolerant. Currentness is date-first, then
 * physical position for same-day entries. File order must never decide which
 * verdict is current.
 */
export function latestReviewEntry(
  entries: readonly ReviewEntry[],
  predicate: (entry: ReviewEntry) => boolean = () => true,
): ReviewEntry | undefined {
  return entries
    .map((entry, physicalIndex) => ({ entry, physicalIndex }))
    .filter(({ entry }) => predicate(entry))
    .sort((left, right) => {
      const dateDifference = right.entry.date.localeCompare(left.entry.date);
      return dateDifference !== 0 ? dateDifference : right.physicalIndex - left.physicalIndex;
    })[0]?.entry;
}
