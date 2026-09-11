import type {
  GapNetworkCreateResearchRoutePayloadParams,
  GapNetworkResearchRoutePayload,
  GapNetworkReport,
} from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";
import { buildKnowledgeMapTitle } from "@/app/lib/knowledge-map-lens";
import type { LLMJudgmentUsageLedger } from "@/app/server/ai-generation/judgment";
import { GAP_NETWORK_CORE_EVIDENCE_VERSION } from "@/app/lib/gap-network-view-core";
import { analyzeGapNetwork } from "@/app/server/services/knowledge-map/analyze-gap-network";
import {
  buildExternalSignalsFromInlineAnalysis,
  buildKnowledgeMapBaseData,
  type KnowledgeMapBaseBuildInput,
} from "@/app/server/services/knowledge-map/base-builder";
import { interpretGapNetworkHypotheses } from "@/app/server/services/knowledge-map/interpret-gap-hypothesis";
import { interpretClusterNarratives } from "@/app/server/services/knowledge-map/interpret-cluster-narrative";
import { interpretGapNarratives } from "@/app/server/services/knowledge-map/interpret-gap-narrative";
import { interpretGapNetworkDomain } from "@/app/server/services/knowledge-map/interpret-gap-network-domain";
import {
  interpretGapNetworkContentNarrative,
  type GapNetworkContentNarrative,
} from "@/app/server/services/knowledge-map/interpret-gap-network-content-narrative";
import { buildGapNetworkReactionPreparation } from "@/app/server/services/gap-network-reaction-preparation";

type GapNetworkBuildInput = Pick<
  KnowledgeMapBaseBuildInput,
  "query" | "queryClauses" | "papers" | "graphSupport" | "createdBy"
> & {
  viewerPrincipalId: string;
  sourceSnapshotId: string;
  graphSupport?: KnowledgeMapBaseBuildInput["graphSupport"];
  citationLineageBreakdown?: { references: number; citations: number };
  usageLedger?: LLMJudgmentUsageLedger;
};

type GapNetworkBuilderDeps = Parameters<typeof buildKnowledgeMapBaseData>[1] & {
  interpretGapNetwork?: typeof interpretGapNetworkHypotheses;
  interpretClusterNarrative?: typeof interpretClusterNarratives;
  interpretGapNarrative?: typeof interpretGapNarratives;
  interpretDomain?: typeof interpretGapNetworkDomain;
  interpretContentNarrative?: typeof interpretGapNetworkContentNarrative;
};

type KnowledgeMapBaseData = Awaited<ReturnType<typeof buildKnowledgeMapBaseData>>;
type GapNetworkStructuralReport = ReturnType<typeof analyzeGapNetwork>;

interface GapNetworkStructuralState {
  papers: KnowledgeMapBaseData["papers"];
  base: KnowledgeMapBaseData["base"];
  clusters: KnowledgeMapBaseData["clusters"];
  analysis: GapNetworkStructuralReport;
  papersById: Map<string, KnowledgeMapBaseData["papers"][number]>;
}

interface GapNetworkEnrichmentState {
  gapNetworkReport: GapNetworkReport;
  narrativesByGapPairId: Awaited<ReturnType<typeof interpretGapNarratives>>;
  domainLabel: string | null;
  contentNarrative: GapNetworkContentNarrative;
}

type GapNetworkCoreView = GapNetworkResearchRoutePayload;

const EMPTY_GAP_NETWORK_CONTENT_NARRATIVE: GapNetworkContentNarrative = {
  overview: "",
  clusterParagraphs: [],
  gapInferenceParagraph: "",
};

