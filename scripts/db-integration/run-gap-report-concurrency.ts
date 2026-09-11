import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import {
  assertMigrationRevisionMatches,
  readExpectedMigrationVersions,
} from "./migration-revision";

interface LocalSupabaseStatus {
  API_URL: string;
  DB_URL: string;
  SERVICE_ROLE_KEY: string;
}

interface PostgrestReadinessOptions {
  apiUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof globalThis.fetch;
  now?: () => number;
  sleep?: (durationMs: number) => Promise<void>;
  timeoutMs?: number;
  retryDelayMs?: number;
  requestTimeoutMs?: number;
}

interface PostgrestReadinessResult {
  attempts: number;
  elapsedMs: number;
}

const POSTGREST_READINESS_TIMEOUT_MS = 30_000;
const POSTGREST_READINESS_RETRY_DELAY_MS = 500;
const POSTGREST_READINESS_REQUEST_TIMEOUT_MS = 2_000;
const POSTGREST_ERROR_BODY_LIMIT = 512;

function readLocalSupabaseStatus(): LocalSupabaseStatus {
  const output = execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const jsonStart = output.indexOf("{");
  const jsonEnd = output.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error("Could not parse `supabase status -o json`; run `supabase start` first.");
  }

  const parsed = JSON.parse(output.slice(jsonStart, jsonEnd + 1)) as Partial<LocalSupabaseStatus>;
  if (!parsed.API_URL || !parsed.DB_URL || !parsed.SERVICE_ROLE_KEY) {
    throw new Error("Local Supabase status is missing API_URL, DB_URL, or SERVICE_ROLE_KEY.");
  }
  return parsed as LocalSupabaseStatus;
}

export function assertLoopbackUrl(label: string, rawUrl: string): void {
  const hostname = new URL(rawUrl).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "[::1]") {
    throw new Error(`${label} must be loopback-only for destructive integration cleanup.`);
  }
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, durationMs);
  });
}

function assertPositiveDuration(label: string, durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`${label} must be a positive finite duration.`);
  }
}

function normalizeErrorBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (!normalized) return "empty body";
  if (normalized.length <= POSTGREST_ERROR_BODY_LIMIT) return normalized;
  return `${normalized.slice(0, POSTGREST_ERROR_BODY_LIMIT)}…`;
}

function isRetriablePostgrestResponse(status: number, body: string): boolean {
  if (status === 502 || status === 503 || status === 504) return true;

  try {
    const parsed = JSON.parse(body) as unknown;
    if (typeof parsed !== "object" || parsed === null || !("code" in parsed)) return false;
    const code = (parsed as { code?: unknown }).code;
    return typeof code === "string" && /^PGRST00[0-2]$/.test(code);
  } catch {
    return false;
  }
}

function describeRequestError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function waitForPostgrestSchema({
  apiUrl,
  serviceRoleKey,
  fetchImpl = globalThis.fetch,
  now = () => performance.now(),
  sleep = delay,
  timeoutMs = POSTGREST_READINESS_TIMEOUT_MS,
  retryDelayMs = POSTGREST_READINESS_RETRY_DELAY_MS,
  requestTimeoutMs = POSTGREST_READINESS_REQUEST_TIMEOUT_MS,
}: PostgrestReadinessOptions): Promise<PostgrestReadinessResult> {
  assertPositiveDuration("PostgREST readiness timeout", timeoutMs);
  assertPositiveDuration("PostgREST readiness retry delay", retryDelayMs);
  assertPositiveDuration("PostgREST readiness request timeout", requestTimeoutMs);
  assertLoopbackUrl("PostgREST readiness URL", apiUrl);

  const readinessUrl = new URL("/rest/v1/gap_reports", apiUrl);
  readinessUrl.searchParams.set("select", "id");
  readinessUrl.searchParams.set("limit", "0");

  const startedAt = now();
  let attempts = 0;
  let lastFailure = "probe did not run";

  while (attempts === 0 || now() - startedAt < timeoutMs) {
    attempts += 1;
    const elapsedBeforeRequest = Math.max(0, now() - startedAt);
    const remainingMs = Math.max(1, timeoutMs - elapsedBeforeRequest);
    const abortController = new AbortController();
    const abortTimer = setTimeout(
      () => {
        abortController.abort();
      },
      Math.min(requestTimeoutMs, remainingMs),
    );
    let retryable = true;

    try {
      const response = await fetchImpl(readinessUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Accept-Profile": "lighthouse",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        signal: abortController.signal,
      });
      const body = await response.text();
      if (response.ok) {
        return { attempts, elapsedMs: Math.round(Math.max(0, now() - startedAt)) };
      }

      lastFailure = `HTTP ${response.status.toString()}: ${normalizeErrorBody(body)}`;
      retryable = isRetriablePostgrestResponse(response.status, body);
    } catch (error) {
      lastFailure = `request error: ${describeRequestError(error)}`;
    } finally {
      clearTimeout(abortTimer);
    }

    if (!retryable) {
      throw new Error(
        `PostgREST schema readiness failed without retry after ${attempts.toString()} attempt(s): ${lastFailure}`,
      );
    }

    const remainingAfterRequest = timeoutMs - Math.max(0, now() - startedAt);
    if (remainingAfterRequest <= 0) break;
    await sleep(Math.min(retryDelayMs, remainingAfterRequest));
  }

  throw new Error(
    `PostgREST schema readiness timed out after ${timeoutMs.toString()}ms (${attempts.toString()} attempts). Last failure: ${lastFailure}`,
  );
}

async function readAppliedMigrationVersions(databaseUrl: string): Promise<string[]> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ version: string }>(
      "select version from supabase_migrations.schema_migrations order by version",
    );
    return result.rows.map((row) => row.version);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const repositoryRoot = resolve(process.cwd());
  const status = readLocalSupabaseStatus();
  assertLoopbackUrl("Supabase API URL", status.API_URL);
  assertLoopbackUrl("PostgreSQL DB URL", status.DB_URL);

  const expected = readExpectedMigrationVersions(resolve(repositoryRoot, "supabase/migrations"));
  const actual = await readAppliedMigrationVersions(status.DB_URL);
  assertMigrationRevisionMatches(expected, actual);

  console.info("[db-integration] local revision verified", {
    apiOrigin: new URL(status.API_URL).origin,
    databaseHost: new URL(status.DB_URL).host,
    migrationCount: actual.length,
  });

  const readiness = await waitForPostgrestSchema({
    apiUrl: status.API_URL,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
  });
  console.info("[db-integration] PostgREST schema ready", readiness);

  const result = spawnSync(
    process.execPath,
    [
      resolve(repositoryRoot, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      resolve(repositoryRoot, "vitest.config.postgres-integration.mts"),
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        LIGHTHOUSE_DB_INTEGRATION_API_URL: status.API_URL,
        LIGHTHOUSE_DB_INTEGRATION_DATABASE_URL: status.DB_URL,
        LIGHTHOUSE_DB_INTEGRATION_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      },
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
