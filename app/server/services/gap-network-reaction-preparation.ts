import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import type {
  GapHypothesis,
  GapHypothesisProposal,
  GapNetworkCluster,
  GapNetworkReactionPreparation,
  GapNetworkReport,
  GapPair,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import type { GapNarrativePayload } from "@/app/server/services/knowledge-map/interpret-gap-narrative";
import { t } from "@/app/i18n/message-access";

const MAX_REACTION_TITLE_CHARS = 30;
const MAX_REACTION_BODY_CHARS = 200;

function takeSnippet(text: string, maxChars: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }

  return trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}

function formatConceptList(labels: string[], maxItems: number): string {
  return labels
    .map((label) => label.trim())
    .filter((label) => label.length > 0)
    .slice(0, maxItems)
    .join(", ");
}

function rankGapPairs(left: GapPair, right: GapPair): number {
  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }
  return right.gapScore - left.gapScore;
}

function buildReaction(params: {
  id: string;
  title: string;
  body: string;
  preparedAt: string;
}): RouteAiComment {
  return {
    id: params.id,
    title: takeSnippet(params.title, MAX_REACTION_TITLE_CHARS),
    body: takeSnippet(params.body, MAX_REACTION_BODY_CHARS),
    chips: [],
    timestamp: params.preparedAt,
  };
}

function buildOverviewReaction(params: {
  query: string;
  report: GapNetworkReport;
  preparedAt: string;
}): RouteAiComment {
  const topGap = params.report.gapPairs.at(0) ?? null;
  const body = topGap
    ? t("gapNetwork.label.gap-network-reaction-preparation.overviewBody", {
        query: params.query,
        topGap: topGap.displayLabel,
        clusterCount: params.report.metrics.clusterCount,
        gapPairCount: params.report.metrics.gapPairCount,
      })
    : t("gapNetwork.label.gap-network-reaction-preparation.overviewBodyEmpty", {
        query: params.query,
        clusterCount: params.report.metrics.clusterCount,
      });

  return buildReaction({
    id: "gap-network-overview",
    title: t("gapNetwork.label.gap-network-reaction-preparation.overviewTitle"),
    body,
    preparedAt: params.preparedAt,
  });
}

function buildClusterReaction(params: {
  cluster: GapNetworkCluster;
  preparedAt: string;
}): RouteAiComment {
  const concepts = formatConceptList(
    params.cluster.concepts.map((concept) => concept.label),
    3,
  );
  const body =
    params.cluster.narrative && params.cluster.narrative.trim().length > 0
      ? params.cluster.narrative.trim()
      : [
          t("gapNetwork.label.gap-network-reaction-preparation.clusterBody", {
            clusterLabel: params.cluster.label,
            paperCount: params.cluster.paperCount,
          }),
          concepts
            ? t("gapNetwork.label.gap-network-reaction-preparation.clusterConcepts", {
                concepts,
              })
            : "",
        ]
          .filter(Boolean)
          .join(" ");

  return buildReaction({
    id: `gap-network-cluster-${params.cluster.id}`,
    title: t("gapNetwork.label.gap-network-reaction-preparation.clusterTitle", {
      clusterLabel: params.cluster.label,
    }),
    body,
    preparedAt: params.preparedAt,
  });
}

function resolveNearestGapLabel(params: {
  clusterId: string;
  gapPairs: GapPair[];
}): string | undefined {
  const nearest = params.gapPairs
    .filter(
      (gapPair) =>
        gapPair.leftClusterId === params.clusterId || gapPair.rightClusterId === params.clusterId,
    )
    .slice()
    .sort(rankGapPairs)
    .at(0);
  return nearest?.displayLabel;
}

