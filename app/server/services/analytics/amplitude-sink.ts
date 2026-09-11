import { createHash } from "node:crypto";

import { loadEnvConfig } from "@next/env";

import type { AnalyticsSink, CanonicalEvent } from "@/app/lib/analytics/canonical-event";

const DEFAULT_AMPLITUDE_HTTP_ENDPOINT = "https://api2.amplitude.com/2/httpapi";
const DEFAULT_AMPLITUDE_HTTP_TIMEOUT_MS = 2500;
const DEFAULT_AMPLITUDE_HTTP_MAX_ATTEMPTS = 2;
const DEFAULT_AMPLITUDE_HTTP_RETRY_DELAY_MS = 100;

export interface AmplitudeAnalyticsSinkOptions {
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
}

export function createAmplitudeAnalyticsSink(
  options: AmplitudeAnalyticsSinkOptions = {},
): AnalyticsSink {
  const apiKey = resolveAmplitudeApiKey(options.apiKey);
  const endpoint = options.endpoint ?? DEFAULT_AMPLITUDE_HTTP_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_AMPLITUDE_HTTP_TIMEOUT_MS;
  const maxAttempts = Math.max(
    1,
    Math.floor(options.maxAttempts ?? DEFAULT_AMPLITUDE_HTTP_MAX_ATTEMPTS),
  );
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_AMPLITUDE_HTTP_RETRY_DELAY_MS);

  return {
    name: "amplitude",
    async capture(
      eventName: string,
      event: CanonicalEvent,
      payload: Record<string, unknown>,
    ): Promise<void> {
      if (!apiKey) {
        if (options.apiKey !== undefined) return;
        throw new Error("Amplitude HTTP V2 sink is missing an API key");
      }
      if (!hasAmplitudeIdentity(event)) return;
      const body = JSON.stringify({
        api_key: apiKey,
        events: [buildAmplitudeEvent(eventName, event, payload)],
      });
      await postWithRetry(
        fetchImpl,
        endpoint,
        body,
        timeoutMs,
        maxAttempts,
        retryDelayMs,
        eventName,
      );
    },
  };
}

function resolveAmplitudeApiKey(explicitApiKey?: string): string {
  if (explicitApiKey !== undefined) return explicitApiKey;

  const configured = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY ?? process.env.AMPLITUDE_API_KEY;
  if (configured) return configured;

  loadEnvConfig(process.cwd());
  return process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY ?? process.env.AMPLITUDE_API_KEY ?? "";
}

function hasAmplitudeIdentity(event: CanonicalEvent): boolean {
  return Boolean(event.actor.id || event.deviceId);
}

async function postWithRetry(
  fetchImpl: typeof fetch,
  endpoint: string,
  body: string,
  timeoutMs: number,
  maxAttempts: number,
  retryDelayMs: number,
  eventName: string,
): Promise<void> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await postWithTimeout(fetchImpl, endpoint, body, timeoutMs, eventName);
      if (response.ok) return;
      const responseText = await response.text().catch(() => "");
      const error = new Error(rejectionMessage(eventName, response.status, responseText));
      if (!isRetryableStatus(response.status) || attempt === maxAttempts) throw error;
      lastError = error;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts) throw lastError;
    }
    if (retryDelayMs > 0) await delay(retryDelayMs);
  }
  if (lastError) throw lastError;
}

async function postWithTimeout(
  fetchImpl: typeof fetch,
  endpoint: string,
  body: string,
  timeoutMs: number,
  eventName?: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    return await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      const eventLabel = eventName ? ` while posting event ${eventName}` : "";
      throw new Error(`Amplitude HTTP V2 sink timed out after ${String(timeoutMs)}ms${eventLabel}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAmplitudeEvent(
  eventName: string,
  event: CanonicalEvent,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const occurredAtMs = Date.parse(event.occurredAt);
  return {
    event_type: eventName,
    user_id: event.actor.id,
    device_id: event.deviceId,
    session_id: event.sessionId,
    insert_id: buildInsertId(eventName, event),
    time: Number.isFinite(occurredAtMs) ? occurredAtMs : undefined,
    event_properties: payload,
  };
}

function buildInsertId(eventName: string, event: CanonicalEvent): string {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        eventName,
        canonicalName: event.name,
        version: event.version,
        occurredAt: event.occurredAt,
        actor: event.actor,
        deviceId: event.deviceId,
        sessionId: event.sessionId,
        subject: event.subject,
        properties: event.properties,
      }),
    )
    .digest("hex")
    .slice(0, 32);
  return `lighthouse:${eventName}:${hash}`;
}

function rejectionMessage(eventName: string, status: number, responseText: string): string {
  const details = responseText.trim().slice(0, 500);
  return details
    ? `Amplitude HTTP V2 sink rejected event ${eventName}: ${String(status)} ${details}`
    : `Amplitude HTTP V2 sink rejected event ${eventName}: ${String(status)}`;
}
