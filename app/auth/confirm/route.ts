import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { buildAppRedirectUrl } from "@/app/lib/supabase/auth-helpers";
import { createClient } from "@/app/server/auth/supabase";

export const maxDuration = 15;

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function getEmailOtpType(value: string | null): EmailOtpType | null {
  if (!value || !EMAIL_OTP_TYPES.has(value as EmailOtpType)) {
    return null;
  }

  return value as EmailOtpType;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";
  const redirectUrl = buildAppRedirectUrl(
    request.url,
    next,
    request.headers.get("host"),
    request.headers.get("x-forwarded-proto"),
  );
  const supabase = await createClient();
  const tokenHash = searchParams.get("token_hash");
  const type = getEmailOtpType(searchParams.get("type"));

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(redirectUrl);
    }

    console.error("[auth.confirm] verifyOtp failed:", error);
  }

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectUrl);
    }

    console.error("[auth.confirm] exchangeCodeForSession failed:", error);
  }

  return NextResponse.redirect(
    buildAppRedirectUrl(
      request.url,
      "/?auth=failed",
      request.headers.get("host"),
      request.headers.get("x-forwarded-proto"),
    ),
  );
}
