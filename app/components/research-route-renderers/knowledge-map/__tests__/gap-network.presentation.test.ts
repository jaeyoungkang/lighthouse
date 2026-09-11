import { describe, expect, it } from "vitest";
import {
  buildGapNetworkAnchoredPositions,
  buildGapNetworkClusterAnchors,
  buildGapNetworkClusterHulls,
  buildGapNetworkGapPath,
} from "@/app/components/research-route-renderers/knowledge-map/gap-network.presentation";
import type { PositionedGapNetworkConcept } from "@/app/components/research-route-renderers/knowledge-map/gap-network.presentation";

const clusters = Array.from({ length: 5 }, (_, index) => ({
  id: `cluster-${String(index)}`,
  label: `Cluster ${String(index)}`,
  color: `#${String(index + 1).repeat(6)}`,
  paperCount: 3,
  concepts: [
    {
      id: `concept-${String(index)}`,
      score: 1,
    },
  ],
}));

const permutationClusters = [
  {
    id: "cluster-alpha",
    label: "Alpha",
    color: "#111111",
    paperCount: 4,
    concepts: [
      { id: "concept-alpha-1", score: 5 },
      { id: "concept-alpha-2", score: 3 },
    ],
  },
  {
    id: "cluster-beta",
    label: "Beta",
    color: "#222222",
    paperCount: 4,
    concepts: [
      { id: "concept-beta-1", score: 4 },
      { id: "concept-beta-2", score: 2 },
    ],
  },
  {
    id: "cluster-gamma",
    label: "Gamma",
    color: "#333333",
    paperCount: 4,
    concepts: [
      { id: "concept-gamma-1", score: 4.5 },
      { id: "concept-gamma-2", score: 2.5 },
    ],
  },
];

const permutationConcepts = permutationClusters.flatMap((cluster) =>
  cluster.concepts.map((concept) => ({
    ...concept,
    cluster: cluster.id,
  })),
);

const permutationEdges = [
  {
    source: "concept-alpha-1",
    target: "concept-alpha-2",
    clusterId: "cluster-alpha",
    weight: 0.9,
  },
  {
    source: "concept-alpha-2",
    target: "concept-beta-1",
    clusterId: "cluster-alpha",
    weight: 0.72,
  },
  {
    source: "concept-beta-1",
    target: "concept-beta-2",
    clusterId: "cluster-beta",
    weight: 0.84,
  },
  {
    source: "concept-alpha-1",
    target: "concept-beta-2",
    clusterId: "cluster-beta",
    weight: 0.61,
  },
  {
    source: "concept-beta-2",
    target: "concept-gamma-1",
    clusterId: "cluster-beta",
    weight: 0.68,
  },
  {
    source: "concept-gamma-1",
    target: "concept-gamma-2",
    clusterId: "cluster-gamma",
    weight: 0.86,
  },
];

function getPositionSnapshot(positions: Map<string, PositionedGapNetworkConcept>) {
  return [...positions.entries()].sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
}

function getCyclicPermutations<T>(values: T[]): T[][] {
  return values.map((_, offset) => [...values.slice(offset), ...values.slice(0, offset)]);
}

describe("buildGapNetworkGapPath", () => {
  it("renders a single marker even when the cluster distance is long", () => {
    const path = buildGapNetworkGapPath({
      leftHull: {
        id: "cluster-0",
        label: "Agents",
        color: "#111111",
        cx: -260,
        cy: -40,
        leftX: -340,
        rightX: -180,
        topY: -120,
        bottomY: 40,
        labelY: -136,
        anchorSlot: "left",
        pathD: "M 0 0",
      },
      rightHull: {
        id: "cluster-1",
        label: "Memory",
        color: "#222222",
        cx: 260,
        cy: 60,
        leftX: 180,
        rightX: 340,
        topY: -20,
        bottomY: 140,
        labelY: -36,
        anchorSlot: "right",
        pathD: "M 0 0",
      },
      rank: 1,
    });

    expect(path.markers).toHaveLength(1);
    expect(path.markers[0]).toMatchObject({
      ringRadius: 18,
    });
  });
});

