import type { GapPair } from "@/app/domain/research-route-payload";
import { compareGapNetworkClustersByGapInvolvement } from "@/app/lib/gap-network-metrics";
import { applyForceDirectedConceptLayout } from "./gap-network.force-layout";
import {
  buildSoftHullPath,
  getBezierPoint,
  getConvexHull,
  round,
} from "./gap-network.presentation.utils";

export type GapNetworkPanelMode = "stack" | "floating";
export type GapNetworkAnchorSlot =
  | "center"
  | "left"
  | "right"
  | "top-left"
  | "top-mid-left"
  | "top-center"
  | "top-mid-right"
  | "top-right"
  | "top-band"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center";

interface GapNetworkClusterLike {
  id: string;
  label: string;
  color: string;
  paperCount: number;
  concepts: Array<{ id: string; score: number }>;
}

interface GapNetworkConceptLike {
  id: string;
  cluster: string;
  score: number;
}

interface GapNetworkConceptEdgeLike {
  source: string;
  target: string;
  clusterId: string;
  weight: number;
}

export interface PositionedGapNetworkConcept {
  id: string;
  x: number;
  y: number;
  angle: number;
  anchorSlot: GapNetworkAnchorSlot;
  labelSide: "left" | "right";
}

export interface GapNetworkClusterHull {
  id: string;
  label: string;
  color: string;
  cx: number;
  cy: number;
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
  labelY: number;
  anchorSlot: GapNetworkAnchorSlot;
  pathD: string;
}

export interface GapNetworkGapPath {
  d: string;
  markers: Array<{ x: number; y: number; ringRadius: number }>;
  labelX: number;
  labelY: number;
}

interface GapNetworkAnchorPoint {
  x: number;
  y: number;
}

export interface GapNetworkClusterAnchor {
  slot: GapNetworkAnchorSlot;
  point: GapNetworkAnchorPoint;
  angleOffset: number;
}

const GAP_NETWORK_ANCHOR_POSITIONS: Partial<Record<GapNetworkAnchorSlot, GapNetworkAnchorPoint>> = {
  center: { x: 0, y: 0 },
  left: { x: -356, y: -22 },
  right: { x: 356, y: -22 },
  "top-left": { x: -388, y: -182 },
  "top-mid-left": { x: -212, y: -252 },
  "top-center": { x: 0, y: -284 },
  "top-mid-right": { x: 212, y: -252 },
  "top-right": { x: 388, y: -182 },
  "bottom-left": { x: -242, y: 194 },
  "bottom-right": { x: 242, y: 194 },
  "bottom-center": { x: 0, y: 186 },
};
const MIN_GAP_NETWORK_CLUSTER_BUFFER = 148;
const MIN_GAP_NETWORK_VERTICAL_CORRIDOR = 164;
const GAP_NETWORK_TOP_BAND_MIN_HALF_SPAN = 416;
const GAP_NETWORK_TOP_BAND_MAX_HALF_SPAN = 640;
const GAP_NETWORK_TOP_BAND_STEP = 126;
const GAP_NETWORK_TOP_BAND_PEAK_Y = -294;
const GAP_NETWORK_TOP_BAND_EDGE_DROP = 112;
const GAP_NETWORK_CLUSTER_HULL_PADDING = 34;
const GAP_NETWORK_CLUSTER_MIN_RADIUS_X = 56;
const GAP_NETWORK_CLUSTER_MIN_RADIUS_Y = 44;
const GAP_NETWORK_CLUSTER_PAPER_SCALE_MIN = 0.9;
const GAP_NETWORK_CLUSTER_PAPER_SCALE_MAX = 1.24;
const GAP_NETWORK_TRIANGLE_SLOT_ORDER = [
  "top-center",
  "bottom-right",
  "bottom-left",
] as const satisfies readonly GapNetworkAnchorSlot[];
const GAP_NETWORK_TRIANGLE_ANCHOR_POINTS: ReadonlyArray<
  readonly [GapNetworkAnchorSlot, GapNetworkAnchorPoint]
