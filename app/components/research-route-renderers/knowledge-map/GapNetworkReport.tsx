"use client";

// @promise promise:gap-network-detection-from-search
// @promise promise:gap-overlay-decision-evidence
// @promise promise:gap-report-prepared-reaction
// @aspect aspect:user-facing-language-governance
// @aspect aspect:visible-explanation-sufficiency
// @aspect aspect:ai-generated-content-feedback
// @aspect aspect:research-route-visual-hierarchy
// @check intent-check:cluster-narrative-describes-research-work
// @check intent-check:hypothesis-proposals-have-depth
// @check acceptance-check:gap-network-detection-from-search-analysis-input-visible
// @check acceptance-check:gap-network-detection-from-search-cluster-size-encoding
// @check acceptance-check:gap-network-detection-from-search-cluster-detail-zoom-render

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GraphPaperSnapshot,
  GapNetworkClusterReaction,
  GapNetworkGapReaction,
  GapNetworkReport as GapNetworkReportData,
} from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";
import {
  buildGapNetworkClusterFocusViewBox,
  buildGapNetworkGapFocusViewBox,
  buildGapConcepts,
  buildGapNetworkConceptLabelLayouts,
  buildGapNetworkGapLabelLayouts,
  computeAutoFitViewBox,
  getCanvasMessage,
  isGapNetworkNoMeaningfulGapState,
  hasAnyExpectedGapPair,
  type GapConceptViewModel,
} from "./gap-network.report-helpers";
import { GapNetworkCanvasSection } from "./GapNetworkSections";
import {
  buildGapNetworkAnchoredPositions,
  buildGapNetworkClusterHulls,
  buildGapNetworkGapPath,
} from "./gap-network.presentation";
import type { ViewBox } from "./gap-network.report-helpers";
import {
  buildClusterReactionLookup,
  buildFocusedSelectionSummary,
  buildGapReactionLookup,
  type FocusedSelectionNarrativeStatus,
  type GapNetworkSeedSearchHandler,
  GapNetworkFocusedSelectionSummary,
} from "./GapNetworkFocusedSelectionSummary";

const GAP_NETWORK_VIEWBOX_ANIMATION_MS = 220;

