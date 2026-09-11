import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import {
  isAcceptanceCheckRef,
  isAspectRef,
  isExperienceRef,
  isMomentRef,
  isPromiseRef,
} from "@/app/domain/story-chain";
import type { StoryChain } from "@/app/server/services/story-chain/loader";
import type {
  AnalyticsEventContract,
  AnalyticsEventDefinition,
  AnalyticsPropertySchema,
  AnalyticsStoryRefs,
  EventContractValidationOptions,
  EventContractValidationResult,
} from "./event-contract-types";
import {
  validateDuplicateValues,
  validateEventShape,
  validatePropertySchemas,
  validateSinkNames,
} from "./event-contract-validation";
import { validateRuntimeEmittedEvents } from "./runtime-emitted-events";

export type {
  AnalyticsContextGroup,
  AnalyticsContextLifetime,
  AnalyticsEmissionBoundary,
  AnalyticsEmissionCardinality,
  AnalyticsEventActor,
  AnalyticsEventContract,
  AnalyticsEventDefinition,
  AnalyticsEventOwner,
  AnalyticsEventSurface,
  AnalyticsPrivacyLevel,
  AnalyticsPropertySchema,
  AnalyticsPropertySensitivity,
  AnalyticsPropertyType,
  AnalyticsSignalSeverity,
  AnalyticsStoryRefs,
  AnalyticsTriggerPhase,
  AnalyticsTriggerSource,
  EventContractValidationOptions,
  EventContractValidationResult,
} from "./event-contract-types";

export const ANALYTICS_EVENTS_PATH = "docs/analytics/events.yaml";

export class AnalyticsEventContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsEventContractError";
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AnalyticsEventContractError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AnalyticsEventContractError(`${label} must be a non-empty string`);
  }
  return value;
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new AnalyticsEventContractError(`${label} must be a positive integer`);
  }
  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new AnalyticsEventContractError(`${label} must be a boolean`);
  }
  return value;
}

function asStringArray(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new AnalyticsEventContractError(`${label} must be a string array`);
  }
  return value as string[];
}

function asUnknownArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AnalyticsEventContractError(`${label} must be a non-empty array`);
  }
  return value;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new AnalyticsEventContractError(`${label} has unsupported value "${value}"`);
  }
  return value as T;
}

function parseStoryRefs(value: unknown, label: string): AnalyticsStoryRefs {
  const refs = asRecord(value, label);
  const experienceRefRaw = refs.experienceRef
    ? asString(refs.experienceRef, `${label}.experienceRef`)
    : undefined;
  const momentRefRaw = refs.momentRef ? asString(refs.momentRef, `${label}.momentRef`) : undefined;
  const promiseRefRaw = refs.promiseRef
    ? asString(refs.promiseRef, `${label}.promiseRef`)
    : undefined;
  const relatedPromiseRefsRaw = asStringArray(
    refs.relatedPromiseRefs,
    `${label}.relatedPromiseRefs`,
  );
  const aspectRefsRaw = asStringArray(refs.aspectRefs, `${label}.aspectRefs`);
  const acceptanceCheckRefsRaw = asStringArray(
    refs.acceptanceCheckRefs,
    `${label}.acceptanceCheckRefs`,
  );

  return {
    experienceRef: parseOptionalRef(
      experienceRefRaw,
      isExperienceRef,
      `${label}.experienceRef`,
      "experience:",
    ),
    momentRef: parseOptionalRef(momentRefRaw, isMomentRef, `${label}.momentRef`, "moment:"),
    promiseRef: parseOptionalRef(promiseRefRaw, isPromiseRef, `${label}.promiseRef`, "promise:"),
    relatedPromiseRefs: parseRefArray(
      relatedPromiseRefsRaw,
      isPromiseRef,
      `${label}.relatedPromiseRefs`,
      "promise:",
    ),
    aspectRefs: parseRefArray(aspectRefsRaw, isAspectRef, `${label}.aspectRefs`, "aspect:"),
    acceptanceCheckRefs: parseRefArray(
      acceptanceCheckRefsRaw,
      isAcceptanceCheckRef,
      `${label}.acceptanceCheckRefs`,
      "acceptance-check:",
    ),
    scenarioRefs: asStringArray(refs.scenarioRefs, `${label}.scenarioRefs`),
  };
}