> = [
  ["top-center", { x: 0, y: -316 }],
  ["bottom-right", { x: 304, y: 184 }],
  ["bottom-left", { x: -304, y: 184 }],
];
const GAP_NETWORK_DIAMOND_SLOT_ORDER = [
  "top-center",
  "right",
  "bottom-center",
  "left",
] as const satisfies readonly GapNetworkAnchorSlot[];
const GAP_NETWORK_DIAMOND_ANCHOR_POINTS: ReadonlyArray<
  readonly [GapNetworkAnchorSlot, GapNetworkAnchorPoint]
> = [
  ["top-center", { x: 0, y: -320 }],
  ["right", { x: 338, y: -12 }],
  ["bottom-center", { x: 0, y: 220 }],
  ["left", { x: -338, y: -12 }],
];
const GAP_NETWORK_PENTAGON_SLOT_ORDER = [
  "top-center",
  "top-right",
  "bottom-right",
  "bottom-left",
  "top-left",
] as const satisfies readonly GapNetworkAnchorSlot[];
const GAP_NETWORK_PENTAGON_ANCHOR_POINTS: ReadonlyArray<
  readonly [GapNetworkAnchorSlot, GapNetworkAnchorPoint]
> = [
  ["top-center", { x: 0, y: -324 }],
  ["top-right", { x: 346, y: -148 }],
  ["bottom-right", { x: 222, y: 210 }],
  ["bottom-left", { x: -222, y: 210 }],
  ["top-left", { x: -346, y: -148 }],
];

function getTopRowSlots(count: number): GapNetworkAnchorSlot[] {
  switch (count) {
    case 1:
      return ["top-center"];
    case 2:
      return ["top-left", "top-right"];
    case 3:
      return ["top-left", "top-center", "top-right"];
    default:
      return ["top-left", "top-mid-left", "top-mid-right", "top-right"];
  }
}

function getAnchorPoint(slot: GapNetworkAnchorSlot): GapNetworkAnchorPoint {
  const center = GAP_NETWORK_ANCHOR_POSITIONS.center ?? { x: 0, y: 0 };
  return GAP_NETWORK_ANCHOR_POSITIONS[slot] ?? center;
}

function getDefaultClusterAnchor(slot: GapNetworkAnchorSlot): GapNetworkClusterAnchor {
  return {
    slot,
    point: getAnchorPoint(slot),
    angleOffset: getSlotAngleOffset(slot),
  };
}

function compareGapNetworkClustersByPriority(
  left: GapNetworkClusterLike,
  right: GapNetworkClusterLike,
  gapPairs: GapPair[],
) {
  return compareGapNetworkClustersByGapInvolvement(left, right, gapPairs);
}

function getGapNetworkPolygonAnchors(params: {
  clusters: GapNetworkClusterLike[];
  gapPairs: GapPair[];
  slotOrder: readonly GapNetworkAnchorSlot[];
  anchorPoints: ReadonlyArray<readonly [GapNetworkAnchorSlot, GapNetworkAnchorPoint]>;
}): Map<string, GapNetworkClusterAnchor> {
  const orderedClusters = params.clusters
    .slice()
    .sort((left, right) => compareGapNetworkClustersByPriority(left, right, params.gapPairs));
  const anchorPointBySlot = new Map(params.anchorPoints);

  return new Map(
    orderedClusters.map((cluster, index) => {
      const slot = params.slotOrder[index] ?? "center";
      const point = anchorPointBySlot.get(slot) ?? getAnchorPoint(slot);
      return [
        cluster.id,
        {
          slot,
          point,
          angleOffset: getSlotAngleOffset(slot),
        },
      ] as const;
    }),
  );
}

