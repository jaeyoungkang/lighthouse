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

export type AiScienceSampleCluster = "scientist" | "lab" | "bridge";
export type AiScienceSampleRelation = "co-citation" | "shared-refs";

export interface AiScienceSamplePaper extends SimulationNodeDatum {
  id: string;
  label: string;
  title: string;
  keywords: readonly string[];
  cluster: AiScienceSampleCluster;
  year: number;
  citations: number;
  graphScore: number;
  x: number;
  y: number;
}

export interface AiScienceSampleEdge extends SimulationLinkDatum<AiScienceSamplePaper> {
  source: string | AiScienceSamplePaper;
  target: string | AiScienceSamplePaper;
  relation: AiScienceSampleRelation;
  strength: "strong" | "weak";
  sharedCiters: number;
  sharedRefs: number;
}

export interface PositionedAiScienceSampleEdge {
  id: string;
  source: AiScienceSamplePaper;
  target: AiScienceSamplePaper;
  relation: AiScienceSampleRelation;
  strength: "strong" | "weak";
  sharedCiters: number;
  sharedRefs: number;
  labelX: number;
  labelY: number;
}

export interface AiScienceSampleLayout {
  papers: AiScienceSamplePaper[];
  edges: PositionedAiScienceSampleEdge[];
}

const WIDTH = 1120;
const HEIGHT = 640;
const ITERATIONS = 180;

export const AI_SCIENCE_SAMPLE_PAPERS: readonly AiScienceSamplePaper[] = [
  {
    id: "101",
    label: "P1",
    title: "AI Scientists for Hypothesis Generation",
    keywords: ["hypothesis generation", "AI scientist"],
    cluster: "scientist",
    year: 2025,
    citations: 12,
    graphScore: 0.82,
    x: 250,
    y: 170,
    fx: 250,
    fy: 170,
  },
  {
    id: "202",
    label: "P2",
    title: "Autonomous Discovery Agents",
    keywords: ["discovery agents", "experiment planning"],
    cluster: "scientist",
    year: 2025,
    citations: 10,
    graphScore: 0.74,
    x: 250,
    y: 470,
    fx: 250,
    fy: 470,
  },
  {
    id: "303",
    label: "P3",
    title: "Robotic Labs for Closed Loop Science",
    keywords: ["closed-loop science", "robotic labs"],
    cluster: "lab",
    year: 2024,
    citations: 14,
    graphScore: 0.68,
    x: 870,
    y: 170,
    fx: 870,
    fy: 170,
  },
  {
    id: "404",
    label: "P4",
    title: "Laboratory Automation for Materials Discovery",
    keywords: ["laboratory automation", "materials discovery"],
    cluster: "lab",
    year: 2024,
    citations: 9,
    graphScore: 0.61,
    x: 870,
    y: 470,
    fx: 870,
    fy: 470,
  },
  {
    id: "505",
    label: "P5",
    title: "Retrieval Augmented Hypothesis Generation for Scientific Workflows",
    keywords: ["retrieval augmented hypothesis generation", "scientific workflows"],
    cluster: "bridge",
    year: 2026,
    citations: 7,
    graphScore: 0.79,
    x: 560,
    y: 250,
    fx: 560,
    fy: 250,
  },
  {
    id: "606",
    label: "P6",
    title: "Benchmarking AI for Science Discovery Agents",
    keywords: ["AI for science benchmarks", "discovery agents"],
    cluster: "bridge",
    year: 2025,
    citations: 6,
    graphScore: 0.44,
    x: 560,
    y: 470,
    fx: 560,
    fy: 470,
  },
] as const;

