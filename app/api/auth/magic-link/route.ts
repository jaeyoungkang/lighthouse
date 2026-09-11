import { NextResponse, type NextRequest } from "next/server";
import { t } from "@/app/i18n/message-access";
import { buildEmailRedirectUrl, isLocalSupabaseUrl } from "@/app/lib/supabase/auth-helpers";
import { createClient } from "@/app/server/auth/supabase";
import { isInternalEmail, normalizeAccessEmail } from "@/app/server/auth/access-policy";
import { resolveCurrentProductAccessForEmail } from "@/app/server/auth/identity";
import { readRouteJsonBody } from "@/app/server/guards/route-json-body";
import {
  consumeRouteIngressAdmission,
  resolveRequestSourceKey,
} from "@/app/server/operational/route-ingress-admission";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import { apiErrorResponse } from "@/app/server/http/api-error-response";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { z } from "zod";

export const maxDuration = 15;

const magicLinkRequestSchema = z
  .object({
    email: z.string().trim().min(3).max(320),
  })
  .strict();

const guardedPOST = withRouteGuard(async (request: NextRequest) => {
  const sourceAdmission = consumeRouteIngressAdmission(
    "magic-link-source",
    resolveRequestSourceKey(request),
  );
  if (!sourceAdmission.allowed) {
    return apiErrorResponse({
      status: 429,
      code: "AUTH_MAGIC_LINK_RATE_LIMITED",
      message: t("auth.error.magicLinkFailed"),
      retryAfterSeconds: sourceAdmission.retryAfterSeconds,
    });
  }

  const body = await readRouteJsonBody(
    request,
    getRouteBodyLimit("app/api/auth/magic-link/route.ts"),
  );
  if (!body.ok) return body.response;
  const parsed = magicLinkRequestSchema.safeParse(body.body);
  const email = parsed.success ? normalizeAccessEmail(parsed.data.email) : "";

  if (!email.includes("@")) {
    return apiErrorResponse({
      status: 400,
      code: "AUTH_EMAIL_INVALID",
      message: t("auth.error.emailInvalid"),
    });
  }

  const emailAdmission = consumeRouteIngressAdmission("magic-link-email", email);
  if (!emailAdmission.allowed) {
    return apiErrorResponse({
      status: 429,
      code: "AUTH_MAGIC_LINK_RATE_LIMITED",
      message: t("auth.error.magicLinkFailed"),
      retryAfterSeconds: emailAdmission.retryAfterSeconds,
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!isLocalSupabaseUrl(supabaseUrl) && !isInternalEmail(email)) {
    let accessDecision: "allowed" | "denied" | "unavailable";
    try {
      accessDecision = await resolveCurrentProductAccessForEmail(email);
    } catch {
      accessDecision = "unavailable";
    }
    if (accessDecision === "unavailable") {
      return apiErrorResponse({
        status: 503,
        code: "AUTH_ACCESS_DECISION_UNAVAILABLE",
        message: t("invitedAccess.error.accessDecisionUnavailable"),
      });
    }
    if (accessDecision !== "allowed") {
      return apiErrorResponse({
        status: 403,
        code: "AUTH_EMAIL_RESTRICTED",
        message: t("auth.error.emailRestricted"),
      });
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: buildEmailRedirectUrl(
        request.url,
        request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
        request.headers.get("x-forwarded-proto"),
      ),
    },
  });

  if (error) {
    return apiErrorResponse({
      status: 502,
      code: "AUTH_MAGIC_LINK_FAILED",
      message: error.message || t("auth.error.magicLinkFailed"),
    });
  }

  return NextResponse.json({ ok: true });
});

export async function POST(request: NextRequest) {
  return guardedPOST(request);
}