function shiftClusterMembers(params: {
  clusterIds: string[];
  positions: Map<string, PositionedGapNetworkConcept>;
  conceptsByCluster: Map<string, GapNetworkConceptLike[]>;
  dx: number;
  dy: number;
}) {
  if (params.dx === 0 && params.dy === 0) {
    return;
  }

  params.clusterIds.forEach((clusterId) => {
    const members = params.conceptsByCluster.get(clusterId) ?? [];
    members.forEach((concept) => {
      const position = params.positions.get(concept.id);
      if (!position) {
        return;
      }

      params.positions.set(concept.id, {
        ...position,
        x: round(position.x + params.dx, 2),
        y: round(position.y + params.dy, 2),
      });
    });
  });
}

function buildHullMap(
  clusters: GapNetworkClusterLike[],
  positions: Map<string, PositionedGapNetworkConcept>,
) {
  return new Map(
    buildGapNetworkClusterHulls(clusters, positions).map((hull) => [hull.id, hull] as const),
  );
}

function applyHorizontalClusterSpacing(params: {
  clusters: GapNetworkClusterLike[];
  anchorSlots: Map<string, GapNetworkAnchorSlot>;
  positions: Map<string, PositionedGapNetworkConcept>;
  conceptsByCluster: Map<string, GapNetworkConceptLike[]>;
}) {
  const orderedTopClusters = params.clusters
    .filter((cluster) => {
      const slot = params.anchorSlots.get(cluster.id) ?? "center";
      return slot !== "bottom-center" && slot !== "center";
    })
    .slice();

  if (orderedTopClusters.length < 2) {
    return;
  }

  let hullMap = buildHullMap(params.clusters, params.positions);
  orderedTopClusters.sort((left, right) => {
    const leftHull = hullMap.get(left.id);
    const rightHull = hullMap.get(right.id);
    return (leftHull?.leftX ?? 0) - (rightHull?.leftX ?? 0);
  });

  for (let index = 1; index < orderedTopClusters.length; index += 1) {
    const previous = hullMap.get(orderedTopClusters[index - 1]?.id ?? "");
    const current = hullMap.get(orderedTopClusters[index]?.id ?? "");

    if (!previous || !current) {
      continue;
    }

    const gap = current.leftX - previous.rightX;
    if (gap >= MIN_GAP_NETWORK_CLUSTER_BUFFER) {
      continue;
    }

    shiftClusterMembers({
      clusterIds: orderedTopClusters.slice(index).map((cluster) => cluster.id),
      positions: params.positions,
      conceptsByCluster: params.conceptsByCluster,
      dx: MIN_GAP_NETWORK_CLUSTER_BUFFER - gap,
      dy: 0,
    });
    hullMap = buildHullMap(params.clusters, params.positions);
  }

  const leftMost = hullMap.get(orderedTopClusters[0]?.id ?? "");
  const rightMost = hullMap.get(orderedTopClusters[orderedTopClusters.length - 1]?.id ?? "");
  if (!leftMost || !rightMost) {
    return;
  }

  const bandCenter = (leftMost.leftX + rightMost.rightX) / 2;
  shiftClusterMembers({
    clusterIds: orderedTopClusters.map((cluster) => cluster.id),
    positions: params.positions,
    conceptsByCluster: params.conceptsByCluster,
    dx: -bandCenter,
    dy: 0,
  });
}

function applyVerticalClusterSpacing(params: {
  clusters: GapNetworkClusterLike[];
  anchorSlots: Map<string, GapNetworkAnchorSlot>;
  positions: Map<string, PositionedGapNetworkConcept>;
  conceptsByCluster: Map<string, GapNetworkConceptLike[]>;
}) {
  const bottomCluster = params.clusters.find(
    (cluster) => (params.anchorSlots.get(cluster.id) ?? "center") === "bottom-center",
  );
  if (!bottomCluster) {
    return;
  }

  const topClusterIds = params.clusters
    .filter((cluster) => cluster.id !== bottomCluster.id)
    .map((cluster) => cluster.id);
  if (topClusterIds.length === 0) {
    return;
  }

  const hullMap = buildHullMap(params.clusters, params.positions);
  const bottomHull = hullMap.get(bottomCluster.id);
  if (!bottomHull) {
    return;
  }

  const topBandBottom = Math.max(
    ...topClusterIds.map(
      (clusterId) => hullMap.get(clusterId)?.bottomY ?? Number.NEGATIVE_INFINITY,
    ),
  );
  const corridor = bottomHull.topY - topBandBottom;
  if (corridor >= MIN_GAP_NETWORK_VERTICAL_CORRIDOR) {
    return;
  }

  shiftClusterMembers({
    clusterIds: [bottomCluster.id],
    positions: params.positions,
    conceptsByCluster: params.conceptsByCluster,
    dx: 0,
    dy: MIN_GAP_NETWORK_VERTICAL_CORRIDOR - corridor,
  });
}