const AI_SCIENCE_SAMPLE_EDGES: readonly AiScienceSampleEdge[] = [
  {
    source: "101",
    target: "202",
    relation: "co-citation",
    strength: "strong",
    sharedCiters: 4,
    sharedRefs: 1,
  },
  {
    source: "101",
    target: "505",
    relation: "shared-refs",
    strength: "strong",
    sharedCiters: 2,
    sharedRefs: 3,
  },
  {
    source: "202",
    target: "505",
    relation: "co-citation",
    strength: "strong",
    sharedCiters: 3,
    sharedRefs: 1,
  },
  {
    source: "303",
    target: "404",
    relation: "shared-refs",
    strength: "strong",
    sharedCiters: 1,
    sharedRefs: 5,
  },
  {
    source: "202",
    target: "303",
    relation: "co-citation",
    strength: "weak",
    sharedCiters: 1,
    sharedRefs: 0,
  },
  {
    source: "404",
    target: "505",
    relation: "shared-refs",
    strength: "weak",
    sharedCiters: 0,
    sharedRefs: 1,
  },
] as const;

function createDeterministicRandom() {
  let seed = 0x51a1f0c1;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function clusterX(cluster: AiScienceSampleCluster) {
  if (cluster === "scientist") {
    return 250;
  }
  if (cluster === "lab") {
    return 880;
  }
  return 560;
}

function clusterY(cluster: AiScienceSampleCluster) {
  if (cluster === "bridge") {
    return 320;
  }
  return 310;
}

export function buildAiScienceSampleLayout(): AiScienceSampleLayout {
  const papers = AI_SCIENCE_SAMPLE_PAPERS.map((paper) => ({ ...paper }));
  const edges = AI_SCIENCE_SAMPLE_EDGES.map((edge) => ({ ...edge }));

  const simulation = forceSimulation<AiScienceSamplePaper>(papers)
    .randomSource(createDeterministicRandom())
    .force(
      "link",
      forceLink<AiScienceSamplePaper, AiScienceSampleEdge>(edges)
        .id((paper) => paper.id)
        .distance((edge) => (edge.strength === "strong" ? 230 : 300))
        .strength((edge) => (edge.strength === "strong" ? 0.52 : 0.16)),
    )
    .force("charge", forceManyBody<AiScienceSamplePaper>().strength(-720))
    .force("collide", forceCollide<AiScienceSamplePaper>().radius(142).strength(0.98))
    .force("x", forceX<AiScienceSamplePaper>((paper) => clusterX(paper.cluster)).strength(0.2))
    .force("y", forceY<AiScienceSamplePaper>((paper) => clusterY(paper.cluster)).strength(0.12))
    .stop();

  for (let index = 0; index < ITERATIONS; index += 1) {
    simulation.tick();
  }

  papers.forEach((paper) => {
    paper.x = round(Math.min(Math.max(paper.x, 130), WIDTH - 130));
    paper.y = round(Math.min(Math.max(paper.y, 90), HEIGHT - 90));
  });

  const paperById = new Map(papers.map((paper) => [paper.id, paper] as const));
  const positionedEdges = edges.flatMap((edge): PositionedAiScienceSampleEdge[] => {
    const sourceId = typeof edge.source === "string" ? edge.source : edge.source.id;
    const targetId = typeof edge.target === "string" ? edge.target : edge.target.id;
    const source = paperById.get(sourceId);
    const target = paperById.get(targetId);
    if (!source || !target) {
      return [];
    }
    const edgeId = `${source.id}-${target.id}-${edge.relation}`;
    const labelOffset = edgeLabelOffset(edgeId);
    return [
      {
        id: edgeId,
        source,
        target,
        relation: edge.relation,
        strength: edge.strength,
        sharedCiters: edge.sharedCiters,
        sharedRefs: edge.sharedRefs,
        labelX: round((source.x + target.x) / 2 + labelOffset.x),
        labelY: round((source.y + target.y) / 2 + labelOffset.y),
      },
    ];
  });

  return {
    papers,
    edges: positionedEdges,
  };
}

function edgeLabelOffset(edgeId: string) {
  const offsets: Record<string, { x: number; y: number }> = {
    "101-202-co-citation": { x: -54, y: 0 },
    "101-505-shared-refs": { x: 0, y: -30 },
    "202-505-co-citation": { x: 0, y: 34 },
    "303-404-shared-refs": { x: 56, y: 0 },
    "202-303-co-citation": { x: 0, y: 42 },
    "404-505-shared-refs": { x: 0, y: 36 },
  };
  return offsets[edgeId] ?? { x: 0, y: 0 };
}