function parseOptionalRef<T extends string>(
  value: string | undefined,
  predicate: (candidate: string) => candidate is T,
  label: string,
  expectedPrefix: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (!predicate(value)) {
    throw new AnalyticsEventContractError(
      `${label} must be a canonical Story Chain ref starting with "${expectedPrefix}"`,
    );
  }
  return value;
}

function parseRefArray<T extends string>(
  values: readonly string[],
  predicate: (candidate: string) => candidate is T,
  label: string,
  expectedPrefix: string,
): T[] {
  return values.map((value, index) => {
    if (!predicate(value)) {
      throw new AnalyticsEventContractError(
        `${label}[${String(index)}] must be a canonical Story Chain ref starting with "${expectedPrefix}"`,
      );
    }
    return value;
  });
}

function parseStringRecord(value: unknown, label: string): Record<string, string> {
  const record = asRecord(value, label);
  const result: Record<string, string> = {};
  for (const [key, entryValue] of Object.entries(record)) {
    result[key] = asString(entryValue, `${label}.${key}`);
  }
  return result;
}

function parseEmission(value: unknown, label: string): AnalyticsEventDefinition["emission"] {
  if (value === undefined) return undefined;
  const emission = asRecord(value, label);
  return {
    boundary: oneOf(
      asString(emission.boundary, `${label}.boundary`),
      [
        "command_handler",
        "state_transition",
        "viewed_boundary",
        "task_enqueue",
        "failure_boundary",
      ] as const,
      `${label}.boundary`,
    ),
    cardinality: oneOf(
      asString(emission.cardinality, `${label}.cardinality`),
      ["every_action", "once_per_identity", "once_per_session", "state_transition"] as const,
      `${label}.cardinality`,
    ),
    identityKeys: asStringArray(emission.identityKeys, `${label}.identityKeys`),
    emitter: asString(emission.emitter, `${label}.emitter`),
  };
}

function parseMeasurement(value: unknown, label: string): AnalyticsEventDefinition["measurement"] {
  if (value === undefined) return undefined;
  const measurement = asRecord(value, label);
  return {
    purpose: asString(measurement.purpose, `${label}.purpose`),
    decisionUse: asString(measurement.decisionUse, `${label}.decisionUse`),
    propertyPurposes: parseStringRecord(
      measurement.propertyPurposes ?? {},
      `${label}.propertyPurposes`,
    ),
  };
}

function parsePropertySchema(value: unknown, name: string): AnalyticsPropertySchema {
  const label = `propertySchemas.${name}`;
  const schema = asRecord(value, label);
  const range = schema.range === undefined ? undefined : asRecord(schema.range, `${label}.range`);
  return {
    description: asString(schema.description, `${label}.description`),
    type: oneOf(
      asString(schema.type, `${label}.type`),
      ["string", "integer", "number", "boolean", "string_or_null", "integer_or_null"] as const,
      `${label}.type`,
    ),
    examples: asUnknownArray(schema.examples, `${label}.examples`),
    ...(Array.isArray(schema.enum)
      ? { enum: schema.enum as Array<string | number | boolean | null> }
      : {}),
    ...(range
      ? {
          range: {
            ...(typeof range.min === "number" ? { min: range.min } : {}),
            ...(typeof range.max === "number" ? { max: range.max } : {}),
          },
        }
      : {}),
    sensitivity: oneOf(
      asString(schema.sensitivity, `${label}.sensitivity`),
      ["public_contract", "behavior_metadata", "user_private", "restricted"] as const,
      `${label}.sensitivity`,
    ),
    contextGroup: oneOf(
      asString(schema.contextGroup, `${label}.contextGroup`),
      ["journey", "search", "paper", "result", "action"] as const,
      `${label}.contextGroup`,
    ),
    lifetime: oneOf(
      asString(schema.lifetime, `${label}.lifetime`),
      ["journey", "search_context", "route_view", "event"] as const,
      `${label}.lifetime`,
    ),
    sourceOwner: asString(schema.sourceOwner, `${label}.sourceOwner`),
  };
}