describe("buildGapNetworkAnchoredPositions", () => {
  it("uses d3 force links to pull connected concept nodes together", () => {
    const forceClusters = [
      {
        id: "cluster-0",
        label: "Memory",
        color: "#111111",
        paperCount: 3,
        concepts: [
          { id: "concept-a", score: 5 },
          { id: "concept-b", score: 4 },
          { id: "concept-c", score: 3 },
        ],
      },
    ];
    const concepts = forceClusters.flatMap((cluster) =>
      cluster.concepts.map((concept) => ({
        ...concept,
        cluster: cluster.id,
      })),
    );

    const positions = buildGapNetworkAnchoredPositions({
      concepts,
      clusters: forceClusters,
      conceptEdges: [
        { source: "concept-a", target: "concept-b", clusterId: "cluster-0", weight: 1 },
      ],
      gapPairs: [],
    });
    const source = positions.get("concept-a");
    const linked = positions.get("concept-b");
    const unlinked = positions.get("concept-c");

    expect(source).toBeDefined();
    expect(linked).toBeDefined();
    expect(unlinked).toBeDefined();
    const linkedDistance = Math.hypot(
      (source?.x ?? 0) - (linked?.x ?? 0),
      (source?.y ?? 0) - (linked?.y ?? 0),
    );
    const unlinkedDistance = Math.hypot(
      (source?.x ?? 0) - (unlinked?.x ?? 0),
      (source?.y ?? 0) - (unlinked?.y ?? 0),
    );

    expect(linkedDistance).toBeLessThan(unlinkedDistance);
  });

  it("keeps concept coordinates stable when cluster and node input order changes", () => {
    const original = buildGapNetworkAnchoredPositions({
      concepts: permutationConcepts,
      clusters: permutationClusters,
      conceptEdges: permutationEdges,
      gapPairs: [],
    });
    const expected = getPositionSnapshot(original);
    const conceptPermutations = getCyclicPermutations(permutationConcepts).slice(1);

    getCyclicPermutations(permutationClusters)
      .slice(1)
      .forEach((clusterPermutation, index) => {
        const permuted = buildGapNetworkAnchoredPositions({
          concepts: conceptPermutations[index] ?? permutationConcepts.slice().reverse(),
          clusters: clusterPermutation,
          conceptEdges: permutationEdges,
          gapPairs: [],
        });

        expect(getPositionSnapshot(permuted)).toEqual(expected);
      });
  });

  it("keeps concept coordinates stable when edge input order changes", () => {
    const original = buildGapNetworkAnchoredPositions({
      concepts: permutationConcepts,
      clusters: permutationClusters,
      conceptEdges: permutationEdges,
      gapPairs: [],
    });
    const expected = getPositionSnapshot(original);
    const edgePermutations = [
      ...getCyclicPermutations(permutationEdges).slice(1),
      permutationEdges.slice().reverse(),
    ];

    edgePermutations.forEach((conceptEdges) => {
      const permuted = buildGapNetworkAnchoredPositions({
        concepts: permutationConcepts,
        clusters: permutationClusters,
        conceptEdges,
        gapPairs: [],
      });

      expect(getPositionSnapshot(permuted)).toEqual(expected);
    });
  });
});

describe("buildGapNetworkClusterHulls", () => {
  it("scales cluster hull footprints by paper count", () => {
    const scaleClusters = [
      {
        id: "cluster-small",
        label: "Small Cluster",
        color: "#111111",
        paperCount: 2,
        concepts: [{ id: "concept-small", score: 1 }],
      },
      {
        id: "cluster-large",
        label: "Large Cluster",
        color: "#222222",
        paperCount: 18,
        concepts: [{ id: "concept-large", score: 1 }],
      },
    ];
    const positions = new Map<string, PositionedGapNetworkConcept>([
      [
        "concept-small",
        {
          id: "concept-small",
          x: 0,
          y: 0,
          angle: 0,
          anchorSlot: "left",
          labelSide: "right",
        },
      ],
      [
        "concept-large",
        {
          id: "concept-large",
          x: 240,
          y: 0,
          angle: 0,
          anchorSlot: "right",
          labelSide: "right",
        },
      ],
    ]);

    const hulls = buildGapNetworkClusterHulls(scaleClusters, positions);
    const smallHull = hulls.find((hull) => hull.id === "cluster-small");
    const largeHull = hulls.find((hull) => hull.id === "cluster-large");

    expect(smallHull).toBeDefined();
    expect(largeHull).toBeDefined();
    expect((largeHull?.rightX ?? 0) - (largeHull?.leftX ?? 0)).toBeGreaterThan(
      (smallHull?.rightX ?? 0) - (smallHull?.leftX ?? 0),
    );
    expect((largeHull?.bottomY ?? 0) - (largeHull?.topY ?? 0)).toBeGreaterThan(
      (smallHull?.bottomY ?? 0) - (smallHull?.topY ?? 0),
    );
  });

  it("keeps sparse paper clusters visibly smaller when node count is paper-capped", () => {
    const sizeClusters = [
      {
        id: "cluster-small",
        label: "Small Cluster",
        color: "#111111",
        paperCount: 4,
        concepts: Array.from({ length: 4 }, (_, index) => ({
          id: `small-concept-${String(index)}`,
          score: 4 - index,
        })),
      },
      {
        id: "cluster-large",
        label: "Large Cluster",
        color: "#222222",
        paperCount: 20,
        concepts: Array.from({ length: 16 }, (_, index) => ({
          id: `large-concept-${String(index)}`,
          score: 16 - index,
        })),
      },
    ];
    const concepts = sizeClusters.flatMap((cluster) =>
      cluster.concepts.map((concept) => ({
        ...concept,
        cluster: cluster.id,
      })),
    );
    const positions = buildGapNetworkAnchoredPositions({
      concepts,
      clusters: sizeClusters,
      conceptEdges: [],
      gapPairs: [],
    });

    const hulls = buildGapNetworkClusterHulls(sizeClusters, positions);
    const smallHull = hulls.find((hull) => hull.id === "cluster-small");
    const largeHull = hulls.find((hull) => hull.id === "cluster-large");
    const getArea = (hull: typeof smallHull) =>
      ((hull?.rightX ?? 0) - (hull?.leftX ?? 0)) * ((hull?.bottomY ?? 0) - (hull?.topY ?? 0));

    expect(smallHull).toBeDefined();
    expect(largeHull).toBeDefined();
    expect(sizeClusters[0]?.concepts).toHaveLength(4);
    expect(sizeClusters[1]?.concepts).toHaveLength(16);
    expect(getArea(largeHull)).toBeGreaterThan(getArea(smallHull) * 1.35);
  });
});

