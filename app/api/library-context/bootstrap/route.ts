import { NextResponse } from "next/server";

// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-bootstrap-auth-challenge
// @check acceptance-check:search-results-fast-window-library-bootstrap-outcomes

import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import { resolveMyReviewedPapersLibraryContextSource } from "@/app/server/domain-access/reviewed-paper-access";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { resolveLibraryPresetPapers } from "@/app/server/services/library-anchor-display";
import {
  resolveLibraryContextForUser,
  type LibraryContextAccessStatus,
} from "@/app/server/services/library-context-source";

// Response-tail citation warming has a 90s internal deadline. `after()` is still
// bounded by the route lifetime, so keep enough headroom for bootstrap work and
// the warm's own abort/observation path to finish deterministically.
export const maxDuration = 120;

type LibraryContextBootstrapResponse = {
  userEmail?: string;
  libraryContextAvailable: boolean;
  libraryAccessStatus: LibraryContextAccessStatus;
  libraryPapers: Awaited<ReturnType<typeof resolveLibraryPresetPapers>>;
};

function buildUnavailableResponse(userEmail?: string): LibraryContextBootstrapResponse {
  return {
    userEmail,
    libraryContextAvailable: false,
    libraryAccessStatus: "unavailable",
    libraryPapers: [],
  };
}

function isRequestAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

export const GET = withRouteGuard(async (req: Request) => {
  const { user } = await requireOwnerPrincipalAuth();

  try {
    if (isRequestAborted(req.signal)) {
      return NextResponse.json(buildUnavailableResponse(user.email));
    }
    const libraryContextUserSource = await resolveMyReviewedPapersLibraryContextSource();
    if (isRequestAborted(req.signal)) {
      return NextResponse.json(buildUnavailableResponse(user.email));
    }
    const libraryContextResolution = await resolveLibraryContextForUser(
      user.email,
      libraryContextUserSource,
      { signal: req.signal },
    );
    if (isRequestAborted(req.signal)) {
      return NextResponse.json(buildUnavailableResponse(user.email));
    }
    const libraryContext = libraryContextResolution.context;

    return NextResponse.json({
      userEmail: user.email,
      libraryContextAvailable: libraryContext !== null,
      libraryAccessStatus: libraryContextResolution.accessStatus,
      libraryPapers: await resolveLibraryPresetPapers(libraryContext, { signal: req.signal }),
    } satisfies LibraryContextBootstrapResponse);
  } catch (error) {
    console.warn("[library-context/bootstrap] Library context bootstrap failed", {
      ownerPrincipalId: user.id,
      errorName: error instanceof Error ? error.name : String(error),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(buildUnavailableResponse(user.email));
  }
});
