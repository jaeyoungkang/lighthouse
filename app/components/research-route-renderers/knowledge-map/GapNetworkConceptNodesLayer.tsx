"use client";

// @promise promise:gap-led-next-search
// @check acceptance-check:gap-led-next-search-seeds-are-identifiable

import { startTransition } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { GapNetworkCluster } from "@/app/domain/research-route-payload";
import {
  truncateGapNetworkConceptLabel,
  type GapConceptViewModel,
  type GapNetworkConceptLabelLayout,
} from "./gap-network.report-helpers";
import type { PositionedGapNetworkConcept } from "./gap-network.presentation";

type GapNetworkConceptState = "idle" | "selected" | "connected" | "dimmed";

export interface GapNetworkConceptNodesLayerProps {
  concepts: GapConceptViewModel[];
  positions: Map<string, PositionedGapNetworkConcept>;
  clusterById: Map<string, GapNetworkCluster>;
  conceptLabelLayouts: Map<string, GapNetworkConceptLabelLayout>;
  activeClusterIds: Set<string>;
  canSelectConceptNodes: boolean;
  selectedConceptId: string | null;
  connectedConceptIds: Set<string>;
  onClusterActivate: (clusterId: string) => void;
  onConceptActivate: (conceptId: string) => void;
  setHoveredClusterId: Dispatch<SetStateAction<string | null>>;
}

function clampGapNetworkRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, value));
}

function formatGapNetworkAnimationValues(values: number[]): string {
  return values.map((value) => String(Math.round(value * 100) / 100)).join(";");
}

function formatGapNetworkAnimationDuration(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}

function getGapNetworkConceptBaseRadius(score: number, minScore: number, maxScore: number): number {
  if (maxScore <= minScore) {
    return 9.4;
  }

  const normalized = clampGapNetworkRatio((score - minScore) / (maxScore - minScore));
  return 7.2 + normalized * 4.4;
}

function getConceptState(params: {
  conceptId: string;
  clusterId: string;
  activeClusterIds: Set<string>;
  hasSelectedConcept: boolean;
  selectedConceptId: string | null;
  connectedConceptIds: Set<string>;
}): GapNetworkConceptState {
  if (params.hasSelectedConcept) {
    if (params.selectedConceptId === params.conceptId) {
      return "selected";
    }
    if (params.connectedConceptIds.has(params.conceptId)) {
      return "connected";
    }
    return "dimmed";
  }

  return params.activeClusterIds.size > 0 && !params.activeClusterIds.has(params.clusterId)
    ? "dimmed"
    : "idle";
}

function buildGapNetworkClusterHubConceptIds(
  clusterById: Map<string, GapNetworkCluster>,
): Set<string> {
  const clusterHubConceptIds = new Set<string>();

  clusterById.forEach((cluster) => {
    const hubConcept = cluster.concepts.slice().sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.id.localeCompare(right.id);
    })[0];

    clusterHubConceptIds.add(hubConcept.id);
  });

  return clusterHubConceptIds;
}

function GapNetworkHubPulseRing({
  clusterColor,
  conceptRadius,
  conceptScore,
  minScore,
  maxScore,
  conceptState,
}: {
  clusterColor: string;
  conceptRadius: number;
  conceptScore: number;
  minScore: number;
  maxScore: number;
  conceptState: GapNetworkConceptState;
}) {
  const normalizedScore = clampGapNetworkRatio(
    (conceptScore - minScore) / Math.max(maxScore - minScore, 1),
  );
  const duration = formatGapNetworkAnimationDuration((4.8 - normalizedScore) * 0.9);
  const strokeOpacity =
    conceptState === "dimmed" ? 0.08 : conceptState === "selected" ? 0.42 : 0.22;
  const opacityValues =
    conceptState === "dimmed"
      ? "0.08;0.02;0.08"
      : conceptState === "selected"
        ? "0.42;0.14;0.42"
        : "0.22;0.08;0.22";

  return (
    <circle
      r={conceptRadius + 4.8}
      fill="none"
      stroke={clusterColor}
      strokeOpacity={strokeOpacity}
      strokeWidth={1.2}
      filter="url(#gap-network-soft-glow)"
      pointerEvents="none"
    >
      <animate
        attributeName="r"
        values={formatGapNetworkAnimationValues([
          conceptRadius + 4.8,
          conceptRadius + 8,
          conceptRadius + 4.8,
        ])}
        dur={duration}
        repeatCount="indefinite"
      />
      <animate
        attributeName="stroke-opacity"
        values={opacityValues}
        dur={duration}
        repeatCount="indefinite"
      />
    </circle>
  );
}

