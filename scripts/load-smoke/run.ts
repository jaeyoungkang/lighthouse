// Load-smoke runner for Light House incident #183: "N concurrent first-session
// users, each doing one search." Operational measurement tooling only — it does
// NOT change product behavior and has no Story Chain coupling.
//
// SAFETY: refuses to run against anything but a loopback host unless BOTH
// --allow-remote and --i-understand-not-prod are passed, and ALWAYS hard-errors
// on hosts that look like production/managed infrastructure.
//
// Usage:
//   npm run load-smoke -- --users 20
//   npm run load-smoke -- --ramp 5,10,20,40
//   npm run load-smoke -- --mode sustained-closed --users 20 --duration 300 ...
//   npm run load-smoke -- --mode sustained-open --arrival-rate 2 --max-in-flight 20 --duration 300 ...
//   npm run load-smoke -- --base-url http://localhost:3000 --query "transformer attention"
//
// Prereqs: `supabase start` and `npm run dev` running locally, and
// MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET set (loaded from .env.local by the npm script).

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadAuthConfig, mintUserCookie, type AuthConfig } from "./mint-session";
import {
  buildLoadSmokeReportPayload,
  formatCohortReport,
  formatRampTable,
  formatSustainedReport,
  getCohortGoNoGoVerdict,
  getSustainedGoNoGoVerdict,
  summarizeCohort,
  type CohortResult,
  type JourneyContext,
  type LoadSmokeMode,
  type SustainedWorkloadSummary,
  type UserJourneyResult,
} from "./metrics";
import { runUserJourney } from "./user-journey";
import { runSustainedClosed, runSustainedOpen, type SustainedWorkloadExecution } from "./workload";
import {
  assertCleanProviderFixtureBaseline,
  assertSafeProviderStatsUrl,
  buildProviderFixtureEvidence,
  readProviderFixtureStats,
  type ProviderFixtureEvidence,
} from "./provider-stats";
import {
  DEFAULT_LOAD_SMOKE_REPORT_RETENTION,
  pruneLoadSmokeReports,
} from "../local-artifacts/cleanup";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_QUERY = "transformer attention";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_USERS = 10;
const DEFAULT_INPUT_PROFILE = "single-query-first-session-v1";
const DEFAULT_PROVIDER_PROFILE = "runtime-configured-live-path-unverified";

const BLOCKED_HOST_SUBSTRINGS: readonly string[] = [
  "vercel.app",
  "themoonlight.io",
  "borca.ai",
  "supabase.co",
];
const LOOPBACK_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "::1"];

interface CliOptions {
  baseUrl: string;
  query: string;
  timeoutMs: number;
  users: number;
  ramp: number[] | null;
  mode: "one-shot" | "sustained-closed" | "sustained-open";
  durationMs: number | null;
  arrivalRatePerSecond: number | null;
  maxInFlight: number | null;
  inputProfile: string | null;
  providerProfile: string | null;
  providerStatsUrl: string | null;
  topologyProfile: string | null;
  runOwner: string | null;
  allowRemote: boolean;
  iUnderstand: boolean;
  runLabel: string | null;
  help: boolean;
}

interface GitIdentity {
  targetRevision: string;
  workingTreeDirty: boolean;
}

interface ProviderStatsBinding {
  statsUrl: string;
  baseline: Awaited<ReturnType<typeof readProviderFixtureStats>>;
}

function valueAt(argv: string[], index: number): string | undefined {
  return index < argv.length ? argv[index] : undefined;
}

function requireValue(value: string | undefined, flag: string): string {
  if (value === undefined) throw new Error(`${flag} requires a value`);
  return value;
}

function parsePositiveInt(value: string | undefined, flag: string): number {
  if (value === undefined) throw new Error(`${flag} requires a value`);
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer (got "${value}")`);
  }
  return parsed;
}

function parsePositiveNumber(value: string | undefined, flag: string): number {
  if (value === undefined) throw new Error(`${flag} requires a value`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number (got "${value}")`);
  }
  return parsed;
}

function parseMode(value: string | undefined, flag: string): CliOptions["mode"] {
  const mode = requireValue(value, flag);
  if (mode === "one-shot" || mode === "sustained-closed" || mode === "sustained-open") {
    return mode;
  }
  throw new Error(`${flag} must be one-shot, sustained-closed, or sustained-open`);
}