function getSlotAngleOffset(slot: GapNetworkAnchorSlot): number {
  switch (slot) {
    case "top-left":
      return Math.PI * 0.92;
    case "top-mid-left":
      return Math.PI * 1.08;
    case "top-center":
      return -Math.PI / 2;
    case "top-mid-right":
      return -Math.PI * 0.08;
    case "top-right":
      return Math.PI * 0.12;
    case "top-band":
      return -Math.PI / 2;
    case "bottom-left":
      return Math.PI * 0.64;
    case "bottom-right":
      return Math.PI * 0.36;
    case "bottom-center":
      return Math.PI / 2;
    case "left":
      return Math.PI;
    case "right":
      return 0;
    default:
      return -Math.PI / 2;
  }
}

export function getGapNetworkHypothesisPanelMode(viewportWidth: number): GapNetworkPanelMode {
  return viewportWidth < 768 ? "stack" : "floating";
}

export function getGapNetworkHullStyle(isActive: boolean) {
  return {
    strokeDasharray: "6,4",
    strokeOpacity: isActive ? 0.78 : 0.5,
    strokeWidth: isActive ? 2.4 : 1.7,
    glowOpacity: isActive ? 0.22 : 0.12,
    glowWidth: isActive ? 13 : 9,
    labelPlacement: "bottom-label" as const,
  };
}

export function getGapNetworkGapStyle(isActive: boolean) {
  return {
    stroke: isActive ? "var(--gap-stroke)" : "var(--gap-stroke-idle)",
    strokeOpacity: isActive ? 0.96 : 0.8,
    strokeWidth: isActive ? 3 : 2.2,
    strokeDasharray: "8,6",
    markerRadius: isActive ? 19 : 16,
    glowOpacity: isActive ? 0.3 : 0.16,
    glowWidth: isActive ? 11 : 8,
    flowRadius: isActive ? 4.4 : 3.4,
  };
}

function getGapNetworkClusterPaperScale(params: {
  paperCount: number;
  minPaperCount: number;
  maxPaperCount: number;
}): number {
  if (params.maxPaperCount <= params.minPaperCount) {
    return 1;
  }

  const minSqrt = Math.sqrt(Math.max(params.minPaperCount, 1));
  const maxSqrt = Math.sqrt(Math.max(params.maxPaperCount, 1));
  const paperSqrt = Math.sqrt(Math.max(params.paperCount, 1));
  const normalized = (paperSqrt - minSqrt) / (maxSqrt - minSqrt);
  return round(
    GAP_NETWORK_CLUSTER_PAPER_SCALE_MIN +
      Math.max(0, Math.min(1, normalized)) *
        (GAP_NETWORK_CLUSTER_PAPER_SCALE_MAX - GAP_NETWORK_CLUSTER_PAPER_SCALE_MIN),
    4,
  );
}

export function buildGapNetworkAnchorSlots(
  clusters: GapNetworkClusterLike[],
  gapPairs: GapPair[],
): Map<string, GapNetworkAnchorSlot> {
  return new Map(
    [...buildGapNetworkClusterAnchors(clusters, gapPairs).entries()].map(([clusterId, anchor]) => [
      clusterId,
      anchor.slot,
    ]),
  );
}

