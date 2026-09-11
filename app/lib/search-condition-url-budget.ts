// @aspect aspect:search-first-url-model

import { isValidYearRangeFilterSyntax } from "@/app/domain/search-year-range";

export const SEARCH_CONDITION_REQUEST_TARGET_MAX_BYTES = 8_192;

export const SEARCH_CONDITION_VALUE_LIMITS = {
  keywordQueryBytes: 1_024,
  followupQueryBytes: 192,
  facetValuesPerKind: 4,
  facetValueBytes: 128,
  yearBytes: 9,
  termSourceQueryBytes: 1_024,
  termBytes: 192,
  termSupportMax: 40,
  seedPaperIdBytes: 128,
  seedPaperTitleBytes: 768,
  seedPaperUrlBytes: 1_024,
  seedPaperYearMax: 9_999,
  seedPaperCitationsMax: Number.MAX_SAFE_INTEGER,
} as const;

export type SearchConditionRouteKind = "search" | "citation" | "similar";

const SEARCH_CONDITION_ROUTE_KIND_BY_PATH = {
  "/": "search",
  "/search": "search",
  "/citation": "citation",
  "/similar": "similar",
} as const satisfies Record<string, SearchConditionRouteKind>;

export function resolveSearchConditionRouteKind(pathname: string): SearchConditionRouteKind | null {
  if (!Object.hasOwn(SEARCH_CONDITION_ROUTE_KIND_BY_PATH, pathname)) return null;

  return SEARCH_CONDITION_ROUTE_KIND_BY_PATH[
    pathname as keyof typeof SEARCH_CONDITION_ROUTE_KIND_BY_PATH
  ];
}

export type SearchConditionUrlRejectionReason =
  | "dimension-limit"
  | "invalid-value"
  | "mode-conflict"
  | "request-target-limit";

export type SearchConditionUrlValidation =
  | {
      ok: true;
      requestTarget: string;
      requestTargetBytes: number;
    }
  | {
      ok: false;
      reason: SearchConditionUrlRejectionReason;
    };

const SEARCH_SCALAR_KEYS = [
  "q",
  "sort",
  "year",
  "personalize",
  "hasPdf",
  "lib",
  "entry",
  "termSourceQuery",
  "term",
  "termType",
  "termSupport",
  "seedPaperId",
  "seedPaperTitle",
  "seedPaperYear",
  "seedPaperUrl",
  "seedPaperCitations",
] as const;

const RELATIONSHIP_SCALAR_KEYS = [
  "seed",
  "seedPaperId",
  "seedPaperTitle",
  "seedPaperYear",
  "seedPaperUrl",
  "seedPaperCitations",
] as const;

const FACET_KEYS = ["field", "author", "venue"] as const;
const SEARCH_SORT_OPTIONS = new Set(["relevance", "citationCount", "year", "yearAsc", "interest"]);
const SEARCH_ENTRY_SOURCES = new Set([
  "route-bar",
  "empty-entry",
  "requery",
  "term",
  "position",
  "similar",
]);
const TERM_SEED_CANDIDATE_TYPES = new Set(["direct", "broader", "narrower", "variant"]);

const textEncoder = new TextEncoder();

export function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

function exceedsUtf8Limit(value: string | null, maxBytes: number): boolean {
  return value !== null && utf8ByteLength(value) > maxBytes;
}

function hasDuplicates(params: URLSearchParams, keys: readonly string[]): boolean {
  return keys.some((key) => params.getAll(key).length > 1);
}

function hasAny(params: URLSearchParams, keys: readonly string[]): boolean {
  return keys.some((key) => params.has(key));
}

function invalidBooleanFlag(value: string | null, accepted: string): boolean {
  return value !== null && value !== accepted;
}

function invalidOptionalInteger(value: string | null, minimum: number, maximum: number): boolean {
  if (value === null) return false;
  if (!/^\d+$/.test(value)) return true;
  const parsed = Number(value);
  return !Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum;
}

function validateSeedDimensions(params: URLSearchParams): SearchConditionUrlRejectionReason | null {
  const limits = SEARCH_CONDITION_VALUE_LIMITS;
  if (
    exceedsUtf8Limit(params.get("seed") ?? params.get("seedPaperId"), limits.seedPaperIdBytes) ||
    exceedsUtf8Limit(params.get("seedPaperTitle"), limits.seedPaperTitleBytes) ||
    exceedsUtf8Limit(params.get("seedPaperUrl"), limits.seedPaperUrlBytes)
  ) {
    return "dimension-limit";
  }
  if (
    invalidOptionalInteger(params.get("seedPaperYear"), 0, limits.seedPaperYearMax) ||
    invalidOptionalInteger(params.get("seedPaperCitations"), 0, limits.seedPaperCitationsMax)
  ) {
    return "invalid-value";
  }
  return null;
}