function buildGapReaction(params: {
  gapPair: GapPair;
  hypothesis: GapHypothesis | null;
  proposals?: readonly GapHypothesisProposal[];
  metaQualitative?: string;
  preparedAt: string;
}): RouteAiComment {
  // body는 prepared reaction state — synced 카드(metadata.reactionPreparation 흐름)에서
  // 사용된다. overlay UI는 이 body를 직접 보여주지 않고 proposals/metaQualitative로
  // 재조립하지만, 동기화 surface가 자기 인스턴스에서 텍스트를 가질 수 있도록 채워둔다.
  // aspect:visible-explanation-sufficiency §3.2 200자 한도(takeSnippet) 안에서 닫는다.
  const proposalLine = (params.proposals ?? [])
    .slice(0, 3)
    .map((proposal) => `${proposal.hypothesis} (${proposal.grounding})`)
    .join(" / ");
  const fallbackHypothesisBody = params.hypothesis
    ? takeSnippet(params.hypothesis.description, 150)
    : "";
  const fallbackTemplated = t(
    "gapNetwork.label.gap-network-reaction-preparation.gapBodyFallbackTemplated",
    {
      leftLabel: params.gapPair.leftLabel,
      rightLabel: params.gapPair.rightLabel,
    },
  );
  const body = takeSnippet(
    proposalLine || params.metaQualitative || fallbackHypothesisBody || fallbackTemplated,
    MAX_REACTION_BODY_CHARS,
  );

  return buildReaction({
    id: `gap-network-gap-${params.gapPair.id}`,
    title: t("gapNetwork.label.gap-network-reaction-preparation.gapTitle", {
      leftLabel: params.gapPair.leftLabel,
      rightLabel: params.gapPair.rightLabel,
    }),
    body,
    preparedAt: params.preparedAt,
  });
}

function resolveRepresentativePaperTitles(params: {
  cluster: GapNetworkCluster;
  paperTitleById: Map<string, string>;
}): string[] | undefined {
  if (!params.cluster.topPaperIds || params.cluster.topPaperIds.length === 0) {
    return undefined;
  }
  const titles = params.cluster.topPaperIds
    .map((paperId) => params.paperTitleById.get(paperId))
    .filter((title): title is string => typeof title === "string" && title.trim().length > 0);
  return titles.length > 0 ? titles : undefined;
}

export function buildGapNetworkReactionPreparation(params: {
  query: string;
  report: GapNetworkReport;
  papers?: readonly PaperCore[];
  gapNarratives?: ReadonlyMap<string, GapNarrativePayload>;
  preparedAt?: string;
}): GapNetworkReactionPreparation {
  const preparedAt = params.preparedAt ?? new Date().toISOString();
  const hypothesisByGapPairId = new Map(
    params.report.insight.hypotheses.map(
      (hypothesis) => [hypothesis.gapPairId, hypothesis] as const,
    ),
  );
  const paperTitleById = new Map(
    (params.papers ?? []).map((paper) => [paper.paperId, paper.title] as const),
  );

  return {
    overviewReaction: buildOverviewReaction({
      query: params.query,
      report: params.report,
      preparedAt,
    }),
    clusterReactions: params.report.clusters.map((cluster) => ({
      clusterId: cluster.id,
      reaction: buildClusterReaction({
        cluster,
        preparedAt,
      }),
      nearestGapLabel: resolveNearestGapLabel({
        clusterId: cluster.id,
        gapPairs: params.report.gapPairs,
      }),
      representativePaperTitles: resolveRepresentativePaperTitles({
        cluster,
        paperTitleById,
      }),
      narrative: cluster.narrative,
    })),
    gapReactions: params.report.gapPairs.map((gapPair) => {
      const payload = params.gapNarratives?.get(gapPair.id);
      return {
        gapPairId: gapPair.id,
        reaction: buildGapReaction({
          gapPair,
          hypothesis: hypothesisByGapPairId.get(gapPair.id) ?? null,
          proposals: payload?.proposals,
          metaQualitative: payload?.metaQualitative,
          preparedAt,
        }),
        ...(payload?.metaQualitative ? { metaQualitative: payload.metaQualitative } : {}),
        ...(payload?.proposals && payload.proposals.length > 0
          ? { proposals: payload.proposals }
          : {}),
      };
    }),
    preparedAt,
  };
}
