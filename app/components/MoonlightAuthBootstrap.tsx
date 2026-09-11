"use client";

// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-session-principal-handoff
// @check acceptance-check:search-results-fast-window-bootstrap-auth-challenge

import { useEffect, useState, type ComponentType } from "react";

import { BrandLogo } from "@/app/components/BrandLogo";
import { tPublicAuthBootstrap } from "@/app/i18n/public-auth-bootstrap-messages";
import { API_ROUTES } from "@/app/lib/api-routes";

const DEFAULT_LOCAL_MOONLIGHT_PORT = "3000";
const DEFAULT_LOCAL_MOONLIGHT_ORIGIN = `http://localhost:${DEFAULT_LOCAL_MOONLIGHT_PORT}`;
const BOOTSTRAP_TIMEOUT_MS = 5000;
const STALE_SESSION_CLEANUP_TIMEOUT_MS = 1000;
const LOCAL_BROWSER_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

type MoonlightScholarTokenResponse = {
  readonly token?: unknown;
};

export type MoonlightAuthBootstrapFallback = "email-gate";

class MoonlightScholarTokenRequestError extends Error {
  constructor(readonly status: number) {
    super("Moonlight Scholar token request failed.");
    this.name = "MoonlightScholarTokenRequestError";
  }
}

export function MoonlightAuthBootstrap({
  fallback,
  onSessionNavigation,
}: {
  readonly fallback: MoonlightAuthBootstrapFallback;
  readonly onSessionNavigation: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "failed" | "access_not_allowed">("loading");

  useEffect(() => {
    const sessionController = new AbortController();
    const cleanupController = new AbortController();
    const lifecycleController = new AbortController();
    let timeoutId: number | undefined;
    const isActive = () => !lifecycleController.signal.aborted;

    async function bootstrapMoonlightSession() {
      try {
        const moonlightOrigin = resolveMoonlightOrigin();
        await withBootstrapTimeout(sessionController, BOOTSTRAP_TIMEOUT_MS, async () => {
          await refreshLightHouseMoonlightScholarSession(sessionController.signal, moonlightOrigin);
        });
        if (isActive()) {
          onSessionNavigation();
        }
      } catch (error) {
        if (!isActive()) return;
        if (error instanceof MoonlightScholarTokenRequestError && error.status === 403) {
          setStatus("access_not_allowed");
          return;
        }
        await withBootstrapTimeout(
          cleanupController,
          STALE_SESSION_CLEANUP_TIMEOUT_MS,
          async () => {
            await fetch(API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_SESSION, {
              method: "DELETE",
              signal: cleanupController.signal,
            });
          },
        ).catch(() => undefined);
        if (isActive()) setStatus("failed");
      } finally {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
      }
    }

    void bootstrapMoonlightSession();

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      lifecycleController.abort();
      sessionController.abort();
      cleanupController.abort();
    };

    function withBootstrapTimeout(
      controller: AbortController,
      timeoutMs: number,
      task: () => Promise<void>,
    ): Promise<void> {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          controller.abort();
          reject(new Error("Moonlight Scholar session bootstrap timed out."));
        }, timeoutMs);
      });

      return Promise.race([task(), timeout]).finally(() => {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      });
    }
  }, [onSessionNavigation]);

  if (status === "access_not_allowed") {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="flex max-w-xl flex-col items-center gap-5 text-center">
          <BrandLogo placement="auth" priority testId="moonlight-auth-bootstrap-brand-logo" />
          <p
            role="note"
            className="text-text-muted text-sm leading-6"
            data-testid="moonlight-auth-bootstrap-access-notice"
          >
            {tPublicAuthBootstrap("search.notice.moonlight-library-access-denied")}
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return <MoonlightAuthFallback fallback={fallback} />;
  }

  return (
    <div
      className="flex flex-1 items-center justify-center"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="flex flex-col items-center gap-5">
        <BrandLogo placement="auth" priority testId="moonlight-auth-bootstrap-brand-logo" />
        <span className="sr-only">Moonlight Search session is being verified.</span>
        <div className="bg-border/60 h-1 w-28 overflow-hidden rounded-full">
          <div className="bg-foreground/50 h-full w-1/2 animate-pulse rounded-full" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function MoonlightAuthFallback({
  fallback,
}: {
  readonly fallback: MoonlightAuthBootstrapFallback;
}) {
  const [loadState, setLoadState] = useState<{
    readonly fallback: MoonlightAuthBootstrapFallback;
    readonly FallbackComponent: ComponentType | null;
    readonly loadFailed: boolean;
  }>(() => ({
    fallback,
    FallbackComponent: null,
    loadFailed: false,
  }));

  useEffect(() => {
    let active = true;

    void loadMoonlightAuthFallback()
      .then((Component) => {
        if (active) {
          setLoadState({ fallback, FallbackComponent: Component, loadFailed: false });
        }
      })
      .catch(() => {
        if (active) {
          setLoadState({ fallback, FallbackComponent: null, loadFailed: true });
        }
      });

    return () => {
      active = false;
    };
  }, [fallback]);

  if (loadState.loadFailed) {
    return (
      <div
        className="flex flex-1 items-center justify-center px-5 py-8"
        data-testid="moonlight-auth-bootstrap-fallback-error"
      >
        <div className="flex max-w-xl flex-col items-center gap-5 text-center">
          <BrandLogo placement="auth" priority testId="moonlight-auth-bootstrap-brand-logo" />
          <p role="alert" className="text-text-muted text-sm leading-6">
            {tPublicAuthBootstrap("auth.error.fallbackLoadFailed")}
          </p>
          <button
            type="button"
            className="border-border text-foreground hover:bg-muted/50 inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium transition"
            onClick={() => {
              window.location.reload();
            }}
          >
            {tPublicAuthBootstrap("auth.action.fallbackReload")}
          </button>
        </div>
      </div>
    );
  }

  if (!loadState.FallbackComponent) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        aria-busy="true"
        aria-live="polite"
        role="status"
        data-testid="moonlight-auth-bootstrap-fallback-loading"
      >
        <span className="sr-only">Moonlight Search fallback is loading.</span>
      </div>
    );
  }

  return <loadState.FallbackComponent />;
}

