// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @aspect aspect:first-paint-persistence-independence
// @aspect aspect:search-first-url-model

import { notFound, redirect } from "next/navigation";
import {
  CitationResearchRouteRuntime,
  SimilarResearchRouteRuntime,
} from "@/app/(research)/research-route-runtimes";
import { ConditionUrlRejectedState } from "@/app/components/research/ConditionUrlRejectedState";
import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";
import { isEpisteme3PaperRef } from "@/app/lib/episteme-paper-ref";
import { resolveCurrentUser } from "@/app/server/auth/identity";
import {
  buildRelationshipSeedFromUrlParams,
  executeCitationLineageFromUrl,
  executeGraphNeighborsFromUrl,
  validateRelationshipSeedUrlParams,
  type RelationshipSeedUrlParams,
} from "@/app/server/services/relationship-execution";

interface RelationshipSeedPageProps {
  searchParams: Promise<RelationshipSeedUrlParams>;
}

interface PendingServerEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}

let pendingServerEvents: PendingServerEvent[] = [];
let serverAnalyticsFlushScheduled = false;

function emitServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  pendingServerEvents.push({ distinctId, event, properties });
  if (serverAnalyticsFlushScheduled) return;
  serverAnalyticsFlushScheduled = true;

  void import("@/app/server/domain-access/server-analytics")
    .then(({ trackServerEvent }) => {
      const events = pendingServerEvents;
      pendingServerEvents = [];
      serverAnalyticsFlushScheduled = false;
      for (const pendingEvent of events) {
        trackServerEvent(pendingEvent.distinctId, pendingEvent.event, pendingEvent.properties);
      }
    })
    .catch((error: unknown) => {
      pendingServerEvents = [];
      serverAnalyticsFlushScheduled = false;
      console.warn("[relationship-route] analytics import failed:", error);
    });
}

function trackGraphNeighborsViewed(params: {
  userEmail: string;
  ownerPrincipalId: string;
  document: Awaited<ReturnType<typeof executeGraphNeighborsFromUrl>>["view"];
}): void {
  const { document } = params;
  if (document.metadata.type !== "graph_neighbors") return;
  emitServerEvent(params.userEmail, "graph_neighbors_viewed", {
    owner_principal_id: params.ownerPrincipalId,
    document_id: document.id,
    seed_paper_id: document.metadata.seedPaper.paperId,
    co_cited_count: document.metadata.coCited.length,
    coupled_count: document.metadata.coupled.length,
  });
}

export async function CitationSeedRoutePage({ searchParams }: RelationshipSeedPageProps) {
  const params = await searchParams;
  if (!validateRelationshipSeedUrlParams("citation", params).ok) {
    return <ConditionUrlRejectedState />;
  }
  const user = await resolveCurrentUser();
  if (!user) return null;
  const input = buildRelationshipSeedFromUrlParams("citation", params);
  if (!input) notFound();

  // @check acceptance-check:citation-lineage-search-first-seed
  const { view: document, failed } = await executeCitationLineageFromUrl({
    ownerPrincipalId: user.id,
    input,
  });
  void failed;
  return <CitationResearchRouteRuntime runtimeId={user.id} initialView={document} />;
}

export async function SimilarSeedRoutePage({ searchParams }: RelationshipSeedPageProps) {
  const params = await searchParams;
  if (!validateRelationshipSeedUrlParams("similar", params).ok) {
    return <ConditionUrlRejectedState />;
  }
  const user = await resolveCurrentUser();
  if (!user) return null;
  const input = buildRelationshipSeedFromUrlParams("similar", params);
  if (!input) notFound();
  if (!isEpisteme3PaperRef(input.seedPaper.paperId)) {
    const fallbackRoute = buildSearchRoutePageRoute({
      q: input.seedPaper.title,
      entry: "similar",
      seedPaper: input.seedPaper,
    });
    if (!fallbackRoute.ok) return <ConditionUrlRejectedState />;
    redirect(fallbackRoute.route);
  }

  // @check acceptance-check:graph-neighbor-papers-search-first-seed
  const { view: document, failed } = await executeGraphNeighborsFromUrl({
    ownerPrincipalId: user.id,
    input,
  });
  if (failed) {
    emitServerEvent(user.email, "graph_neighbors_failed", {
      owner_principal_id: user.id,
      seed_paper_id: input.seedPaper.paperId,
    });
  } else {
    trackGraphNeighborsViewed({
      userEmail: user.email,
      ownerPrincipalId: user.id,
      document,
    });
  }

  return <SimilarResearchRouteRuntime runtimeId={user.id} initialView={document} />;
}