function parseRamp(value: string | undefined, flag: string): number[] {
  const raw = requireValue(value, flag);
  const sizes = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .map((entry) => parsePositiveInt(entry, flag));
  if (sizes.length === 0) {
    throw new Error(`${flag} needs at least one positive integer, e.g. 5,10,20,40`);
  }
  return sizes;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: DEFAULT_BASE_URL,
    query: DEFAULT_QUERY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    users: DEFAULT_USERS,
    ramp: null,
    mode: "one-shot",
    durationMs: null,
    arrivalRatePerSecond: null,
    maxInFlight: null,
    inputProfile: null,
    providerProfile: null,
    providerStatsUrl: null,
    topologyProfile: null,
    runOwner: null,
    allowRemote: false,
    iUnderstand: false,
    runLabel: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--allow-remote") {
      options.allowRemote = true;
      continue;
    }
    if (arg === "--i-understand-not-prod") {
      options.iUnderstand = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    const value = valueAt(argv, i + 1);
    switch (arg) {
      case "--users":
        options.users = parsePositiveInt(value, arg);
        i += 1;
        break;
      case "--ramp":
        options.ramp = parseRamp(value, arg);
        i += 1;
        break;
      case "--mode":
        options.mode = parseMode(value, arg);
        i += 1;
        break;
      case "--duration":
        options.durationMs = parsePositiveNumber(value, arg) * 1_000;
        i += 1;
        break;
      case "--arrival-rate":
        options.arrivalRatePerSecond = parsePositiveNumber(value, arg);
        i += 1;
        break;
      case "--max-in-flight":
        options.maxInFlight = parsePositiveInt(value, arg);
        i += 1;
        break;
      case "--input-profile":
        options.inputProfile = requireValue(value, arg);
        i += 1;
        break;
      case "--provider-profile":
        options.providerProfile = requireValue(value, arg);
        i += 1;
        break;
      case "--provider-stats-url":
        options.providerStatsUrl = requireValue(value, arg);
        i += 1;
        break;
      case "--topology-profile":
        options.topologyProfile = requireValue(value, arg);
        i += 1;
        break;
      case "--run-owner":
        options.runOwner = requireValue(value, arg);
        i += 1;
        break;
      case "--base-url":
        options.baseUrl = requireValue(value, arg);
        i += 1;
        break;
      case "--query":
        options.query = requireValue(value, arg);
        i += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = parsePositiveInt(value, arg);
        i += 1;
        break;
      case "--run-label":
        options.runLabel = requireValue(value, arg);
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  validateModeOptions(options);
  return options;
}

function validateModeOptions(options: CliOptions): void {
  if (options.providerStatsUrl !== null && options.providerProfile === null) {
    throw new Error("--provider-stats-url requires an explicit --provider-profile");
  }
  const sustained = options.mode === "sustained-closed" || options.mode === "sustained-open";
  if (options.ramp !== null && options.mode !== "one-shot") {
    throw new Error("--ramp cannot be combined with a sustained --mode");
  }
  if (!sustained) {
    if (
      options.durationMs !== null ||
      options.arrivalRatePerSecond !== null ||
      options.maxInFlight !== null
    ) {
      throw new Error("--duration, --arrival-rate, and --max-in-flight require a sustained --mode");
    }
    return;
  }

  if (options.durationMs === null) throw new Error(`${options.mode} requires --duration <seconds>`);
  if (options.inputProfile === null) throw new Error(`${options.mode} requires --input-profile`);
  if (options.providerProfile === null)
    throw new Error(`${options.mode} requires --provider-profile`);
  if (options.topologyProfile === null)
    throw new Error(`${options.mode} requires --topology-profile`);
  if (options.runOwner === null) throw new Error(`${options.mode} requires --run-owner`);

  if (options.mode === "sustained-open") {
    if (options.arrivalRatePerSecond === null) {
      throw new Error("sustained-open requires --arrival-rate <journeys-per-second>");
    }
    if (options.maxInFlight === null) {
      throw new Error("sustained-open requires --max-in-flight");
    }
  } else if (options.arrivalRatePerSecond !== null || options.maxInFlight !== null) {
    throw new Error("sustained-closed uses --users concurrency, not arrival-rate/max-in-flight");
  }
}

/**
 * Production-safety guard. Loopback-only by default. Non-loopback hosts require
 * BOTH override flags, and any host that looks like production/managed infra is
 * always refused, even with the flags.
 */
function assertSafeTarget(baseUrl: string, allowRemote: boolean, iUnderstand: boolean): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`--base-url is not a valid URL: ${baseUrl}`);
  }

  const host = url.hostname.toLowerCase();
  const bareHost = host.replace(/^\[/, "").replace(/\]$/, "");

  const blocked = BLOCKED_HOST_SUBSTRINGS.find((needle) => host.includes(needle));
  if (blocked !== undefined) {
    throw new Error(
      `Refusing to run: target host "${url.hostname}" contains "${blocked}" ` +
        "(production / managed infrastructure). The load smoke is local-only.",
    );
  }

  if (LOOPBACK_HOSTS.includes(bareHost)) return;

  if (!allowRemote || !iUnderstand) {
    throw new Error(
      `Refusing to run against non-loopback host "${url.hostname}". Default is loopback ` +
        "only (localhost / 127.0.0.1 / ::1). To target another host pass BOTH " +
        "--allow-remote AND --i-understand-not-prod.",
    );
  }
}

