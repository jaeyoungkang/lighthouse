import type {
  GapHypothesis,
  GapPair,
  GapNetworkReport as GapNetworkReportData,
} from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";
import { round } from "./gap-network.presentation.utils";

export interface GapConceptViewModel {
  id: string;
  label: string;
  cluster: string;
  score: number;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GapNetworkPanelEmptyState = "none" | "no-gap" | "no-hypothesis";

const MAX_GAP_NETWORK_VIEWBOX_ASPECT = 1.95;
const MIN_GAP_NETWORK_VIEWBOX_ASPECT = 1.1;
const MAX_GAP_NETWORK_LABEL_WORDS = 4;
const MAX_GAP_NETWORK_LABEL_CHARS = 24;
const MAX_GAP_NETWORK_CLUSTER_LABEL_WORDS = 4;
const MAX_GAP_NETWORK_CLUSTER_LABEL_CHARS = 28;
const MAX_GAP_NETWORK_GAP_SIDE_LABEL_WORDS = 3;
const MAX_GAP_NETWORK_GAP_SIDE_LABEL_CHARS = 18;
const MIN_GAP_NETWORK_CONCEPT_LABEL_Y_GAP = 11;
const GAP_NETWORK_GAP_LABEL_TIERS = [0, 28, -28, 54, -54];
const GAP_NETWORK_VIEWBOX_PADDING_X = 44;
const GAP_NETWORK_VIEWBOX_PADDING_TOP = 18;
const GAP_NETWORK_VIEWBOX_PADDING_BOTTOM = 74;
const GAP_NETWORK_VIEWBOX_PADDING_Y = 40;
const GAP_NETWORK_CLUSTER_FOCUS_WIDTH_SCALE = 0.5;
const GAP_NETWORK_CLUSTER_FOCUS_HEIGHT_SCALE = 0.52;
const GAP_NETWORK_CLUSTER_FOCUS_MIN_WIDTH_RATIO = 0.46;
const GAP_NETWORK_CLUSTER_FOCUS_MIN_HEIGHT_RATIO = 0.34;
const GAP_NETWORK_CLUSTER_FOCUS_MAX_WIDTH_RATIO = 0.62;
const GAP_NETWORK_CLUSTER_FOCUS_MAX_HEIGHT_RATIO = 0.48;

export interface GapNetworkConceptLabelLayout {
  x: number;
  y: number;
  text: string;
  textAnchor: "start" | "end";
}

export interface GapNetworkGapLabelLayout {
  x: number;
  y: number;
  text: string;
  width: number;
}

export function buildGapConcepts(report: GapNetworkReportData): GapConceptViewModel[] {
  return report.clusters.flatMap((cluster) =>
    cluster.concepts.map((concept) => ({
      id: concept.id,
      label: concept.label,
      cluster: cluster.id,
      score: concept.score,
    })),
  );
}

export function hasAnyExpectedGapPair(report: GapNetworkReportData): boolean {
  const totalPaperCount = Math.max(report.metrics.totalPaperCount, 1);
  if (report.metrics.totalEdgeCount <= 0 || report.clusters.length < 2) {
    return false;
  }

  return report.clusters.some((leftCluster, leftIndex) =>
    report.clusters.slice(leftIndex + 1).some((rightCluster) => {
      const expected =
        2 *
        report.metrics.totalEdgeCount *
        (leftCluster.paperCount / totalPaperCount) *
        (rightCluster.paperCount / totalPaperCount);
      return expected >= 1;
    }),
  );
}

export function getCanvasMessage(params: {
  hasRenderableNetwork: boolean;
  report: GapNetworkReportData;
  hasAnyMeaningfulExpectedGapPair: boolean;
}) {
  if (!params.hasRenderableNetwork) {
    return params.report.clusters.length < 2
      ? t("gapNetwork.error.gap-network-report-helpers")
      : t("gapNetwork.label.gap-network-report-helpers");
  }

  return null;
}

export function isGapNetworkNoMeaningfulGapState(params: {
  hasRenderableNetwork: boolean;
  report: GapNetworkReportData;
  hasAnyMeaningfulExpectedGapPair: boolean;
}) {
  return (
    params.hasRenderableNetwork &&
    params.report.gapPairs.length === 0 &&
    !params.hasAnyMeaningfulExpectedGapPair
  );
}

export function getPanelEmptyState(report: GapNetworkReportData): GapNetworkPanelEmptyState {
  if (report.gapPairs.length === 0) {
    return "no-gap";
  }
  if (report.insight.hypotheses.length === 0) {
    return "no-hypothesis";
  }
  return "none";
}

export function buildFeaturedHypothesis(params: {
  hypotheses: GapHypothesis[];
  activeGapPairId: string | null;
  visibleGapPairIds: Set<string>;
}) {
  const visibleHypotheses = params.hypotheses.filter((hypothesis) =>
    params.visibleGapPairIds.has(hypothesis.gapPairId),
  );
  const pool = visibleHypotheses.length > 0 ? visibleHypotheses : params.hypotheses;
  if (pool.length === 0) {
    return null;
  }
  if (!params.activeGapPairId) {
    return pool[0];
  }
  return pool.find((hypothesis) => hypothesis.gapPairId === params.activeGapPairId) ?? pool[0];
}

export function estimateGapNetworkLabelWidth(label: string, minWidth = 0) {
  return Math.max(minWidth, label.length * 6.1 + 24);
}

export function computeAutoFitViewBox(params: {
  positions: Map<string, { x: number; y: number; labelSide: "left" | "right" }>;
  hulls: Array<{
    leftX: number;
    rightX: number;
    topY: number;
    bottomY: number;
    labelY: number;
  }>;
  conceptLabelLayouts: Map<string, GapNetworkConceptLabelLayout>;
  gapLabelLayouts: Map<string, GapNetworkGapLabelLayout>;
}): ViewBox {
  if (
    params.positions.size === 0 &&
    params.hulls.length === 0 &&
    params.conceptLabelLayouts.size === 0 &&
    params.gapLabelLayouts.size === 0
  ) {
    return { x: -420, y: -320, width: 840, height: 640 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  params.positions.forEach((position) => {
    minX = Math.min(minX, position.x - (position.labelSide === "left" ? 118 : 18));
    maxX = Math.max(maxX, position.x + (position.labelSide === "right" ? 118 : 18));
    minY = Math.min(minY, position.y - 28);
    maxY = Math.max(maxY, position.y + 28);
  });

  params.hulls.forEach((hull) => {
    minX = Math.min(minX, hull.leftX);
    maxX = Math.max(maxX, hull.rightX);
    minY = Math.min(minY, hull.topY);
    maxY = Math.max(maxY, hull.bottomY, hull.labelY + 28);
  });

  params.conceptLabelLayouts.forEach((layout) => {
    const labelWidth = estimateGapNetworkLabelWidth(layout.text);
    minX = Math.min(minX, layout.textAnchor === "end" ? layout.x - labelWidth : layout.x - 4);
    maxX = Math.max(maxX, layout.textAnchor === "start" ? layout.x + labelWidth : layout.x + 4);
    minY = Math.min(minY, layout.y - 12);
    maxY = Math.max(maxY, layout.y + 8);
  });

  params.gapLabelLayouts.forEach((layout) => {
    minX = Math.min(minX, layout.x - layout.width / 2);
    maxX = Math.max(maxX, layout.x + layout.width / 2);
    minY = Math.min(minY, layout.y - 16);
    maxY = Math.max(maxY, layout.y + 16);
  });

  const rawX = minX - GAP_NETWORK_VIEWBOX_PADDING_X;
  const rawY = minY - GAP_NETWORK_VIEWBOX_PADDING_TOP;
  const rawWidth = maxX - minX + GAP_NETWORK_VIEWBOX_PADDING_X * 2;
  const rawHeight =
    maxY - minY + GAP_NETWORK_VIEWBOX_PADDING_TOP + GAP_NETWORK_VIEWBOX_PADDING_BOTTOM;
  const aspect = rawWidth / Math.max(rawHeight, 1);

  if (aspect > MAX_GAP_NETWORK_VIEWBOX_ASPECT) {
    const targetHeight = rawWidth / MAX_GAP_NETWORK_VIEWBOX_ASPECT;
    const extraY = (targetHeight - rawHeight) / 2;
    return {
      x: rawX,
      y: rawY - extraY + GAP_NETWORK_VIEWBOX_PADDING_Y * 0.35,
      width: rawWidth,
      height: targetHeight,
    };
  }

  if (aspect < MIN_GAP_NETWORK_VIEWBOX_ASPECT) {
    const targetWidth = rawHeight * MIN_GAP_NETWORK_VIEWBOX_ASPECT;
    const extraX = (targetWidth - rawWidth) / 2;
    return {
      x: rawX - extraX,
      y: rawY + GAP_NETWORK_VIEWBOX_PADDING_Y * 0.35,
      width: targetWidth,
      height: rawHeight,
    };
  }

  return {
    x: rawX,
    y: rawY + GAP_NETWORK_VIEWBOX_PADDING_Y * 0.35,
    width: rawWidth,
    height: rawHeight,
  };
}

export function truncateGapNetworkConceptLabel(label: string) {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return normalized;
  }

  const words = normalized.split(" ");
  const compactWords = words.slice(0, MAX_GAP_NETWORK_LABEL_WORDS).join(" ");
  const compactBase = words.length > MAX_GAP_NETWORK_LABEL_WORDS ? compactWords : normalized;
  if (compactBase.length <= MAX_GAP_NETWORK_LABEL_CHARS) {
    return compactBase;
  }

  return `${compactBase.slice(0, MAX_GAP_NETWORK_LABEL_CHARS).trimEnd()}…`;
}

export function truncateGapNetworkClusterLabel(label: string) {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return normalized;
  }

  const base =
    normalized.length > MAX_GAP_NETWORK_CLUSTER_LABEL_CHARS && normalized.includes("&")
      ? normalized.split("&")[0]?.trim() || normalized
      : normalized;
  const words = base.split(" ");
  const compactWords = words.slice(0, MAX_GAP_NETWORK_CLUSTER_LABEL_WORDS).join(" ");
  const compactBase = words.length > MAX_GAP_NETWORK_CLUSTER_LABEL_WORDS ? compactWords : base;
  if (compactBase.length <= MAX_GAP_NETWORK_CLUSTER_LABEL_CHARS) {
    return compactBase;
  }

  return `${compactBase.slice(0, MAX_GAP_NETWORK_CLUSTER_LABEL_CHARS).trimEnd()}…`;
}

function truncateGapNetworkGapSideLabel(label: string) {
  const compactClusterLabel = truncateGapNetworkClusterLabel(label);
  const words = compactClusterLabel.split(" ");
  const compactWords = words.slice(0, MAX_GAP_NETWORK_GAP_SIDE_LABEL_WORDS).join(" ");
  const compactBase =
    words.length > MAX_GAP_NETWORK_GAP_SIDE_LABEL_WORDS ? compactWords : compactClusterLabel;
  if (compactBase.length <= MAX_GAP_NETWORK_GAP_SIDE_LABEL_CHARS) {
    return compactBase;
  }

  return `${compactBase.slice(0, MAX_GAP_NETWORK_GAP_SIDE_LABEL_CHARS).trimEnd()}…`;
}

export function buildCompactGapNetworkGapLabel(gapPair: GapPair) {
  return `${truncateGapNetworkGapSideLabel(gapPair.leftLabel)} ↔ ${truncateGapNetworkGapSideLabel(gapPair.rightLabel)}`;
}

export function buildGapNetworkConceptLabelLayouts(params: {
  concepts: GapConceptViewModel[];
  positions: Map<string, { x: number; y: number; labelSide: "left" | "right" }>;
}) {
  const groupedLabels = new Map<
    string,
    Array<{
      conceptId: string;
      baseX: number;
      baseY: number;
      text: string;
      side: "left" | "right";
      score: number;
    }>
  >();

  params.concepts.forEach((concept) => {
    const position = params.positions.get(concept.id);
    if (!position) {
      return;
    }

    const text = truncateGapNetworkConceptLabel(concept.label);
    const key = `${concept.cluster}:${position.labelSide}`;
    const bucket = groupedLabels.get(key) ?? [];
    bucket.push({
      conceptId: concept.id,
      baseX: position.x + (position.labelSide === "right" ? 14 : -14),
      baseY: position.y + 4,
      text,
      side: position.labelSide,
      score: concept.score,
    });
    groupedLabels.set(key, bucket);
  });

  const layouts = new Map<string, GapNetworkConceptLabelLayout>();

  groupedLabels.forEach((bucket) => {
    bucket
      .slice()
      .sort((left, right) => {
        if (left.baseY !== right.baseY) {
          return left.baseY - right.baseY;
        }
        return right.score - left.score;
      })
      .forEach((entry, index, entries) => {
        const previous = index > 0 ? entries[index - 1] : null;
        const previousLayout = previous ? layouts.get(previous.conceptId) : null;
        const minY = previousLayout
          ? previousLayout.y + MIN_GAP_NETWORK_CONCEPT_LABEL_Y_GAP
          : entry.baseY;
        const y = Math.max(entry.baseY, minY);
        const overflowSteps = Math.min(
          2,
          Math.max(0, Math.round((y - entry.baseY) / MIN_GAP_NETWORK_CONCEPT_LABEL_Y_GAP)),
        );
        const x =
          entry.side === "right"
            ? entry.baseX + overflowSteps * 4
            : entry.baseX - overflowSteps * 4;

        layouts.set(entry.conceptId, {
          x,
          y,
          text: entry.text,
          textAnchor: entry.side === "right" ? "start" : "end",
        });
      });
  });

  return layouts;
}

export function buildGapNetworkGapLabelLayouts(params: {
  gapPairs: GapPair[];
  gapPaths: Map<string, { labelX: number; labelY: number }>;
}) {
  const layouts = new Map<string, GapNetworkGapLabelLayout>();
  const placedBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];