export function buildE2SummaryMarkdown(params: {
  query: string;
  report: GapNetworkReport;
  domainLabel: string | null;
  contentNarrative: GapNetworkContentNarrative;
}) {
  const { report, domainLabel, contentNarrative } = params;
  const topGap = report.gapPairs.at(0);
  const lines: string[] = [
    `# ${buildKnowledgeMapTitle("E2", params.query, { domainLabel: domainLabel ?? undefined })}`,
    "",
  ];

  // 1) 분석된 분야 도입부 — intent-check:gap-domain-framing (Domain Framing)
  lines.push(t("gapNetwork.label.gap-network-builder.section.domain"));
  lines.push("");
  if (domainLabel) {
    lines.push(t("gapNetwork.label.gap-network-builder.domain.intro", { domainLabel }));
    lines.push("");
  }
  if (contentNarrative.overview) {
    lines.push(contentNarrative.overview);
  } else {
    lines.push(
      t("communityMap.label.community-matrix-builder", { count: report.metrics.clusterCount }),
    );
  }
  lines.push("");

  // 2) 클러스터 배경·차이 — intent-check:gap-cluster-differentiation (Cluster Differentiation)
  lines.push(t("gapNetwork.label.gap-network-builder.section.clusters"));
  lines.push("");
  const paragraphByClusterId = new Map(
    contentNarrative.clusterParagraphs.map((entry) => [entry.clusterId, entry.paragraph]),
  );
  for (const cluster of report.clusters) {
    const paragraph = paragraphByClusterId.get(cluster.id);
    lines.push(
      t("gapNetwork.label.gap-network-builder.cluster.heading", {
        clusterLabel: cluster.label,
        paperCount: cluster.paperCount,
      }),
    );
    lines.push("");
    if (paragraph) {
      lines.push(paragraph);
    } else if (cluster.narrative) {
      lines.push(cluster.narrative);
    } else {
      const concepts = cluster.concepts
        .slice(0, 4)
        .map((concept) => concept.label)
        .join(", ");
      lines.push(
        concepts.length > 0
          ? t("gapNetwork.label.gap-network-builder.cluster.fallbackWithConcepts", {
              clusterLabel: cluster.label,
              concepts,
            })
          : t("gapNetwork.label.gap-network-builder.cluster.fallbackPlain", {
              clusterLabel: cluster.label,
            }),
      );
    }
    lines.push("");
  }

  // 3) 공백 추론 방법 — intent-check:gap-inference-transparency (Gap Inference Transparency)
  lines.push(t("gapNetwork.label.gap-network-builder.section.gapInference"));
  lines.push("");
  if (contentNarrative.gapInferenceParagraph) {
    lines.push(contentNarrative.gapInferenceParagraph);
  } else {
    lines.push(t("gapNetwork.label.gap-network-builder.gapInference.fallback"));
  }
  lines.push("");

  // 메트릭 footer (참고용 — 본문 narrative가 진짜 노출이지만 수치 그라운드 보존)
  lines.push("---");
  lines.push("");
  const metricLines = [
    t("communityMap.label.community-matrix-builder", { count: report.metrics.clusterCount }),
    t("gapNetwork.label.gap-network-builder", { count: report.metrics.totalPaperCount }),
    t("gapNetwork.label.gap-network-builder.2", { count: report.metrics.totalEdgeCount }),
    t("gapNetwork.label.gap-network-builder.3", { count: report.metrics.gapPairCount }),
    topGap ? t("gapNetwork.label.gap-network-builder.4", { topGap: topGap.displayLabel }) : null,
  ].filter((line): line is string => line !== null);
  lines.push(...metricLines);

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export async function buildGapNetworkViewPayload(
  input: GapNetworkBuildInput,
  deps: GapNetworkBuilderDeps = {},
): Promise<GapNetworkCreateResearchRoutePayloadParams> {
  const structuralState = await buildGapNetworkStructuralState(input, deps);
  const { gapNetworkReport, narrativesByGapPairId, domainLabel, contentNarrative } =
    await enrichGapNetworkReport({
      input,
      deps,
      structuralState,
    });

  const reactionPreparation = buildGapNetworkReactionPreparation({
    query: input.query,
    report: gapNetworkReport,
    papers: structuralState.papers,
    gapNarratives: narrativesByGapPairId,
  });

  const updatedAt = new Date().toISOString();
  return {
    viewerPrincipalId: input.viewerPrincipalId,
    type: "gap_network",
    title: buildKnowledgeMapTitle("E2", input.query, {
      domainLabel: domainLabel ?? undefined,
    }),
    content: buildE2SummaryMarkdown({
      query: input.query,
      report: gapNetworkReport,
      domainLabel,
      contentNarrative,
    }),
    createdBy: input.createdBy,
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: input.sourceSnapshotId,
      query: input.query,
      papers: structuralState.papers,
      gapNetworkReport,
      ...(input.graphSupport ? { sourceGraphSupport: input.graphSupport } : {}),
      reactionPreparation,
      gapNetworkBuild: {
        core: "ready",
        enrichment: "ready",
        coreEvidence: GAP_NETWORK_CORE_EVIDENCE_VERSION,
        phase: "complete",
        updatedAt,
      },
      ...(input.citationLineageBreakdown
        ? { sourceCitationLineageBreakdown: input.citationLineageBreakdown }
        : {}),
    },
    refs: [input.sourceSnapshotId],
  };
}