function getGapNetworkConceptOpacity(
  conceptState: GapNetworkConceptState,
  hasSelectedConcept: boolean,
): number {
  return conceptState === "dimmed" ? (hasSelectedConcept ? 0.18 : 0.35) : 1;
}

function getGapNetworkConceptFillOpacity(
  conceptState: GapNetworkConceptState,
  hasSelectedConcept: boolean,
): number {
  if (conceptState === "dimmed") {
    return 0.18;
  }
  if (conceptState === "selected") {
    return 1;
  }
  return hasSelectedConcept ? 0.96 : 0.95;
}

function getGapNetworkConceptStrokeWidth(conceptState: GapNetworkConceptState): number {
  if (conceptState === "selected") {
    return 2.1;
  }
  return conceptState === "connected" ? 1.6 : 1.2;
}

function getGapNetworkNodePulseAmplitude(
  conceptState: GapNetworkConceptState,
  isHubConcept: boolean,
): number {
  if (conceptState === "selected") {
    return 1;
  }
  if (conceptState === "connected") {
    return 0.72;
  }
  return isHubConcept ? 0.5 : 0.28;
}

function GapNetworkConceptNode({
  concept,
  position,
  cluster,
  labelLayout,
  showConceptLabel,
  conceptState,
  conceptRadius,
  hasSelectedConcept,
  canSelectConceptNodes,
  isHubConcept,
  minScore,
  maxScore,
  onClusterActivate,
  onConceptActivate,
  setHoveredClusterId,
}: {
  concept: GapConceptViewModel;
  position: PositionedGapNetworkConcept;
  cluster: GapNetworkCluster | undefined;
  labelLayout: GapNetworkConceptLabelLayout | undefined;
  showConceptLabel: boolean;
  conceptState: GapNetworkConceptState;
  conceptRadius: number;
  hasSelectedConcept: boolean;
  canSelectConceptNodes: boolean;
  isHubConcept: boolean;
  minScore: number;
  maxScore: number;
  onClusterActivate: (clusterId: string) => void;
  onConceptActivate: (conceptId: string) => void;
  setHoveredClusterId: Dispatch<SetStateAction<string | null>>;
}) {
  const textOffset =
    (labelLayout?.x ?? position.x + (position.labelSide === "right" ? 14 : -14)) - position.x;
  const textY = (labelLayout?.y ?? position.y + 4) - position.y;
  const textAnchor = labelLayout?.textAnchor ?? (position.labelSide === "right" ? "start" : "end");
  const labelText = labelLayout?.text ?? truncateGapNetworkConceptLabel(concept.label);
  const conceptOpacity = getGapNetworkConceptOpacity(conceptState, hasSelectedConcept);
  const conceptFillOpacity = getGapNetworkConceptFillOpacity(conceptState, hasSelectedConcept);
  const conceptStrokeOpacity = conceptState === "dimmed" && hasSelectedConcept ? 0.22 : 1;
  const conceptStrokeWidth = getGapNetworkConceptStrokeWidth(conceptState);
  const nodePulseDuration = formatGapNetworkAnimationDuration(
    4.4 - clampGapNetworkRatio((concept.score - minScore) / Math.max(maxScore - minScore, 1)) * 0.7,
  );
  const nodePulseAmplitude = getGapNetworkNodePulseAmplitude(conceptState, isHubConcept);

  return (
    <g
      key={concept.id}
      transform={`translate(${String(position.x)} ${String(position.y)})`}
      opacity={conceptOpacity}
    >
      {isHubConcept ? (
        <GapNetworkHubPulseRing
          clusterColor={cluster?.color ?? "var(--accent)"}
          conceptRadius={conceptRadius}
          conceptScore={concept.score}
          minScore={minScore}
          maxScore={maxScore}
          conceptState={conceptState}
        />
      ) : null}
      <circle
        data-gap-interactive="true"
        data-concept-node="true"
        data-concept-id={concept.id}
        data-concept-state={conceptState}
        data-concept-hub={isHubConcept ? "true" : "false"}
        data-cluster-id={concept.cluster}
        r={conceptRadius}
        fill={cluster?.color ?? "var(--accent)"}
        fillOpacity={conceptFillOpacity}
        stroke="var(--node-stroke)"
        strokeOpacity={conceptStrokeOpacity}
        strokeWidth={conceptStrokeWidth}
        onMouseEnter={() => {
          startTransition(() => {
            setHoveredClusterId(concept.cluster);
          });
        }}
        onMouseLeave={() => {
          startTransition(() => {
            setHoveredClusterId((current) => (current === concept.cluster ? null : current));
          });
        }}
        onClick={(event) => {
          event.stopPropagation();
          startTransition(() => {
            if (canSelectConceptNodes) {
              onConceptActivate(concept.id);
              return;
            }

            onClusterActivate(concept.cluster);
          });
        }}
      >
        {conceptState !== "dimmed" ? (
          <>
            <animate
              attributeName="r"
              values={formatGapNetworkAnimationValues([
                conceptRadius,
                conceptRadius + nodePulseAmplitude,
                conceptRadius,
              ])}
              dur={nodePulseDuration}
              repeatCount="indefinite"
            />
            <animate
              attributeName="fill-opacity"
              values={formatGapNetworkAnimationValues([
                conceptFillOpacity,
                Math.max(conceptFillOpacity - 0.1, 0.3),
                conceptFillOpacity,
              ])}
              dur={nodePulseDuration}
              repeatCount="indefinite"
            />
          </>
        ) : null}
      </circle>
      {showConceptLabel ? (
        <text
          x={textOffset}
          y={textY}
          textAnchor={textAnchor}
          className="text-lh-2xs fill-[var(--graph-node-text)] font-medium"
          pointerEvents="none"
        >
          {labelText}
        </text>
      ) : null}
    </g>
  );
}