  params.gapPairs
    .map((gapPair) => {
      const gapPath = params.gapPaths.get(gapPair.id);
      if (!gapPath) {
        return null;
      }

      const text = buildCompactGapNetworkGapLabel(gapPair);
      const width = estimateGapNetworkLabelWidth(text, 112);
      return {
        gapPairId: gapPair.id,
        baseX: gapPath.labelX,
        baseY: gapPath.labelY,
        text,
        width,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.baseX - right.baseX)
    .forEach((entry) => {
      const initialTier = GAP_NETWORK_GAP_LABEL_TIERS[0] ?? 0;
      let bestPlacement = {
        x: entry.baseX,
        y: entry.baseY + initialTier,
        width: entry.width,
        overlapCount: Number.POSITIVE_INFINITY,
      };

      GAP_NETWORK_GAP_LABEL_TIERS.forEach((tierOffset) => {
        const y = entry.baseY + tierOffset;
        const box = {
          left: entry.baseX - entry.width / 2,
          right: entry.baseX + entry.width / 2,
          top: y - 13,
          bottom: y + 13,
        };
        const overlapCount = placedBoxes.filter(
          (placedBox) =>
            box.left < placedBox.right + 10 &&
            box.right > placedBox.left - 10 &&
            box.top < placedBox.bottom + 8 &&
            box.bottom > placedBox.top - 8,
        ).length;

        if (overlapCount < bestPlacement.overlapCount) {
          bestPlacement = {
            x: entry.baseX,
            y,
            width: entry.width,
            overlapCount,
          };
        }
      });

      placedBoxes.push({
        left: bestPlacement.x - bestPlacement.width / 2,
        right: bestPlacement.x + bestPlacement.width / 2,
        top: bestPlacement.y - 13,
        bottom: bestPlacement.y + 13,
      });
      layouts.set(entry.gapPairId, {
        x: bestPlacement.x,
        y: bestPlacement.y,
        text: entry.text,
        width: bestPlacement.width,
      });
    });

  return layouts;
}

export function buildGapNetworkClusterFocusViewBox(params: {
  clusterId: string;
  concepts: GapConceptViewModel[];
  positions: Map<string, { x: number; y: number; labelSide: "left" | "right" }>;
  hullById: Map<
    string,
    {
      leftX: number;
      rightX: number;
      topY: number;
      bottomY: number;
      labelY: number;
    }
  >;
  conceptLabelLayouts: Map<string, GapNetworkConceptLabelLayout>;
  initialViewBox: ViewBox;
}) {
  const hull = params.hullById.get(params.clusterId);
  if (!hull) {
    return params.initialViewBox;
  }

  const clusterConcepts = params.concepts.filter((concept) => concept.cluster === params.clusterId);
  const clusterPositions = new Map(
    clusterConcepts.flatMap((concept) => {
      const position = params.positions.get(concept.id);
      return position ? ([[concept.id, position]] as const) : [];
    }),
  );
  const clusterLabelLayouts = new Map(
    clusterConcepts.flatMap((concept) => {
      const layout = params.conceptLabelLayouts.get(concept.id);
      return layout ? ([[concept.id, layout]] as const) : [];
    }),
  );

  const focusViewBox = computeAutoFitViewBox({
    positions: clusterPositions,
    hulls: [hull],
    conceptLabelLayouts: clusterLabelLayouts,
    gapLabelLayouts: new Map(),
  });
  const centerX = focusViewBox.x + focusViewBox.width / 2;
  const centerY = focusViewBox.y + focusViewBox.height / 2;
  const maxFocusedWidth = params.initialViewBox.width * GAP_NETWORK_CLUSTER_FOCUS_MAX_WIDTH_RATIO;
  const maxFocusedHeight =
    params.initialViewBox.height * GAP_NETWORK_CLUSTER_FOCUS_MAX_HEIGHT_RATIO;
  const width = Math.min(
    maxFocusedWidth,
    Math.max(
      focusViewBox.width * GAP_NETWORK_CLUSTER_FOCUS_WIDTH_SCALE,
      params.initialViewBox.width * GAP_NETWORK_CLUSTER_FOCUS_MIN_WIDTH_RATIO,
    ),
  );
  const height = Math.min(
    maxFocusedHeight,
    Math.max(
      focusViewBox.height * GAP_NETWORK_CLUSTER_FOCUS_HEIGHT_SCALE,
      params.initialViewBox.height * GAP_NETWORK_CLUSTER_FOCUS_MIN_HEIGHT_RATIO,
    ),
  );
  return {
    x: round(centerX - width / 2, 2),
    y: round(centerY - height / 2, 2),
    width: round(width, 2),
    height: round(height, 2),
  };
}

export function buildGapNetworkGapFocusViewBox(params: {
  gapPair: GapPair;
  concepts: GapConceptViewModel[];
  positions: Map<string, { x: number; y: number; labelSide: "left" | "right" }>;
  hullById: Map<
    string,
    {
      leftX: number;
      rightX: number;
      topY: number;
      bottomY: number;
      labelY: number;
    }
  >;
  conceptLabelLayouts: Map<string, GapNetworkConceptLabelLayout>;
  gapLabelLayouts: Map<string, GapNetworkGapLabelLayout>;
  initialViewBox: ViewBox;
}) {
  const leftHull = params.hullById.get(params.gapPair.leftClusterId);
  const rightHull = params.hullById.get(params.gapPair.rightClusterId);
  if (!leftHull || !rightHull) {
    return params.initialViewBox;
  }

  const clusterIds = new Set([params.gapPair.leftClusterId, params.gapPair.rightClusterId]);
  const gapConcepts = params.concepts.filter((concept) => clusterIds.has(concept.cluster));
  const gapPositions = new Map(
    gapConcepts.flatMap((concept) => {
      const position = params.positions.get(concept.id);
      return position ? ([[concept.id, position]] as const) : [];
    }),
  );
  const gapConceptLabelLayouts = new Map(
    gapConcepts.flatMap((concept) => {
      const layout = params.conceptLabelLayouts.get(concept.id);
      return layout ? ([[concept.id, layout]] as const) : [];
    }),
  );
  const gapLabelLayout = params.gapLabelLayouts.get(params.gapPair.id);
  const focusViewBox = computeAutoFitViewBox({
    positions: gapPositions,
    hulls: [leftHull, rightHull],
    conceptLabelLayouts: gapConceptLabelLayouts,
    gapLabelLayouts: gapLabelLayout
      ? new Map<string, GapNetworkGapLabelLayout>([[params.gapPair.id, gapLabelLayout]])
      : new Map<string, GapNetworkGapLabelLayout>(),
  });
  const centerX = focusViewBox.x + focusViewBox.width / 2;
  const centerY = focusViewBox.y + focusViewBox.height / 2;
  const maxFocusedWidth = params.initialViewBox.width * 0.48;
  const maxFocusedHeight = params.initialViewBox.height * 0.48;
  const width = Math.min(
    maxFocusedWidth,
    Math.max(focusViewBox.width * 0.5, params.initialViewBox.width * 0.38),
  );
  const height = Math.min(
    maxFocusedHeight,
    Math.max(focusViewBox.height * 0.52, params.initialViewBox.height * 0.34),
  );

  return {
    x: round(centerX - width / 2, 2),
    y: round(centerY - height / 2, 2),
    width: round(width, 2),
    height: round(height, 2),
  };
}

export function buildCurrentGapSummary(gapPair: GapPair | null) {
  if (!gapPair) {
    return t("gapNetwork.label.gap-network-report-helpers.2");
  }

  const bridge =
    gapPair.bridgeConcepts.length > 0
      ? gapPair.bridgeConcepts.join(", ")
      : t("gapNetwork.label.gap-network-report-helpers.3");
  return t("gapNetwork.label.gap-network-report-helpers.4", {
    displayLabel: gapPair.displayLabel,
    leftLabel: gapPair.leftLabel,
    rightLabel: gapPair.rightLabel,
    param: bridge,
  });
}

export function buildResearcherTakeaway(
  featuredHypothesis: GapHypothesis | null,
  gapPair: GapPair | null,
) {
  if (featuredHypothesis && gapPair) {
    return t("gapNetwork.label.gap-network-report-helpers.5", {
      displayLabel: gapPair.displayLabel,
      thesis: featuredHypothesis.sourceConcept,
      thesis2: featuredHypothesis.targetConcept,
    });
  }

  if (gapPair) {
    return t("gapNetwork.label.gap-network-report-helpers.6", {
      displayLabel: gapPair.displayLabel,
    });
  }

  return t("gapNetwork.label.gap-network-report-helpers.7");
}

export function buildGapCardDescription(gapPair: GapPair) {
  const left = gapPair.leftConcepts.slice(0, 2).join(", ");
  const right = gapPair.rightConcepts.slice(0, 2).join(", ");
  return `${left || gapPair.leftLabel} ↔ ${right || gapPair.rightLabel}`;
}