function parseEventDefinition(value: unknown, index: number): AnalyticsEventDefinition {
  const event = asRecord(value, `events[${String(index)}]`);
  const name = asString(event.name, `events[${String(index)}].name`);
  const observability = asRecord(event.observability, `${name}.observability`);
  const trigger = asRecord(event.trigger, `${name}.trigger`);
  const subject = asRecord(event.subject, `${name}.subject`);
  const properties = asRecord(event.properties, `${name}.properties`);
  const privacy = asRecord(event.privacy, `${name}.privacy`);

  return {
    name,
    version: asNumber(event.version, `${name}.version`),
    owner: oneOf(
      asString(event.owner, `${name}.owner`),
      ["product", "governance", "runtime", "evidence"] as const,
      `${name}.owner`,
    ),
    actor: oneOf(
      asString(event.actor, `${name}.actor`),
      ["user", "agent", "system", "evaluator", "operator"] as const,
      `${name}.actor`,
    ),
    surface: oneOf(
      asString(event.surface, `${name}.surface`),
      ["research-route", "agent_runtime", "admin", "public_site", "cli", "ci"] as const,
      `${name}.surface`,
    ),
    storyRefs: parseStoryRefs(event.storyRefs, `${name}.storyRefs`),
    observability: {
      realitySignal: asBoolean(observability.realitySignal, `${name}.observability.realitySignal`),
      signalMeaning: asString(observability.signalMeaning, `${name}.observability.signalMeaning`),
      severity: oneOf(
        asString(observability.severity, `${name}.observability.severity`),
        ["info", "warning", "critical"] as const,
        `${name}.observability.severity`,
      ),
      requiredForPromiseCoverage: asBoolean(
        observability.requiredForPromiseCoverage,
        `${name}.observability.requiredForPromiseCoverage`,
      ),
    },
    trigger: {
      source: oneOf(
        asString(trigger.source, `${name}.trigger.source`),
        ["client", "server", "runtime", "cli", "evidence_runner"] as const,
        `${name}.trigger.source`,
      ),
      phase: oneOf(
        asString(trigger.phase, `${name}.trigger.phase`),
        ["requested", "committed", "rendered", "completed", "failed"] as const,
        `${name}.trigger.phase`,
      ),
      timing: asString(trigger.timing, `${name}.trigger.timing`),
    },
    ...(event.measurement
      ? { measurement: parseMeasurement(event.measurement, `${name}.measurement`) }
      : {}),
    subject: {
      allowed: asStringArray(subject.allowed, `${name}.subject.allowed`),
    },
    properties: {
      required: asStringArray(properties.required, `${name}.properties.required`),
      optional: asStringArray(properties.optional, `${name}.properties.optional`),
      forbidden: asStringArray(properties.forbidden, `${name}.properties.forbidden`),
    },
    privacy: {
      level: oneOf(
        asString(privacy.level, `${name}.privacy.level`),
        ["public_contract", "behavior_metadata", "user_private", "restricted"] as const,
        `${name}.privacy.level`,
      ),
      allowExternalSinks: asBoolean(
        privacy.allowExternalSinks,
        `${name}.privacy.allowExternalSinks`,
      ),
    },
    ...(event.emission ? { emission: parseEmission(event.emission, `${name}.emission`) } : {}),
    sinks: parseStringRecord(event.sinks ?? {}, `${name}.sinks`),
  };
}

