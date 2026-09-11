import { API_ROUTES } from "@/app/lib/api-routes";
import {
  initializeAmplitudeUnifiedModule,
  isAmplitudeUnifiedConfigured,
  readAmplitudeUnifiedModule,
} from "./amplitude-unified-client";
import type { CanonicalEventPayload } from "./canonical-event";

export function trackCanonicalEvent(name: string, payload: CanonicalEventPayload): void {
  if (!isAmplitudeUnifiedConfigured()) {
    dispatchCanonicalEvent(name, payload, false);
    return;
  }

  void initializeAmplitudeUnifiedModule().then(
    (module) => {
      dispatchCanonicalEvent(name, payload, module !== null);
    },
    () => {
      dispatchCanonicalEvent(name, payload, false);
    },
  );
}

function dispatchCanonicalEvent(
  name: string,
  payload: CanonicalEventPayload,
  includeSdkIdentity: boolean,
): void {
  try {
    const resolved = includeSdkIdentity ? resolveSdkIdentity(payload) : payload;
    const body = JSON.stringify({ name, payload: resolved });
    const url = API_ROUTES.ANALYTICS_EVENTS;
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const accepted = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      if (accepted) return;
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // fire-and-forget
  }
}

function readSdkDeviceId(): string | undefined {
  try {
    return readAmplitudeUnifiedModule()?.getDeviceId();
  } catch {
    return undefined;
  }
}

function readSdkSessionId(): number | undefined {
  try {
    return readAmplitudeUnifiedModule()?.getSessionId();
  } catch {
    return undefined;
  }
}

function resolveSdkIdentity(payload: CanonicalEventPayload): CanonicalEventPayload {
  return {
    ...payload,
    deviceId: payload.deviceId ?? readSdkDeviceId(),
    sessionId: payload.sessionId ?? readSdkSessionId(),
  };
}