interface CohortRunParams {
  config: AuthConfig;
  baseUrl: string;
  query: string;
  timeoutMs: number;
  users: number;
}

interface JourneyRunParams extends Omit<CohortRunParams, "users"> {
  userIndex: number;
  syntheticUserIndex: number;
  workloadStartedAt: number;
}

function executeJourney(params: JourneyRunParams): Promise<UserJourneyResult> {
  const minted = mintUserCookie(params.config, params.syntheticUserIndex);
  const ctx: JourneyContext = {
    baseUrl: params.baseUrl,
    cookie: minted.cookie,
    query: params.query,
    timeoutMs: params.timeoutMs,
    userIndex: params.userIndex,
    cohortStartedAt: params.workloadStartedAt,
  };
  return runUserJourney(ctx);
}

async function runCohort(params: CohortRunParams): Promise<CohortResult> {
  const cohortStartedAt = performance.now();
  const journeys = await Promise.all(
    Array.from({ length: params.users }, (_unused, index) => {
      return executeJourney({
        ...params,
        userIndex: index,
        syntheticUserIndex: index,
        workloadStartedAt: cohortStartedAt,
      });
    }),
  );
  const wallClockMs = performance.now() - cohortStartedAt;
  return summarizeCohort(params.users, wallClockMs, journeys);
}

async function runSustained(
  options: CliOptions,
  config: AuthConfig,
): Promise<{ cohort: CohortResult; workload: SustainedWorkloadSummary }> {
  if (options.durationMs === null) throw new Error("sustained duration was not validated");

  const journeyBase = {
    config,
    baseUrl: options.baseUrl,
    query: options.query,
    timeoutMs: options.timeoutMs,
  };
  let execution: SustainedWorkloadExecution<UserJourneyResult>;
  if (options.mode === "sustained-closed") {
    execution = await runSustainedClosed({
      concurrency: options.users,
      durationMs: options.durationMs,
      execute: (userIndex, workloadStartedAt, closedWorkerIndex) =>
        executeJourney({
          ...journeyBase,
          userIndex,
          syntheticUserIndex: closedWorkerIndex ?? userIndex,
          workloadStartedAt,
        }),
    });
  } else {
    if (options.arrivalRatePerSecond === null || options.maxInFlight === null) {
      throw new Error("sustained-open arrival configuration was not validated");
    }
    execution = await runSustainedOpen({
      arrivalRatePerSecond: options.arrivalRatePerSecond,
      durationMs: options.durationMs,
      maxInFlight: options.maxInFlight,
      execute: (userIndex, workloadStartedAt) =>
        executeJourney({
          ...journeyBase,
          userIndex,
          syntheticUserIndex: userIndex,
          workloadStartedAt,
        }),
    });
  }

  const { results, ...workload } = execution;
  return {
    cohort: summarizeCohort(execution.admittedJourneys, execution.wallClockMs, results),
    workload,
  };
}

