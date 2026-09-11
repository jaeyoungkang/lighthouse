// Load-smoke metrics: shared types, request classification, per-endpoint and
// Server-Timing aggregation, and stdout report formatting. Pure functions only
// (no I/O, no network) so the runner and the per-user journey can share them.
//
// Measurement-only operational tooling for incident #183 ("N concurrent
// first-session users, each doing one search"). Not a user-facing behavior
// change — no Story Chain / Promise coupling.

import { validateProviderFixtureEvidence, type ProviderFixtureEvidence } from "./provider-stats";

/** Canonical endpoint labels. Single source of truth shared by journey + metrics. */
export const ENDPOINT_LABELS = {
  searchPage: "GET /search",
  querySearch: "GET /search?q= (query execution)",
  followupEntry: "GET /search?q= (seeded follow-up execution)",
  enrich: "POST /api/search/enrichment",
  termDiscovery: "POST /api/search/term-discovery",
  spelling: "POST /api/search/spelling-correction",
} as const;

const ENDPOINT_ORDER: readonly string[] = Object.values(ENDPOINT_LABELS);

/** Outcome bucket for a single request. 3xx folds into "2xx" (fetch follows redirects). */
type RequestOutcome = "2xx" | "4xx" | "5xx" | "timeout" | "network-error";

const OUTCOME_KEYS: readonly RequestOutcome[] = ["2xx", "4xx", "5xx", "timeout", "network-error"];

/** Per-user search result classification. */
export type SearchOutcome = "ready-with-papers" | "ready-empty" | "error";

const SEARCH_OUTCOME_KEYS: readonly SearchOutcome[] = ["ready-with-papers", "ready-empty", "error"];

/** One recorded request inside a user journey. */
export interface RequestRecord {
  endpoint: string;
  userIndex: number;
  outcome: RequestOutcome;
  status: number | null;
  latencyMs: number;
  /** Offset from cohort start, so the first request failure is ordered by wall-clock time. */
  startOffsetMs: number;
  /** Present for actual HTTP journeys; omitted by legacy/unit-only metric fixtures. */
  method?: "GET" | "POST";
  /** Exact path handed to fetch, including the encoded query string. */
  requestPath?: string;
  /** Redirect-resolved response URL. Null when no response was received. */
  finalUrl?: string | null;
  redirectMode?: "follow" | "manual";
  /** Parsed Server-Timing phases (ms). Present on /run responses. */
  serverTiming?: Record<string, number>;
}

export interface RequestProvenance {
  endpoint: string;
  userIndex: number;
  method: "GET" | "POST";
  requestPath: string;
  finalUrl: string | null;
  redirectMode: "follow" | "manual";
}

/** Input to a single user journey. */
export interface JourneyContext {
  baseUrl: string;
  cookie: string;
  query: string;
  timeoutMs: number;
  userIndex: number;
  cohortStartedAt: number;
}

/** Result of one user journey. */
export interface UserJourneyResult {
  userIndex: number;
  documentId: string | null;
  /** Ordered unique paper identities observed from the rendered search result. */
  paperIds: string[] | null;
  records: RequestRecord[];
}

export interface UserSearchReadiness {
  userIndex: number;
  /** null means the query response was unreadable; [] is a successful empty result. */
  paperIds: string[] | null;
}

