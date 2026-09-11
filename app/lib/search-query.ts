import type { SearchQueryClause } from "@/app/domain/search-query";

// A comma joins concepts inside one compound search intent. Only semicolons and
// newlines explicitly start another provider query.
// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-comma-query-single-intent
const SEARCH_QUERY_CLAUSE_SPLITTER = /[;\n]+/;
const CLAUSE_LEADING_BOILERPLATE_PATTERNS = [
  /^(?:towards?|toward)\s+/i,
  /^(?:a|an|the)\s+study\s+of\s+/i,
  /^(?:a|an|the)\s+(?:survey|review)\s+of\s+/i,
  /^(?:a|an|the)\s+(?:framework|frameworks|system|systems|approach|approaches|method|methods)\s+for\s+/i,
  /^(?:the\s+)?future\s+of\s+/i,
  /^(?:using|leveraging|applying)\s+/i,
];

export const MAX_SEARCH_QUERY_CLAUSES = 4;
const CLAUSE_ROLE_WEIGHTS = {
  anchor: 0.8,
  theme: 1.2,
  constraint: 1.0,
  other: 1.0,
} as const;

export function parseSearchQueryClauses(query: string): string[] {
  const normalized = query.trim();
  if (!normalized) return [];

  const clauses = normalized
    .split(SEARCH_QUERY_CLAUSE_SPLITTER)
    .map((clause) => clause.trim().replace(/\s+/g, " "))
    .filter((clause) => clause.length > 0);

  if (clauses.length <= 1) {
    return clauses;
  }

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const clause of clauses) {
    const key = clause.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(clause);
  }

  return deduped.slice(0, MAX_SEARCH_QUERY_CLAUSES);
}

export function deterministicNormalizeSearchClause(clause: string): string {
  let next = clause.trim().replace(/\s+/g, " ");

  for (const pattern of CLAUSE_LEADING_BOILERPLATE_PATTERNS) {
    next = next.replace(pattern, "");
  }

  return next.trim().replace(/\s+/g, " ");
}

function hasOrderedTokenSubset(rawTokens: string[], normalizedTokens: string[]): boolean {
  if (normalizedTokens.length === 0) return false;
  let pointer = 0;

  for (const token of rawTokens) {
    if (token === normalizedTokens[pointer]) {
      pointer += 1;
      if (pointer >= normalizedTokens.length) {
        return true;
      }
    }
  }

  return false;
}

export function isExtractiveClauseRewrite(rawClause: string, normalizedClause: string): boolean {
  const rawNormalized = deterministicNormalizeSearchClause(rawClause).toLowerCase();
  const nextNormalized = deterministicNormalizeSearchClause(normalizedClause).toLowerCase();
  if (!rawNormalized || !nextNormalized) return false;
  if (rawNormalized === nextNormalized) return true;
  if (rawNormalized.includes(nextNormalized)) return true;

  const rawTokens = rawNormalized.split(" ").filter((token) => token.length > 0);
  const normalizedTokens = nextNormalized.split(" ").filter((token) => token.length > 0);
  return hasOrderedTokenSubset(rawTokens, normalizedTokens);
}

export function createDefaultSearchQueryClauses(query: string): SearchQueryClause[] {
  return parseSearchQueryClauses(query).map((clause) => {
    const normalizedClause = deterministicNormalizeSearchClause(clause) || clause;
    return {
      rawClause: clause,
      normalizedClause,
      role: "other",
      isExtractive: isExtractiveClauseRewrite(clause, normalizedClause),
      derivedExpansions: [],
    };
  });
}

function dedupeSearchQueryClauses(clauses: SearchQueryClause[]): SearchQueryClause[] {
  const seen = new Set<string>();
  const deduped: SearchQueryClause[] = [];

  for (const clause of clauses) {
    const normalizedClause = deterministicNormalizeSearchClause(clause.normalizedClause);
    if (!normalizedClause) continue;

    const normalizedKey = normalizedClause.toLowerCase();
    if (seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);
    deduped.push({
      ...clause,
      normalizedClause,
    });
  }

  return deduped;
}

export function getResolvedSearchQueryClauses(params: {
  query: string;
  queryClauses?: SearchQueryClause[];
}): SearchQueryClause[] {
  if (params.queryClauses && params.queryClauses.length > 0) {
    const normalized = dedupeSearchQueryClauses(
      params.queryClauses
        .map((clause) => {
          if (!clause.isExtractive) {
            return null;
          }

          const normalizedClause = deterministicNormalizeSearchClause(clause.normalizedClause);
          if (!normalizedClause) {
            return null;
          }

          return {
            ...clause,
            normalizedClause,
          };
        })
        .filter((clause): clause is SearchQueryClause => clause !== null),
    );

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return dedupeSearchQueryClauses(createDefaultSearchQueryClauses(params.query));
}

export function getEffectiveSearchQueryClauses(params: {
  query: string;
  queryClauses?: SearchQueryClause[];
}): string[] {
  return getResolvedSearchQueryClauses(params).map((clause) => clause.normalizedClause);
}

export function allocateSearchClauseLimits(
  totalLimit: number,
  clauseCount: number,
  queryClauses?: SearchQueryClause[],
): number[] {
  const normalizedLimit = Math.max(1, totalLimit);
  const normalizedClauseCount = Math.max(1, Math.min(clauseCount, normalizedLimit));
  const activeClauses = queryClauses?.slice(0, normalizedClauseCount) ?? [];

  if (activeClauses.length !== normalizedClauseCount) {
    const baseLimit = Math.floor(normalizedLimit / normalizedClauseCount);
    const remainder = normalizedLimit % normalizedClauseCount;

    return Array.from(
      { length: normalizedClauseCount },
      (_, index) => baseLimit + (index < remainder ? 1 : 0),
    );
  }

  const clauseWeights = activeClauses.map((clause) => CLAUSE_ROLE_WEIGHTS[clause.role]);
  const totalWeight = clauseWeights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    const baseLimit = Math.floor(normalizedLimit / normalizedClauseCount);
    const remainder = normalizedLimit % normalizedClauseCount;

    return Array.from(
      { length: normalizedClauseCount },
      (_, index) => baseLimit + (index < remainder ? 1 : 0),
    );
  }

  const baseLimits = Array.from({ length: normalizedClauseCount }, () => 1);
  let remainingBudget = normalizedLimit - normalizedClauseCount;

  if (remainingBudget <= 0) {
    return baseLimits;
  }

  const weightedShares = clauseWeights.map((weight) => (weight / totalWeight) * remainingBudget);
  const fractionalShares = weightedShares.map((share) => share - Math.floor(share));

  for (let index = 0; index < weightedShares.length; index++) {
    const additionalBudget = Math.floor(weightedShares[index] ?? 0);
    baseLimits[index] += additionalBudget;
    remainingBudget -= additionalBudget;
  }

  const rankedFractions = fractionalShares
    .map((fraction, index) => ({
      index,
      fraction,
      weight: clauseWeights[index] ?? 0,
    }))
    .sort((left, right) => {
      const fractionDiff = right.fraction - left.fraction;
      if (fractionDiff !== 0) return fractionDiff;
      const weightDiff = right.weight - left.weight;
      if (weightDiff !== 0) return weightDiff;
      return left.index - right.index;
    });

  for (let index = 0; index < rankedFractions.length && remainingBudget > 0; index++) {
    const targetIndex = rankedFractions[index].index;
    baseLimits[targetIndex] += 1;
    remainingBudget -= 1;
  }

  return baseLimits;
}
