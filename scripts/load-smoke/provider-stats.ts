import {
  PROVIDER_FIXTURE_PROFILES,
  type ProviderFixtureProfile,
  type ProviderFixtureStats,
} from "./provider-fixture";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const PROVIDER_STATS_TIMEOUT_MS = 3_000;

export interface ProviderFixtureEvidence {
  source: "loopback-provider-fixture";
  statsUrl: string;
  attribution: "zero-baseline";
  baseline: ProviderFixtureStats;
  final: ProviderFixtureStats;
  completedJourneys: number;
  requestsPerCompletedJourney: number;
}

function readNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`provider fixture stats ${label} must be a non-negative integer`);
  }
  return value as number;
}

function readPositiveInteger(value: unknown, label: string): number {
  const parsed = readNonNegativeInteger(value, label);
  if (parsed === 0) throw new Error(`provider fixture stats ${label} must be positive`);
  return parsed;
}

function readProfile(value: unknown): ProviderFixtureProfile {
  if (!PROVIDER_FIXTURE_PROFILES.includes(value as ProviderFixtureProfile)) {
    throw new Error("provider fixture stats profile is unsupported");
  }
  return value as ProviderFixtureProfile;
}

export function parseProviderFixtureStats(value: unknown): ProviderFixtureStats {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("provider fixture stats must be an object");
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.responses !== "object" ||
    record.responses === null ||
    Array.isArray(record.responses)
  ) {
    throw new Error("provider fixture stats responses must be an object");
  }
  const responses = record.responses as Record<string, unknown>;
  return {
    profile: readProfile(record.profile),
    configuredDelayMs: readNonNegativeInteger(record.configuredDelayMs, "configuredDelayMs"),
    configuredPaperCount: readPositiveInteger(record.configuredPaperCount, "configuredPaperCount"),
    searchRequests: readNonNegativeInteger(record.searchRequests, "searchRequests"),
    inFlight: readNonNegativeInteger(record.inFlight, "inFlight"),
    maxInFlight: readNonNegativeInteger(record.maxInFlight, "maxInFlight"),
    responses: {
      success: readNonNegativeInteger(responses.success, "responses.success"),
      rateLimited: readNonNegativeInteger(responses.rateLimited, "responses.rateLimited"),
      serverError: readNonNegativeInteger(responses.serverError, "responses.serverError"),
    },
  };
}

export function assertSafeProviderStatsUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`--provider-stats-url is not a valid URL: ${rawUrl}`);
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "");
  if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(hostname)) {
    throw new Error("--provider-stats-url must use HTTP on a loopback host");
  }
  if (
    url.pathname !== "/__stats" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new Error("--provider-stats-url must target the fixture /__stats endpoint exactly");
  }
  return url.toString();
}

export async function readProviderFixtureStats(statsUrl: string): Promise<ProviderFixtureStats> {
  const safeUrl = assertSafeProviderStatsUrl(statsUrl);
  const response = await fetch(safeUrl, { signal: AbortSignal.timeout(PROVIDER_STATS_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`provider fixture stats returned HTTP ${String(response.status)}`);
  }
  return parseProviderFixtureStats(await response.json());
}

function responseCount(stats: ProviderFixtureStats): number {
  return stats.responses.success + stats.responses.rateLimited + stats.responses.serverError;
}

export function assertCleanProviderFixtureBaseline(stats: ProviderFixtureStats): void {
  if (
    stats.searchRequests !== 0 ||
    stats.inFlight !== 0 ||
    stats.maxInFlight !== 0 ||
    responseCount(stats) !== 0
  ) {
    throw new Error(
      "provider fixture stats require a fresh zero baseline; restart the fixture before the run",
    );
  }
}

export function buildProviderFixtureEvidence(
  statsUrl: string,
  baseline: ProviderFixtureStats,
  final: ProviderFixtureStats,
  completedJourneys: number,
): ProviderFixtureEvidence {
  const safeUrl = assertSafeProviderStatsUrl(statsUrl);
  assertCleanProviderFixtureBaseline(baseline);
  if (!Number.isInteger(completedJourneys) || completedJourneys <= 0) {
    throw new Error("provider fixture evidence requires positive completedJourneys");
  }
  if (
    final.profile !== baseline.profile ||
    final.configuredDelayMs !== baseline.configuredDelayMs ||
    final.configuredPaperCount !== baseline.configuredPaperCount
  ) {
    throw new Error("provider fixture configuration changed during the load-smoke run");
  }
  if (
    final.inFlight !== 0 ||
    responseCount(final) !== final.searchRequests ||
    final.maxInFlight > final.searchRequests ||
    (final.searchRequests > 0 && final.maxInFlight === 0)
  ) {
    throw new Error("provider fixture final stats are incomplete or internally inconsistent");
  }
  return {
    source: "loopback-provider-fixture",
    statsUrl: safeUrl,
    attribution: "zero-baseline",
    baseline,
    final,
    completedJourneys,
    requestsPerCompletedJourney: final.searchRequests / completedJourneys,
  };
}

export function validateProviderFixtureEvidence(evidence: ProviderFixtureEvidence): void {
  const rawEvidence = evidence as unknown as Record<string, unknown>;
  const rebuilt = buildProviderFixtureEvidence(
    evidence.statsUrl,
    parseProviderFixtureStats(evidence.baseline),
    parseProviderFixtureStats(evidence.final),
    evidence.completedJourneys,
  );
  if (
    rawEvidence.source !== rebuilt.source ||
    rawEvidence.attribution !== rebuilt.attribution ||
    evidence.requestsPerCompletedJourney !== rebuilt.requestsPerCompletedJourney
  ) {
    throw new Error("provider fixture evidence derived fields are inconsistent");
  }
}
