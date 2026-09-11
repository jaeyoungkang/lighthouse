"use client";

// @promise promise:gap-overlay-decision-evidence
// @promise promise:gap-led-next-search
// @promise promise:gap-network-detection-from-search
// @promise promise:gap-report-prepared-reaction
// @aspect aspect:ai-generated-content-feedback
// @aspect aspect:immediate-navigation
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:gap-led-next-search-seed-launches-search
// @check acceptance-check:gap-led-next-search-seed-traces-to-papers
// @check acceptance-check:gap-led-next-search-click-feedback

import { Fragment, type MouseEvent } from "react";
import type {
  GapHypothesis,
  GapHypothesisProposal,
  GapNetworkCluster,
  GapNetworkClusterReaction,
  GapPair,
  GraphPaperSnapshot,
} from "@/app/domain/research-route-payload";
import { AiContentFeedback } from "@/app/components/ai-content-feedback";
import { SearchNavigationButtonContent } from "@/app/components/research/SearchNavigationButtonContent";
import {
  type PendingSearchFollowupActivation,
  useSearchFollowupActivation,
} from "@/app/components/research/search-followup-activation";
import { t } from "@/app/i18n/message-access";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import { buildSearchTermFollowupRoute } from "../search-view-followup-handlers";
import type { FollowupActivationEvent } from "../search-view.helpers";

export type GapNetworkSeedSearchHandler = (
  seed: string,
  seedKind: "cluster" | "concept" | "gap",
  event?: FollowupActivationEvent,
) => void;

export interface FocusedSelectionSummaryData {
  kind: "cluster" | "gap";
  kicker?: string;
  meta: string;
  body?: string;
  actionsEnabled?: boolean;
  feedbackEnabled?: boolean;
  representativeTitles?: string[];
  representativeTitlesHeading?: string;
  proposals?: GapHypothesisProposal[];
  seedTerm: string;
  selectedConcept?: {
    label: string;
    supportingPaperTitles: string[];
  };
}

export type FocusedSelectionNarrativeStatus = "ready" | "pending" | "degraded";

function isGapSeedSearchActivation(
  pending: PendingSearchFollowupActivation | null,
  targetRoute: string,
): boolean {
  return pending?.route === targetRoute;
}

