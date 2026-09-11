// @promise promise:gap-network-detection-from-search
// @promise promise:search-results-fast-window
// @promise promise:shared-gap-report-member-access
// @check acceptance-check:gap-network-detection-from-search-top-result-input-set
// @check acceptance-check:search-results-fast-window-personalization-opt-out
// @check acceptance-check:shared-gap-report-member-access-authenticated-sharing
// @aspect aspect:library-grounded-research
// @aspect aspect:immediate-navigation
// @aspect aspect:search-first-url-model

import { notFound } from "next/navigation";
import { GapResearchRouteRuntime } from "@/app/(research)/research-route-runtimes";
import { GAP_OPENING_QUERY_VALUE } from "@/app/lib/api-routes";
import { NotFoundError, UnauthenticatedError } from "@/app/server/auth/auth-errors";
import { getGapNetworkView } from "@/app/server/domain-access/gap-report-access";
import { resolveCurrentUser } from "@/app/server/auth/identity";

interface PersistedGapReportPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ admission?: string | string[] }>;
}

interface GapSourcePageProps {
  searchParams: Promise<{
    opening?: string | string[];
    source?: string | string[];
    sourceSnapshotId?: string | string[];
    sort?: string | string[];
    year?: string | string[];
    paper?: string | string[];
  }>;
}

function isUnauthenticatedOrNotFound(error: unknown): boolean {
  return error instanceof NotFoundError || error instanceof UnauthenticatedError;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function PersistedGapReportRoutePage({
  params,
  searchParams = Promise.resolve({}),
}: PersistedGapReportPageProps) {
  const [user, { id }, query] = await Promise.all([resolveCurrentUser(), params, searchParams]);
  if (!user) return null;
  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  let document;

  try {
    document = await getGapNetworkView(id);
  } catch (error) {
    if (isUnauthenticatedOrNotFound(error)) {
      notFound();
    }
    throw error;
  }

  return (
    <GapResearchRouteRuntime
      runtimeId={user.id}
      initialView={document}
      gapAdmissionBlocked={firstParam(query.admission) === "blocked"}
    />
  );
}

export async function GapSourceRoutePage({ searchParams }: GapSourcePageProps) {
  const params = await searchParams;
  if (firstParam(params.opening) === GAP_OPENING_QUERY_VALUE) {
    return null;
  }
  const user = await resolveCurrentUser();
  if (!user) return null;
  notFound();
}
