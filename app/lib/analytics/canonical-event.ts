import type {
  AnalyticsEventActor,
  AnalyticsEventSurface,
  AnalyticsPrivacyLevel,
  AnalyticsStoryRefs,
} from "@/app/server/services/analytics/event-contract";

export interface CanonicalEvent {
  name: string;
  version: number;
  occurredAt: string;
  actor: {
    type: AnalyticsEventActor;
    id?: string;
  };
  deviceId?: string;
  sessionId?: number;
  surface: AnalyticsEventSurface;
  storyRefs: AnalyticsStoryRefs;
  trigger: {
    source: string;
    phase: string;
    timing: string;
  };
  subject: Record<string, string | number | boolean | null>;
  properties: Record<string, unknown>;
  privacy: {
    level: AnalyticsPrivacyLevel;
    allowExternalSinks: boolean;
  };
}

export interface CanonicalEventPayload {
  actor: {
    type: AnalyticsEventActor;
    id?: string;
  };
  deviceId?: string;
  sessionId?: number;
  subject?: Record<string, string | number | boolean | null>;
  properties: Record<string, unknown>;
}

export interface AnalyticsEventStore {
  insert(event: CanonicalEvent): Promise<void>;
}

export interface AnalyticsSink {
  name: string;
  capture(
    eventName: string,
    event: CanonicalEvent,
    payload: Record<string, unknown>,
  ): Promise<void>;
}