export async function buildGapNetworkEnrichedViewPayloadFromCore(
  document: GapNetworkCoreView,
  deps: GapNetworkBuilderDeps = {},
  options?: { usageLedger?: LLMJudgmentUsageLedger },
): Promise<GapNetworkCreateResearchRoutePayloadParams> {
  const papers = document.metadata.papers;
  const currentReport = document.metadata.gapNetworkReport;
  const papersById = new Map(papers.map((paper) => [paper.paperId, paper] as const));
  const clusterLabels = Object.fromEntries(
    currentReport.clusters.map((cluster) => [cluster.id, cluster.label] as const),
  );
  const clusterSeeds = currentReport.clusters.map((cluster) => ({
    id: cluster.id,
    label: cluster.label,
    paperIds: Array.from(
      new Set([
        ...(cluster.topPaperIds ?? []),
        ...cluster.concepts.flatMap((concept) => concept.supportingPaperIds ?? []),
      ]),
    ),
  }));

  const { gapNetworkReport, narrativesByGapPairId, domainLabel, contentNarrative } =
    await enrichStoredGapNetworkReport({
      query: document.metadata.query,
      report: currentReport,
      papers,
      papersById,
      clusterLabels,
      clusters: clusterSeeds,
      deps,
      usageLedger: options?.usageLedger,
    });

  const reactionPreparation = buildGapNetworkReactionPreparation({
    query: document.metadata.query,
    report: gapNetworkReport,
    papers,
    gapNarratives: narrativesByGapPairId,
  });

  const updatedAt = new Date().toISOString();
  return {
    viewerPrincipalId: document.viewerPrincipalId,
    type: "gap_network",
    title: buildKnowledgeMapTitle("E2", document.metadata.query, {
      domainLabel: domainLabel ?? undefined,
    }),
    content: buildE2SummaryMarkdown({
      query: document.metadata.query,
      report: gapNetworkReport,
      domainLabel,
      contentNarrative,
    }),
    createdBy: document.createdBy,
    metadata: {
      ...document.metadata,
      gapNetworkReport,
      reactionPreparation,
      gapNetworkBuild: {
        ...document.metadata.gapNetworkBuild,
        core: "ready",
        enrichment: "ready",
        coreEvidence:
          document.metadata.gapNetworkBuild?.coreEvidence ?? GAP_NETWORK_CORE_EVIDENCE_VERSION,
        phase: "complete",
        updatedAt,
        ...(document.metadata.gapNetworkBuild?.phaseDurationsMs
          ? { phaseDurationsMs: document.metadata.gapNetworkBuild.phaseDurationsMs }
          : {}),
      },
    },
    refs: document.refs,
  };
}

export async function buildGapNetworkCoreViewPayload(
  input: GapNetworkBuildInput,
  deps: GapNetworkBuilderDeps = {},
): Promise<GapNetworkCreateResearchRoutePayloadParams> {
  const structuralState = await buildGapNetworkStructuralState(input, deps);
  const gapNetworkReport = buildGapNetworkCoreReport(structuralState);
  const reactionPreparation = buildGapNetworkReactionPreparation({
    query: input.query,
    report: gapNetworkReport,
    papers: structuralState.papers,
    gapNarratives: new Map(),
  });
  const updatedAt = new Date().toISOString();

  return {
    viewerPrincipalId: input.viewerPrincipalId,
    type: "gap_network",
    title: buildKnowledgeMapTitle("E2", input.query),
    content: buildE2SummaryMarkdown({
      query: input.query,
      report: gapNetworkReport,
      domainLabel: null,
      contentNarrative: EMPTY_GAP_NETWORK_CONTENT_NARRATIVE,
    }),
    createdBy: input.createdBy,
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: input.sourceSnapshotId,
      query: input.query,
      papers: structuralState.papers,
      gapNetworkReport,
      ...(input.graphSupport ? { sourceGraphSupport: input.graphSupport } : {}),
      reactionPreparation,
      gapNetworkBuild: {
        core: "ready",
        enrichment: "pending",
        coreEvidence: GAP_NETWORK_CORE_EVIDENCE_VERSION,
        phase: "enrichment",
        updatedAt,
      },
      ...(input.citationLineageBreakdown
        ? { sourceCitationLineageBreakdown: input.citationLineageBreakdown }
        : {}),
    },
    refs: [input.sourceSnapshotId],
  };
}

