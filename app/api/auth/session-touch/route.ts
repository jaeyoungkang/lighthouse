import { NextResponse } from "next/server";

import { UnauthenticatedError } from "@/app/server/auth/auth-errors";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import { scheduleAppUserSnapshot } from "@/app/server/auth/app-user-snapshot";
import { withRouteGuard } from "@/app/server/guards/route-guard";

export const runtime = "nodejs";
export const maxDuration = 15;

const guardedPOST = withRouteGuard(async (): Promise<NextResponse> => {
  let auth: Awaited<ReturnType<typeof requireOwnerPrincipalAuth>>;
  try {
    auth = await requireOwnerPrincipalAuth();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return new NextResponse(null, { status: 204 });
    }

    console.warn("[auth session-touch] failed to resolve authenticated session:", error);
    throw error;
  }

  scheduleAppUserSnapshot({
    principal: auth.user.id,
    email: auth.user.email,
    backfill: auth.source === "moonlight_scholar",
  });

  return new NextResponse(null, { status: 204 });
});

export async function POST(): Promise<Response | NextResponse> {
  return guardedPOST();
}
