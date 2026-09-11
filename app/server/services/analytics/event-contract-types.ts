import type {
  AcceptanceCheckRef,
  AspectRef,
  ExperienceRef,
  MomentRef,
  PromiseRef,
} from "@/app/domain/story-chain";

export type AnalyticsEventOwner = "product" | "governance" | "runtime" | "evidence";
export type AnalyticsEventActor = "user" | "agent" | "system" | "evaluator" | "operator";
export type AnalyticsEventSurface =
  | "research-route"
  | "agent_runtime"
  | "admin"
  | "public_site"
  | "cli"
  | "ci";
export type AnalyticsPrivacyLevel =
  | "public_contract"
  | "behavior_metadata"
  | "user_private"
  | "restricted";
export type AnalyticsSignalSeverity = "info" | "warning" | "critical";
export type AnalyticsTriggerSource = "client" | "server" | "runtime" | "cli" | "evidence_runner";
export type AnalyticsTriggerPhase = "requested" | "committed" | "rendered" | "completed" | "failed";
export type AnalyticsEmissionBoundary =
  | "command_handler"
  | "state_transition"
  | "viewed_boundary"
  | "task_enqueue"
  | "failure_boundary";
export type AnalyticsEmissionCardinality =
  | "every_action"
  | "once_per_identity"
  | "once_per_session"
  | "state_transition";
export type AnalyticsPropertyType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "string_or_null"
  | "integer_or_null";
export type AnalyticsPropertySensitivity =
  | "public_contract"
  | "behavior_metadata"
  | "user_private"
  | "restricted";
export type AnalyticsContextGroup = "journey" | "search" | "paper" | "result" | "action";
export type AnalyticsContextLifetime = "journey" | "search_context" | "route_view" | "event";

export interface AnalyticsPropertySchema {
  description: string;
  type: AnalyticsPropertyType;
  examples: unknown[];
  enum?: Array<string | number | boolean | null>;
  range?: { min?: number; max?: number };
  sensitivity: AnalyticsPropertySensitivity;
  contextGroup: AnalyticsContextGroup;
  lifetime: AnalyticsContextLifetime;
  sourceOwner: string;
}

export interface AnalyticsStoryRefs {
  experienceRef?: ExperienceRef;
  momentRef?: MomentRef;
  promiseRef?: PromiseRef;
  relatedPromiseRefs?: PromiseRef[];
  aspectRefs: AspectRef[];
  acceptanceCheckRefs: AcceptanceCheckRef[];
  scenarioRefs: string[];
}

export interface AnalyticsEventDefinition {
  name: string;
  version: number;
  owner: AnalyticsEventOwner;
  actor: AnalyticsEventActor;
  surface: AnalyticsEventSurface;
  storyRefs: AnalyticsStoryRefs;
  observability: {
    realitySignal: boolean;
    signalMeaning: string;
    severity: AnalyticsSignalSeverity;
    requiredForPromiseCoverage: boolean;
  };
  trigger: {
    source: AnalyticsTriggerSource;
    phase: AnalyticsTriggerPhase;
    timing: string;
  };
  measurement?: {
    purpose: string;
    decisionUse: string;
    propertyPurposes: Record<string, string>;
  };
  subject: {
    allowed: string[];
  };
  properties: {
    required: string[];
    optional: string[];
    forbidden: string[];
  };
  privacy: {
    level: AnalyticsPrivacyLevel;
    allowExternalSinks: boolean;
  };
  emission?: {
    boundary: AnalyticsEmissionBoundary;
    cardinality: AnalyticsEmissionCardinality;
    identityKeys: string[];
    emitter: string;
  };
  sinks: Record<string, string>;
}

export interface AnalyticsEventContract {
  propertySchemas?: Record<string, AnalyticsPropertySchema>;
  events: AnalyticsEventDefinition[];
}

export interface EventContractValidationResult {
  errors: string[];
  warnings: string[];
}

export interface EventContractValidationOptions {
  runtimeSourceCheck?: boolean;
}
