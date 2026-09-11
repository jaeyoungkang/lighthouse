import { t } from "@/app/i18n/message-access";

type GraphSurfaceExplainerVariant = "search" | "representative" | "terms" | "gap";

interface GraphSurfaceExplainerProps {
  variant: GraphSurfaceExplainerVariant;
}

interface SurfaceVisualNode {
  id: string;
  x: number;
  y: number;
  tone: "accent" | "plain" | "panel";
  meta: string;
  title: string;
  detail: string;
}

interface SurfaceVisualEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  tone: "strong" | "weak";
  dashed?: boolean;
  labelOffset?: { x: number; y: number };
}

interface GraphSurfaceStepConfig {
  labelKey: keyof typeof GRAPH_SURFACE_STEP_LABEL_KEYS;
  bodyKey: string;
}

interface GraphSurfaceConfig {
  testId: string;
  titleKey: Parameters<typeof t>[0];
  bodyKey: Parameters<typeof t>[0];
  steps: readonly GraphSurfaceStepConfig[];
  legend: readonly string[];
  nodes: readonly SurfaceVisualNode[];
  edges: readonly SurfaceVisualEdge[];
}

const GRAPH_SURFACE_STEP_LABEL_KEYS = {
  sample: "commitment.graphSurface.step.sample",
  call: "commitment.graphSurface.step.call",
  intersect: "commitment.graphSurface.step.intersect",
  apply: "commitment.graphSurface.step.apply",
} as const;

