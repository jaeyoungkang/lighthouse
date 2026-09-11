import { appendFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { AnalyticsEventStore, CanonicalEvent } from "@/app/lib/analytics/canonical-event";

const DEFAULT_LOCAL_ANALYTICS_EVENT_PATH = ".local/analytics-events.jsonl";
const SERVERLESS_LOCAL_ANALYTICS_EVENT_PATH = path.join(
  tmpdir(),
  "lighthouse",
  "analytics-events.jsonl",
);
const LOCAL_ANALYTICS_EVENT_STORE_PATH_ENV = "LOCAL_ANALYTICS_EVENT_STORE_PATH";
const LOCAL_ANALYTICS_EVENT_RUN_SOURCE_ENV = "LOCAL_ANALYTICS_EVENT_RUN_SOURCE";
const LOCAL_ANALYTICS_RECORD_SCHEMA_VERSION = 1;
const LOCAL_ANALYTICS_BUILD_REVISION_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export type LocalAnalyticsEventRunSource = "runtime" | "manual" | "test";
export type LocalAnalyticsEventEnvironment =
  | "production"
  | "preview"
  | "development"
  | "test"
  | "unknown";

export interface LocalAnalyticsEventProvenance {
  schemaVersion: typeof LOCAL_ANALYTICS_RECORD_SCHEMA_VERSION;
  environment: LocalAnalyticsEventEnvironment;
  buildRevision: string | null;
  runSource: LocalAnalyticsEventRunSource;
}

export interface LocalAnalyticsEventRecord extends CanonicalEvent {
  localProvenance: LocalAnalyticsEventProvenance;
}

export function resolveLocalJsonlAnalyticsEventPath(
  env: Record<string, string | undefined> = process.env,
  cwd = process.cwd(),
): string {
  const overridePath = env[LOCAL_ANALYTICS_EVENT_STORE_PATH_ENV]?.trim();
  if (overridePath) {
    return path.isAbsolute(overridePath) ? overridePath : path.join(cwd, overridePath);
  }

  if (env.VERCEL || cwd === "/var/task" || cwd.startsWith("/var/task/")) {
    return SERVERLESS_LOCAL_ANALYTICS_EVENT_PATH;
  }

  return path.join(cwd, DEFAULT_LOCAL_ANALYTICS_EVENT_PATH);
}

export function createLocalJsonlAnalyticsEventStore(
  filePath = resolveLocalJsonlAnalyticsEventPath(),
  env: Record<string, string | undefined> = process.env,
): AnalyticsEventStore {
  const localProvenance = resolveLocalAnalyticsEventProvenance(env);
  return {
    async insert(event: CanonicalEvent): Promise<void> {
      await mkdir(path.dirname(filePath), { recursive: true });
      const record: LocalAnalyticsEventRecord = { ...event, localProvenance };
      await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
    },
  };
}

export function resolveLocalAnalyticsEventProvenance(
  env: Record<string, string | undefined> = process.env,
): LocalAnalyticsEventProvenance {
  return {
    schemaVersion: LOCAL_ANALYTICS_RECORD_SCHEMA_VERSION,
    environment: resolveLocalAnalyticsEventEnvironment(env),
    buildRevision: resolveLocalAnalyticsBuildRevision(env),
    runSource: resolveLocalAnalyticsEventRunSource(env),
  };
}

function resolveLocalAnalyticsEventEnvironment(
  env: Record<string, string | undefined>,
): LocalAnalyticsEventEnvironment {
  const configured = firstNonEmpty(env.VERCEL_ENV, env.NODE_ENV);
  if (
    configured === "production" ||
    configured === "preview" ||
    configured === "development" ||
    configured === "test"
  ) {
    return configured;
  }
  return "unknown";
}

function resolveLocalAnalyticsBuildRevision(
  env: Record<string, string | undefined>,
): string | null {
  const configured = firstNonEmpty(env.VERCEL_GIT_COMMIT_SHA, env.GIT_COMMIT_SHA, env.COMMIT_SHA);
  return configured && LOCAL_ANALYTICS_BUILD_REVISION_PATTERN.test(configured) ? configured : null;
}

function resolveLocalAnalyticsEventRunSource(
  env: Record<string, string | undefined>,
): LocalAnalyticsEventRunSource {
  const configured = firstNonEmpty(env[LOCAL_ANALYTICS_EVENT_RUN_SOURCE_ENV]);
  if (configured === "runtime" || configured === "manual" || configured === "test") {
    return configured;
  }
  return env.NODE_ENV === "test" ? "test" : "runtime";
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) return normalized;
  }
  return undefined;
}
