import { EPISTEME3_NATIVE_API_PREFIX } from "@/app/lib/api-routes";

const DEFAULT_EPISTEME_PUBLIC_BASE = "https://sah.borca.ai";

export function getEpistemePublicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_EPISTEME_PUBLIC_BASE ?? DEFAULT_EPISTEME_PUBLIC_BASE).replace(
    /\/+$/,
    "",
  );
}

export function getEpistemeApiBaseUrl(): string {
  const configured = (
    process.env.EPISTEME3_LITERATURE_API_URL ??
    process.env.EPISTEME_LITERATURE_API_URL ??
    getEpistemePublicBaseUrl()
  ).replace(/\/+$/, "");
  return configured.endsWith(EPISTEME3_NATIVE_API_PREFIX)
    ? configured
    : `${configured}${EPISTEME3_NATIVE_API_PREFIX}`;
}

export function getEpistemeOrigin(): string | null {
  try {
    return new URL(getEpistemeApiBaseUrl()).origin.toLowerCase();
  } catch {
    return null;
  }
}