interface EndpointStats {
  endpoint: string;
  count: number;
  outcomes: Record<RequestOutcome, number>;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

interface PhaseStats {
  phase: string;
  count: number;
  p50: number;
  p95: number;
  max: number;
}

interface FirstRequestFailure {
  endpoint: string;
  userIndex: number;
  outcome: RequestOutcome;
  status: number | null;
  atMs: number;
}

/** Aggregated result for one cohort (one ramp step). */
export interface CohortResult {
  users: number;
  wallClockMs: number;
  endpoints: EndpointStats[];
  serverTimingPhases: PhaseStats[];
  /** Per-user evidence retained in the machine-readable report. */
  searchReadiness: UserSearchReadiness[];
  /** Exact request/final-URL evidence when the journey was collected over HTTP. */
  requestProvenance?: RequestProvenance[];
  /** Count of 5xx + timeout + network-error records — the collapse signal. */
  totalErrorCount: number;
  firstRequestFailure: FirstRequestFailure | null;
}

/** Map an HTTP status to an outcome bucket (3xx counts as success). */
export function classifyOutcome(status: number): RequestOutcome {
  if (status >= 200 && status < 400) return "2xx";
  if (status >= 400 && status < 500) return "4xx";
  return "5xx";
}

/** Parse a `Server-Timing` header into a phase -> duration(ms) map. */
export function parseServerTiming(header: string | null): Record<string, number> {
  const result: Record<string, number> = {};
  if (header === null || header.trim() === "") return result;

  for (const part of header.split(",")) {
    const segments = part.split(";").map((segment) => segment.trim());
    const name = segments[0];
    if (name === "") continue;
    const durationSegment = segments.find((segment) => segment.startsWith("dur="));
    if (durationSegment === undefined) continue;
    const duration = Number(durationSegment.slice("dur=".length));
    if (Number.isFinite(duration)) result[name] = duration;
  }

  return result;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(fraction * sorted.length) - 1;
  const index = Math.min(sorted.length - 1, Math.max(0, rank));
  return sorted[index];
}

function emptyOutcomeTally(): Record<RequestOutcome, number> {
  const tally = {} as Record<RequestOutcome, number>;
  for (const key of OUTCOME_KEYS) tally[key] = 0;
  return tally;
}

function emptySearchTally(): Record<SearchOutcome, number> {
  const tally = {} as Record<SearchOutcome, number>;
  for (const key of SEARCH_OUTCOME_KEYS) tally[key] = 0;
  return tally;
}

function hasValidPaperIdentities(paperIds: string[] | null): boolean {
  if (paperIds === null) return true;
  if (!Array.isArray(paperIds)) return false;
  const seen = new Set<string>();
  for (const paperId of paperIds) {
    if (typeof paperId !== "string" || paperId.trim() === "" || seen.has(paperId)) return false;
    seen.add(paperId);
  }
  return true;
}

function searchOutcomeFromPaperIds(paperIds: string[] | null): SearchOutcome | null {
  if (!hasValidPaperIdentities(paperIds)) return null;
  if (paperIds === null) return "error";
  return paperIds.length > 0 ? "ready-with-papers" : "ready-empty";
}

function buildSearchReadiness(journey: UserJourneyResult): UserSearchReadiness {
  const searchOutcome = searchOutcomeFromPaperIds(journey.paperIds);
  if (searchOutcome === null) {
    throw new Error(`invalid search paper identities for user ${String(journey.userIndex)}`);
  }
  return {
    userIndex: journey.userIndex,
    paperIds: journey.paperIds === null ? null : [...journey.paperIds],
  };
}

function aggregateSearchOutcomes(
  searchReadiness: readonly UserSearchReadiness[],
): Record<SearchOutcome, number> {
  const tally = emptySearchTally();
  for (const readiness of searchReadiness) {
    const searchOutcome = searchOutcomeFromPaperIds(readiness.paperIds);
    if (searchOutcome !== null) tally[searchOutcome] += 1;
  }
  return tally;
}

function validateSearchReadinessIdentities(
  users: number,
  searchReadiness: readonly UserSearchReadiness[],
): { reasons: string[]; uniqueEntries: UserSearchReadiness[] } {
  const reasons: string[] = [];
  const seen = new Set<number>();
  const uniqueEntries: UserSearchReadiness[] = [];
  for (const readiness of searchReadiness) {
    if (
      !Number.isInteger(readiness.userIndex) ||
      readiness.userIndex < 0 ||
      readiness.userIndex >= users
    ) {
      reasons.push(`invalid search readiness user index ${String(readiness.userIndex)}`);
      continue;
    }
    if (seen.has(readiness.userIndex)) {
      reasons.push(`duplicate search readiness for user ${String(readiness.userIndex)}`);
      continue;
    }
    seen.add(readiness.userIndex);
    uniqueEntries.push(readiness);
  }

  const missing = Array.from({ length: users }, (_unused, userIndex) => userIndex).filter(
    (userIndex) => !seen.has(userIndex),
  );
  if (missing.length > 0) {
    reasons.push(`missing search readiness for user(s) ${missing.map(String).join(",")}`);
  }
  return { reasons, uniqueEntries };
}

function evaluateSearchReadiness(
  users: number,
  searchReadiness: readonly UserSearchReadiness[],
): { reasons: string[]; validEntries: UserSearchReadiness[] } {
  const identities = validateSearchReadinessIdentities(users, searchReadiness);
  const reasons = [...identities.reasons];
  const validEntries: UserSearchReadiness[] = [];
  for (const readiness of identities.uniqueEntries) {
    if (searchOutcomeFromPaperIds(readiness.paperIds) === null) {
      reasons.push(`user ${String(readiness.userIndex)} has invalid search paper identities`);
      continue;
    }
    validEntries.push(readiness);
  }
  return { reasons, validEntries };
}

function orderEndpoints(labels: string[]): string[] {
  return [...labels].sort((left, right) => {
    const leftIndex = ENDPOINT_ORDER.indexOf(left);
    const rightIndex = ENDPOINT_ORDER.indexOf(right);
    const leftRank = leftIndex === -1 ? ENDPOINT_ORDER.length : leftIndex;
    const rightRank = rightIndex === -1 ? ENDPOINT_ORDER.length : rightIndex;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.localeCompare(right);
  });
}

function aggregateEndpoints(records: RequestRecord[]): EndpointStats[] {
  const byEndpoint = new Map<string, RequestRecord[]>();
  for (const record of records) {
    const bucket = byEndpoint.get(record.endpoint);
    if (bucket === undefined) byEndpoint.set(record.endpoint, [record]);
    else bucket.push(record);
  }

  return orderEndpoints([...byEndpoint.keys()]).map((endpoint) => {
    const bucket = byEndpoint.get(endpoint) ?? [];
    const outcomes = emptyOutcomeTally();
    const latencies: number[] = [];
    for (const record of bucket) {
      outcomes[record.outcome] += 1;
      latencies.push(record.latencyMs);
    }
    return {
      endpoint,
      count: bucket.length,
      outcomes,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies.length === 0 ? 0 : Math.max(...latencies),
    };
  });
}

function aggregateServerTiming(records: RequestRecord[]): PhaseStats[] {
  const byPhase = new Map<string, number[]>();
  for (const record of records) {
    if (record.endpoint !== ENDPOINT_LABELS.querySearch || record.serverTiming === undefined) {
      continue;
    }
    for (const [phase, duration] of Object.entries(record.serverTiming)) {
      const bucket = byPhase.get(phase);
      if (bucket === undefined) byPhase.set(phase, [duration]);
      else bucket.push(duration);
    }
  }

  return [...byPhase.keys()].sort().map((phase) => {
    const durations = byPhase.get(phase) ?? [];
    return {
      phase,
      count: durations.length,
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      max: durations.length === 0 ? 0 : Math.max(...durations),
    };
  });
}

function findFirstRequestFailure(records: RequestRecord[]): FirstRequestFailure | null {
  let earliest: RequestRecord | null = null;
  for (const record of records) {
    if (
      record.outcome !== "5xx" &&
      record.outcome !== "timeout" &&
      record.outcome !== "network-error"
    ) {
      continue;
    }
    if (earliest === null || record.startOffsetMs < earliest.startOffsetMs) earliest = record;
  }
  if (earliest === null) return null;
  return {
    endpoint: earliest.endpoint,
    userIndex: earliest.userIndex,
    outcome: earliest.outcome,
    status: earliest.status,
    atMs: earliest.startOffsetMs,
  };
}

function collectRequestProvenance(records: RequestRecord[]): RequestProvenance[] {
  return records.flatMap((record) => {
    if (
      record.method === undefined ||
      record.requestPath === undefined ||
      record.redirectMode === undefined
    ) {
      return [];
    }
    return [
      {
        endpoint: record.endpoint,
        userIndex: record.userIndex,
        method: record.method,
        requestPath: record.requestPath,
        finalUrl: record.finalUrl ?? null,
        redirectMode: record.redirectMode,
      },
    ];
  });
}

/** Reduce one cohort's journeys into an aggregated, serializable result. */
export function summarizeCohort(
  users: number,
  wallClockMs: number,
  journeys: UserJourneyResult[],
): CohortResult {
  const records = journeys.flatMap((journey) => journey.records);
  const searchReadiness = journeys.map(buildSearchReadiness);
  const readinessEvaluation = evaluateSearchReadiness(users, searchReadiness);
  if (readinessEvaluation.reasons.length > 0) {
    throw new Error(readinessEvaluation.reasons.join("; "));
  }
  const totalErrorCount = records.filter(
    (record) =>
      record.outcome === "5xx" ||
      record.outcome === "timeout" ||
      record.outcome === "network-error",
  ).length;
  const requestProvenance = collectRequestProvenance(records);

  return {
    users,
    wallClockMs,
    endpoints: aggregateEndpoints(records),
    serverTimingPhases: aggregateServerTiming(records),
    searchReadiness,
    ...(requestProvenance.length === 0 ? {} : { requestProvenance }),
    totalErrorCount,
    firstRequestFailure: findFirstRequestFailure(records),
  };
}

export interface CohortGoNoGoVerdict {
  ok: boolean;
  reasons: string[];
}

/**
 * Search-anchor p95 budget (ms) for the go/no-go verdict. Transcribed to
 * docs/operational-readiness.md §1 — this constant is the owner, the doc copies it.
 */
export const SEARCH_P95_BUDGET_MS = 3_000;

export function getCohortGoNoGoVerdict(cohort: CohortResult): CohortGoNoGoVerdict {
  const reasons: string[] = [];
  if (cohort.totalErrorCount > 0) {
    reasons.push(`${String(cohort.totalErrorCount)} 5xx/timeout/network-error request(s)`);
  }

  const readinessEvaluation = evaluateSearchReadiness(cohort.users, cohort.searchReadiness);
  reasons.push(...readinessEvaluation.reasons);

  let readyWithPapers = 0;
  for (const readiness of readinessEvaluation.validEntries) {
    if (searchOutcomeFromPaperIds(readiness.paperIds) === "ready-with-papers") {
      readyWithPapers += 1;
    }
  }
  if (readyWithPapers !== cohort.users) {
    reasons.push(`${String(readyWithPapers)}/${String(cohort.users)} users ready with papers`);
  }

  // Latency criterion on the search anchor. A run with no samples cannot prove
  // the budget, so missing measurement is a no-go, never a silent green.
  const searchStats = cohort.endpoints.find(
    (endpoint) => endpoint.endpoint === ENDPOINT_LABELS.querySearch,
  );
  if (searchStats === undefined || searchStats.count === 0) {
    reasons.push(`no ${ENDPOINT_LABELS.querySearch} samples — p95 unmeasured`);
  } else if (searchStats.p95 >= SEARCH_P95_BUDGET_MS) {
    reasons.push(
      `${ENDPOINT_LABELS.querySearch} p95 ${searchStats.p95.toFixed(1)}ms >= ${String(SEARCH_P95_BUDGET_MS)}ms budget`,
    );
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export interface FirstWorkloadBreak {
  cohortIndex: number;
  users: number;
  reasons: string[];
}

export type LoadSmokeMode = "one-shot" | "ramp" | "sustained-closed" | "sustained-open";

export interface SustainedWorkloadSummary {
  arrivalModel: "closed" | "open";
  configuredDurationMs: number;
  wallClockMs: number;
  scheduledArrivals: number;
  admittedJourneys: number;
  completedJourneys: number;
  shedArrivals: number;
  maxInFlight: number;
  achievedThroughputPerSecond: number;
}

export interface LoadSmokeReportPayloadInput {
  generatedAt: string;
  runLabel: string;
  node: string;
  config: {
    baseUrl: string;
    query: string;
    timeoutMs: number;
    mode: LoadSmokeMode;
    targetRevision: string;
    workingTreeDirty: boolean;
    runOwner: string;
    inputProfile: string;
    providerProfile: string;
    topologyProfile: string;
    users?: number;
    ramp?: number[];
    durationMs?: number;
    warmupMs?: number;
    cooldownPolicy?: "drain-admitted";
    concurrency?: number;
    arrivalRatePerSecond?: number;
    maxInFlight?: number;
  };
}

function isPositiveInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}

function isPositiveFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function validateReportIdentity(input: LoadSmokeReportPayloadInput): void {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(input.config.targetRevision)) {
    throw new Error("load-smoke report requires an exact Git revision");
  }
  for (const [label, value] of [
    ["runOwner", input.config.runOwner],
    ["inputProfile", input.config.inputProfile],
    ["providerProfile", input.config.providerProfile],
    ["topologyProfile", input.config.topologyProfile],
  ] as const) {
    if (value.trim() === "") throw new Error(`load-smoke report requires non-empty ${label}`);
  }
}

function rejectDefinedConfigFields(
  mode: LoadSmokeMode,
  fields: ReadonlyArray<readonly [name: string, value: unknown]>,
): void {
  const conflictingField = fields.find(([, value]) => value !== undefined)?.[0];
  if (conflictingField !== undefined) {
    throw new Error(`${mode} report cannot carry ${conflictingField} config`);
  }
}

function validateModeSpecificConfig(input: LoadSmokeReportPayloadInput): void {
  const config = input.config;
  const sustainedFields = [
    ["durationMs", config.durationMs],
    ["warmupMs", config.warmupMs],
    ["cooldownPolicy", config.cooldownPolicy],
    ["concurrency", config.concurrency],
    ["arrivalRatePerSecond", config.arrivalRatePerSecond],
    ["maxInFlight", config.maxInFlight],
  ] as const;

  if (config.mode === "one-shot") {
    rejectDefinedConfigFields(config.mode, [["ramp", config.ramp], ...sustainedFields]);
    return;
  }
  if (config.mode === "ramp") {
    rejectDefinedConfigFields(config.mode, [["users", config.users], ...sustainedFields]);
    return;
  }
  if (config.mode === "sustained-closed") {
    rejectDefinedConfigFields(config.mode, [
      ["users", config.users],
      ["ramp", config.ramp],
      ["arrivalRatePerSecond", config.arrivalRatePerSecond],
      ["maxInFlight", config.maxInFlight],
    ]);
    return;
  }
  rejectDefinedConfigFields(config.mode, [
    ["users", config.users],
    ["ramp", config.ramp],
    ["concurrency", config.concurrency],
  ]);
}

function validateSustainedReport(
  input: LoadSmokeReportPayloadInput,
  cohorts: CohortResult[],
  workload: SustainedWorkloadSummary,
): void {
  const expectedArrivalModel = input.config.mode === "sustained-closed" ? "closed" : "open";
  if (workload.arrivalModel !== expectedArrivalModel) {
    throw new Error(
      `${input.config.mode} report cannot carry ${workload.arrivalModel} arrival evidence`,
    );
  }
  if (!isPositiveFinite(input.config.durationMs)) {
    throw new Error(`${input.config.mode} report requires a positive durationMs`);
  }
  if (input.config.warmupMs !== 0 || input.config.cooldownPolicy !== "drain-admitted") {
    throw new Error(`${input.config.mode} report requires declared warm-up and cool-down policy`);
  }
  if (workload.configuredDurationMs !== input.config.durationMs) {
    throw new Error("sustained workload duration must match report config");
  }
  if (cohorts.length !== 1 || cohorts[0]?.users !== workload.admittedJourneys) {
    throw new Error("sustained workload evidence must match exactly one admitted journey cohort");
  }
  for (const [label, value] of [
    ["scheduledArrivals", workload.scheduledArrivals],
    ["admittedJourneys", workload.admittedJourneys],
    ["completedJourneys", workload.completedJourneys],
    ["shedArrivals", workload.shedArrivals],
    ["maxInFlight", workload.maxInFlight],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`sustained workload ${label} must be a non-negative integer`);
    }
  }
  if (
    !Number.isFinite(workload.wallClockMs) ||
    workload.wallClockMs < 0 ||
    !Number.isFinite(workload.achievedThroughputPerSecond) ||
    workload.achievedThroughputPerSecond < 0
  ) {
    throw new Error("sustained workload timing and throughput must be finite and non-negative");
  }
  if (
    workload.completedJourneys > workload.admittedJourneys ||
    workload.admittedJourneys > workload.scheduledArrivals
  ) {
    throw new Error("sustained workload completion/admission counts are inconsistent");
  }