function areViewBoxesEqual(left: ViewBox, right: ViewBox) {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

function interpolateViewBox(left: ViewBox, right: ViewBox, progress: number): ViewBox {
  const eased = 1 - (1 - progress) ** 3;
  return {
    x: left.x + (right.x - left.x) * eased,
    y: left.y + (right.y - left.y) * eased,
    width: left.width + (right.width - left.width) * eased,
    height: left.height + (right.height - left.height) * eased,
  };
}

interface GapNetworkReportProps {
  documentId?: string | null;
  query: string;
  report: GapNetworkReportData;
  papers?: GraphPaperSnapshot[];
  sourceCitationLineageBreakdown?: { references: number; citations: number };
  clusterReactions?: GapNetworkClusterReaction[];
  gapReactions?: GapNetworkGapReaction[];
  selectionNarrativeStatus?: FocusedSelectionNarrativeStatus;
  onBackgroundReset?: () => void;
  onClusterSelect?: (clusterId: string) => void;
  onGapSelect?: (gapPairId: string) => void;
  onUseSeedAsSearch?: GapNetworkSeedSearchHandler;
}

interface FocusableConcept {
  id: string;
  cluster: string;
}

interface ConceptEdgeReference {
  source: string;
  target: string;
}

interface SelectedConceptState {
  selectedConceptId: string;
  selectedClusterId: string;
  connectedConceptIds: Set<string>;
  connectedEdgeIds: Set<string>;
}

// @aspect aspect:user-facing-language-governance
// @aspect aspect:visible-explanation-sufficiency
function CitationLineageBreakdownLine({
  breakdown,
}: {
  breakdown: { references: number; citations: number };
}) {
  return (
    <p
      className="lh-type-reading-body lh-tone-secondary mt-2"
      data-testid="gap-network-citation-lineage-breakdown"
    >
      {t("gapNetwork.label.gap-network-report.sourceBreakdown.citationLineage", {
        references: breakdown.references,
        citations: breakdown.citations,
      })}
    </p>
  );
}

function GapNetworkInsufficientEdgeState({
  papers,
  report,
  sourceCitationLineageBreakdown,
}: {
  papers?: GraphPaperSnapshot[];
  report: GapNetworkReportData;
  sourceCitationLineageBreakdown?: { references: number; citations: number };
}) {
  const abstractPaperCount =
    papers?.filter((paper) => (paper.abstract ?? "").trim().length > 0).length ?? null;
  return (
    <section
      className="border-border bg-surface-panel/60 text-foreground rounded-md border px-5 py-6"
      data-testid="gap-network-insufficient-edge-state"
    >
      <p className="lh-type-section-heading lh-tone-primary">
        {t("gapNetwork.label.gap-network-report.insufficientEdges.title")}
      </p>
      <p className="lh-type-reading-body lh-tone-secondary mt-2">
        {t("gapNetwork.label.gap-network-report.insufficientEdges.body", {
          paperCount: report.metrics.totalPaperCount,
          edgeCount: report.metrics.totalEdgeCount,
        })}
      </p>
      {sourceCitationLineageBreakdown ? (
        <CitationLineageBreakdownLine breakdown={sourceCitationLineageBreakdown} />
      ) : null}
      {abstractPaperCount !== null ? (
        <p className="lh-type-reading-body lh-tone-secondary mt-2">
          {t("gapNetwork.label.gap-network-report.insufficientEdges.abstractCoverage", {
            abstractPaperCount,
            paperCount: report.metrics.totalPaperCount,
          })}
        </p>
      ) : null}
      <p className="lh-type-reading-body lh-tone-secondary mt-2">
        {t("gapNetwork.label.gap-network-report.insufficientEdges.next")}
      </p>
    </section>
  );
}

function GapNetworkNoMeaningfulGapState({
  report,
  sourceCitationLineageBreakdown,
}: {
  report: GapNetworkReportData;
  sourceCitationLineageBreakdown?: { references: number; citations: number };
}) {
  return (
    <section
      className="border-border bg-surface-panel/60 text-foreground rounded-md border px-5 py-6"
      data-testid="gap-network-no-meaningful-gap-state"
    >
      <p className="lh-type-section-heading lh-tone-primary">
        {t("gapNetwork.label.gap-network-report.noMeaningfulGap.title")}
      </p>
      <p className="lh-type-reading-body lh-tone-secondary mt-2">
        {t("gapNetwork.label.gap-network-report.noMeaningfulGap.body", {
          paperCount: report.metrics.totalPaperCount,
          edgeCount: report.metrics.totalEdgeCount,
        })}
      </p>
      {sourceCitationLineageBreakdown ? (
        <CitationLineageBreakdownLine breakdown={sourceCitationLineageBreakdown} />
      ) : null}
      <p className="lh-type-reading-body lh-tone-secondary mt-2">
        {t("gapNetwork.label.gap-network-report.noMeaningfulGap.next")}
      </p>
    </section>
  );
}

function buildActiveClusterIds(params: {
  hoveredClusterId: string | null;
  selectedClusterId: string | null;
}) {
  const ids = new Set<string>();
  if (params.hoveredClusterId) {
    ids.add(params.hoveredClusterId);
  }
  if (params.selectedClusterId) {
    ids.add(params.selectedClusterId);
  }
  return ids;
}

function buildFocusClusterIds(params: { focusedClusterId: string | null }) {
  return params.focusedClusterId ? new Set([params.focusedClusterId]) : new Set<string>();
}

function useGapNetworkLayout(report: GapNetworkReportData, concepts: GapConceptViewModel[]) {
  const positions = useMemo(
    () =>
      buildGapNetworkAnchoredPositions({
        concepts,
        clusters: report.clusters,
        conceptEdges: report.conceptEdges,
        gapPairs: report.gapPairs,
      }),
    [concepts, report.clusters, report.conceptEdges, report.gapPairs],
  );
  const hulls = useMemo(
    () => buildGapNetworkClusterHulls(report.clusters, positions),
    [positions, report.clusters],
  );
  const hullById = useMemo(() => new Map(hulls.map((hull) => [hull.id, hull] as const)), [hulls]);
  const visibleGapPairs = useMemo(() => report.gapPairs.slice(0, 5), [report.gapPairs]);
  const gapPathsById = useMemo(() => {
    const entries = visibleGapPairs.flatMap((gapPair) => {
      const leftHull = hullById.get(gapPair.leftClusterId);
      const rightHull = hullById.get(gapPair.rightClusterId);
      if (!leftHull || !rightHull) {
        return [];
      }
      return [
        [
          gapPair.id,
          buildGapNetworkGapPath({
            leftHull,
            rightHull,
            rank: gapPair.rank,
          }),
        ] as const,
      ];
    });
    return new Map(entries);
  }, [hullById, visibleGapPairs]);
  const conceptLabelLayouts = useMemo(
    () => buildGapNetworkConceptLabelLayouts({ concepts, positions }),
    [concepts, positions],
  );
  const gapLabelLayouts = useMemo(
    () =>
      buildGapNetworkGapLabelLayouts({
        gapPairs: visibleGapPairs,
        gapPaths: gapPathsById,
      }),
    [gapPathsById, visibleGapPairs],
  );
  const autoFitViewBox = useMemo(
    () => computeAutoFitViewBox({ positions, hulls, conceptLabelLayouts, gapLabelLayouts }),
    [conceptLabelLayouts, gapLabelLayouts, hulls, positions],
  );
  const clusterFocusViewBoxById = useMemo(
    () =>
      new Map(
        report.clusters.map((cluster) => [
          cluster.id,
          buildGapNetworkClusterFocusViewBox({
            clusterId: cluster.id,
            concepts,
            positions,
            hullById,
            conceptLabelLayouts,
            initialViewBox: autoFitViewBox,
          }),
        ]),
      ),
    [autoFitViewBox, conceptLabelLayouts, concepts, hullById, positions, report.clusters],
  );
  const gapFocusViewBoxById = useMemo(
    () =>
      new Map(
        visibleGapPairs.map((gapPair) => [
          gapPair.id,
          buildGapNetworkGapFocusViewBox({
            gapPair,
            concepts,
            positions,
            hullById,
            conceptLabelLayouts,
            gapLabelLayouts,
            initialViewBox: autoFitViewBox,
          }),
        ]),
      ),
    [
      autoFitViewBox,
      conceptLabelLayouts,
      concepts,
      gapLabelLayouts,
      hullById,
      positions,
      visibleGapPairs,
    ],
  );
  return {
    positions,
    hulls,
    hullById,
    visibleGapPairs,
    gapPathsById,
    conceptLabelLayouts,
    gapLabelLayouts,
    autoFitViewBox,
    clusterFocusViewBoxById,
    gapFocusViewBoxById,
  };
}

function buildSelectedConceptState(params: {
  selectedConceptId: string | null;
  canSelectConceptNodes: boolean;
  conceptById: Map<string, FocusableConcept>;
  focusClusterIds: Set<string>;
  conceptEdges: ConceptEdgeReference[];
}): SelectedConceptState | null {
  if (!params.selectedConceptId || !params.canSelectConceptNodes) {
    return null;
  }

  const selectedConcept = params.conceptById.get(params.selectedConceptId);
  if (!selectedConcept || !params.focusClusterIds.has(selectedConcept.cluster)) {
    return null;
  }

  const connectedConceptIds = new Set<string>([selectedConcept.id]);
  const connectedEdgeIds = new Set<string>();
  params.conceptEdges.forEach((edge) => {
    if (edge.source !== selectedConcept.id && edge.target !== selectedConcept.id) {
      return;
    }
    connectedConceptIds.add(edge.source);
    connectedConceptIds.add(edge.target);
    connectedEdgeIds.add(`${edge.source}::${edge.target}`);
  });

  return {
    selectedConceptId: selectedConcept.id,
    selectedClusterId: selectedConcept.cluster,
    connectedConceptIds,
    connectedEdgeIds,
  };
}

export function GapNetworkReport({
  documentId = null,
  query,
  report,
  papers,
  sourceCitationLineageBreakdown,
  clusterReactions = [],
  gapReactions = [],
  selectionNarrativeStatus = "ready",
  onBackgroundReset,
  onClusterSelect,
  onGapSelect,
  onUseSeedAsSearch,
}: GapNetworkReportProps) {
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [focusedClusterId, setFocusedClusterId] = useState<string | null>(null);
  const [focusedGapPairId, setFocusedGapPairId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clusterById = useMemo(
    () => new Map(report.clusters.map((cluster) => [cluster.id, cluster] as const)),
    [report.clusters],
  );
  const clusterReactionById = useMemo(
    () => buildClusterReactionLookup(clusterReactions),
    [clusterReactions],
  );
  const gapReactionById = useMemo(() => buildGapReactionLookup(gapReactions), [gapReactions]);
  const hypothesisByGapPairId = useMemo(
    () =>
      new Map(report.insight.hypotheses.map((hypothesis) => [hypothesis.gapPairId, hypothesis])),
    [report.insight.hypotheses],
  );
  const concepts = useMemo(() => buildGapConcepts(report), [report]);
  const conceptById = useMemo(
    () => new Map(concepts.map((concept) => [concept.id, concept] as const)),
    [concepts],
  );
  const {
    positions,
    hulls,
    hullById,
    visibleGapPairs,
    gapPathsById,
    conceptLabelLayouts,
    gapLabelLayouts,
    autoFitViewBox,
    clusterFocusViewBoxById,
    gapFocusViewBoxById,
  } = useGapNetworkLayout(report, concepts);
  const targetViewBox = useMemo(() => {
    if (focusedClusterId) {
      return clusterFocusViewBoxById.get(focusedClusterId) ?? autoFitViewBox;
    }
    if (focusedGapPairId) {
      return gapFocusViewBoxById.get(focusedGapPairId) ?? autoFitViewBox;
    }
    return autoFitViewBox;
  }, [
    autoFitViewBox,
    clusterFocusViewBoxById,
    focusedClusterId,
    focusedGapPairId,
    gapFocusViewBoxById,
  ]);
  const focusClusterIds = useMemo(
    () =>
      buildFocusClusterIds({
        focusedClusterId,
      }),
    [focusedClusterId],
  );
  const canSelectConceptNodes = focusClusterIds.size > 0;
  const selectedConceptState = useMemo(
    () =>
      buildSelectedConceptState({
        selectedConceptId,
        canSelectConceptNodes,
        conceptById,
        focusClusterIds,
        conceptEdges: report.conceptEdges,
      }),
    [canSelectConceptNodes, conceptById, focusClusterIds, report.conceptEdges, selectedConceptId],
  );
  const [viewBox, setViewBox] = useState(targetViewBox);
  const viewBoxRef = useRef(targetViewBox);
  useEffect(() => {
    viewBoxRef.current = viewBox;
  }, [viewBox]);
  useEffect(() => {
    if (areViewBoxesEqual(viewBoxRef.current, targetViewBox)) {
      return;
    }
    const from = viewBoxRef.current;
    let timeoutId = 0;
    let startTime = 0;
    const step = () => {
      const timestamp = performance.now();
      if (startTime === 0) {
        startTime = timestamp;
      }
      const progress = Math.min((timestamp - startTime) / GAP_NETWORK_VIEWBOX_ANIMATION_MS, 1);
      const nextViewBox = interpolateViewBox(from, targetViewBox, progress);
      viewBoxRef.current = nextViewBox;
      setViewBox(nextViewBox);
      if (progress < 1) {
        timeoutId = window.setTimeout(step, 16);
      }
    };
    timeoutId = window.setTimeout(step, 16);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [targetViewBox]);
  const focusedCluster = focusedClusterId ? (clusterById.get(focusedClusterId) ?? null) : null;
  const focusedGapPair = focusedGapPairId
    ? (visibleGapPairs.find((gapPair) => gapPair.id === focusedGapPairId) ?? null)
    : null;
  const focusedSelectionSummary = useMemo(
    () =>
      buildFocusedSelectionSummary({
        clusterReactionById,
        focusedCluster,
        focusedGapPair,
        gapReactionById,
        hypothesisByGapPairId,
        narrativeStatus: selectionNarrativeStatus,
        selectedConceptId,
        papers,
      }),
    [
      clusterReactionById,
      focusedCluster,
      focusedGapPair,
      gapReactionById,
      hypothesisByGapPairId,
      selectedConceptId,
      selectionNarrativeStatus,
      papers,
    ],
  );
  const activeClusterIds = useMemo(
    () =>
      buildActiveClusterIds({
        hoveredClusterId,
        selectedClusterId,
      }),
    [hoveredClusterId, selectedClusterId],
  );

  const hasRenderableNetwork = report.clusters.length >= 2 && report.metrics.totalEdgeCount > 0;
  const hasAnyMeaningfulExpectedGapPair = useMemo(() => hasAnyExpectedGapPair(report), [report]);
  const canvasMessage = getCanvasMessage({
    hasRenderableNetwork,
    report,
    hasAnyMeaningfulExpectedGapPair,
  });
  if (report.metrics.totalEdgeCount <= 0) {
    return (
      <GapNetworkInsufficientEdgeState
        papers={papers}
        report={report}
        sourceCitationLineageBreakdown={sourceCitationLineageBreakdown}
      />
    );
  }

  if (
    isGapNetworkNoMeaningfulGapState({
      hasRenderableNetwork,
      report,
      hasAnyMeaningfulExpectedGapPair,
    })
  ) {
    return (
      <GapNetworkNoMeaningfulGapState
        report={report}
        sourceCitationLineageBreakdown={sourceCitationLineageBreakdown}
      />
    );
  }

  return (
    <section className="space-y-5">
      <p
        className="lh-type-reading-body lh-tone-secondary"
        data-testid="gap-network-analysis-input-summary"
      >
        {t("gapNetwork.label.gap-network-report.analysisInput.summary", {
          paperCount: report.metrics.totalPaperCount,
          clusterCount: report.clusters.length,
        })}
      </p>
      <div
        className="flex flex-col gap-4 lg:flex-row lg:items-start"
        data-testid="gap-network-graph-and-panel"
      >
        <div className="min-w-0 flex-1">
          <GapNetworkCanvasSection
            query={query}
            reportConceptEdges={report.conceptEdges}
            concepts={concepts}
            positions={positions}
            hulls={hulls}
            hullById={hullById}
            clusterById={clusterById}
            visibleGapPairs={visibleGapPairs}
            gapPathsById={gapPathsById}
            conceptLabelLayouts={conceptLabelLayouts}
            gapLabelLayouts={gapLabelLayouts}
            activeClusterIds={activeClusterIds}
            canvasMessage={canvasMessage}
            svgRef={svgRef}
            viewBox={viewBox}
            activeGapPairId={focusedGapPairId}
            onBackgroundActivate={() => {
              setSelectedConceptId(null);
              setHoveredClusterId(null);
              setSelectedClusterId(null);
              setFocusedClusterId(null);
              setFocusedGapPairId(null);
              onBackgroundReset?.();
            }}
            onClusterActivate={(clusterId) => {
              setSelectedConceptId(null);
              setHoveredClusterId(clusterId);
              setSelectedClusterId(clusterId);
              setFocusedClusterId(clusterId);
              setFocusedGapPairId(null);
              onClusterSelect?.(clusterId);
            }}
            onGapPairActivate={(gapPairId) => {
              setSelectedConceptId(null);
              setHoveredClusterId(null);
              setSelectedClusterId(null);
              setFocusedClusterId(null);
              setFocusedGapPairId(gapPairId);
              onGapSelect?.(gapPairId);
            }}
            canSelectConceptNodes={canSelectConceptNodes}
            selectedConceptId={selectedConceptState?.selectedConceptId ?? null}
            selectedConceptClusterId={selectedConceptState?.selectedClusterId ?? null}
            connectedConceptIds={selectedConceptState?.connectedConceptIds ?? new Set<string>()}
            connectedEdgeIds={selectedConceptState?.connectedEdgeIds ?? new Set<string>()}
            onConceptActivate={(conceptId) => {
              if (!canSelectConceptNodes) {
                return;
              }
              const concept = conceptById.get(conceptId);
              if (!concept || !focusClusterIds.has(concept.cluster)) {
                return;
              }
              setSelectedConceptId((current) => (current === conceptId ? null : conceptId));
            }}
            setHoveredClusterId={setHoveredClusterId}
          />
        </div>
        {focusedSelectionSummary ? (
          <aside className="w-full lg:w-96 lg:flex-shrink-0" data-testid="gap-network-side-panel">
            <GapNetworkFocusedSelectionSummary
              summary={focusedSelectionSummary}
              documentId={documentId}
              onUseSeedAsSearch={onUseSeedAsSearch}
            />
          </aside>
        ) : null}
      </div>
    </section>
  );
}
