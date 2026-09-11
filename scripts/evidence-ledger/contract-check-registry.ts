export const CONTRACT_CHECK_CASES = {
  "product-boundary": [
    "document-model",
    "route-kind-runtime-boundaries",
    "server-delegation-hubs",
    "agent-panel-input",
    "no-autonomous-search-rules",
    "route-view-ai-comment-surface",
  ],
  "runtime-contract": [
    "route-ai-comment-generation-boundary",
    "route-view-ai-comment-generation-boundary",
  ],
  "search-first-url-model": ["no-store-url-sync"],
  documents: [
    "search-focused-context",
    "gap-context",
    "search-view-snapshot",
    "gap-view-snapshot",
    "view-snapshot-context",
  ],
  "search-result-window": ["visible-window", "no-llm-critical-path"],
  "gap-network-e2": [
    "gap-report-payload-shape",
    "report-shape",
    "hypothesis-linkage",
    "reaction-preparation",
  ],
} as const;

export type ContractCheckTarget = keyof typeof CONTRACT_CHECK_CASES;

export function isContractCheckTarget(value: string): value is ContractCheckTarget {
  return Object.hasOwn(CONTRACT_CHECK_CASES, value);
}

export function isContractCheckSubcase(target: ContractCheckTarget, value: string): boolean {
  return value === "all" || (CONTRACT_CHECK_CASES[target] as readonly string[]).includes(value);
}
