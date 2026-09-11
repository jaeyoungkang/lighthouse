import type { SearchQueryClause } from "@/app/domain/search-query";
import { createDefaultSearchQueryClauses } from "@/app/lib/search-query";

export function normalizeSearchQueryClauses(query: string): SearchQueryClause[] {
  return createDefaultSearchQueryClauses(query);
}