async function buildGapNetworkStructuralState(
  input: GapNetworkBuildInput,
  deps: GapNetworkBuilderDeps,
): Promise<GapNetworkStructuralState> {
  const { papers, base, clusters } = await buildKnowledgeMapBaseData(
    {
      query: input.query,
      queryClauses: input.queryClauses,
      papers: input.papers,
      graphSupport: input.graphSupport,
    },
    deps,
  );

  const analysis = analyzeGapNetwork({
    query: input.query,
    queryClauses: input.queryClauses,
    papers,
    citationEdges: base.citationEdges,
    semanticEdges: base.semanticEdges,
    graphSupportEdges: base.graphSupportEdges,
    clusterLabels: base.clusterLabels,
    clusters,
    externalSignals: buildExternalSignalsFromInlineAnalysis(input.papers),
  });

  const papersById = new Map(papers.map((paper) => [paper.paperId, paper] as const));

  return {
    papers,
    base,
    clusters,
    analysis,
    papersById,
  };
}

function buildGapNetworkCoreReport(structuralState: GapNetworkStructuralState): GapNetworkReport {
  return {
    ...structuralState.analysis,
    insight: { hypotheses: [] },
  };
}

async function enrichGapNetworkReport(params: {
  input: GapNetworkBuildInput;
  deps: GapNetworkBuilderDeps;
  structuralState: GapNetworkStructuralState;
}): Promise<GapNetworkEnrichmentState> {
  const { deps, input, structuralState } = params;
  const { analysis, base, clusters, papers, papersById } = structuralState;
  const [insight, narrativesByClusterId] = await Promise.all([
    (deps.interpretGapNetwork ?? interpretGapNetworkHypotheses)({
      query: input.query,
      report: analysis,
      papers,
      clusterLabels: base.clusterLabels,
      clusters,
      usageLedger: input.usageLedger,
    }),
    (deps.interpretClusterNarrative ?? interpretClusterNarratives)({
      query: input.query,
      clusters: analysis.clusters,
      papersById,
      usageLedger: input.usageLedger,
    }),
  ]);
  const clustersById = new Map(analysis.clusters.map((cluster) => [cluster.id, cluster] as const));
  // NOTE: hypothesisByGapPairId는 의도적으로 interpretGapNarratives에 넘기지 않는다.
  // interpretGapNetworkHypotheses가 fallback으로 빠지면 모든 hypothesis.description이
  // 같은 i18n 템플릿으로 채워져 downstream LLM/fallback을 오염시킨다 (reality signal
  // 2026-04-30, prior signal record). 본 서비스는 gapPair-specific
  // facts(매개 개념·left/rightConcepts·대표 논문)만 입력으로 받아 per-gap 다양성을 만든다.
  const baseGapNetworkReport: GapNetworkReport = {
    ...analysis,
    clusters: analysis.clusters.map((cluster) => {
      const narrative = narrativesByClusterId.get(cluster.id);
      return narrative ? { ...cluster, narrative } : cluster;
    }),
    insight,
  };
  const gapNarrativePromise = (deps.interpretGapNarrative ?? interpretGapNarratives)({
    query: input.query,
    gapPairs: analysis.gapPairs,
    clustersById,
    papersById,
    usageLedger: input.usageLedger,
  });

  const domainAndContentPromise = (async () => {
    // Domain framing first, then content narrative — overview/cluster paragraphs cite
    // the domain explicitly, so we feed the derived label into the narrative prompt
    // (promise:gap-report-prepared-reaction AC3 / intent-check:gap-domain-framing..03).
    const domainLabelRaw = await (deps.interpretDomain ?? interpretGapNetworkDomain)({
      query: input.query,
      clusters: baseGapNetworkReport.clusters,
      usageLedger: input.usageLedger,
    });
    const contentNarrative = await (
      deps.interpretContentNarrative ?? interpretGapNetworkContentNarrative
    )({
      query: input.query,
      domainLabel: domainLabelRaw,
      clusters: baseGapNetworkReport.clusters,
      gapPairs: baseGapNetworkReport.gapPairs,
      usageLedger: input.usageLedger,
    });
    return { domainLabelRaw, contentNarrative };
  })();

  const [narrativesByGapPairId, { domainLabelRaw, contentNarrative }] = await Promise.all([
    gapNarrativePromise,
    domainAndContentPromise,
  ]);

  // Persist domainLabel + contentNarrative on the report so the UI can render them
  // (promise:gap-report-prepared-reaction AC4 — sticky graph + scrollable report body page composition).
  const gapNetworkReport: GapNetworkReport = {
    ...baseGapNetworkReport,
    ...(domainLabelRaw ? { domainLabel: domainLabelRaw } : {}),
    contentNarrative,
  };

  return {
    gapNetworkReport,
    narrativesByGapPairId,
    domainLabel: domainLabelRaw,
    contentNarrative,
  };
}

