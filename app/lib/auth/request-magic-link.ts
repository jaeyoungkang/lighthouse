import { tPublicClient as t } from "@/app/i18n/public-client-messages";
import { API_ROUTES } from "@/app/lib/api-routes";

export function getRequestErrorMessage(
  error: unknown,
  fallback = t("auth.error.request-magic-link"),
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function requestMagicLink(email: string): Promise<void> {
  const response = await fetch(API_ROUTES.AUTH_MAGIC_LINK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message =
      typeof payload?.error === "string" ? payload.error : t("auth.error.request-magic-link.2");
    throw new Error(message);
  }
}
