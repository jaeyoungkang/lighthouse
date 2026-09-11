"use client";

import { startTransition } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  GapPair,
  GapNetworkCluster,
  GapNetworkConceptEdge,
} from "@/app/domain/research-route-payload";
import {
  buildCompactGapNetworkGapLabel,
  estimateGapNetworkLabelWidth,
  truncateGapNetworkClusterLabel,
  type GapConceptViewModel,
  type GapNetworkConceptLabelLayout,
  type GapNetworkGapLabelLayout,
  type ViewBox,
} from "./gap-network.report-helpers";
import { GapNetworkConceptNodesLayer } from "./GapNetworkConceptNodesLayer";
import {
  getGapNetworkGapStyle,
  getGapNetworkHullStyle,
  type GapNetworkClusterHull,
  type GapNetworkGapPath,
  type PositionedGapNetworkConcept,
} from "./gap-network.presentation";

function formatGapNetworkAnimationValues(values: number[]): string {
  return values.map((value) => String(Math.round(value * 100) / 100)).join(";");
}

interface GapNetworkCanvasSectionProps {
  query: string;
  reportConceptEdges: GapNetworkConceptEdge[];
  concepts: GapConceptViewModel[];
  positions: Map<string, PositionedGapNetworkConcept>;
  hulls: GapNetworkClusterHull[];
  hullById: Map<string, GapNetworkClusterHull>;
  clusterById: Map<string, GapNetworkCluster>;
  visibleGapPairs: GapPair[];
  gapPathsById: Map<string, GapNetworkGapPath>;
  conceptLabelLayouts: Map<string, GapNetworkConceptLabelLayout>;
  gapLabelLayouts: Map<string, GapNetworkGapLabelLayout>;
  activeClusterIds: Set<string>;
  canSelectConceptNodes: boolean;
  selectedConceptId: string | null;
  selectedConceptClusterId: string | null;
  connectedConceptIds: Set<string>;
  connectedEdgeIds: Set<string>;
  canvasMessage: string | null;
  svgRef: RefObject<SVGSVGElement | null>;
  viewBox: ViewBox;
  activeGapPairId: string | null;
  onBackgroundActivate: () => void;
  onClusterActivate: (clusterId: string) => void;
  onGapPairActivate: (gapPairId: string) => void;
  onConceptActivate: (conceptId: string) => void;
  setHoveredClusterId: Dispatch<SetStateAction<string | null>>;
}

interface GapNetworkConceptEdgesLayerProps {
  reportConceptEdges: GapNetworkConceptEdge[];
  positions: Map<string, PositionedGapNetworkConcept>;
  clusterById: Map<string, GapNetworkCluster>;
  activeClusterIds: Set<string>;
  hasSelectedConcept: boolean;
  connectedEdgeIds: Set<string>;
}

function GapNetworkConceptEdgesLayer({
  reportConceptEdges,
  positions,
  clusterById,
  activeClusterIds,
  hasSelectedConcept,
  connectedEdgeIds,
}: GapNetworkConceptEdgesLayerProps) {
  return (
    <>
      {reportConceptEdges.map((edge) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        const cluster = clusterById.get(edge.clusterId);
        if (!source || !target) {
          return null;
        }

        const clusterIsActive = activeClusterIds.size === 0 || activeClusterIds.has(edge.clusterId);
        const edgeId = `${edge.source}::${edge.target}`;
        const edgeIsConnected = connectedEdgeIds.has(edgeId);
        const edgeOpacity = hasSelectedConcept
          ? edgeIsConnected
            ? 0.44 + edge.weight * 0.28
            : clusterIsActive
              ? 0.05
              : 0.025
          : clusterIsActive
            ? 0.12 + edge.weight * 0.22
            : 0.06;
        const edgeWidth = hasSelectedConcept
          ? edgeIsConnected
            ? 1.7 + edge.weight * 2.1
            : 0.7 + edge.weight * 0.6
          : 0.9 + edge.weight * 1.4;

        return (
          <line
            key={`${edge.clusterId}-${edge.source}-${edge.target}`}
            data-concept-edge-id={edgeId}
            data-concept-edge-state={
              hasSelectedConcept ? (edgeIsConnected ? "connected" : "dimmed") : "idle"
            }
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke={cluster?.color ?? "var(--text-subtle)"}
            strokeOpacity={edgeOpacity}
            strokeWidth={edgeWidth}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          >
            {!hasSelectedConcept && clusterIsActive ? (
              <animate
                attributeName="stroke-opacity"
                values={formatGapNetworkAnimationValues([
                  edgeOpacity,
                  Math.min(edgeOpacity + 0.16, 0.72),
                  edgeOpacity,
                ])}
                dur="4.2s"
                repeatCount="indefinite"
              />
            ) : null}
          </line>
        );
      })}
    </>
  );
}