export function parseEventContract(source: string): AnalyticsEventContract {
  const root = asRecord(parseYaml(source), "events.yaml");
  const propertySchemasRaw = asRecord(root.propertySchemas ?? {}, "events.yaml propertySchemas");
  const eventsRaw = root.events;
  if (!Array.isArray(eventsRaw)) {
    throw new AnalyticsEventContractError("events.yaml events must be an array");
  }
  return {
    propertySchemas: Object.fromEntries(
      Object.entries(propertySchemasRaw).map(([name, value]) => [
        name,
        parsePropertySchema(value, name),
      ]),
    ),
    events: eventsRaw.map(parseEventDefinition),
  };
}

export function loadEventContract(repoRoot: string): AnalyticsEventContract {
  return parseEventContract(readFileSync(path.join(repoRoot, ANALYTICS_EVENTS_PATH), "utf8"));
}

function parseScenarioIds(repoRoot: string): Set<string> {
  const source = readFileSync(
    path.join(repoRoot, "docs/contracts/story-chain/scenario-catalog.md"),
    "utf8",
  );
  return new Set(
    [...source.matchAll(/^### .*\b(scenario:[a-z0-9-]+)\b/gm)].map((match) => match[1]),
  );
}

interface StoryRefIndexes {
  experienceIds: Set<string>;
  momentById: Map<string, StoryChain["moments"][number]>;
  promiseById: Map<string, StoryChain["promises"][number]>;
  aspectById: Map<string, StoryChain["aspects"][number]>;
  scenarioIds: Set<string>;
}

function validateEventStoryRefs(
  event: AnalyticsEventDefinition,
  chain: StoryChain,
  indexes: StoryRefIndexes,
  errors: string[],
): void {
  validateParentRefs(event, indexes, errors);
  const promise = event.storyRefs.promiseRef
    ? indexes.promiseById.get(event.storyRefs.promiseRef)
    : undefined;
  if (event.storyRefs.promiseRef && !promise) {
    errors.push(`${event.name}: promiseRef "${event.storyRefs.promiseRef}" is not declared`);
  }
  for (const relatedPromiseRef of event.storyRefs.relatedPromiseRefs ?? []) {
    if (relatedPromiseRef === event.storyRefs.promiseRef) {
      errors.push(
        `${event.name}: relatedPromiseRefs repeats primary promiseRef "${relatedPromiseRef}"`,
      );
    } else if (!indexes.promiseById.has(relatedPromiseRef)) {
      errors.push(`${event.name}: relatedPromiseRef "${relatedPromiseRef}" is not declared`);
    }
  }
  if (promise) {
    validatePromiseParentRefs(event, promise, indexes, errors);
  }
  validateAspectRefs(event, promise, indexes.aspectById, errors);
  validateAcceptanceCheckRefs(event, promise, chain, errors);
  for (const scenarioRef of event.storyRefs.scenarioRefs) {
    if (!indexes.scenarioIds.has(scenarioRef)) {
      errors.push(`${event.name}: scenarioRef "${scenarioRef}" is not declared`);
    }
  }
}

function validateRequiredEventCoverage(
  contract: AnalyticsEventContract,
  chain: StoryChain,
  errors: string[],
): void {
  const eventsByName = new Map(contract.events.map((event) => [event.name, event]));
  for (const promise of chain.promises) {
    for (const eventName of promise.requiredEvents ?? []) {
      const event = eventsByName.get(eventName);
      if (!event) {
        errors.push(`${promise.id}: required event "${eventName}" is not declared`);
        continue;
      }
      if (event.storyRefs.promiseRef !== promise.id) {
        errors.push(
          `${promise.id}: required event "${eventName}" does not use the Promise as its primary promiseRef`,
        );
      }
    }
  }
}

function validateParentRefs(
  event: AnalyticsEventDefinition,
  indexes: Pick<StoryRefIndexes, "experienceIds" | "momentById">,
  errors: string[],
): void {
  if (event.storyRefs.experienceRef && !indexes.experienceIds.has(event.storyRefs.experienceRef)) {
    errors.push(`${event.name}: experienceRef "${event.storyRefs.experienceRef}" is not declared`);
  }
  if (event.storyRefs.momentRef && !indexes.momentById.has(event.storyRefs.momentRef)) {
    errors.push(`${event.name}: momentRef "${event.storyRefs.momentRef}" is not declared`);
  }
}

function validatePromiseParentRefs(
  event: AnalyticsEventDefinition,
  promise: StoryChain["promises"][number],
  indexes: Pick<StoryRefIndexes, "momentById">,
  errors: string[],
): void {
  if (event.storyRefs.momentRef !== promise.moment) {
    errors.push(
      `${event.name}: momentRef "${event.storyRefs.momentRef ?? "none"}" must match ${promise.id} parent "${promise.moment}"`,
    );
  }
  const moment = indexes.momentById.get(promise.moment);
  if (moment && event.storyRefs.experienceRef !== moment.experience) {
    errors.push(
      `${event.name}: experienceRef "${event.storyRefs.experienceRef ?? "none"}" must match ${promise.moment} parent "${moment.experience}"`,
    );
  }
}

function validateAspectRefs(
  event: AnalyticsEventDefinition,
  promise: StoryChain["promises"][number] | undefined,
  aspectById: Map<string, StoryChain["aspects"][number]>,
  errors: string[],
): void {
  for (const aspectRef of event.storyRefs.aspectRefs) {
    const aspect = aspectById.get(aspectRef);
    if (!aspect) {
      errors.push(`${event.name}: aspectRef "${aspectRef}" is not declared`);
      continue;
    }
    if (promise && !aspect.appliesTo.includes(promise.id)) {
      errors.push(`${event.name}: aspectRef "${aspectRef}" does not apply to ${promise.id}`);
    }
  }
}

function validateAcceptanceCheckRefs(
  event: AnalyticsEventDefinition,
  promise: StoryChain["promises"][number] | undefined,
  chain: StoryChain,
  errors: string[],
): void {
  const promiseAcceptanceChecks = new Set(promise?.acceptanceChecks.map((check) => check.id) ?? []);
  for (const checkRef of event.storyRefs.acceptanceCheckRefs) {
    const owner = chain.promises.find((entry) =>
      entry.acceptanceChecks.some((check) => check.id === checkRef),
    );
    if (!owner) {
      errors.push(`${event.name}: acceptanceCheckRef "${checkRef}" is not declared`);
      continue;
    }
    if (promise && !promiseAcceptanceChecks.has(checkRef)) {
      errors.push(
        `${event.name}: acceptanceCheckRef "${checkRef}" does not belong to ${promise.id}`,
      );
    }
  }
}

export function validateEventContract(
  contract: AnalyticsEventContract,
  chain: StoryChain,
  repoRoot: string,
  options: EventContractValidationOptions = { runtimeSourceCheck: true },
): EventContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const experienceIds = new Set(chain.experiences.map((entry) => entry.id));
  const momentById = new Map(chain.moments.map((entry) => [entry.id, entry]));
  const promiseById = new Map(chain.promises.map((entry) => [entry.id, entry]));
  const aspectById = new Map(chain.aspects.map((entry) => [entry.id, entry]));
  const scenarioIds = parseScenarioIds(repoRoot);
  const eventNames = contract.events.map((event) => event.name);
  const indexes = { experienceIds, momentById, promiseById, aspectById, scenarioIds };

  validateDuplicateValues(eventNames, "events", errors);
  validateSinkNames(contract, errors);
  validatePropertySchemas(contract, errors);

  for (const event of contract.events) {
    validateEventShape(event, contract, errors, warnings);
    validateEventStoryRefs(event, chain, indexes, errors);
  }
  validateRequiredEventCoverage(contract, chain, errors);
  if (options.runtimeSourceCheck ?? true) {
    validateRuntimeEmittedEvents(contract, repoRoot, errors);
  }

  return { errors, warnings };
}

export function validateEventContractOrThrow(
  contract: AnalyticsEventContract,
  chain: StoryChain,
  repoRoot: string,
): EventContractValidationResult {
  const result = validateEventContract(contract, chain, repoRoot);
  if (result.errors.length > 0) {
    throw new AnalyticsEventContractError(result.errors.join("\n"));
  }
  return result;
}