// @check acceptance-check:gap-network-detection-from-search-layout-permutation-invariance
export function buildGapNetworkClusterAnchors(
  clusters: GapNetworkClusterLike[],
  gapPairs: GapPair[],
): Map<string, GapNetworkClusterAnchor> {
  if (clusters.length === 0) {
    return new Map();
  }

  if (clusters.length === 1) {
    const [onlyCluster] = clusters;
    return new Map([[onlyCluster.id, getDefaultClusterAnchor("center")]]);
  }

  if (clusters.length === 2) {
    return new Map(
      clusters
        .slice()
        .sort((left, right) => {
          const labelOrder = left.label.localeCompare(right.label);
          return labelOrder !== 0 ? labelOrder : left.id.localeCompare(right.id);
        })
        .map(
          (cluster, index) =>
            [cluster.id, getDefaultClusterAnchor(index === 0 ? "left" : "right")] as const,
        ),
    );
  }

  if (clusters.length === 3) {
    return getGapNetworkPolygonAnchors({
      clusters,
      gapPairs,
      slotOrder: GAP_NETWORK_TRIANGLE_SLOT_ORDER,
      anchorPoints: GAP_NETWORK_TRIANGLE_ANCHOR_POINTS,
    });
  }

  if (clusters.length === 4) {
    return getGapNetworkPolygonAnchors({
      clusters,
      gapPairs,
      slotOrder: GAP_NETWORK_DIAMOND_SLOT_ORDER,
      anchorPoints: GAP_NETWORK_DIAMOND_ANCHOR_POINTS,
    });
  }

  if (clusters.length === 5) {
    return getGapNetworkPolygonAnchors({
      clusters,
      gapPairs,
      slotOrder: GAP_NETWORK_PENTAGON_SLOT_ORDER,
      anchorPoints: GAP_NETWORK_PENTAGON_ANCHOR_POINTS,
    });
  }

  const [bottomCluster] = clusters
    .slice()
    .sort((left, right) => compareGapNetworkClustersByPriority(left, right, gapPairs));
  const topClusters = clusters
    .filter((cluster) => cluster.id !== bottomCluster.id)
    .slice()
    .sort((left, right) => {
      if (right.paperCount !== left.paperCount) {
        return right.paperCount - left.paperCount;
      }
      return left.id.localeCompare(right.id);
    });

  const anchors = new Map<string, GapNetworkClusterAnchor>([
    [bottomCluster.id, getDefaultClusterAnchor("bottom-center")],
  ]);

  if (topClusters.length <= 4) {
    const topSlots = getTopRowSlots(topClusters.length);
    topClusters.forEach((cluster, index) => {
      anchors.set(cluster.id, getDefaultClusterAnchor(topSlots[index] ?? "top-center"));
    });
    return anchors;
  }

  const topHalfSpan = Math.min(
    GAP_NETWORK_TOP_BAND_MAX_HALF_SPAN,
    Math.max(
      GAP_NETWORK_TOP_BAND_MIN_HALF_SPAN,
      GAP_NETWORK_TOP_BAND_STEP * (topClusters.length - 1),
    ),
  );

  topClusters.forEach((cluster, index) => {
    const progress = topClusters.length === 1 ? 0.5 : index / (topClusters.length - 1);
    const normalizedX = progress * 2 - 1;
    const absX = Math.abs(normalizedX);
    const x = round(normalizedX * topHalfSpan, 2);
    const y = round(GAP_NETWORK_TOP_BAND_PEAK_Y + absX ** 1.35 * GAP_NETWORK_TOP_BAND_EDGE_DROP, 2);
    const angleOffset = round(-Math.PI / 2 + normalizedX * Math.PI * 0.52, 4);

    anchors.set(cluster.id, {
      slot: "top-band",
      point: { x, y },
      angleOffset,
    });
  });

  return anchors;
}