function readGitIdentity(): GitIdentity {
  const targetRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim();
  if (targetRevision === "") throw new Error("could not resolve target Git revision");
  return { targetRevision, workingTreeDirty: status !== "" };
}

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function defaultRunLabel(): string {
  return `load-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function reportMode(options: CliOptions): LoadSmokeMode {
  if (options.mode !== "one-shot") return options.mode;
  return options.ramp === null ? "one-shot" : "ramp";
}

function inferredTopologyProfile(baseUrl: string): string {
  const hostname = new URL(baseUrl).hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  return LOOPBACK_HOSTS.includes(hostname)
    ? "loopback-target-unverified"
    : "non-loopback-target-unverified";
}

async function beginProviderStatsBinding(
  statsUrl: string | null,
): Promise<ProviderStatsBinding | null> {
  if (statsUrl === null) return null;
  const safeUrl = assertSafeProviderStatsUrl(statsUrl);
  const baseline = await readProviderFixtureStats(safeUrl);
  assertCleanProviderFixtureBaseline(baseline);
  return { statsUrl: safeUrl, baseline };
}

async function finishProviderStatsBinding(
  binding: ProviderStatsBinding | null,
  completedJourneys: number,
): Promise<ProviderFixtureEvidence | undefined> {
  if (binding === null) return undefined;
  return buildProviderFixtureEvidence(
    binding.statsUrl,
    binding.baseline,
    await readProviderFixtureStats(binding.statsUrl),
    completedJourneys,
  );
}

function printProviderFixtureEvidence(evidence: ProviderFixtureEvidence | undefined): void {
  if (evidence === undefined) return;
  process.stdout.write(
    `provider fixture: ${String(evidence.final.searchRequests)} requests, ` +
      `${evidence.requestsPerCompletedJourney.toFixed(2)}/completed journey, ` +
      `max in-flight ${String(evidence.final.maxInFlight)}\n`,
  );
}

function writeReport(
  options: CliOptions,
  cohorts: CohortResult[],
  initialGitIdentity: GitIdentity,
  sustainedWorkload?: SustainedWorkloadSummary,
  providerFixtureEvidence?: ProviderFixtureEvidence,
): string {
  const runLabel = sanitizeLabel(options.runLabel ?? defaultRunLabel());
  const directory = path.join(process.cwd(), "reports", "load-smoke");
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `${runLabel}.json`);
  const finalGitIdentity = readGitIdentity();
  if (
    finalGitIdentity.targetRevision !== initialGitIdentity.targetRevision ||
    finalGitIdentity.workingTreeDirty !== initialGitIdentity.workingTreeDirty
  ) {
    throw new Error("Git revision or working-tree state changed while load-smoke was running");
  }
  const mode = reportMode(options);

  const payload = buildLoadSmokeReportPayload(
    {
      generatedAt: new Date().toISOString(),
      runLabel,
      node: process.version,
      config: {
        baseUrl: options.baseUrl,
        query: options.query,
        timeoutMs: options.timeoutMs,
        mode,
        ...initialGitIdentity,
        runOwner: options.runOwner ?? "not-declared-one-shot",
        inputProfile: options.inputProfile ?? DEFAULT_INPUT_PROFILE,
        providerProfile: options.providerProfile ?? DEFAULT_PROVIDER_PROFILE,
        topologyProfile: options.topologyProfile ?? inferredTopologyProfile(options.baseUrl),
        users: mode === "one-shot" ? options.users : undefined,
        ramp: mode === "ramp" ? (options.ramp ?? undefined) : undefined,
        durationMs: mode.startsWith("sustained-") ? (options.durationMs ?? undefined) : undefined,
        warmupMs: mode.startsWith("sustained-") ? 0 : undefined,
        cooldownPolicy: mode.startsWith("sustained-") ? "drain-admitted" : undefined,
        concurrency: mode === "sustained-closed" ? options.users : undefined,
        arrivalRatePerSecond:
          mode === "sustained-open" ? (options.arrivalRatePerSecond ?? undefined) : undefined,
        maxInFlight: mode === "sustained-open" ? (options.maxInFlight ?? undefined) : undefined,
      },
    },
    cohorts,
    sustainedWorkload,
    providerFixtureEvidence,
  );

  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
  const retention = pruneLoadSmokeReports(directory, {
    keep: DEFAULT_LOAD_SMOKE_REPORT_RETENTION,
    preserve: filePath,
  });
  if (retention.remove.length > 0) {
    process.stdout.write(
      `load-smoke report retention: removed ${String(retention.remove.length)} old report(s), ` +
        `kept ${String(retention.retain.length)}\n`,
    );
  }
  return filePath;
}

function printUsage(): void {
  process.stdout.write(
    [
      "Light House load-smoke — incident #183 (N concurrent first-session searches)",
      "",
      "Usage: npm run load-smoke -- [options]",
      "",
      "  --mode <mode>        one-shot (default), sustained-closed, or sustained-open",
      "  --users <N>          one-shot users or sustained-closed concurrency (default 10)",
      "  --ramp 5,10,20,40    run cohorts of these sizes sequentially (overrides --users)",
      "  --duration <seconds> sustained admission duration (required for sustained modes)",
      "  --arrival-rate <n>   open-model journeys per second",
      "  --max-in-flight <N>  open-model client admission ceiling (no client backlog)",
      "  --input-profile <id> declared query/cardinality/personalization profile",
      "  --provider-profile <id> declared live or controlled provider behavior",
      "  --provider-stats-url <url> bind a fresh loopback fixture /__stats window",
      "  --topology-profile <id> declared target topology",
      "  --run-owner <id>     person/team responsible for allowance and stop decision",
      "  --base-url <url>     target server (default http://localhost:3000)",
      '  --query <text>       search query (default "transformer attention")',
      "  --timeout-ms <n>     per-request timeout (default 30000)",
      "  --run-label <label>  JSON report filename stem (default timestamped)",
      "  --allow-remote       allow a non-loopback host (requires the flag below too)",
      "  --i-understand-not-prod  acknowledge a non-loopback target",
      "  -h, --help           show this help",
      "",
      "Safety: loopback-only by default; production/managed hosts are always refused.",
      "Prereqs: `supabase start`, `npm run dev`, MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET set.",
      "",
    ].join("\n"),
  );
}

async function main(): Promise<number> {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return 0;
    }

    assertSafeTarget(options.baseUrl, options.allowRemote, options.iUnderstand);
    const initialGitIdentity = readGitIdentity();
    const config = loadAuthConfig(process.env);
    const providerStatsBinding = await beginProviderStatsBinding(options.providerStatsUrl);

    if (options.mode === "sustained-closed" || options.mode === "sustained-open") {
      process.stdout.write(
        `Target ${options.baseUrl} | ${options.mode} | duration ${String(options.durationMs)}ms | ` +
          `input ${options.inputProfile ?? "-"} | provider ${options.providerProfile ?? "-"} | ` +
          `topology ${options.topologyProfile ?? "-"} | owner ${options.runOwner ?? "-"}\n`,
      );
      const sustained = await runSustained(options, config);
      const providerFixtureEvidence = await finishProviderStatsBinding(
        providerStatsBinding,
        sustained.workload.completedJourneys,
      );
      process.stdout.write(formatCohortReport(sustained.cohort, "admitted-journeys"));
      process.stdout.write(formatSustainedReport(sustained.workload));
      printProviderFixtureEvidence(providerFixtureEvidence);

      const reportPath = writeReport(
        options,
        [sustained.cohort],
        initialGitIdentity,
        sustained.workload,
        providerFixtureEvidence,
      );
      process.stdout.write(`\nJSON report: ${reportPath}\n`);
      const verdict = getSustainedGoNoGoVerdict(sustained.cohort, sustained.workload);
      if (!verdict.ok) {
        process.stderr.write(`\nload-smoke go/no-go failed: ${verdict.reasons.join("; ")}\n`);
        return 1;
      }
      process.stdout.write(
        "load-smoke local sustained verdict: PASS (production capacity remains unproven)\n",
      );
      return 0;
    }

    const cohortSizes = options.ramp ?? [options.users];
    process.stdout.write(
      `Target ${options.baseUrl} | query "${options.query}" | timeout ${String(options.timeoutMs)}ms | ` +
        `cohorts ${cohortSizes.map((size) => String(size)).join(", ")}\n`,
    );

    const cohorts: CohortResult[] = [];
    for (const size of cohortSizes) {
      const cohort = await runCohort({
        config,
        baseUrl: options.baseUrl,
        query: options.query,
        timeoutMs: options.timeoutMs,
        users: size,
      });
      process.stdout.write(formatCohortReport(cohort));
      cohorts.push(cohort);
    }

    if (options.ramp !== null) process.stdout.write(formatRampTable(cohorts));

    const providerFixtureEvidence = await finishProviderStatsBinding(
      providerStatsBinding,
      cohorts.reduce((total, cohort) => total + cohort.users, 0),
    );
    printProviderFixtureEvidence(providerFixtureEvidence);
    const reportPath = writeReport(
      options,
      cohorts,
      initialGitIdentity,
      undefined,
      providerFixtureEvidence,
    );
    process.stdout.write(`\nJSON report: ${reportPath}\n`);
    const failures = cohorts
      .map((cohort) => ({ cohort, verdict: getCohortGoNoGoVerdict(cohort) }))
      .filter((entry) => !entry.verdict.ok);
    if (failures.length > 0) {
      process.stderr.write("\nload-smoke go/no-go failed:\n");
      for (const failure of failures) {
        process.stderr.write(
          `  ${String(failure.cohort.users)} users: ${failure.verdict.reasons.join("; ")}\n`,
        );
      }
      return 1;
    }

    process.stdout.write("load-smoke go/no-go: PASS\n");
    return 0;
  } catch (error) {
    process.stderr.write(
      `\nload-smoke aborted: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

void main().then((code) => {
  process.exit(code);
});