function buildFallbackClusterDescription(params: { cluster: GapNetworkCluster }): string {
  const concepts = params.cluster.concepts
    .slice(0, 3)
    .map((concept) => concept.label.trim())
    .filter((label) => label.length > 0)
    .join(", ");

  return [
    t("gapNetwork.label.gap-network-report.clusterBody", {
      clusterLabel: params.cluster.label,
      paperCount: params.cluster.paperCount,
    }),
    concepts ? t("gapNetwork.label.gap-network-report.clusterConcepts", { concepts }) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildClusterReactionLookup(
  clusterReactions: readonly GapNetworkClusterReaction[],
): Map<
  string,
  {
    body: string;
    nearestGapLabel?: string;
    representativePaperTitles?: string[];
    narrative?: string;
  }
> {
  return new Map(
    clusterReactions.map(
      (entry) =>
        [
          entry.clusterId,
          {
            body: entry.reaction.body,
            nearestGapLabel: entry.nearestGapLabel,
            representativePaperTitles: entry.representativePaperTitles,
            narrative: entry.narrative,
          },
        ] as const,
    ),
  );
}

function enrichClusterBody(params: {
  baseBody: string;
  cluster: GapNetworkCluster;
  representativeTitles?: string[];
}): string {
  const concepts = params.cluster.concepts
    .slice(0, 4)
    .map((concept) => concept.label.trim())
    .filter((label) => label.length > 0);
  const representativeTitles = params.representativeTitles?.slice(0, 2) ?? [];

  if (concepts.length > 0 && representativeTitles.length > 0) {
    return t("gapNetwork.label.gap-network-report.focusedClusterBodyWithConceptsAndPapers", {
      body: params.baseBody,
      concepts: concepts.join(", "),
      papers: representativeTitles.join(" · "),
    });
  }

  if (concepts.length > 0) {
    return t("gapNetwork.label.gap-network-report.focusedClusterBodyWithConcepts", {
      body: params.baseBody,
      concepts: concepts.join(", "),
    });
  }

  if (representativeTitles.length > 0) {
    return t("gapNetwork.label.gap-network-report.focusedClusterBodyWithPapers", {
      body: params.baseBody,
      papers: representativeTitles.join(" · "),
    });
  }

  return params.baseBody;
}

function buildFallbackGapMeta(gapPair: GapPair): string {
  return t("gapNetwork.label.gap-network-report.focusedGapMetaFallback", {
    leftLabel: gapPair.leftLabel,
    rightLabel: gapPair.rightLabel,
  });
}

function buildFallbackGapProposal(params: {
  gapPair: GapPair;
  hypothesis: GapHypothesis | null;
}): GapHypothesisProposal {
  const hypothesis =
    params.hypothesis?.description ??
    t("gapNetwork.label.gap-network-report.focusedGapFallbackHypothesis", {
      leftLabel: params.gapPair.leftLabel,
      rightLabel: params.gapPair.rightLabel,
    });
  const bridge = params.gapPair.bridgeConcepts[0];
  const grounding = bridge
    ? t("gapNetwork.label.gap-network-report.focusedGapFallbackGroundingWithBridge", {
        bridge,
      })
    : t("gapNetwork.label.gap-network-report.focusedGapFallbackGroundingNoBridge", {
        leftLabel: params.gapPair.leftLabel,
        rightLabel: params.gapPair.rightLabel,
      });
  return { hypothesis, grounding };
}

export interface PreparedGapReactionEntry {
  body: string;
  metaQualitative?: string;
  proposals?: GapHypothesisProposal[];
}

export function buildGapReactionLookup(
  gapReactions: readonly {
    gapPairId: string;
    reaction: { body: string };
    metaQualitative?: string;
    proposals?: GapHypothesisProposal[];
  }[],
): Map<string, PreparedGapReactionEntry> {
  return new Map(
    gapReactions.map(
      (entry) =>
        [
          entry.gapPairId,
          {
            body: entry.reaction.body,
            metaQualitative: entry.metaQualitative,
            proposals: entry.proposals,
          },
        ] as const,
    ),
  );
}

function buildUnavailableFocusedSummary(params: {
  kind: "cluster" | "gap";
  status: Exclude<FocusedSelectionNarrativeStatus, "ready">;
  seedTerm: string;
}): FocusedSelectionSummaryData {
  const isPending = params.status === "pending";
  return {
    kind: params.kind,
    kicker:
      params.kind === "cluster"
        ? t("gapNetwork.label.gap-network-report.focusedClusterKicker")
        : undefined,
    meta: isPending
      ? t("gapNetwork.label.gap-network-report.focusedSelectionPendingMeta")
      : t("gapNetwork.label.gap-network-report.focusedSelectionDegradedMeta"),
    body: isPending
      ? t(
          params.kind === "cluster"
            ? "gapNetwork.label.gap-network-report.focusedClusterPendingBody"
            : "gapNetwork.label.gap-network-report.focusedGapPendingBody",
        )
      : t(
          params.kind === "cluster"
            ? "gapNetwork.label.gap-network-report.focusedClusterDegradedBody"
            : "gapNetwork.label.gap-network-report.focusedGapDegradedBody",
        ),
    actionsEnabled: false,
    feedbackEnabled: false,
    seedTerm: params.seedTerm,
  };
}

function buildFocusedGapSummary(params: {
  focusedGapPair: GapPair;
  gapReactionById: Map<string, PreparedGapReactionEntry>;
  hypothesisByGapPairId: Map<string, GapHypothesis>;
  narrativeStatus: FocusedSelectionNarrativeStatus;
}): FocusedSelectionSummaryData {
  if (params.narrativeStatus !== "ready") {
    return buildUnavailableFocusedSummary({
      kind: "gap",
      status: params.narrativeStatus,
      seedTerm: params.focusedGapPair.displayLabel,
    });
  }

  const preparedGapReaction = params.gapReactionById.get(params.focusedGapPair.id);
  const hypothesis = params.hypothesisByGapPairId.get(params.focusedGapPair.id) ?? null;

  const meta =
    preparedGapReaction?.metaQualitative && preparedGapReaction.metaQualitative.trim().length > 0
      ? preparedGapReaction.metaQualitative.trim()
      : buildFallbackGapMeta(params.focusedGapPair);
  const proposals =
    preparedGapReaction?.proposals && preparedGapReaction.proposals.length > 0
      ? preparedGapReaction.proposals.slice(0, 3)
      : [buildFallbackGapProposal({ gapPair: params.focusedGapPair, hypothesis })];

  return {
    kind: "gap",
    meta,
    proposals,
    actionsEnabled: true,
    feedbackEnabled: true,
    seedTerm: params.focusedGapPair.displayLabel,
  };
}

function buildSelectedConcept(params: {
  focusedCluster: GapNetworkCluster;
  selectedConceptId?: string | null;
  papers?: readonly GraphPaperSnapshot[];
}): FocusedSelectionSummaryData["selectedConcept"] {
  if (!params.selectedConceptId) return undefined;
  const concept = params.focusedCluster.concepts.find(
    (entry) => entry.id === params.selectedConceptId,
  );
  if (!concept) return undefined;
  const supportingIds = concept.supportingPaperIds ?? [];
  if (supportingIds.length === 0) {
    return { label: concept.label, supportingPaperTitles: [] };
  }
  const paperById = new Map((params.papers ?? []).map((paper) => [paper.paperId, paper]));
  const supportingPaperTitles = supportingIds
    .map((paperId) => paperById.get(paperId)?.title.trim())
    .filter((title): title is string => Boolean(title))
    .slice(0, 3);
  return { label: concept.label, supportingPaperTitles };
}

function buildFocusedClusterSummary(params: {
  clusterReactionById: Map<
    string,
    {
      body: string;
      nearestGapLabel?: string;
      representativePaperTitles?: string[];
      narrative?: string;
    }
  >;
  focusedCluster: GapNetworkCluster;
  narrativeStatus: FocusedSelectionNarrativeStatus;
  selectedConceptId?: string | null;
  papers?: readonly GraphPaperSnapshot[];
}): FocusedSelectionSummaryData {
  if (params.narrativeStatus !== "ready") {
    return buildUnavailableFocusedSummary({
      kind: "cluster",
      status: params.narrativeStatus,
      seedTerm: params.focusedCluster.label,
    });
  }

  const preparedClusterReaction = params.clusterReactionById.get(params.focusedCluster.id);
  const narrative =
    preparedClusterReaction?.narrative ?? params.focusedCluster.narrative ?? undefined;

  const representativeTitles =
    preparedClusterReaction?.representativePaperTitles &&
    preparedClusterReaction.representativePaperTitles.length > 0
      ? preparedClusterReaction.representativePaperTitles.slice(0, 2)
      : undefined;
  const body = enrichClusterBody({
    baseBody:
      narrative?.trim() ||
      preparedClusterReaction?.body ||
      buildFallbackClusterDescription({ cluster: params.focusedCluster }),
    cluster: params.focusedCluster,
    representativeTitles,
  });
  const selectedConcept = buildSelectedConcept({
    focusedCluster: params.focusedCluster,
    selectedConceptId: params.selectedConceptId,
    papers: params.papers,
  });

  return {
    kind: "cluster",
    kicker: t("gapNetwork.label.gap-network-report.focusedClusterKicker"),
    meta: t("gapNetwork.label.gap-network-report.focusedClusterMeta", {
      paperCount: params.focusedCluster.paperCount,
    }),
    body,
    actionsEnabled: true,
    feedbackEnabled: false,
    representativeTitles,
    representativeTitlesHeading: representativeTitles
      ? t("gapNetwork.label.gap-network-report.focusedClusterRepresentativePapers")
      : undefined,
    seedTerm: selectedConcept?.label ?? params.focusedCluster.label,
    selectedConcept,
  };
}

export function buildFocusedSelectionSummary(params: {
  clusterReactionById: Map<
    string,
    {
      body: string;
      nearestGapLabel?: string;
      representativePaperTitles?: string[];
      narrative?: string;
    }
  >;
  focusedCluster: GapNetworkCluster | null;
  focusedGapPair: GapPair | null;
  gapReactionById: Map<string, PreparedGapReactionEntry>;
  hypothesisByGapPairId: Map<string, GapHypothesis>;
  narrativeStatus?: FocusedSelectionNarrativeStatus;
  selectedConceptId?: string | null;
  papers?: readonly GraphPaperSnapshot[];
}): FocusedSelectionSummaryData | null {
  const narrativeStatus = params.narrativeStatus ?? "ready";
  if (params.focusedGapPair) {
    return buildFocusedGapSummary({
      focusedGapPair: params.focusedGapPair,
      gapReactionById: params.gapReactionById,
      hypothesisByGapPairId: params.hypothesisByGapPairId,
      narrativeStatus,
    });
  }

  if (!params.focusedCluster) {
    return null;
  }

  return buildFocusedClusterSummary({
    clusterReactionById: params.clusterReactionById,
    focusedCluster: params.focusedCluster,
    narrativeStatus,
    selectedConceptId: params.selectedConceptId,
    papers: params.papers,
  });
}

export function GapNetworkFocusedSelectionSummary({
  summary,
  documentId = null,
  onUseSeedAsSearch,
}: {
  summary: FocusedSelectionSummaryData;
  documentId?: string | null;
  onUseSeedAsSearch?: GapNetworkSeedSearchHandler;
}) {
  const { pending } = useSearchFollowupActivation();
  const libraryContextAvailable = useLibraryAvailabilityStore((state) => state.available);
  const feedbackBody =
    summary.body ??
    summary.proposals
      ?.map((proposal) => `${proposal.hypothesis} ${proposal.grounding}`)
      .join("\n") ??
    summary.meta;
  const seedKind: "cluster" | "concept" | "gap" = summary.selectedConcept
    ? "concept"
    : summary.kind;
  const actionsEnabled = summary.actionsEnabled ?? true;
  const feedbackEnabled = summary.feedbackEnabled ?? summary.kind === "gap";
  const searchTargetRouteResult = buildSearchTermFollowupRoute({
    query: summary.seedTerm,
    libraryContextAvailable,
  });
  const searchTargetRoute = searchTargetRouteResult.ok ? searchTargetRouteResult.route : "";
  const isSearchNavigationPending = isGapSeedSearchActivation(pending, searchTargetRoute);
  return (
    <section
      aria-label="focused graph selection explanation"
      className="lh-panel rounded-lh-2xl w-full max-w-2xl px-4 py-3 transition-all duration-200"
      data-selection-kind={summary.kind}
      data-testid="focused-selection-summary"
    >
      {summary.kicker ? <p className="lh-kicker">{summary.kicker}</p> : null}
      {summary.kicker ? "\n" : null}
      <p className="lh-type-metadata lh-tone-secondary" data-overlay-slot="meta">
        {summary.meta}
      </p>
      {"\n"}
      {summary.body ? (
        <>
          <p className="lh-type-reading-body lh-tone-primary">{summary.body}</p>
          {"\n"}
        </>
      ) : null}
      {summary.proposals && summary.proposals.length > 0 ? (
        <ol className="space-y-2" data-overlay-slot="proposals">
          {summary.proposals.map((proposal, index) => (
            <Fragment key={`${String(index)}-${proposal.hypothesis.slice(0, 20)}`}>
              <li
                className="lh-type-reading-body lh-tone-primary"
                data-overlay-slot-item="proposal"
              >
                <span className="font-semibold">{proposal.hypothesis}</span>
                <span className="lh-tone-secondary ml-1">— {proposal.grounding}</span>
              </li>
              {"\n"}
            </Fragment>
          ))}
        </ol>
      ) : null}
      {summary.representativeTitles && summary.representativeTitles.length > 0 ? (
        <p className="lh-type-metadata lh-tone-secondary" data-overlay-slot="representative-papers">
          <span className="font-semibold">{summary.representativeTitlesHeading}:</span>{" "}
          {summary.representativeTitles.join(" · ")}
        </p>
      ) : null}
      {summary.selectedConcept && summary.selectedConcept.supportingPaperTitles.length > 0 ? (
        <p
          className="lh-type-metadata lh-tone-secondary"
          data-overlay-slot="selected-concept-papers"
          data-selected-concept-label={summary.selectedConcept.label}
        >
          <span className="font-semibold">
            {t("gapNetwork.label.gap-network-report.selectedConcept.supportingPapersHeading", {
              label: summary.selectedConcept.label,
            })}
            :
          </span>{" "}
          {summary.selectedConcept.supportingPaperTitles.join(" · ")}
        </p>
      ) : null}
      {onUseSeedAsSearch && actionsEnabled ? (
        <button
          type="button"
          className="lh-type-control-label lh-tone-control border-border bg-surface-panel/40 hover:bg-surface-panel-strong/70 focus-visible:ring-ring/60 rounded-lh-sm mt-2 inline-flex items-center gap-2 border px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          data-testid="gap-network-seed-as-search"
          data-seed-kind={seedKind}
          data-seed-term={summary.seedTerm}
          disabled={isSearchNavigationPending}
          aria-busy={isSearchNavigationPending}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            onUseSeedAsSearch(summary.seedTerm, seedKind, event);
          }}
          onAuxClick={(event: MouseEvent<HTMLButtonElement>) => {
            if (event.button !== 1) return;
            onUseSeedAsSearch(summary.seedTerm, seedKind, event);
          }}
        >
          <SearchNavigationButtonContent pending={isSearchNavigationPending}>
            {t("gapNetwork.label.gap-network-report.seedAsSearch", {
              seedTerm: summary.seedTerm,
            })}
          </SearchNavigationButtonContent>
        </button>
      ) : null}
      {summary.kind === "gap" && feedbackEnabled ? (
        <AiContentFeedback
          target={{
            documentId,
            documentType: "gap_network",
            surfaceId: `gap-focused:${summary.kind}:${summary.meta}`,
            surfaceKind: "gap_gap_focused_summary",
            promiseRef: "promise:gap-overlay-decision-evidence",
            outputSnapshot: {
              title: summary.meta,
              body: feedbackBody,
            },
            metadata: { selectionKind: summary.kind },
          }}
        />
      ) : null}
    </section>
  );
}