function validateSearchDimensions(
  params: URLSearchParams,
): SearchConditionUrlRejectionReason | null {
  if (hasDuplicates(params, SEARCH_SCALAR_KEYS)) return "invalid-value";

  const hasTermSeed = hasAny(params, ["termSourceQuery", "term", "termType", "termSupport"]);
  const hasSeedPaper = hasAny(params, [
    "seedPaperId",
    "seedPaperTitle",
    "seedPaperYear",
    "seedPaperUrl",
    "seedPaperCitations",
  ]);
  if (hasTermSeed && hasSeedPaper) return "mode-conflict";

  const queryLimit =
    hasTermSeed || hasSeedPaper
      ? SEARCH_CONDITION_VALUE_LIMITS.followupQueryBytes
      : SEARCH_CONDITION_VALUE_LIMITS.keywordQueryBytes;
  if (exceedsUtf8Limit(params.get("q"), queryLimit)) return "dimension-limit";

  for (const key of FACET_KEYS) {
    const values = params.getAll(key);
    if (
      values.length > SEARCH_CONDITION_VALUE_LIMITS.facetValuesPerKind ||
      values.some((value) => exceedsUtf8Limit(value, SEARCH_CONDITION_VALUE_LIMITS.facetValueBytes))
    ) {
      return "dimension-limit";
    }
  }

  if (
    exceedsUtf8Limit(params.get("year"), SEARCH_CONDITION_VALUE_LIMITS.yearBytes) ||
    (params.has("year") && !isValidYearRangeFilterSyntax(params.get("year") ?? ""))
  ) {
    return "invalid-value";
  }
  if (params.has("sort") && !SEARCH_SORT_OPTIONS.has(params.get("sort") ?? "")) {
    return "invalid-value";
  }
  if (
    invalidBooleanFlag(params.get("personalize"), "false") ||
    invalidBooleanFlag(params.get("hasPdf"), "true") ||
    invalidBooleanFlag(params.get("lib"), "1") ||
    (params.has("entry") && !SEARCH_ENTRY_SOURCES.has(params.get("entry") ?? ""))
  ) {
    return "invalid-value";
  }

  if (hasTermSeed) {
    if (
      hasAny(params, [...FACET_KEYS, "sort", "year"]) ||
      !params.get("q")?.trim() ||
      !params.get("termSourceQuery") ||
      !params.get("term") ||
      !params.has("termSupport") ||
      !TERM_SEED_CANDIDATE_TYPES.has(params.get("termType") ?? "")
    ) {
      return "mode-conflict";
    }
    if (
      exceedsUtf8Limit(
        params.get("termSourceQuery"),
        SEARCH_CONDITION_VALUE_LIMITS.termSourceQueryBytes,
      ) ||
      exceedsUtf8Limit(params.get("term"), SEARCH_CONDITION_VALUE_LIMITS.termBytes)
    ) {
      return "dimension-limit";
    }
    if (
      invalidOptionalInteger(
        params.get("termSupport"),
        0,
        SEARCH_CONDITION_VALUE_LIMITS.termSupportMax,
      )
    ) {
      return "invalid-value";
    }
  }

  if (hasSeedPaper) {
    if (
      hasAny(params, [...FACET_KEYS, "sort", "year"]) ||
      !params.get("q")?.trim() ||
      !params.get("seedPaperId") ||
      !params.get("seedPaperTitle")
    ) {
      return "mode-conflict";
    }
    return validateSeedDimensions(params);
  }

  return null;
}

function validateRelationshipDimensions(
  params: URLSearchParams,
): SearchConditionUrlRejectionReason | null {
  if (hasDuplicates(params, RELATIONSHIP_SCALAR_KEYS)) return "invalid-value";
  if (params.has("seed") && params.has("seedPaperId")) return "mode-conflict";
  if (!(params.get("seedPaperId") ?? params.get("seed"))?.trim()) return "invalid-value";
  return validateSeedDimensions(params);
}

export function validateSearchConditionUrl(
  routeKind: SearchConditionRouteKind,
  params: URLSearchParams,
): SearchConditionUrlValidation {
  const dimensionRejection =
    routeKind === "search"
      ? validateSearchDimensions(params)
      : validateRelationshipDimensions(params);
  if (dimensionRejection) return { ok: false, reason: dimensionRejection };

  const suffix = params.toString();
  const pathname = `/${routeKind}`;
  const requestTarget = suffix ? `${pathname}?${suffix}` : pathname;
  const requestTargetBytes = utf8ByteLength(requestTarget);
  if (requestTargetBytes > SEARCH_CONDITION_REQUEST_TARGET_MAX_BYTES) {
    return { ok: false, reason: "request-target-limit" };
  }
  return { ok: true, requestTarget, requestTargetBytes };
}

export function searchParamsFromRecord(
  _routeKind: SearchConditionRouteKind,
  values: object,
): URLSearchParams {
  const params = new URLSearchParams();
  const record = values as Record<string, string | string[] | undefined>;
  for (const [key, value] of Object.entries(record)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, entry);
    }
  }
  return params;
}
