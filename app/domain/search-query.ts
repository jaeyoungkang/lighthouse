export type SearchQueryClauseRole = "anchor" | "theme" | "constraint" | "other";

export interface SearchQueryClause {
  rawClause: string;
  normalizedClause: string;
  role: SearchQueryClauseRole;
  isExtractive: boolean;
  derivedExpansions: string[];
}