async function enrichStoredGapNetworkReport(params: {
  query: string;
  report: GapNetworkReport;
  papers: GapNetworkCoreView["metadata"]["papers"];
  papersById: Map<string, GapNetworkCoreView["metadata"]["papers"][number]>;
  clusterLabels: Record<string, string>;
  clusters: Array<{ id: string; label: string; paperIds: string[] }>;
  deps: GapNetworkBuilderDeps;
  usageLedger?: LLMJudgmentUsageLedger;
}): Promise<GapNetworkEnrichmentState> {
  const { deps, query, report, papers, papersById, clusterLabels, clusters, usageLedger } = params;
  const [insight, narrativesByClusterId] = await Promise.all([
    (deps.interpretGapNetwork ?? interpretGapNetworkHypotheses)({
      query,
      report,
      papers,
      clusterLabels,
      clusters,
      usageLedger,
    }),
    (deps.interpretClusterNarrative ?? interpretClusterNarratives)({
      query,
      clusters: report.clusters,
      papersById,
      usageLedger,
    }),
  ]);
  const clustersById = new Map(report.clusters.map((cluster) => [cluster.id, cluster] as const));
  const baseGapNetworkReport: GapNetworkReport = {
    ...report,
    clusters: report.clusters.map((cluster) => {
      const narrative = narrativesByClusterId.get(cluster.id);
      return narrative ? { ...cluster, narrative } : cluster;
    }),
    insight,
  };
  const gapNarrativePromise = (deps.interpretGapNarrative ?? interpretGapNarratives)({
    query,
    gapPairs: report.gapPairs,
    clustersById,
    papersById,
    usageLedger,
  });

  const domainAndContentPromise = (async () => {
    const domainLabelRaw = await (deps.interpretDomain ?? interpretGapNetworkDomain)({
      query,
      clusters: baseGapNetworkReport.clusters,
      usageLedger,
    });
    const contentNarrative = await (
      deps.interpretContentNarrative ?? interpretGapNetworkContentNarrative
    )({
      query,
      domainLabel: domainLabelRaw,
      clusters: baseGapNetworkReport.clusters,
      gapPairs: baseGapNetworkReport.gapPairs,
      usageLedger,
    });
    return { domainLabelRaw, contentNarrative };
  })();

  const [narrativesByGapPairId, { domainLabelRaw, contentNarrative }] = await Promise.all([
    gapNarrativePromise,
    domainAndContentPromise,
  ]);

  return {
    gapNetworkReport: {
      ...baseGapNetworkReport,
      ...(domainLabelRaw ? { domainLabel: domainLabelRaw } : {}),
      contentNarrative,
    },
    narrativesByGapPairId,
    domainLabel: domainLabelRaw,
    contentNarrative,
  };
}
