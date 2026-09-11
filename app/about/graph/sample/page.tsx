// @promise promise:researcher-prose-promises-page
// @aspect aspect:user-facing-language-governance
// @aspect aspect:common-page-footer
// @check acceptance-check:researcher-prose-promises-page-graph-explainer
import type { Metadata } from "next";
import { AboutNav } from "@/app/about/about-nav";
import { SiteFooter } from "@/app/components/SiteFooter";
import {
  buildAiScienceSampleLayout,
  type AiScienceSampleCluster,
  type AiScienceSampleRelation,
} from "@/app/about/graph/sample/ai-for-science-sample-layout";
import { t } from "@/app/i18n/message-access";

export const metadata: Metadata = {
  title: t("commitment.graphSample.title"),
  description: t("commitment.graphSample.description"),
};

const REPRESENTATIVE_PAPER_IDS = new Set(["101", "303", "505"]);

function edgePathClass(relation: AiScienceSampleRelation, strength: "strong" | "weak") {
  const base = relation === "co-citation" ? "stroke-accent" : "stroke-border-strong";
  const opacity = strength === "strong" ? "opacity-95" : "opacity-45";
  return `${base} ${opacity}`;
}

function nodeFillClass(cluster: AiScienceSampleCluster) {
  if (cluster === "scientist") {
    return "fill-accent-soft";
  }
  if (cluster === "lab") {
    return "fill-surface-panel";
  }
  return "fill-background";
}

