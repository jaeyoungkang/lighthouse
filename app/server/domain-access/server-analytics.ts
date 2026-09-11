import type { CanonicalEventPayload } from "@/app/lib/analytics/canonical-event";
import { getAnalyticsEventRouterForTrustedServer } from "@/app/server/domain-access/analytics-event-access";

export function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  recordCanonicalEventFromLegacyServerEvent(distinctId, event, properties ?? {});
}

export async function trackAdminInvitedAccessMembershipSynced(
  operatorId: string,
  operation: "add" | "remove",
): Promise<void> {
  try {
    const result = await getAnalyticsEventRouterForTrustedServer().trackCanonicalEvent(
      "governance.invited_access_membership.synced",
      {
        actor: { type: "operator", id: operatorId },
        properties: { operation },
      },
    );
    if (!result.ok || result.storeError || result.sinkErrors?.length) {
      console.warn("[server-analytics] invited-access membership event failed:", {
        error: result.error,
        storeError: result.storeError,
        sinkErrors: result.sinkErrors,
      });
    }
  } catch (error) {
    console.warn("[server-analytics] invited-access membership event threw:", error);
  }
}

function recordCanonicalEventFromLegacyServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
): void {
  const mapped = mapLegacyServerEventToCanonical(distinctId, event, properties);
  if (!mapped) return;
  dispatchCanonicalMapped(mapped);
}

function dispatchCanonicalMapped(mapped: { name: string; payload: CanonicalEventPayload }): void {
  try {
    void getAnalyticsEventRouterForTrustedServer()
      .trackCanonicalEvent(mapped.name, mapped.payload)
      .then((result) => {
        if (!result.ok || result.storeError || result.sinkErrors?.length) {
          console.warn("[server-analytics] canonical analytics mirror failed:", {
            event: mapped.name,
            error: result.error,
            storeError: result.storeError,
            sinkErrors: result.sinkErrors,
          });
        }
      })
      .catch((error: unknown) => {
        console.warn("[server-analytics] canonical analytics mirror threw:", {
          event: mapped.name,
          error,
        });
      });
  } catch (error) {
    console.warn("[server-analytics] canonical analytics setup failed:", error);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapLegacyServerEventToCanonical(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
): { name: string; payload: CanonicalEventPayload } | null {
  const ownerPrincipalId = asString(properties.owner_principal_id);
  if (!ownerPrincipalId) return null;
  const actor = { type: "user" as const, id: distinctId };

  if (event === "search_executed") {
    return null;
  }

  if (event === "pdf_opened") {
    return null;
  }

  if (event === "citation_lineage_opened") return null;

  if (event === "citation_lineage_failed") {
    const paperId = asString(properties.seed_paper_id);
    if (!paperId) return null;
    return {
      name: "product.citation_lineage.failed",
      payload: {
        actor,
        subject: { ownerPrincipalId, paperId },
        properties: {
          ownerPrincipalId,
          paperId,
          reason: asString(properties.reason) ?? "unknown",
        },
      },
    };
  }

  if (event === "graph_neighbors_viewed") {
    const documentId = asString(properties.document_id);
    const paperId = asString(properties.seed_paper_id);
    if (!documentId || !paperId) return null;
    return {
      name: "product.graph_neighbors.viewed",
      payload: {
        actor,
        subject: { ownerPrincipalId, documentId, paperId },
        properties: {
          ownerPrincipalId,
          documentId,
          paperId,
          coCitedCount: asNumber(properties.co_cited_count) ?? 0,
          coupledCount: asNumber(properties.coupled_count) ?? 0,
        },
      },
    };
  }

  if (event === "graph_neighbors_failed") {
    const paperId = asString(properties.seed_paper_id);
    if (!paperId) return null;
    return {
      name: "product.graph_neighbors.failed",
      payload: {
        actor,
        subject: { ownerPrincipalId, paperId },
        properties: { ownerPrincipalId, paperId },
      },
    };
  }

  return null;
}
