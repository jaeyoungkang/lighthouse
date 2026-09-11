export type RuntimeLogLevel = "silent" | "error" | "warn" | "info" | "debug";

const LEVEL_PRIORITY: Record<RuntimeLogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const VALID_LEVELS = new Set<RuntimeLogLevel>(["silent", "error", "warn", "info", "debug"]);

function readEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}

function normalizeLevel(value: string | undefined): RuntimeLogLevel | null {
  if (!value) return null;
  return VALID_LEVELS.has(value as RuntimeLogLevel) ? (value as RuntimeLogLevel) : null;
}

function resolveConfiguredLevel(): RuntimeLogLevel {
  const envLevel =
    normalizeLevel(readEnv("LIGHTHOUSE_LOG_LEVEL")) ??
    normalizeLevel(readEnv("NEXT_PUBLIC_LIGHTHOUSE_LOG_LEVEL"));
  if (envLevel) {
    return envLevel;
  }

  if (
    readEnv("EVIDENCE_LEDGER") === "1" ||
    readEnv("NODE_ENV") === "test" ||
    readEnv("VITEST") === "true"
  ) {
    return "silent";
  }

  return readEnv("NODE_ENV") === "development" ? "warn" : "error";
}

function shouldLog(level: Exclude<RuntimeLogLevel, "silent">): boolean {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[resolveConfiguredLevel()];
}

function pickObjectFields(
  value: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | undefined {
  const picked = Object.fromEntries(
    keys.flatMap((key) => (key in value ? [[key, value[key]]] : [])),
  );
  return Object.keys(picked).length > 0 ? picked : undefined;
}

function serializeError(error: Error): Record<string, unknown> {
  const source = error as Error & Record<string, unknown>;
  const base = {
    name: error.name,
    message: error.message,
    ...(typeof source.code === "string" || typeof source.code === "number"
      ? { code: source.code }
      : {}),
    ...(typeof source.status === "number" ? { status: source.status } : {}),
    ...(typeof source.hint === "string" ? { hint: source.hint } : {}),
  };

  const details = pickObjectFields(source, ["details", "digest", "cause"]);
  return readEnv("LIGHTHOUSE_LOG_LEVEL") === "debug" ||
    readEnv("NEXT_PUBLIC_LIGHTHOUSE_LOG_LEVEL") === "debug"
    ? {
        ...base,
        ...(details ?? {}),
        ...(error.stack ? { stack: error.stack } : {}),
      }
    : {
        ...base,
        ...(details ?? {}),
      };
}

function serializeDetails(details: unknown): unknown {
  if (details === undefined) return undefined;
  if (details instanceof Error) {
    return serializeError(details);
  }
  if (typeof details === "object" && details !== null) {
    const record = details as Record<string, unknown>;
    const preferred = pickObjectFields(record, [
      "code",
      "message",
      "status",
      "hint",
      "details",
      "name",
      "digest",
      "attempt",
      "documentId",
      "ownerPrincipalId",
      "userId",
      "documentType",
      "durationMs",
      "finishReason",
      "steps",
      "model",
      "inputTokens",
      "outputTokens",
      "totalTokens",
      "reasoningTokens",
      "cachedInputTokens",
      "costUsdMicros",
      "priced",
    ]);
    return preferred ?? details;
  }
  return details;
}

function write(
  level: Exclude<RuntimeLogLevel, "silent">,
  scope: string,
  message: string,
  details?: unknown,
): void {
  if (!shouldLog(level)) return;

  const line = `[${scope}] ${message}`;
  const payload = serializeDetails(details);

  if (level === "error") {
    if (payload === undefined) {
      console.error(line);
    } else {
      console.error(line, payload);
    }
    return;
  }
  if (level === "warn") {
    if (payload === undefined) {
      console.warn(line);
    } else {
      console.warn(line, payload);
    }
    return;
  }
  if (level === "info") {
    if (payload === undefined) {
      console.info(line);
    } else {
      console.info(line, payload);
    }
    return;
  }
  if (payload === undefined) {
    console.debug(line);
  } else {
    console.debug(line, payload);
  }
}

export function logError(scope: string, message: string, details?: unknown): void {
  write("error", scope, message, details);
}

export function logWarn(scope: string, message: string, details?: unknown): void {
  write("warn", scope, message, details);
}

export function logInfo(scope: string, message: string, details?: unknown): void {
  write("info", scope, message, details);
}

export function logDebug(scope: string, message: string, details?: unknown): void {
  write("debug", scope, message, details);
}

export function shouldEmitObservationLogs(): boolean {
  return (
    readEnv("EVIDENCE_LEDGER") !== "1" &&
    (readEnv("LIGHTHOUSE_OBSERVE_CONSOLE") === "1" ||
      readEnv("NEXT_PUBLIC_LIGHTHOUSE_OBSERVE_CONSOLE") === "1")
  );
}

export function emitStructuredObservation(entry: unknown): void {
  if (!shouldEmitObservationLogs()) return;
  console.info(JSON.stringify(entry));
}