  if (input.config.mode === "sustained-closed") {
    if (!isPositiveInteger(input.config.concurrency)) {
      throw new Error("sustained-closed report requires positive concurrency");
    }
    if (
      workload.scheduledArrivals !== workload.admittedJourneys ||
      workload.shedArrivals !== 0 ||
      workload.maxInFlight > input.config.concurrency
    ) {
      throw new Error("sustained-closed admission evidence is inconsistent with concurrency");
    }
    return;
  }

  if (
    !isPositiveFinite(input.config.arrivalRatePerSecond) ||
    !isPositiveInteger(input.config.maxInFlight)
  ) {
    throw new Error("sustained-open report requires positive arrival rate and max in-flight");
  }
  if (
    workload.shedArrivals !== workload.scheduledArrivals - workload.admittedJourneys ||
    workload.maxInFlight > input.config.maxInFlight
  ) {
    throw new Error("sustained-open admission evidence is inconsistent with max in-flight");
  }
}

function validateOneShotOrRampReport(
  input: LoadSmokeReportPayloadInput,
  cohorts: CohortResult[],
): void {
  if (input.config.mode === "one-shot") {
    if (
      !isPositiveInteger(input.config.users) ||
      cohorts.length !== 1 ||
      cohorts[0]?.users !== input.config.users
    ) {
      throw new Error("one-shot report requires exactly one matching positive user cohort");
    }
    return;
  }
  if (input.config.mode !== "ramp") return;
  const ramp = input.config.ramp;
  if (
    ramp === undefined ||
    ramp.length === 0 ||
    ramp.some((users) => !isPositiveInteger(users)) ||
    ramp.length !== cohorts.length ||
    cohorts.some((cohort, index) => cohort.users !== ramp[index])
  ) {
    throw new Error("ramp report requires ordered cohorts matching every positive ramp step");
  }
}