const GRAPH_SURFACE_CONFIG = {
  search: {
    testId: "commitment-graph-surface-search",
    titleKey: "commitment.graphSurface.search.title",
    bodyKey: "commitment.graphSurface.search.body",
    steps: [
      { labelKey: "sample", bodyKey: "commitment.graphSurface.search.step.sample" },
      { labelKey: "call", bodyKey: "commitment.graphSurface.search.step.call" },
      { labelKey: "intersect", bodyKey: "commitment.graphSurface.search.step.intersect" },
      { labelKey: "apply", bodyKey: "commitment.graphSurface.search.step.apply" },
    ],
    legend: [
      t("commitment.graphSurface.visual.search.legend.results"),
      t("commitment.graphSurface.visual.search.legend.parallelInputs"),
      t("commitment.graphSurface.visual.search.legend.screenClues"),
    ],
    nodes: [
      {
        id: "query",
        x: 135,
        y: 110,
        tone: "accent",
        meta: t("commitment.graphSurface.visual.search.query.meta"),
        title: "ai for science",
        detail: t("commitment.graphSurface.visual.search.query.detail"),
      },
      {
        id: "library",
        x: 135,
        y: 245,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.search.library.meta"),
        title: "saved AI scientist papers",
        detail: t("commitment.graphSurface.visual.search.library.detail"),
      },
      {
        id: "p1",
        x: 430,
        y: 110,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.common.resultPaper"),
        title: "Hypothesis Generation",
        detail: t("commitment.graphSurface.visual.common.currentResultPaper"),
      },
      {
        id: "p3",
        x: 430,
        y: 245,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.search.graphCandidate.meta"),
        title: "Robotic Labs for Closed Loop Science",
        detail: t("commitment.graphSurface.visual.search.graphCandidate.detail"),
      },
      {
        id: "graph",
        x: 710,
        y: 110,
        tone: "panel",
        meta: t("commitment.graphSurface.visual.search.graph.meta"),
        title: t("commitment.graphSurface.visual.search.graph.title"),
        detail: t("commitment.graphSurface.visual.search.graph.detail"),
      },
      {
        id: "output",
        x: 710,
        y: 245,
        tone: "panel",
        meta: t("commitment.graphSurface.visual.common.screen"),
        title: t("commitment.graphSurface.visual.search.output.title"),
        detail: t("commitment.graphSurface.visual.search.output.detail"),
      },
    ],
    edges: [
      {
        id: "query-p1",
        source: "query",
        target: "p1",
        label: t("commitment.graphSurface.visual.search.edge.candidates"),
        tone: "strong",
      },
      {
        id: "library-p3",
        source: "library",
        target: "p3",
        label: t("commitment.graphSurface.visual.search.edge.interestClue"),
        tone: "weak",
        dashed: true,
        labelOffset: { x: 0, y: 30 },
      },
      {
        id: "p1-graph",
        source: "p1",
        target: "graph",
        label: t("commitment.graphSurface.visual.common.edge.connectionCheck"),
        tone: "strong",
        dashed: true,
      },
      {
        id: "p3-graph",
        source: "p3",
        target: "graph",
        label: t("commitment.graphSurface.visual.search.edge.resultPaper"),
        tone: "weak",
        dashed: true,
      },
      {
        id: "graph-output",
        source: "graph",
        target: "output",
        label: t("commitment.graphSurface.visual.search.edge.supportScore"),
        tone: "strong",
      },
      {
        id: "p1-p3",
        source: "p1",
        target: "p3",
        label: t("commitment.graphSurface.visual.search.edge.currentSample"),
        tone: "weak",
        labelOffset: { x: -48, y: 0 },
      },
    ],
  },
  representative: {
    testId: "commitment-graph-surface-representative",
    titleKey: "commitment.graphSurface.representative.title",
    bodyKey: "commitment.graphSurface.representative.body",
    steps: [
      { labelKey: "sample", bodyKey: "commitment.graphSurface.representative.step.sample" },
      { labelKey: "call", bodyKey: "commitment.graphSurface.representative.step.call" },
      { labelKey: "intersect", bodyKey: "commitment.graphSurface.representative.step.intersect" },
      { labelKey: "apply", bodyKey: "commitment.graphSurface.representative.step.apply" },
    ],
    legend: [
      t("commitment.graphSurface.visual.rep.legend.fitCandidates"),
      t("commitment.graphSurface.visual.search.legend.connections"),
      t("commitment.graphSurface.visual.rep.legend.cards"),
    ],
    nodes: [
      {
        id: "p1",
        x: 135,
        y: 110,
        tone: "accent",
        meta: t("commitment.graphSurface.visual.common.representativeCandidate"),
        title: "AI Scientists for Hypothesis Generation",
        detail: t("commitment.graphSurface.visual.rep.p1.detail"),
      },
      {
        id: "p2",
        x: 135,
        y: 245,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.common.representativeCandidate"),
        title: "Autonomous Discovery Agents",
        detail: t("commitment.graphSurface.visual.rep.p2.detail"),
      },
      {
        id: "p5",
        x: 430,
        y: 110,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.rep.connectedCandidate"),
        title: "Retrieval Augmented Hypothesis Generation",
        detail: t("commitment.graphSurface.visual.rep.p5.detail"),
      },
      {
        id: "p3",
        x: 430,
        y: 245,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.common.representativeCandidate"),
        title: "Robotic Labs for Closed Loop Science",
        detail: t("commitment.graphSurface.visual.rep.p3.detail"),
      },
      {
        id: "card",
        x: 710,
        y: 110,
        tone: "panel",
        meta: t("commitment.graphSurface.visual.common.screen"),
        title: t("commitment.graphSurface.visual.rep.card.title"),
        detail: t("commitment.graphSurface.visual.rep.card.detail"),
      },
      {
        id: "criteria",
        x: 710,
        y: 245,
        tone: "panel",
        meta: t("commitment.graphSurface.visual.rep.criteria.meta"),
        title: t("commitment.graphSurface.visual.rep.criteria.title"),
        detail: t("commitment.graphSurface.visual.rep.criteria.detail"),
      },
    ],
    edges: [
      {
        id: "p1-p5",
        source: "p1",
        target: "p5",
        label: t("commitment.graphSurface.visual.common.edge.sharedRefs"),
        tone: "strong",
        dashed: true,
      },
      {
        id: "p2-p5",
        source: "p2",
        target: "p5",
        label: t("commitment.graphSurface.visual.common.edge.cocitation"),
        tone: "strong",
      },
      {
        id: "p3-criteria",
        source: "p3",
        target: "criteria",
        label: t("commitment.graphSurface.visual.rep.edge.fit"),
        tone: "weak",
        dashed: true,
        labelOffset: { x: 0, y: 28 },
      },
      {
        id: "p5-card",
        source: "p5",
        target: "card",
        label: t("commitment.graphSurface.visual.rep.edge.order"),
        tone: "strong",
      },
      {
        id: "criteria-card",
        source: "criteria",
        target: "card",
        label: t("commitment.graphSurface.visual.rep.edge.criteria"),
        tone: "strong",
        labelOffset: { x: 48, y: 0 },
      },
    ],
  },
  terms: {
    testId: "commitment-graph-surface-terms",
    titleKey: "commitment.graphSurface.terms.title",
    bodyKey: "commitment.graphSurface.terms.body",
    steps: [
      { labelKey: "sample", bodyKey: "commitment.graphSurface.terms.step.sample" },
      { labelKey: "call", bodyKey: "commitment.graphSurface.terms.step.call" },
      { labelKey: "intersect", bodyKey: "commitment.graphSurface.terms.step.intersect" },
      { labelKey: "apply", bodyKey: "commitment.graphSurface.terms.step.apply" },
    ],
    legend: [
      t("commitment.graphSurface.visual.terms.legend.expression"),
      t("commitment.graphSurface.visual.terms.legend.supportPapers"),
      t("commitment.graphSurface.visual.terms.legend.connectedEvidence"),
    ],
    nodes: [
      {
        id: "term",
        x: 135,
        y: 110,
        tone: "accent",
        meta: t("commitment.graphSurface.visual.terms.term.meta"),
        title: "retrieval augmented hypothesis generation",
        detail: t("commitment.graphSurface.visual.terms.term.detail"),
      },
      {
        id: "method",
        x: 135,
        y: 245,
        tone: "accent",
        meta: t("commitment.graphSurface.visual.terms.method.meta"),
        title: "hypothesis generation workflow",
        detail: t("commitment.graphSurface.visual.terms.method.detail"),
      },
      {
        id: "papers-a",
        x: 430,
        y: 110,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.terms.support.meta"),
        title: "P1 · P2",
        detail: t("commitment.graphSurface.visual.terms.supportA.detail"),
      },
      {
        id: "papers-b",
        x: 430,
        y: 245,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.terms.support.meta"),
        title: "P5",
        detail: t("commitment.graphSurface.visual.terms.supportB.detail"),
      },
      {
        id: "priority",
        x: 710,
        y: 110,
        tone: "panel",
        meta: t("commitment.graphSurface.visual.terms.priority.meta"),
        title: t("commitment.graphSurface.visual.terms.priority.title"),
        detail: t("commitment.graphSurface.visual.terms.priority.detail"),
      },
      {
        id: "chip",
        x: 710,
        y: 245,
        tone: "panel",
        meta: t("commitment.graphSurface.visual.common.screen"),
        title: t("commitment.graphSurface.visual.terms.chip.title"),
        detail: t("commitment.graphSurface.visual.terms.chip.detail"),
      },
    ],
    edges: [
      {
        id: "term-papers-a",
        source: "term",
        target: "papers-a",
        label: t("commitment.graphSurface.visual.terms.edge.supportExpression"),
        tone: "strong",
      },
      {
        id: "method-papers-b",
        source: "method",
        target: "papers-b",
        label: t("commitment.graphSurface.visual.terms.edge.methodCue"),
        tone: "strong",
      },
      {
        id: "papers-a-papers-b",
        source: "papers-a",
        target: "papers-b",
        label: t("commitment.graphSurface.visual.common.edge.cocitation"),
        tone: "weak",
        dashed: true,
        labelOffset: { x: -52, y: 0 },
      },
      {
        id: "papers-a-priority",
        source: "papers-a",
        target: "priority",
        label: t("commitment.graphSurface.visual.terms.edge.currentConnection"),
        tone: "strong",
        dashed: true,
      },
      {
        id: "papers-b-chip",
        source: "papers-b",
        target: "chip",
        label: t("commitment.graphSurface.visual.terms.edge.basisCopy"),
        tone: "weak",
        dashed: true,
        labelOffset: { x: 0, y: 28 },
      },
      {
        id: "priority-chip",
        source: "priority",
        target: "chip",
        label: t("commitment.graphSurface.visual.terms.edge.priority"),
        tone: "strong",
        labelOffset: { x: 48, y: 0 },
      },
    ],
  },
  gap: {
    testId: "commitment-graph-surface-gap",
    titleKey: "commitment.graphSurface.gap.title",
    bodyKey: "commitment.graphSurface.gap.body",
    steps: [
      { labelKey: "sample", bodyKey: "commitment.graphSurface.gap.step.sample" },
      { labelKey: "call", bodyKey: "commitment.graphSurface.gap.step.call" },
      { labelKey: "intersect", bodyKey: "commitment.graphSurface.gap.step.intersect" },
      { labelKey: "apply", bodyKey: "commitment.graphSurface.gap.step.apply" },
    ],
    legend: [
      t("commitment.graphSurface.visual.gap.legend.clusters"),
      t("commitment.graphSurface.visual.gap.legend.weakConnection"),
      t("commitment.graphSurface.visual.gap.legend.gapCandidate"),
    ],
    nodes: [
      {
        id: "left",
        x: 135,
        y: 110,
        tone: "accent",
        meta: t("commitment.graphSurface.visual.gap.left.meta"),
        title: "AI scientist / hypothesis",
        detail: t("commitment.graphSurface.visual.gap.left.detail"),
      },
      {
        id: "left-paper",
        x: 135,
        y: 245,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.common.representativeCandidate"),
        title: "AI Scientists for Hypothesis Generation",
        detail: t("commitment.graphSurface.visual.gap.rep.detail"),
      },
      {
        id: "right",
        x: 430,
        y: 110,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.gap.right.meta"),
        title: "robotic lab / automation",
        detail: t("commitment.graphSurface.visual.gap.right.detail"),
      },
      {
        id: "right-paper",
        x: 430,
        y: 245,
        tone: "plain",
        meta: t("commitment.graphSurface.visual.common.representativeCandidate"),
        title: "Robotic Labs for Closed Loop Science",
        detail: t("commitment.graphSurface.visual.gap.rep.detail"),
      },
      {
        id: "gap",
        x: 710,
        y: 110,
        tone: "panel",
        meta: t("commitment.graphSurface.visual.gap.candidate.meta"),
        title: t("commitment.graphSurface.visual.gap.candidate.title"),
        detail: t("commitment.graphSurface.visual.gap.candidate.detail"),
      },
      {
        id: "report",
        x: 710,
        y: 245,
        tone: "panel",
        meta: t("commitment.graphSurface.visual.gap.report.meta"),
        title: t("commitment.graphSurface.visual.gap.report.title"),
        detail: t("commitment.graphSurface.visual.gap.report.detail"),
      },
    ],
    edges: [
      {
        id: "left-right",
        source: "left",
        target: "right",
        label: t("commitment.graphSurface.visual.gap.edge.weakConnection"),
        tone: "weak",
        dashed: true,
      },
      {
        id: "left-left-paper",
        source: "left",
        target: "left-paper",
        label: t("commitment.graphSurface.visual.gap.edge.representative"),
        tone: "strong",
        labelOffset: { x: -52, y: 0 },
      },
      {
        id: "right-right-paper",
        source: "right",
        target: "right-paper",
        label: t("commitment.graphSurface.visual.gap.edge.representative"),
        tone: "strong",
        labelOffset: { x: 52, y: 0 },
      },
      {
        id: "right-gap",
        source: "right",
        target: "gap",
        label: t("commitment.graphSurface.visual.gap.edge.supportingEvidence"),
        tone: "strong",
      },
      {
        id: "right-paper-report",
        source: "right-paper",
        target: "report",
        label: t("commitment.graphSurface.visual.gap.edge.evidencePaper"),
        tone: "weak",
        dashed: true,
        labelOffset: { x: 0, y: 28 },
      },
      {
        id: "gap-report",
        source: "gap",
        target: "report",
        label: t("commitment.graphSurface.visual.gap.edge.report"),
        tone: "strong",
        labelOffset: { x: 52, y: 0 },
      },
    ],
  },
} satisfies Record<GraphSurfaceExplainerVariant, GraphSurfaceConfig>;