describe("buildGapNetworkClusterAnchors", () => {
  it("uses cluster id as the stable tie-breaker for equal two-cluster labels", () => {
    const equalLabelClusters = permutationClusters.slice(0, 2).map((cluster) => ({
      ...cluster,
      label: "Shared label",
    }));
    const original = buildGapNetworkClusterAnchors(equalLabelClusters, []);
    const permuted = buildGapNetworkClusterAnchors(equalLabelClusters.slice().reverse(), []);

    expect(original.get("cluster-alpha")?.slot).toBe("left");
    expect(original.get("cluster-beta")?.slot).toBe("right");
    expect(permuted.get("cluster-alpha")?.slot).toBe("left");
    expect(permuted.get("cluster-beta")?.slot).toBe("right");
  });

  it("uses a triangle layout when there are three clusters", () => {
    const anchors = buildGapNetworkClusterAnchors(clusters.slice(0, 3), []);

    expect(anchors.get("cluster-0")?.slot).toBe("top-center");
    expect(anchors.get("cluster-1")?.slot).toBe("bottom-right");
    expect(anchors.get("cluster-2")?.slot).toBe("bottom-left");
    expect(anchors.get("cluster-0")?.point.y).toBeLessThan(anchors.get("cluster-1")?.point.y ?? 0);
    expect(anchors.get("cluster-1")?.point.x).toBeGreaterThan(0);
    expect(anchors.get("cluster-2")?.point.x).toBeLessThan(0);
  });

  it("uses a diamond layout when there are four clusters", () => {
    const anchors = buildGapNetworkClusterAnchors(clusters.slice(0, 4), []);

    expect(anchors.get("cluster-0")?.slot).toBe("top-center");
    expect(anchors.get("cluster-1")?.slot).toBe("right");
    expect(anchors.get("cluster-2")?.slot).toBe("bottom-center");
    expect(anchors.get("cluster-3")?.slot).toBe("left");
    expect(anchors.get("cluster-2")?.point.y).toBeGreaterThan(
      anchors.get("cluster-1")?.point.y ?? 0,
    );
    expect(anchors.get("cluster-1")?.point.x).toBeGreaterThan(0);
    expect(anchors.get("cluster-3")?.point.x).toBeLessThan(0);
  });

  it("uses a pentagon layout when there are five clusters", () => {
    const anchors = buildGapNetworkClusterAnchors(clusters, []);
    const slots = new Set([...anchors.values()].map((anchor) => anchor.slot));

    expect(slots).toEqual(
      new Set(["top-center", "top-right", "bottom-right", "bottom-left", "top-left"]),
    );
    expect(anchors.get("cluster-0")?.slot).toBe("top-center");
    expect(anchors.get("cluster-1")?.slot).toBe("top-right");
    expect(anchors.get("cluster-2")?.slot).toBe("bottom-right");
    expect(anchors.get("cluster-3")?.slot).toBe("bottom-left");
    expect(anchors.get("cluster-4")?.slot).toBe("top-left");
  });
});
