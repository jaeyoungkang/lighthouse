import type { AcceptanceCheckKey, ScenarioRef } from "@/app/domain/story-chain";

/**
 * Reviewable exceptions to byte-equivalent v1 -> v2 migration parity.
 *
 * Most prose differences are only `.ledger.md` -> `.ledger.yaml` pointer
 * normalization. These sets cover the smaller group whose evidence describes
 * the retired Markdown parser/runner itself or whose legacy execution gap had
 * to be repaired during the cutover. Adding a slug is a reviewed migration
 * decision, not a converter fallback.
 */
const LIBRARY_LEDGER = "library-grounded-research";

/**
 * Canonical ledgers created after the v1 -> v2 cutover. They have no Markdown
 * migration source, so they participate in current schema/Intent parity but
 * never count as a migration repair.
 */
export const POST_CUTOVER_LEDGER_ADDITIONS = new Set([
  "gap-build-principal-admission",
  "research-route-visual-hierarchy",
  "search-empty-results",
]);
export const FORWARD_APPLIED_ASPECT_ADDITIONS = new Map([
  ["inline-analysis", new Set<`aspect:${string}`>(["aspect:research-route-visual-hierarchy"])],
]);

export const ARCHITECTURE_ASSERTION_REWRITES = new Set([
  "ai-comment-research-term-suggestions",
  "alignment-audit",
  "alignment-coherence-gate",
  "citation-lineage",
  "commitment-pages",
  "common-page-footer",
  "gap-led-next-search",
  "gap-network-e2",
  "graph-neighbor-papers",
  "hardening-tier-policy",
  "inline-analysis",
  LIBRARY_LEDGER,
  "moonlight-handoff",
  "paper-card-action-loading-feedback",
  "paper-card-presentation-consistency",
  "progressive-content-spatial-stability",
  "respond-contract-mutation-pilot",
  "search-result-library-add",
  "search-result-window",
  "search-query-route-transition",
  "similar-papers",
  "story-chain-event-contract",
]);

/**
 * Reviewed semantic axes added after the v1 -> v2 cutover. Unlike a key
 * rewrite, these keys must be present in addition to every legacy key; unlike
 * an assertion rewrite, they do not authorize changing a legacy assertion.
 */
export const FORWARD_ACCEPTANCE_CHECK_ADDITIONS = new Map<string, ReadonlySet<AcceptanceCheckKey>>([
  [
    LIBRARY_LEDGER,
    new Set([
      "promise:search-results-fast-window#acceptance-check:search-results-fast-window-unified-result-projection",
      "promise:search-results-fast-window#acceptance-check:search-results-fast-window-library-proximity-marker",
    ]),
  ],
  [
    "gap-network-e2",
    new Set([
      "promise:gap-report-prepared-reaction#acceptance-check:gap-report-prepared-reaction-explicit-enrichment-retry",
      "promise:gap-network-detection-from-search#acceptance-check:gap-network-detection-from-search-layout-permutation-invariance",
    ]),
  ],
  [
    "provider-failure-degraded-mode",
    new Set([
      "promise:gap-report-prepared-reaction#acceptance-check:gap-report-prepared-reaction-explicit-enrichment-retry",
    ]),
  ],
]);

/**
 * Reviewed active-scenario coverage added to pre-cutover Acceptance Check rows.
 * The nested key keeps each addition attached to its existing semantic owner;
 * unregistered additions and removal of a registered ref both fail parity.
 */
export const FORWARD_SCENARIO_ADDITIONS = new Map<
  string,
  ReadonlyMap<AcceptanceCheckKey, ReadonlySet<ScenarioRef>>