/** Build the versioned machine-readable report before the runner writes it. */
export function buildLoadSmokeReportPayload(
  input: LoadSmokeReportPayloadInput,
  cohorts: CohortResult[],
  sustainedWorkload?: SustainedWorkloadSummary,
  providerFixtureEvidence?: ProviderFixtureEvidence,
) {
  validateReportIdentity(input);
  validateModeSpecificConfig(input);
  const sustainedMode =
    input.config.mode === "sustained-closed" || input.config.mode === "sustained-open";
  if (sustainedMode && sustainedWorkload === undefined) {
    throw new Error(`${input.config.mode} report requires sustained workload evidence`);
  }
  if (!sustainedMode && sustainedWorkload !== undefined) {
    throw new Error(`${input.config.mode} report cannot carry sustained workload evidence`);
  }
  if (sustainedWorkload !== undefined) {
    validateSustainedReport(input, cohorts, sustainedWorkload);
  } else {
    validateOneShotOrRampReport(input, cohorts);
  }
  if (providerFixtureEvidence !== undefined) {
    validateProviderFixtureEvidence(providerFixtureEvidence);
    const completedJourneys =
      sustainedWorkload?.completedJourneys ??
      cohorts.reduce((total, cohort) => total + cohort.users, 0);
    if (providerFixtureEvidence.completedJourneys !== completedJourneys) {
      throw new Error("provider fixture evidence does not match workload completion");
    }
  }

  return {
    schemaVersion: "5",
    ...input,
    cohorts,
    ...(input.config.mode === "ramp"
      ? { firstWorkloadBreak: findFirstWorkloadBreak(cohorts) }
      : {}),
    ...(sustainedWorkload === undefined ? {} : { sustainedWorkload }),
    ...(providerFixtureEvidence === undefined ? {} : { providerFixtureEvidence }),
  };
}