function splitTitle(title: string) {
  const words = title.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 28 && line) {
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

function edgeBasisLabel(edge: {
  relation: AiScienceSampleRelation;
  sharedCiters: number;
  sharedRefs: number;
}) {
  if (edge.relation === "co-citation") {
    return `${t("commitment.graphSample.relation.coCitation")} ${String(edge.sharedCiters)}`;
  }
  return `${t("commitment.graphSample.relation.refsShort")} ${String(edge.sharedRefs)}`;
}

function GraphSampleFigure() {
  const layout = buildAiScienceSampleLayout();
  const strongEdges = layout.edges.filter((edge) => edge.strength === "strong");
  const weakEdges = layout.edges.filter((edge) => edge.strength === "weak");

  return (
    <figure
      className="border-border-subtle bg-surface-panel rounded-lh-md border px-5 py-5"
      data-testid="commitment-graph-sample-figure"
      aria-labelledby="commitment-graph-sample-figure-title"
      aria-describedby="commitment-graph-sample-figure-caption"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-accent text-lh-xs font-semibold tracking-wide uppercase">
            ai for science sample
          </p>
          <h2
            id="commitment-graph-sample-figure-title"
            className="text-foreground mt-1 text-xl font-semibold"
          >
            {t("commitment.graphSample.figure.title")}
          </h2>
        </div>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
          <div>
            <dt className="text-text-muted">{t("commitment.graphSample.metric.papers")}</dt>
            <dd className="text-foreground font-semibold">6 papers</dd>
          </div>
          <div>
            <dt className="text-text-muted">{t("commitment.graphSample.metric.relations")}</dt>
            <dd className="text-foreground font-semibold">6 relations</dd>
          </div>
        </dl>
      </div>
      <div
        className="mb-3 flex flex-wrap gap-2 text-xs"
        data-testid="commitment-graph-sample-cluster-legend"
      >
        <span className="border-accent bg-accent-soft text-accent rounded-lh-sm border px-2.5 py-1 font-semibold">
          AI scientist / hypothesis
        </span>
        <span className="border-border-subtle bg-background text-foreground rounded-lh-sm border px-2.5 py-1 font-semibold">
          retrieval / benchmark bridge
        </span>
        <span className="border-border-strong bg-surface-panel text-foreground rounded-lh-sm border px-2.5 py-1 font-semibold">
          robotic lab / automation
        </span>
      </div>

      <svg
        viewBox="0 0 1120 640"
        role="img"
        className="border-border-subtle bg-background rounded-lh-md h-auto w-full border"
        aria-labelledby="commitment-graph-sample-svg-title commitment-graph-sample-svg-desc"
        data-testid="commitment-graph-sample-svg"
      >
        <title id="commitment-graph-sample-svg-title">
          {t("commitment.graphSample.figure.title")}
        </title>
        <desc id="commitment-graph-sample-svg-desc">
          {t("commitment.graphSample.figure.description")}
        </desc>

        <g data-testid="commitment-graph-sample-weak-edges">
          {weakEdges.map((edge) => (
            <g key={edge.id}>
              <line
                x1={edge.source.x}
                y1={edge.source.y}
                x2={edge.target.x}
                y2={edge.target.y}
                className={edgePathClass(edge.relation, edge.strength)}
                strokeWidth={2.2}
                strokeDasharray={edge.relation === "shared-refs" ? "8 7" : "4 7"}
              />
              <text
                x={edge.labelX}
                y={edge.labelY}
                textAnchor="middle"
                className="fill-text-muted text-[11px] font-medium"
              >
                {edgeBasisLabel(edge)}
              </text>
            </g>
          ))}
        </g>
        <g data-testid="commitment-graph-sample-strong-edges">
          {strongEdges.map((edge) => (
            <g key={edge.id}>
              <line
                x1={edge.source.x}
                y1={edge.source.y}
                x2={edge.target.x}
                y2={edge.target.y}
                className={edgePathClass(edge.relation, edge.strength)}
                strokeWidth={3.2}
                strokeDasharray={edge.relation === "shared-refs" ? "9 6" : undefined}
              />
              <text
                x={edge.labelX}
                y={edge.labelY}
                textAnchor="middle"
                className="fill-foreground text-[12px] font-semibold"
              >
                {edgeBasisLabel(edge)}
              </text>
            </g>
          ))}
        </g>
        <g data-testid="commitment-graph-sample-nodes">
          {layout.papers.map((paper) => {
            const titleLines = splitTitle(paper.title);
            const isRepresentative = REPRESENTATIVE_PAPER_IDS.has(paper.id);
            return (
              <g key={paper.id} transform={`translate(${String(paper.x)} ${String(paper.y)})`}>
                <rect
                  x="-112"
                  y="-62"
                  width="224"
                  height="124"
                  rx="12"
                  className={`${nodeFillClass(paper.cluster)} stroke-border-strong`}
                  strokeWidth={isRepresentative ? 2.8 : 1.5}
                />
                <text x="-94" y="-38" className="fill-accent text-[12px] font-bold tracking-wide">
                  {paper.label} · {paper.year}
                </text>
                {titleLines.map((line, index) => (
                  <text
                    key={line}
                    x="-94"
                    y={-18 + index * 15}
                    className="fill-foreground text-[13px] font-semibold"
                  >
                    {line}
                  </text>
                ))}
                <text x="-94" y="38" className="fill-text-muted text-[11px] font-medium">
                  {paper.keywords[0]}
                </text>
                <text x="-94" y="52" className="fill-text-muted text-[11px] font-medium">
                  {paper.keywords[1]}
                </text>
                <text x="96" y="52" textAnchor="end" className="fill-text-muted text-[11px]">
                  {t("commitment.graphSample.node.connection")} {paper.graphScore.toFixed(2)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <figcaption
        id="commitment-graph-sample-figure-caption"
        className="text-text-muted mt-3 text-sm leading-relaxed"
      >
        {t("commitment.graphSample.figure.caption")}
      </figcaption>
    </figure>
  );
}

export default function GraphSamplePage() {
  return (
    <main
      className="text-foreground h-full flex-1 overflow-y-auto"
      data-testid="commitment-graph-sample-page"
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="mb-10 max-w-3xl">
          <p className="text-accent text-lh-xs font-semibold tracking-wide uppercase">
            {t("commitment.graphSample.kicker")}
          </p>
          <h1 className="text-foreground font-display mt-2 text-3xl font-semibold tracking-tight">
            {t("commitment.graphSample.title")}
          </h1>
          <p className="text-text-muted mt-4 text-base leading-relaxed">
            {t("commitment.graphSample.lede")}
          </p>
        </header>
        <AboutNav current="graph" />

        <div className="space-y-6">
          <GraphSampleFigure />
        </div>
      </div>
      <SiteFooter testId="commitment-graph-sample-page-footer" />
    </main>
  );
}
