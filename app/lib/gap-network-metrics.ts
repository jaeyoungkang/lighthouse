import type { GapPair } from "@/app/domain/research-route-payload";

function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits));
}

interface GapInvolvementClusterLike {
  id: string;
}

export function getClusterGapInvolvement(params: {
  cluster: GapInvolvementClusterLike;
  gapPairs: GapPair[];
}): number {
  const involvement = params.gapPairs.reduce((total, gapPair) => {
    if (
      gapPair.leftClusterId === params.cluster.id ||
      gapPair.rightClusterId === params.cluster.id
    ) {
      return total + gapPair.gapScore;
    }
    return total;
  }, 0);

  return round(involvement, 3);
}

interface GapNetworkClusterSortable {
  id: string;
  paperCount: number;
}

export function compareGapNetworkClustersByGapInvolvement(
  left: GapNetworkClusterSortable,
  right: GapNetworkClusterSortable,
  gapPairs: GapPair[],
): number {
  const rightInvolvement = getClusterGapInvolvement({ cluster: right, gapPairs });
  const leftInvolvement = getClusterGapInvolvement({ cluster: left, gapPairs });
  if (rightInvolvement !== leftInvolvement) {
    return rightInvolvement - leftInvolvement;
  }
  if (right.paperCount !== left.paperCount) {
    return right.paperCount - left.paperCount;
  }
  return left.id.localeCompare(right.id);
}