export function buildGapNetworkAnchoredPositions(params: {
  concepts: GapNetworkConceptLike[];
  clusters: GapNetworkClusterLike[];
  conceptEdges: GapNetworkConceptEdgeLike[];
  gapPairs: GapPair[];
}): Map<string, PositionedGapNetworkConcept> {
  const positions = new Map<string, PositionedGapNetworkConcept>();
  const conceptsByCluster = new Map<string, GapNetworkConceptLike[]>();
  const clusterAnchors = buildGapNetworkClusterAnchors(params.clusters, params.gapPairs);
  const anchorSlots = new Map(
    [...clusterAnchors.entries()].map(([clusterId, anchor]) => [clusterId, anchor.slot] as const),
  );
  const usesFixedPolygonLayout =
    params.clusters.length === 3 || params.clusters.length === 4 || params.clusters.length === 5;

  for (const concept of params.concepts) {
    const bucket = conceptsByCluster.get(concept.cluster) ?? [];
    bucket.push(concept);
    conceptsByCluster.set(concept.cluster, bucket);
  }

  params.clusters.forEach((cluster) => {
    const clusterAnchor = clusterAnchors.get(cluster.id) ?? getDefaultClusterAnchor("center");
    const slot = clusterAnchor.slot;
    const anchor = clusterAnchor.point;
    const members = (conceptsByCluster.get(cluster.id) ?? []).slice().sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.id.localeCompare(right.id);
    });

    members.forEach((concept, memberIndex) => {
      const ringSize = memberIndex < 1 ? 1 : Math.min(6 + Math.floor(memberIndex / 6) * 2, 10);
      const ringIndex = memberIndex === 0 ? 0 : Math.floor((memberIndex - 1) / ringSize) + 1;
      const slotIndex = memberIndex === 0 ? 0 : (memberIndex - 1) % ringSize;
      const localRadius = memberIndex === 0 ? 0 : 86 + (ringIndex - 1) * 50;
      const angle =
        memberIndex === 0
          ? clusterAnchor.angleOffset
          : clusterAnchor.angleOffset + (Math.PI * 2 * slotIndex) / ringSize;
      const isLowerSlot =
        slot === "bottom-center" || slot === "bottom-left" || slot === "bottom-right";
      const xScale = isLowerSlot ? 1.14 : slot === "top-center" ? 1.13 : 1.1;
      const yScale = isLowerSlot ? 0.9 : slot === "top-band" ? 0.88 : 0.86;
      const x = anchor.x + Math.cos(angle) * localRadius * xScale;
      const y = anchor.y + Math.sin(angle) * localRadius * yScale;
      const cosine = Math.cos(angle);
      const labelSide =
        Math.abs(cosine) < 0.18
          ? anchor.x >= 0
            ? "right"
            : "left"
          : cosine >= 0
            ? "right"
            : "left";

      positions.set(concept.id, {
        id: concept.id,
        x: round(x, 2),
        y: round(y, 2),
        angle,
        anchorSlot: slot,
        labelSide,
      });
    });
  });

  if (!usesFixedPolygonLayout) {
    applyHorizontalClusterSpacing({
      clusters: params.clusters,
      anchorSlots,
      positions,
      conceptsByCluster,
    });
    applyVerticalClusterSpacing({
      clusters: params.clusters,
      anchorSlots,
      positions,
      conceptsByCluster,
    });
  }

  return applyForceDirectedConceptLayout({
    positions,
    concepts: params.concepts,
    conceptEdges: params.conceptEdges,
  });
}

