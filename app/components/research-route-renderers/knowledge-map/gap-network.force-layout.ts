import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { GapNetworkAnchorSlot, PositionedGapNetworkConcept } from "./gap-network.presentation";
import { round } from "./gap-network.presentation.utils";

interface ForceConceptLike {
  id: string;
  cluster: string;
  score: number;
}

interface ForceConceptEdgeLike {
  source: string;
  target: string;
  clusterId: string;
  weight: number;
}

interface ForceConceptNode extends SimulationNodeDatum {
  id: string;
  cluster: string;
  score: number;
  anchorX: number;
  anchorY: number;
  anchorSlot: GapNetworkAnchorSlot;
}

interface ForceConceptLink extends SimulationLinkDatum<ForceConceptNode> {
  source: string | ForceConceptNode;
  target: string | ForceConceptNode;
  clusterId: string;
  weight: number;
}

const GAP_NETWORK_FORCE_ITERATIONS = 140;

function compareForceConceptEdgesByIdentity(
  left: ForceConceptEdgeLike,
  right: ForceConceptEdgeLike,
): number {
  const clusterOrder = left.clusterId.localeCompare(right.clusterId);
  if (clusterOrder !== 0) {
    return clusterOrder;
  }

  const sourceOrder = left.source.localeCompare(right.source);
  if (sourceOrder !== 0) {
    return sourceOrder;
  }

  const targetOrder = left.target.localeCompare(right.target);
  if (targetOrder !== 0) {
    return targetOrder;
  }

  return left.weight - right.weight;
}

function createDeterministicRandom() {
  let seed = 0xdecafbad;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

// @check acceptance-check:gap-network-detection-from-search-layout-permutation-invariance
export function applyForceDirectedConceptLayout(params: {
  positions: Map<string, PositionedGapNetworkConcept>;
  concepts: ForceConceptLike[];
  conceptEdges: ForceConceptEdgeLike[];
}): Map<string, PositionedGapNetworkConcept> {
  if (params.positions.size <= 1) {
    return params.positions;
  }

  const orderedPositions = [...params.positions.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const conceptById = new Map(params.concepts.map((concept) => [concept.id, concept] as const));
  const clusterCenters = new Map<string, { x: number; y: number; count: number }>();
  orderedPositions.forEach((position) => {
    const concept = conceptById.get(position.id);
    if (!concept) {
      return;
    }
    const current = clusterCenters.get(concept.cluster) ?? { x: 0, y: 0, count: 0 };
    clusterCenters.set(concept.cluster, {
      x: current.x + position.x,
      y: current.y + position.y,
      count: current.count + 1,
    });
  });

  const nodes: ForceConceptNode[] = orderedPositions.map((position) => {
    const concept = conceptById.get(position.id);
    const clusterCenter = concept ? clusterCenters.get(concept.cluster) : null;
    const anchorX = clusterCenter ? clusterCenter.x / Math.max(clusterCenter.count, 1) : position.x;
    const anchorY = clusterCenter ? clusterCenter.y / Math.max(clusterCenter.count, 1) : position.y;
    return {
      id: position.id,
      cluster: concept?.cluster ?? "",
      score: concept?.score ?? 1,
      x: position.x,
      y: position.y,
      anchorX,
      anchorY,
      anchorSlot: position.anchorSlot,
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const links: ForceConceptLink[] = params.conceptEdges
    .slice()
    .sort(compareForceConceptEdgesByIdentity)
    .flatMap((edge) => {
      if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
        return [];
      }
      return [
        {
          source: edge.source,
          target: edge.target,
          clusterId: edge.clusterId,
          weight: edge.weight,
        },
      ];
    });

  const simulation = forceSimulation<ForceConceptNode>(nodes)
    .randomSource(createDeterministicRandom())
    .force(
      "link",
      forceLink<ForceConceptNode, ForceConceptLink>(links)
        .id((node) => node.id)
        .distance((link) => 92 - Math.min(Math.max(link.weight, 0), 1) * 28)
        .strength((link) => 0.5 + Math.min(Math.max(link.weight, 0), 1) * 0.34),
    )
    .force("charge", forceManyBody<ForceConceptNode>().strength(-116))
    .force("collide", forceCollide<ForceConceptNode>().radius(42).strength(0.92))
    .force("x", forceX<ForceConceptNode>((node) => node.anchorX).strength(0.1))
    .force("y", forceY<ForceConceptNode>((node) => node.anchorY).strength(0.1))
    .stop();

  for (let index = 0; index < GAP_NETWORK_FORCE_ITERATIONS; index += 1) {
    simulation.tick();
  }

  const nextPositions = new Map(
    orderedPositions.map((position) => [position.id, position] as const),
  );
  nodes.forEach((node) => {
    const previous = params.positions.get(node.id);
    if (!previous || typeof node.x !== "number" || typeof node.y !== "number") {
      return;
    }
    const dx = node.x - node.anchorX;
    const dy = node.y - node.anchorY;
    const angle = Math.atan2(dy, dx);
    nextPositions.set(node.id, {
      ...previous,
      x: round(node.x, 2),
      y: round(node.y, 2),
      angle,
      labelSide: dx >= 0 ? "right" : "left",
    });
  });

  return nextPositions;
}