function loadMoonlightAuthFallback(): Promise<ComponentType> {
  return import("@/app/components/EmailGate").then((module) => module.EmailGate);
}

export async function refreshLightHouseMoonlightScholarSession(
  signal: AbortSignal,
  origin = resolveMoonlightOrigin(),
): Promise<void> {
  const token = await requestMoonlightScholarToken(origin, signal);
  await createLightHouseMoonlightSession(token, signal);
}

async function requestMoonlightScholarToken(origin: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(resolveMoonlightScholarTokenUrl(origin), {
    method: "POST",
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new MoonlightScholarTokenRequestError(response.status);
  }

  const body = (await response.json()) as MoonlightScholarTokenResponse;
  if (typeof body.token !== "string" || body.token.trim() === "") {
    throw new Error("Moonlight Scholar token response is invalid.");
  }

  return body.token;
}

async function createLightHouseMoonlightSession(token: string, signal: AbortSignal): Promise<void> {
  const response = await fetch(API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_SESSION, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ token }),
    signal,
  });

  if (!response.ok) {
    throw new Error("Light House Moonlight Scholar session request failed.");
  }
}

function resolveMoonlightScholarTokenUrl(origin: string): string {
  return new URL(API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_TOKEN, origin).toString();
}

function resolveMoonlightOrigin(): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL?.trim();
  if (configuredOrigin) {
    return resolveConfiguredLocalMoonlightOrigin(configuredOrigin) ?? configuredOrigin;
  }

  if (process.env.NODE_ENV !== "production") {
    return resolveLocalMoonlightOriginFromWindow() ?? DEFAULT_LOCAL_MOONLIGHT_ORIGIN;
  }

  throw new Error("NEXT_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL is required in production.");
}

function resolveLocalMoonlightOriginFromWindow(): string | null {
  if (typeof window === "undefined") return null;
  return resolveMoonlightOriginForLocation(window.location);
}

function resolveConfiguredLocalMoonlightOrigin(origin: string): string | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  return resolveConfiguredLocalMoonlightOriginForLocation(origin, window.location);
}

export function resolveConfiguredLocalMoonlightOriginForLocation(
  origin: string,
  location: Pick<Location, "protocol" | "hostname">,
): string | null {
  const browserHostname = normalizeLocalBrowserHostname(location.hostname);
  if (!LOCAL_BROWSER_HOSTS.has(browserHostname)) return null;

  const parsed = parseOrigin(origin);
  if (!parsed) return null;

  const configuredHostname = normalizeLocalBrowserHostname(parsed.hostname);
  if (!LOCAL_BROWSER_HOSTS.has(configuredHostname)) return null;

  const host = browserHostname.includes(":") ? `[${browserHostname}]` : browserHostname;
  return `${parsed.protocol}//${host}${parsed.port ? `:${parsed.port}` : ""}`;
}

export function resolveMoonlightOriginForLocation(
  location: Pick<Location, "protocol" | "hostname">,
): string | null {
  if (location.protocol !== "http:" && location.protocol !== "https:") return null;

  const hostname = normalizeLocalBrowserHostname(location.hostname);
  if (!LOCAL_BROWSER_HOSTS.has(hostname)) return null;

  const host = hostname.includes(":") ? `[${hostname}]` : hostname;
  return `${location.protocol}//${host}:${DEFAULT_LOCAL_MOONLIGHT_PORT}`;
}

function normalizeLocalBrowserHostname(hostname: string): string {
  const trimmed = hostname.trim();
  return trimmed === "[::1]" ? "::1" : trimmed;
}

function parseOrigin(origin: string): URL | null {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}