interface GapNetworkClusterHullsLayerProps {
  hulls: GapNetworkClusterHull[];
  activeClusterIds: Set<string>;
  hasSelectedConcept: boolean;
  selectedConceptClusterId: string | null;
  onClusterActivate: (clusterId: string) => void;
  setHoveredClusterId: Dispatch<SetStateAction<string | null>>;
}

function GapNetworkClusterHullsLayer({
  hulls,
  activeClusterIds,
  hasSelectedConcept,
  selectedConceptClusterId,
  onClusterActivate,
  setHoveredClusterId,
}: GapNetworkClusterHullsLayerProps) {
  return (
    <>
      {hulls.map((hull) => {
        const isHighlighted = activeClusterIds.size > 0 && activeClusterIds.has(hull.id);
        const isDimmed = activeClusterIds.size > 0 && !activeClusterIds.has(hull.id);
        const hullStyle = getGapNetworkHullStyle(isHighlighted);
        const hullOpacity = hasSelectedConcept
          ? selectedConceptClusterId === hull.id
            ? hullStyle.strokeOpacity
            : 0.14
          : isDimmed
            ? 0.18
            : hullStyle.strokeOpacity;
        const labelOpacity = hasSelectedConcept
          ? selectedConceptClusterId === hull.id
            ? 1
            : 0.2
          : isDimmed
            ? 0.38
            : 1;

        return (
          <g
            key={hull.id}
            data-gap-interactive="true"
            data-cluster-id={hull.id}
            onMouseEnter={() => {
              startTransition(() => {
                setHoveredClusterId(hull.id);
              });
            }}
            onMouseLeave={() => {
              startTransition(() => {
                setHoveredClusterId((current) => (current === hull.id ? null : current));
              });
            }}
            onClick={(event) => {
              event.stopPropagation();
              startTransition(() => {
                onClusterActivate(hull.id);
              });
            }}
          >
            <path
              d={hull.pathD}
              fill="transparent"
              stroke={hull.color}
              strokeWidth={hullStyle.glowWidth}
              strokeOpacity={
                hasSelectedConcept
                  ? selectedConceptClusterId === hull.id
                    ? hullStyle.glowOpacity
                    : 0.04
                  : isDimmed
                    ? 0.06
                    : hullStyle.glowOpacity
              }
              filter="url(#gap-network-soft-glow)"
              pointerEvents="none"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={hull.pathD}
              fill="transparent"
              stroke={hull.color}
              strokeWidth={hullStyle.strokeWidth}
              strokeOpacity={hullOpacity}
              strokeDasharray={hullStyle.strokeDasharray}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={hull.cx}
              y={hull.labelY}
              textAnchor="middle"
              className="text-lh-lg font-bold"
              fill={hull.color}
              opacity={labelOpacity}
            >
              {truncateGapNetworkClusterLabel(hull.label)}
            </text>
          </g>
        );
      })}
    </>
  );
}

interface GapNetworkGapPairsLayerProps {
  visibleGapPairs: GapPair[];
  hullById: Map<string, GapNetworkClusterHull>;
  gapPathsById: Map<string, GapNetworkGapPath>;
  gapLabelLayouts: Map<string, GapNetworkGapLabelLayout>;
  hasSelectedConcept: boolean;
  activeGapPairId: string | null;
  onGapPairActivate: (gapPairId: string) => void;
}