/** Closed/open client admission verdict, combined with the existing user-outcome SLO. */
export function getSustainedGoNoGoVerdict(
  cohort: CohortResult,
  workload: SustainedWorkloadSummary,
): CohortGoNoGoVerdict {
  const reasons = [...getCohortGoNoGoVerdict(cohort).reasons];
  if (workload.scheduledArrivals === 0) reasons.push("no sustained arrivals were scheduled");
  if (workload.completedJourneys !== workload.admittedJourneys) {
    reasons.push(
      `${String(workload.completedJourneys)}/${String(workload.admittedJourneys)} admitted journeys completed`,
    );
  }
  if (workload.shedArrivals > 0) {
    reasons.push(`${String(workload.shedArrivals)} client admission(s) shed`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** Find the first ramp workload step whose full go/no-go verdict fails. */
export function findFirstWorkloadBreak(cohorts: CohortResult[]): FirstWorkloadBreak | null {
  for (const [cohortIndex, cohort] of cohorts.entries()) {
    const verdict = getCohortGoNoGoVerdict(cohort);
    if (!verdict.ok) return { cohortIndex, users: cohort.users, reasons: verdict.reasons };
  }
  return null;
}

function ms(value: number): string {
  return `${value.toFixed(1)}ms`;
}

/** Format one cohort or sustained journey set as a human-readable stdout block. */
export function formatCohortReport(
  cohort: CohortResult,
  subject: "concurrent-users" | "admitted-journeys" = "concurrent-users",
): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("=".repeat(78));
  lines.push(
    subject === "concurrent-users"
      ? `COHORT — ${String(cohort.users)} concurrent users`
      : `SUSTAINED RESULT — ${String(cohort.users)} admitted journeys`,
  );
  lines.push("=".repeat(78));
  lines.push(
    `wall-clock: ${ms(cohort.wallClockMs)}   5xx+timeout+network: ${String(cohort.totalErrorCount)}`,
  );

  lines.push("");
  lines.push("Per-endpoint (latency over all attempts; timeouts ~= --timeout-ms):");
  lines.push(
    `  ${"endpoint".padEnd(46)}${"n".padStart(4)} ${"2xx".padStart(4)} ${"4xx".padStart(4)} ${"5xx".padStart(4)} ${"t/o".padStart(4)} ${"err".padStart(4)}  ${"p50".padStart(9)} ${"p95".padStart(9)} ${"p99".padStart(9)} ${"max".padStart(9)}`,
  );
  for (const endpoint of cohort.endpoints) {
    lines.push(
      `  ${endpoint.endpoint.padEnd(46)}${String(endpoint.count).padStart(4)} ${String(endpoint.outcomes["2xx"]).padStart(4)} ${String(endpoint.outcomes["4xx"]).padStart(4)} ${String(endpoint.outcomes["5xx"]).padStart(4)} ${String(endpoint.outcomes.timeout).padStart(4)} ${String(endpoint.outcomes["network-error"]).padStart(4)}  ${ms(endpoint.p50).padStart(9)} ${ms(endpoint.p95).padStart(9)} ${ms(endpoint.p99).padStart(9)} ${ms(endpoint.max).padStart(9)}`,
    );
  }

  lines.push("");
  lines.push("/search?q= Server-Timing phases:");
  if (cohort.serverTimingPhases.length === 0) {
    lines.push("  (no Server-Timing captured)");
  } else {
    lines.push(
      `  ${"phase".padEnd(20)}${"n".padStart(4)}  ${"p50".padStart(9)} ${"p95".padStart(9)} ${"max".padStart(9)}`,
    );
    for (const phase of cohort.serverTimingPhases) {
      lines.push(
        `  ${phase.phase.padEnd(20)}${String(phase.count).padStart(4)}  ${ms(phase.p50).padStart(9)} ${ms(phase.p95).padStart(9)} ${ms(phase.max).padStart(9)}`,
      );
    }
  }

  lines.push("");
  lines.push("Search readiness outcome:");
  const readinessEvaluation = evaluateSearchReadiness(cohort.users, cohort.searchReadiness);
  const searchOutcomes = aggregateSearchOutcomes(readinessEvaluation.validEntries);
  for (const key of SEARCH_OUTCOME_KEYS) {
    lines.push(`  ${key.padEnd(20)}${String(searchOutcomes[key]).padStart(4)}`);
  }

  lines.push("");
  if (cohort.firstRequestFailure === null) {
    lines.push("First request failure: none (no 5xx/timeout/network-error)");
  } else {
    const status =
      cohort.firstRequestFailure.status === null ? "-" : String(cohort.firstRequestFailure.status);
    lines.push(
      `First request failure: ${cohort.firstRequestFailure.endpoint} (${cohort.firstRequestFailure.outcome}, status ${status}, user ${String(cohort.firstRequestFailure.userIndex)}, +${ms(cohort.firstRequestFailure.atMs)})`,
    );
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

/** Format the ramp summary table across cohorts. */
export function formatRampTable(cohorts: CohortResult[]): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("RAMP SUMMARY");
  lines.push("=".repeat(78));
  lines.push(
    `  ${"users".padStart(6)} ${"wall".padStart(11)} ${"5xx+t/o+err".padStart(11)} ${"verdict".padStart(8)}  first-request-failure`,
  );
  for (const cohort of cohorts) {
    const verdict = getCohortGoNoGoVerdict(cohort);
    const firstRequestFailure =
      cohort.firstRequestFailure === null
        ? "-"
        : `${cohort.firstRequestFailure.endpoint} (+${ms(cohort.firstRequestFailure.atMs)})`;
    lines.push(
      `  ${String(cohort.users).padStart(6)} ${ms(cohort.wallClockMs).padStart(11)} ${String(cohort.totalErrorCount).padStart(11)} ${(verdict.ok ? "PASS" : "NO-GO").padStart(8)}  ${firstRequestFailure}`,
    );
  }
  const firstWorkloadBreak = findFirstWorkloadBreak(cohorts);
  lines.push("");
  lines.push(
    firstWorkloadBreak === null
      ? "First workload break: none (every ramp step passed go/no-go)"
      : `First workload break: step ${String(firstWorkloadBreak.cohortIndex + 1)} at ${String(firstWorkloadBreak.users)} users — ${firstWorkloadBreak.reasons.join("; ")}`,
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}

/** Format the client-side arrival/admission envelope for a sustained run. */
export function formatSustainedReport(workload: SustainedWorkloadSummary): string {
  const lines = [
    "",
    "=".repeat(78),
    "SUSTAINED WORKLOAD",
    "=".repeat(78),
    `arrival model: ${workload.arrivalModel}`,
    `admission window: ${ms(workload.configuredDurationMs)}   wall-clock including drain: ${ms(workload.wallClockMs)}`,
    `arrivals: ${String(workload.scheduledArrivals)}   admitted: ${String(workload.admittedJourneys)}   completed: ${String(workload.completedJourneys)}   client-shed: ${String(workload.shedArrivals)}`,
    `max in-flight: ${String(workload.maxInFlight)}   achieved journey throughput: ${workload.achievedThroughputPerSecond.toFixed(2)}/s`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}
