import type {
  AnalyticsEventContract,
  AnalyticsEventDefinition,
} from "@/app/server/services/analytics/event-contract";

import {
  type AnalyticsEventStore,
  type AnalyticsSink,
  type CanonicalEvent,
  type CanonicalEventPayload,
} from "@/app/lib/analytics/canonical-event";
import { buildExternalAnalyticsPayload } from "@/app/lib/analytics/privacy-filter";

export interface AnalyticsRouterOptions {
  contract: AnalyticsEventContract;
  store: AnalyticsEventStore;
  sinks?: AnalyticsSink[];
  now?: () => Date;
}

export interface AnalyticsTrackResult {
  ok: boolean;
  event?: CanonicalEvent;
  error?: Error;
  storeError?: Error;
  sinkErrors?: Error[];
}

export function createAnalyticsEventRouter(options: AnalyticsRouterOptions) {
  const definitionsByName = new Map(options.contract.events.map((event) => [event.name, event]));
  const now = options.now ?? (() => new Date());
  const sinks = options.sinks ?? [];

  async function trackCanonicalEvent(
    name: string,
    payload: CanonicalEventPayload,
  ): Promise<AnalyticsTrackResult> {
    try {
      const definition = definitionsByName.get(name);
      if (!definition) throw new Error(`${name}: event is not declared in analytics contract`);
      const event = composeCanonicalEvent(definition, payload, options.contract, now());
      let storeError: Error | undefined;
      try {
        await options.store.insert(event);
      } catch (error) {
        storeError = error instanceof Error ? error : new Error(String(error));
      }
      const sinkErrors: Error[] = [];
      if (definition.privacy.allowExternalSinks) {
        const externalPayload = buildExternalAnalyticsPayload(definition, event);
        for (const sink of sinks) {
          const sinkName = definition.sinks[sink.name];
          if (!sinkName) continue;
          try {
            await sink.capture(sinkName, event, externalPayload);
          } catch (sinkError) {
            sinkErrors.push(sinkError instanceof Error ? sinkError : new Error(String(sinkError)));
          }
        }
      }
      return {
        ok: true,
        event,
        ...(storeError ? { storeError } : {}),
        ...(sinkErrors.length > 0 ? { sinkErrors } : {}),
      };
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      return { ok: false, error: normalized };
    }
  }

  return { trackCanonicalEvent };
}

function composeCanonicalEvent(
  definition: AnalyticsEventDefinition,
  payload: CanonicalEventPayload,
  contract: AnalyticsEventContract,
  occurredAt: Date,
): CanonicalEvent {
  if (payload.actor.type !== definition.actor) {
    throw new Error(
      `${definition.name}: actor type "${payload.actor.type}" does not match contract actor "${definition.actor}"`,
    );
  }
  for (const key of definition.properties.required) {
    if (!(key in payload.properties)) {
      throw new Error(`${definition.name}: missing required property "${key}"`);
    }
  }
  assertOnlyDeclaredProperties(definition, payload.properties);
  assertPropertySchemaValues(definition, contract, payload.properties);
  for (const key of Object.keys(payload.subject ?? {})) {
    if (!definition.subject.allowed.includes(key)) {
      throw new Error(`${definition.name}: subject key "${key}" is not allowed`);
    }
  }
  assertEmissionIdentity(definition, payload);
  return {
    name: definition.name,
    version: definition.version,
    occurredAt: occurredAt.toISOString(),
    actor: payload.actor,
    deviceId: payload.deviceId,
    sessionId: payload.sessionId,
    surface: definition.surface,
    storyRefs: definition.storyRefs,
    trigger: definition.trigger,
    subject: payload.subject ?? {},
    properties: payload.properties,
    privacy: definition.privacy,
  };
}

function assertEmissionIdentity(
  definition: AnalyticsEventDefinition,
  payload: CanonicalEventPayload,
): void {
  const subject = payload.subject ?? {};
  for (const [key, subjectValue] of Object.entries(subject)) {
    if (key in payload.properties && !Object.is(subjectValue, payload.properties[key])) {
      throw new Error(
        `${definition.name}: subject and properties disagree for identity field "${key}"`,
      );
    }
  }

  const activeProductEvent =
    definition.owner === "product" && !definition.name.startsWith("product.");
  if (!activeProductEvent) return;
  for (const identityPath of definition.emission?.identityKeys ?? []) {
    if (identityPath === "actor.id" || identityPath === "deviceId") continue;
    const [scope, key] = identityPath.split(".", 2);
    const container = scope === "subject" ? subject : payload.properties;
    if (!key || !(key in container) || container[key] === null || container[key] === undefined) {
      throw new Error(`${definition.name}: missing emission identity key "${identityPath}"`);
    }
  }
}

function assertPropertySchemaValues(
  definition: AnalyticsEventDefinition,
  contract: AnalyticsEventContract,
  properties: Record<string, unknown>,
): void {
  if (definition.owner !== "product" || definition.name.startsWith("product.")) return;
  for (const [key, value] of Object.entries(properties)) {
    const schema = contract.propertySchemas?.[key];
    if (!schema) throw new Error(`${definition.name}: property schema "${key}" is not declared`);
    const validType = (() => {
      if (schema.type === "string") return typeof value === "string";
      if (schema.type === "integer") return typeof value === "number" && Number.isInteger(value);
      if (schema.type === "number") return typeof value === "number" && Number.isFinite(value);
      if (schema.type === "boolean") return typeof value === "boolean";
      if (schema.type === "string_or_null") return value === null || typeof value === "string";
      return value === null || (typeof value === "number" && Number.isInteger(value));
    })();
    if (!validType) {
      throw new Error(`${definition.name}: property "${key}" must be ${schema.type}`);
    }
    if (schema.enum && !schema.enum.includes(value as never)) {
      throw new Error(`${definition.name}: property "${key}" is outside the declared enum`);
    }
    if (typeof value === "number") {
      if (schema.range?.min !== undefined && value < schema.range.min) {
        throw new Error(`${definition.name}: property "${key}" is below the declared range`);
      }
      if (schema.range?.max !== undefined && value > schema.range.max) {
        throw new Error(`${definition.name}: property "${key}" is above the declared range`);
      }
    }
  }
}

function assertOnlyDeclaredProperties(
  definition: AnalyticsEventDefinition,
  properties: Record<string, unknown>,
): void {
  const allowed = new Set([...definition.properties.required, ...definition.properties.optional]);
  for (const key of Object.keys(properties)) {
    if (!allowed.has(key)) {
      throw new Error(`${definition.name}: property "${key}" is not declared in contract`);
    }
  }
}
