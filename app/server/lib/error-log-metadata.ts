import { utf8ByteLength } from "@/app/lib/utf8";

export const ERROR_LOG_METADATA_LIMITS = {
  maxArrayItems: 32,
  maxDepth: 4,
  maxJsonBytes: 16_384,
  maxKeyLength: 160,
  maxObjectKeys: 64,
  maxStringLength: 2_048,
  maxVisitedNodes: 512,
} as const;

export const ERROR_LOG_METADATA_TRUNCATED_KEY = "__lighthouseTruncated";
const TRUNCATED_VALUE = "[truncated]";
const NULL_CHARACTER_REGEX = /\u0000/g;

interface SanitizeState {
  truncated: boolean;
  visitedNodes: number;
}

function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function sanitizeString(value: string, state: SanitizeState): string {
  const sanitized = value.replace(NULL_CHARACTER_REGEX, "");
  if (sanitized.length <= ERROR_LOG_METADATA_LIMITS.maxStringLength) return sanitized;
  state.truncated = true;
  return sanitized.slice(0, ERROR_LOG_METADATA_LIMITS.maxStringLength);
}

function sanitizeKey(value: string, state: SanitizeState): string {
  const sanitized = value.replace(NULL_CHARACTER_REGEX, "");
  if (sanitized.length <= ERROR_LOG_METADATA_LIMITS.maxKeyLength) return sanitized;
  state.truncated = true;
  return sanitized.slice(0, ERROR_LOG_METADATA_LIMITS.maxKeyLength);
}

function sanitizeValue(value: unknown, depth: number, state: SanitizeState): unknown {
  if (state.visitedNodes >= ERROR_LOG_METADATA_LIMITS.maxVisitedNodes) {
    state.truncated = true;
    return TRUNCATED_VALUE;
  }
  state.visitedNodes += 1;

  if (typeof value === "string") return sanitizeString(value, state);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (typeof value === "bigint") return sanitizeString(String(value), state);
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    state.truncated = true;
    return null;
  }

  if (depth >= ERROR_LOG_METADATA_LIMITS.maxDepth) {
    state.truncated = true;
    return TRUNCATED_VALUE;
  }

  if (Array.isArray(value)) {
    const hasOverflow = value.length > ERROR_LOG_METADATA_LIMITS.maxArrayItems;
    if (hasOverflow) state.truncated = true;
    const itemLimit = hasOverflow
      ? ERROR_LOG_METADATA_LIMITS.maxArrayItems - 1
      : ERROR_LOG_METADATA_LIMITS.maxArrayItems;
    const items = value.slice(0, itemLimit).map((item) => sanitizeValue(item, depth + 1, state));
    if (hasOverflow) items.push(TRUNCATED_VALUE);
    return items;
  }

  const objectValue = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  let ownKeyCount = 0;
  for (const rawKey in objectValue) {
    if (!Object.hasOwn(objectValue, rawKey)) continue;
    ownKeyCount += 1;
    if (
      ownKeyCount > ERROR_LOG_METADATA_LIMITS.maxObjectKeys ||
      state.visitedNodes >= ERROR_LOG_METADATA_LIMITS.maxVisitedNodes
    ) {
      state.truncated = true;
      break;
    }
    const key = sanitizeKey(rawKey, state);
    if (Object.hasOwn(result, key)) {
      state.truncated = true;
      continue;
    }
    setOwn(result, key, sanitizeValue(objectValue[rawKey], depth + 1, state));
  }
  return result;
}

function jsonBytes(value: Record<string, unknown>): number {
  return utf8ByteLength(JSON.stringify(value));
}

export function sanitizeErrorLogMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const state: SanitizeState = { truncated: false, visitedNodes: 0 };
  const sanitized = sanitizeValue(metadata, 0, state) as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(sanitized)) {
    if (key === ERROR_LOG_METADATA_TRUNCATED_KEY) {
      state.truncated = true;
      continue;
    }
    const candidate = { ...result, [key]: value };
    if (jsonBytes(candidate) <= ERROR_LOG_METADATA_LIMITS.maxJsonBytes) {
      setOwn(result, key, value);
    } else {
      state.truncated = true;
    }
  }

  if (!state.truncated) return result;

  const retainedEntries = Object.entries(result);
  let bounded = Object.fromEntries([...retainedEntries, [ERROR_LOG_METADATA_TRUNCATED_KEY, true]]);
  while (
    retainedEntries.length + 1 > ERROR_LOG_METADATA_LIMITS.maxObjectKeys ||
    jsonBytes(bounded) > ERROR_LOG_METADATA_LIMITS.maxJsonBytes
  ) {
    retainedEntries.pop();
    bounded = Object.fromEntries([...retainedEntries, [ERROR_LOG_METADATA_TRUNCATED_KEY, true]]);
  }
  return bounded;
}
