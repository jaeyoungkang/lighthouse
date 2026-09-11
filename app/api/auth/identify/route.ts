import { apiErrorResponse } from "@/app/server/http/api-error-response";

export const maxDuration = 15;

function deprecatedResponse() {
  return apiErrorResponse({
    status: 410,
    code: "AUTH_IDENTIFY_RETIRED",
    message: "Deprecated. Use the Supabase magic link auth flow.",
  });
}

export function GET() {
  return deprecatedResponse();
}

export function POST() {
  return deprecatedResponse();
}

export function DELETE() {
  return deprecatedResponse();
}
