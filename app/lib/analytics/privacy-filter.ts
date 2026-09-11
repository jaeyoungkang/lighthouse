import type { AnalyticsEventDefinition } from "@/app/server/services/analytics/event-contract";

import type { CanonicalEvent } from "./canonical-event";

export function buildExternalAnalyticsPayload(
  definition: AnalyticsEventDefinition,
  event: CanonicalEvent,
): Record<string, unknown> {
  const allowed = new Set([...definition.properties.required, ...definition.properties.optional]);
  const payload: Record<string, unknown> = {
    event_name: event.name,
    event_version: event.version,
    surface: event.surface,
    trigger_source: event.trigger.source,
    trigger_phase: event.trigger.phase,
  };
  if (event.storyRefs.experienceRef) payload.experience_ref = event.storyRefs.experienceRef;
  if (event.storyRefs.momentRef) payload.moment_ref = event.storyRefs.momentRef;
  if (event.storyRefs.promiseRef) payload.promise_ref = event.storyRefs.promiseRef;
  if ((event.storyRefs.relatedPromiseRefs?.length ?? 0) > 0) {
    payload.related_promise_refs = event.storyRefs.relatedPromiseRefs;
  }
  if (event.storyRefs.aspectRefs.length > 0) payload.aspect_refs = event.storyRefs.aspectRefs;
  if (event.storyRefs.acceptanceCheckRefs.length > 0) {
    payload.acceptance_check_refs = event.storyRefs.acceptanceCheckRefs;
  }
  if (event.storyRefs.scenarioRefs.length > 0) payload.scenario_refs = event.storyRefs.scenarioRefs;

  for (const [key, value] of Object.entries(event.subject)) {
    if (definition.subject.allowed.includes(key)) payload[toSnakeCase(key)] = value;
  }
  for (const [key, value] of Object.entries(event.properties)) {
    if (!allowed.has(key)) continue;
    payload[toSnakeCase(key)] = value;
  }
  return payload;
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}