>([
  [
    "citation-lineage",
    new Map<AcceptanceCheckKey, ReadonlySet<ScenarioRef>>([
      [
        "promise:citation-lineage#acceptance-check:citation-lineage-batch-failure-error-reaction",
        new Set(["scenario:citation-provider-failure"]),
      ],
    ]),
  ],
  [
    "gap-network-e2",
    new Map<AcceptanceCheckKey, ReadonlySet<ScenarioRef>>([
      [
        "promise:gap-report-prepared-reaction#acceptance-check:gap-report-prepared-reaction-metadata-content-narrative",
        new Set([
          "scenario:search-gap-view-method-trace",
          "scenario:search-gap-overlay-hypothesis-evidence",
        ]),
      ],
      [
        "promise:gap-network-detection-from-search#acceptance-check:gap-network-detection-from-search-cluster-detail-zoom-render",
        new Set([
          "scenario:search-gap-no-clear-gap",
          "scenario:search-gap-cluster-detail-grounding",
          "scenario:search-gap-insufficient-evidence",
        ]),
      ],
      [
        "promise:gap-overlay-decision-evidence#acceptance-check:gap-overlay-decision-evidence-gap-card-bounds",
        new Set(["scenario:search-gap-link-display"]),
      ],
    ]),
  ],
  [
    "inline-analysis",
    new Map<AcceptanceCheckKey, ReadonlySet<ScenarioRef>>([
      [
        "promise:inline-analysis-auto-run#acceptance-check:inline-analysis-auto-run-explicit-failure-retry",
        new Set(["scenario:search-inline-analysis-partial-failure"]),
      ],
    ]),
  ],
  [
    "search-ephemeral-execution",
    new Map<AcceptanceCheckKey, ReadonlySet<ScenarioRef>>([
      [
        "promise:search-failure-degraded-at-url#acceptance-check:search-failure-degraded-at-url-degraded-surface",
        new Set(["scenario:search-hard-error"]),
      ],
    ]),
  ],
]);

export const ACCEPTANCE_CHECK_KEY_REWRITES = new Map<
  string,
  ReadonlyMap<AcceptanceCheckKey, AcceptanceCheckKey>
>([
  [
    "alignment-audit",
    new Map([
      [
        "promise:release-verdict-aspect-integration#acceptance-check:release-verdict-aspect-integration-release-verdict-three-component-shape",
        "promise:release-verdict-aspect-integration#acceptance-check:release-verdict-aspect-integration-four-dimension-shape",
      ],
    ]),
  ],
  [
    "hardening-tier-policy",
    new Map([
      [
        "promise:hardening-tier-policy#acceptance-check:hardening-tier-policy-mutation-trigger",
        "promise:hardening-tier-policy#acceptance-check:hardening-tier-policy-manual-mutation-lane",
      ],
    ]),
  ],
  [
    "respond-contract-mutation-pilot",
    new Map([
      [
        "promise:respond-contract-mutation-pilot#acceptance-check:respond-contract-mutation-pilot-nightly-isolation",
        "promise:respond-contract-mutation-pilot#acceptance-check:respond-contract-mutation-pilot-manual-isolation",
      ],
    ]),
  ],
]);

export const ARCHITECTURE_EXECUTION_REWRITES = new Set(["alignment-audit", LIBRARY_LEDGER]);

export const LEGACY_EXECUTION_FILE_REWRITES = new Map([
  ["app/lib/__tests__/llm-judgment.test.ts", "app/server/ai-generation/__tests__/judgment.test.ts"],
  [
    "app/lib/analytics/__tests__/event-router.ai-comment-expand.test.ts",
    "app/server/services/analytics/__tests__/event-router.ai-comment-expand.test.ts",
  ],
  [
    "app/lib/analytics/sinks/__tests__/amplitude.test.ts",
    "app/server/services/analytics/__tests__/amplitude-sink.test.ts",
  ],
]);

export const ARCHITECTURE_IMPLEMENTATION_REWRITES = new Set([
  "admin-access-control",
  "ai-comment-research-term-suggestions",
  "alignment-audit",
  "citation-lineage",
  "common-page-footer",
  "document-content-width-governance",
  "gap-network-e2",
  "gap-report-surface",
  "graph-neighbor-papers",
  "hardening-tier-policy",
  "inline-analysis",
  LIBRARY_LEDGER,
  "moonlight-handoff",
  "paper-card-list-windowing",
  "paper-card-presentation-consistency",
  "provider-failure-degraded-mode",
  "research-route-cap-feedback",
  "respond-contract-mutation-pilot",
  "search-ephemeral-execution",
  "search-gap-handoff",
  "search-query-route-transition",
  "search-reaction",
  "search-result-library-add",
  "search-result-window",
  "similar-papers",
  "snapshot-reaction",
  "story-chain-event-contract",
]);

export const ADDED_REVIEW_POINTERS = new Set([
  "knowledge-map-followup-surface",
  "paper-card-action-loading-feedback",
  "paper-card-list-windowing",
  "paper-card-presentation-consistency",
  "route-view-ai-comment-generation-routing",
]);

export const LEGACY_UNCURATED_INTENT_REPAIRS = new Set([
  "ai-generated-content-feedback",
  "knowledge-map-followup-surface",
  "paper-card-action-loading-feedback",
  "paper-card-list-windowing",
  "paper-card-presentation-consistency",
  "progressive-content-spatial-stability",
  "provider-failure-degraded-mode",
  "route-view-ai-comment-generation-routing",
]);
