export type ConfidenceLevel = "high" | "medium" | "low";
export const INLINE_ANALYSIS_VERSION = 10;
export const INLINE_ANALYSIS_VERSION_REASON =
  "v10: stanceProfile.limitations summary and per-query rationale display";
export const INLINE_ANALYSIS_REQUEST_PAPER_LIMIT = 5;
/** One lease owns primary, secondary, and the final cache transition. */
export const INLINE_ANALYSIS_ROUTE_DEADLINE_MS = 30_000;
/**
 * Wire-compatible commands shared by the browser, API parser, domain access,
 * and cache transition. Changing these values requires a separate contract decision.
 */
export const INLINE_ANALYSIS_AUTOMATIC_RETRY_COMMAND = "automatic" as const;
export const INLINE_ANALYSIS_EXPLICIT_RETRY_COMMANDS = ["explicit_retry"] as const;
export const INLINE_ANALYSIS_RETRY_COMMANDS = [
  INLINE_ANALYSIS_AUTOMATIC_RETRY_COMMAND,
  ...INLINE_ANALYSIS_EXPLICIT_RETRY_COMMANDS,
] as const;
export type InlineAnalysisRetryCommand = (typeof INLINE_ANALYSIS_RETRY_COMMANDS)[number];

const ASCII_LATIN_LETTER_PATTERN = /[A-Za-z]/;
const NON_ASCII_LATIN_LETTER_PATTERN = /(?![A-Za-z])\p{Script=Latin}/u;
const UNSUPPORTED_QUERY_LETTER_PATTERN = /(?![A-Za-z]|\p{Script=Greek})\p{Letter}/u;
const GREEK_LETTER_RUN_PATTERN = /\p{Script=Greek}+/gu;
const COMBINING_MARK_PATTERN = /\p{Mark}/u;
const MAX_SCIENTIFIC_GREEK_TOKEN_LENGTH = 3;

export function normalizeProviderReadyDifferentPositionQuery(value: string): string | null {
  const query = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (
    !ASCII_LATIN_LETTER_PATTERN.test(query) ||
    NON_ASCII_LATIN_LETTER_PATTERN.test(query) ||
    UNSUPPORTED_QUERY_LETTER_PATTERN.test(query)
  ) {
    return null;
  }

  const greekRuns = query.match(GREEK_LETTER_RUN_PATTERN) ?? [];
  const hasNaturalLanguageGreekRun = greekRuns.some(
    (run) =>
      Array.from(run).length > MAX_SCIENTIFIC_GREEK_TOKEN_LENGTH ||
      COMBINING_MARK_PATTERN.test(run.normalize("NFD")),
  );

  return hasNaturalLanguageGreekRun ? null : query;
}

export function normalizeProviderReadyDifferentPositionCandidates<T extends { query: string }>(
  candidates: T[],
): T[] {
  return candidates.flatMap((candidate) => {
    const query = normalizeProviderReadyDifferentPositionQuery(candidate.query);
    return query == null ? [] : [{ ...candidate, query }];
  });
}

export interface SemanticProfileQuotedBasis {
  claim: string | null;
  topics: string[];
  method: string | null;
  finding: string | null;
  conclusion?: string | null;
}

export interface SemanticProfile {
  claim: string | null;
  topics: string[];
  method: string | null;
  finding: string | null;
  conclusion?: string | null;
  quotedBasis: SemanticProfileQuotedBasis;
}

export interface DifferentPositionSearchCandidate {
  query: string;
  rationale: string;
  basis: string | null;
}

export interface StanceProfile {
  mainPosition: string | null;
  debateAxis: string | null;
  limitations: string | null;
  counterSearchQueries: DifferentPositionSearchCandidate[];
}

export interface AIAnalysis {
  summary: string;
  localizedTitle?: string | null;
  objective: string;
  methodology: string;
  results: string;
  keywords: string[];
  semanticProfile: SemanticProfile;
  stanceProfile?: StanceProfile;
  confidence: ConfidenceLevel;
  evidenceMap: Record<string, string>;
}