export function buildGapNetworkClusterHulls(
  clusters: GapNetworkClusterLike[],
  positions: Map<string, PositionedGapNetworkConcept>,
): GapNetworkClusterHull[] {
  const paperCounts = clusters.map((cluster) => cluster.paperCount);
  const minPaperCount = paperCounts.length > 0 ? Math.min(...paperCounts) : 0;
  const maxPaperCount = paperCounts.length > 0 ? Math.max(...paperCounts) : 0;

  return clusters.flatMap((cluster) => {
    const members = cluster.concepts
      .map((concept) => positions.get(concept.id))
      .filter((position): position is PositionedGapNetworkConcept => position !== undefined);

    if (members.length === 0) {
      return [];
    }

    const centroid = members.reduce(
      (acc, member) => ({ x: acc.x + member.x, y: acc.y + member.y }),
      { x: 0, y: 0 },
    );
    const cx = centroid.x / members.length;
    const cy = centroid.y / members.length;
    const paperScale = getGapNetworkClusterPaperScale({
      paperCount: cluster.paperCount,
      minPaperCount,
      maxPaperCount,
    });
    const padding = GAP_NETWORK_CLUSTER_HULL_PADDING * paperScale;
    const hullPoints = getConvexHull([
      ...members.map((member) => {
        const dx = member.x - cx;
        const dy = member.y - cy;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        return {
          x: member.x + (dx / distance) * padding,
          y: member.y + (dy / distance) * padding,
        };
      }),
      { x: cx - GAP_NETWORK_CLUSTER_MIN_RADIUS_X * paperScale, y: cy },
      { x: cx + GAP_NETWORK_CLUSTER_MIN_RADIUS_X * paperScale, y: cy },
      { x: cx, y: cy - GAP_NETWORK_CLUSTER_MIN_RADIUS_Y * paperScale },
      { x: cx, y: cy + GAP_NETWORK_CLUSTER_MIN_RADIUS_Y * paperScale },
    ]);

    const xs = hullPoints.map((point) => point.x);
    const ys = hullPoints.map((point) => point.y);
    return [
      {
        id: cluster.id,
        label: cluster.label,
        color: cluster.color,
        cx: round(cx, 2),
        cy: round(cy, 2),
        leftX: round(Math.min(...xs), 2),
        rightX: round(Math.max(...xs), 2),
        topY: round(Math.min(...ys), 2),
        bottomY: round(Math.max(...ys), 2),
        labelY: round(Math.max(...ys) + 22, 2),
        anchorSlot: members[0]?.anchorSlot ?? "center",
        pathD: buildSoftHullPath(hullPoints),
      },
    ];
  });
}

export function buildGapNetworkGapPath(params: {
  leftHull: GapNetworkClusterHull;
  rightHull: GapNetworkClusterHull;
  rank: number;
}): GapNetworkGapPath {
  const dx = params.rightHull.cx - params.leftHull.cx;
  const dy = params.rightHull.cy - params.leftHull.cy;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const unitX = dx / distance;
  const unitY = dy / distance;
  const normalX = -unitY;
  const normalY = unitX;
  const startInset = Math.max((params.leftHull.rightX - params.leftHull.leftX) / 4, 36);
  const endInset = Math.max((params.rightHull.rightX - params.rightHull.leftX) / 4, 36);
  const start = {
    x: params.leftHull.cx + unitX * startInset,
    y: params.leftHull.cy + unitY * startInset,
  };
  const end = {
    x: params.rightHull.cx - unitX * endInset,
    y: params.rightHull.cy - unitY * endInset,
  };
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const usesBottomAnchor =
    params.leftHull.anchorSlot === "bottom-center" ||
    params.leftHull.anchorSlot === "bottom-left" ||
    params.leftHull.anchorSlot === "bottom-right" ||
    params.rightHull.anchorSlot === "bottom-center" ||
    params.rightHull.anchorSlot === "bottom-left" ||
    params.rightHull.anchorSlot === "bottom-right";
  const control = {
    x: midpoint.x + normalX * (usesBottomAnchor ? 24 : 16),
    y: midpoint.y - (usesBottomAnchor ? 40 : 26) + normalY * (usesBottomAnchor ? 0 : -8),
  };
  const labelMarker = getBezierPoint({ start, control, end, t: 0.5 });
  const markers = [
    {
      ...labelMarker,
      ringRadius: 18,
    },
  ];

  return {
    d: `M ${String(round(start.x, 2))} ${String(round(start.y, 2))} Q ${String(round(control.x, 2))} ${String(round(control.y, 2))} ${String(round(end.x, 2))} ${String(round(end.y, 2))}`,
    markers,
    labelX: round(labelMarker.x, 2),
    labelY: round(labelMarker.y + 24 + Math.min(params.rank, 3) * 2, 2),
  };
}