function splitVisualTitle(title: string) {
  const words = title.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 27 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines.slice(0, 3);
}

function visualNodeClass(tone: SurfaceVisualNode["tone"]) {
  if (tone === "accent") {
    return "fill-accent-soft";
  }
  if (tone === "panel") {
    return "fill-surface-panel";
  }
  return "fill-background";
}

function visualEdgeClass(edge: SurfaceVisualEdge) {
  return edge.tone === "strong" ? "stroke-accent opacity-90" : "stroke-border-strong opacity-45";
}

function SurfaceNetworkDiagram({ config }: { config: GraphSurfaceConfig }) {
  const nodesById = new Map(config.nodes.map((node) => [node.id, node] as const));

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {config.legend.map((item) => (
          <span
            key={item}
            className="border-border-subtle bg-background text-text-muted rounded-lh-sm border px-2.5 py-1 font-semibold"
          >
            {item}
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 860 330"
        role="img"
        className="border-border-subtle bg-background rounded-lh-md h-auto w-full border"
        data-testid={`${config.testId}-network`}
      >
        <title>{t(config.titleKey)}</title>
        <g>
          {config.edges.map((edge) => {
            const source = nodesById.get(edge.source);
            const target = nodesById.get(edge.target);
            if (!source || !target) {
              return null;
            }
            const labelX = (source.x + target.x) / 2 + (edge.labelOffset?.x ?? 0);
            const labelY = (source.y + target.y) / 2 + (edge.labelOffset?.y ?? -20);
            return (
              <g key={edge.id} data-testid={`${config.testId}-network-edge`}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className={visualEdgeClass(edge)}
                  strokeWidth={edge.tone === "strong" ? 3 : 2.2}
                  strokeDasharray={edge.dashed ? "9 7" : undefined}
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  className="fill-text-muted text-[12px] font-semibold"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}
        </g>
        <g data-testid={`${config.testId}-network-nodes`}>
          {config.nodes.map((node) => {
            const titleLines = splitVisualTitle(node.title);
            return (
              <g key={node.id} transform={`translate(${String(node.x)} ${String(node.y)})`}>
                <rect
                  x="-104"
                  y="-58"
                  width="208"
                  height="116"
                  rx="12"
                  className={`${visualNodeClass(node.tone)} stroke-border-strong`}
                  strokeWidth={node.tone === "accent" ? 2.4 : 1.5}
                />
                <text x="-88" y="-34" className="fill-accent text-[12px] font-bold tracking-wide">
                  {node.meta}
                </text>
                {titleLines.map((line, index) => (
                  <text
                    key={line}
                    x="-88"
                    y={-13 + index * 15}
                    className="fill-foreground text-[13px] font-semibold"
                  >
                    {line}
                  </text>
                ))}
                <text x="-88" y="42" className="fill-text-muted text-[11px] font-medium">
                  {node.detail}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export function GraphSurfaceExplainer(props: GraphSurfaceExplainerProps) {
  const config = GRAPH_SURFACE_CONFIG[props.variant];

  return (
    <section
      className="border-border-subtle bg-surface-panel rounded-lh-md border px-5 py-5"
      data-testid={config.testId}
    >
      <h2 className="text-foreground text-base font-semibold">{t(config.titleKey)}</h2>
      <p className="text-text-muted mt-2 text-sm leading-relaxed">{t(config.bodyKey)}</p>
      <SurfaceNetworkDiagram config={config} />
      <ol className="mt-4 grid gap-2 text-sm md:grid-cols-4" data-testid={`${config.testId}-flow`}>
        {config.steps.map((step, index) => (
          <li key={step.bodyKey} className="border-border-subtle rounded-lh-sm border px-3 py-3">
            <span className="text-accent text-lh-xs block font-semibold tracking-wide uppercase">
              {String(index + 1)}. {t(GRAPH_SURFACE_STEP_LABEL_KEYS[step.labelKey])}
            </span>
            <span className="text-foreground mt-2 block leading-relaxed">
              {t(step.bodyKey as Parameters<typeof t>[0])}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SearchGraphSurfaceExplainers() {
  return (
    <div className="mb-8 space-y-4">
      <GraphSurfaceExplainer variant="search" />
      <GraphSurfaceExplainer variant="representative" />
      <GraphSurfaceExplainer variant="terms" />
    </div>
  );
}