function GapNetworkGapPairsLayer({
  visibleGapPairs,
  hullById,
  gapPathsById,
  gapLabelLayouts,
  hasSelectedConcept,
  activeGapPairId,
  onGapPairActivate,
}: GapNetworkGapPairsLayerProps) {
  return (
    <>
      {visibleGapPairs.map((gapPair) => {
        const path = gapPathsById.get(gapPair.id);
        const labelLayout = gapLabelLayouts.get(gapPair.id);
        if (
          !hullById.get(gapPair.leftClusterId) ||
          !hullById.get(gapPair.rightClusterId) ||
          !path
        ) {
          return null;
        }

        const isActive = activeGapPairId === gapPair.id;
        const gapStyle = getGapNetworkGapStyle(isActive);
        const labelText = labelLayout?.text ?? buildCompactGapNetworkGapLabel(gapPair);
        const labelWidth = labelLayout?.width ?? estimateGapNetworkLabelWidth(labelText, 112);
        const labelX = labelLayout?.x ?? path.labelX;
        const labelY = labelLayout?.y ?? path.labelY;

        return (
          <g
            key={gapPair.id}
            data-gap-pair-id={gapPair.id}
            data-gap-interface-effects={isActive ? "active" : "enabled"}
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              startTransition(() => {
                onGapPairActivate(gapPair.id);
              });
            }}
          >
            <path
              d={path.d}
              fill="none"
              stroke={gapStyle.stroke}
              strokeOpacity={hasSelectedConcept ? 0.08 : 0.3}
              strokeWidth={gapStyle.strokeWidth}
              strokeDasharray={gapStyle.strokeDasharray}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {path.markers.map((marker, index) => (
              <circle
                key={`${gapPair.id}-marker-${String(index)}`}
                cx={marker.x}
                cy={marker.y}
                r={marker.ringRadius}
                fill="var(--gap-label-bg)"
                stroke={gapStyle.stroke}
                strokeOpacity={isActive ? 0.52 : hasSelectedConcept ? 0.14 : 0.34}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <rect
              x={labelX - labelWidth / 2}
              y={labelY - 13}
              width={labelWidth}
              height={22}
              rx={6}
              fill="var(--gap-label-bg)"
              stroke={gapStyle.stroke}
              strokeOpacity={isActive ? 0.5 : hasSelectedConcept ? 0.12 : 0.2}
              strokeWidth={1}
            />
            <text
              x={labelX}
              y={labelY + 1}
              textAnchor="middle"
              className="text-lh-xs font-semibold"
              fill="var(--accent)"
              opacity={isActive ? 1 : hasSelectedConcept ? 0.38 : 0.86}
            >
              {labelText}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function GapNetworkCanvasSection({
  query,
  reportConceptEdges,
  concepts,
  positions,
  hulls,
  hullById,
  clusterById,
  visibleGapPairs,
  gapPathsById,
  conceptLabelLayouts,
  gapLabelLayouts,
  activeClusterIds,
  canSelectConceptNodes,
  selectedConceptId,
  selectedConceptClusterId,
  connectedConceptIds,
  connectedEdgeIds,
  canvasMessage,
  svgRef,
  viewBox,
  activeGapPairId,
  onBackgroundActivate,
  onClusterActivate,
  onGapPairActivate,
  onConceptActivate,
  setHoveredClusterId,
}: GapNetworkCanvasSectionProps) {
  const hasSelectedConcept = selectedConceptId !== null;
  return (
    <section>
      <div className="relative overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`${String(viewBox.x)} ${String(viewBox.y)} ${String(viewBox.width)} ${String(viewBox.height)}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-[58vh] max-h-[46rem] min-h-[30rem] w-full select-none md:min-h-[38rem]"
          aria-label={query ? `${query} gap network` : "gap network"}
          onClick={() => {
            startTransition(() => {
              onBackgroundActivate();
            });
          }}
        >
          <defs>
            <filter id="gap-network-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4.5" />
            </filter>
            <marker
              id="gap-network-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L8,3 z" fill="var(--gap-stroke)" />
            </marker>
          </defs>

          <rect
            x={viewBox.x - viewBox.width}
            y={viewBox.y - viewBox.height}
            width={viewBox.width * 3}
            height={viewBox.height * 3}
            fill="transparent"
            rx={24}
          />

          {canvasMessage ? (
            <text
              x={viewBox.x + viewBox.width / 2}
              y={viewBox.y + viewBox.height / 2}
              textAnchor="middle"
              className="text-lh-lg fill-[var(--foreground)] font-medium"
            >
              {canvasMessage}
            </text>
          ) : null}

          <GapNetworkConceptEdgesLayer
            reportConceptEdges={reportConceptEdges}
            positions={positions}
            clusterById={clusterById}
            activeClusterIds={activeClusterIds}
            hasSelectedConcept={hasSelectedConcept}
            connectedEdgeIds={connectedEdgeIds}
          />

          <GapNetworkClusterHullsLayer
            hulls={hulls}
            activeClusterIds={activeClusterIds}
            hasSelectedConcept={hasSelectedConcept}
            selectedConceptClusterId={selectedConceptClusterId}
            onClusterActivate={onClusterActivate}
            setHoveredClusterId={setHoveredClusterId}
          />

          <GapNetworkGapPairsLayer
            visibleGapPairs={visibleGapPairs}
            hullById={hullById}
            gapPathsById={gapPathsById}
            gapLabelLayouts={gapLabelLayouts}
            hasSelectedConcept={hasSelectedConcept}
            activeGapPairId={activeGapPairId}
            onGapPairActivate={onGapPairActivate}
          />

          <GapNetworkConceptNodesLayer
            concepts={concepts}
            positions={positions}
            clusterById={clusterById}
            conceptLabelLayouts={conceptLabelLayouts}
            activeClusterIds={activeClusterIds}
            canSelectConceptNodes={canSelectConceptNodes}
            selectedConceptId={selectedConceptId}
            connectedConceptIds={connectedConceptIds}
            onClusterActivate={onClusterActivate}
            onConceptActivate={onConceptActivate}
            setHoveredClusterId={setHoveredClusterId}
          />
        </svg>
      </div>
    </section>
  );
}