export function GapNetworkConceptNodesLayer({
  concepts,
  positions,
  clusterById,
  conceptLabelLayouts,
  activeClusterIds,
  canSelectConceptNodes,
  selectedConceptId,
  connectedConceptIds,
  onClusterActivate,
  onConceptActivate,
  setHoveredClusterId,
}: GapNetworkConceptNodesLayerProps) {
  const hasSelectedConcept = selectedConceptId !== null;
  const scoreValues = concepts.map((concept) => concept.score);
  const minScore = scoreValues.length > 0 ? Math.min(...scoreValues) : 0;
  const maxScore = scoreValues.length > 0 ? Math.max(...scoreValues) : 1;
  const clusterHubConceptIds = buildGapNetworkClusterHubConceptIds(clusterById);

  return (
    <>
      {concepts.map((concept) => {
        const position = positions.get(concept.id);
        if (!position) {
          return null;
        }

        const conceptState = getConceptState({
          conceptId: concept.id,
          clusterId: concept.cluster,
          activeClusterIds,
          hasSelectedConcept,
          selectedConceptId,
          connectedConceptIds,
        });
        const baseConceptRadius = getGapNetworkConceptBaseRadius(concept.score, minScore, maxScore);
        const conceptRadius =
          conceptState === "selected"
            ? baseConceptRadius + 1.7
            : conceptState === "connected"
              ? baseConceptRadius + 0.9
              : baseConceptRadius;

        return (
          <GapNetworkConceptNode
            key={concept.id}
            concept={concept}
            position={position}
            cluster={clusterById.get(concept.cluster)}
            labelLayout={conceptLabelLayouts.get(concept.id)}
            showConceptLabel={true}
            conceptState={conceptState}
            conceptRadius={conceptRadius}
            hasSelectedConcept={hasSelectedConcept}
            canSelectConceptNodes={canSelectConceptNodes}
            isHubConcept={clusterHubConceptIds.has(concept.id)}
            minScore={minScore}
            maxScore={maxScore}
            onClusterActivate={onClusterActivate}
            onConceptActivate={onConceptActivate}
            setHoveredClusterId={setHoveredClusterId}
          />
        );
      })}
    </>
  );
}
