import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import { t } from "@/app/i18n/message-access";
import { isGapNetworkViewReadyForDisplay } from "@/app/lib/gap-network-view-core";
import { NotFoundError } from "@/app/server/auth/auth-errors";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import {
  applyGapReportReactionPreference,
  getGapReportReactionPreferenceUnchecked,
  getGapReportUnchecked,
  updateGapReportReactionPreferenceIfVersionUnchecked,
} from "@/app/server/repository/gap-reports";

export async function getGapNetworkView(documentId: string): Promise<ResearchRoutePayload> {
  const document = await findGapNetworkView(documentId);
  if (!document) {
    throw new NotFoundError(t("document.label.research-route-access"));
  }
  return document;
}

/** Authenticated-member lookup for polling surfaces that render their own pending state. */
export async function findGapNetworkView(documentId: string): Promise<ResearchRoutePayload | null> {
  const { db, user } = await requireOwnerPrincipalAuth();
  const report = await getGapReportUnchecked(db, documentId, user.id);
  if (!report) return null;
  if (!isGapNetworkViewReadyForDisplay(report)) return report;
  const preference = await getGapReportReactionPreferenceUnchecked(db, documentId, user.id);
  return applyGapReportReactionPreference(report, preference);
}

export async function updateGapNetworkReactionPreference(
  documentId: string,
  artifactVersion: number,
  expectedReactionVersion: number,
  changes: {
    reaction: RouteAiComment | null;
    reactionHistory: RouteAiComment[];
  },
): Promise<ResearchRoutePayload | null> {
  const { db, user } = await requireOwnerPrincipalAuth();
  const report = await getGapReportUnchecked(db, documentId, user.id);
  if (!report || report.version !== artifactVersion) return null;

  const preference = await updateGapReportReactionPreferenceIfVersionUnchecked(db, {
    gapReportId: documentId,
    viewerPrincipalId: user.id,
    artifactVersion,
    expectedReactionVersion,
    ...changes,
  });
  if (!preference) return null;

  const confirmedReport = await getGapReportUnchecked(db, documentId, user.id);
  if (!confirmedReport || confirmedReport.version !== artifactVersion) return null;
  return applyGapReportReactionPreference(confirmedReport, preference);
}
