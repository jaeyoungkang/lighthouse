#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assertLighthouseCollectorAuthority } from "./lighthouse-trust-policy.mjs";

const ROOT = process.cwd();
const COLLECTOR_PATH = fileURLToPath(import.meta.url);
const COLLECTOR_REF = "scripts/architecture-fitness/collect-q3-workload.mjs";
const TEST_REF = "scripts/architecture-fitness/__tests__/q3-workload-boundaries.test.ts";
const TRUST_POLICY_REF = "scripts/architecture-fitness/lighthouse-trust-policy.mjs";
const POLICY_REF = "issue-286:search-workload-envelope";
const CAPABILITY_REF = "capability:lighthouse-search-workload";
const ZERO_DIGEST = "0".repeat(64);
const COMPATIBILITY_PATHS = ["app", "supabase", "proxy.ts", "next.config.ts", "package-lock.json"];
const EXACT_REVIEWED_TARGET_UNAVAILABLE_POLICY = "accept-exact-reviewed-target";
const PR_338_MEASUREMENT_REVISION = "a02caaf757b2050aab062816249f96269dd052cf";
const PR_338_MEASURED_GUARDED_TREE_DIGEST =
  "ad206128f5a1c582303c608a3e0ae5b593783331d1d148318fc9680007beb544";
const PR_338_UNAVAILABLE_REPORT_BINDINGS = Object.freeze({
  "scenario:q3-cold-u20": Object.freeze({
    reportRef: "docs/architecture-fitness/pilots/q3-workload/v6-active/cold-u20.report.json",
    expectedDigest: "93f125e76c53739b1c32367025ef374ed1aae2efdb780c8c6e5576809f8d588c",
  }),
  "scenario:q3-sustained-open-1ps-60s": Object.freeze({
    reportRef:
      "docs/architecture-fitness/pilots/q3-workload/v6-active/sustained-open-1ps-60s.report.json",
    expectedDigest: "a34bf67988009876b3565e8b953e808489a3a38a5172a7cb8376845f35fbb648",
  }),
  "scenario:q3-controlled-u2-amplification": Object.freeze({
    reportRef: "docs/architecture-fitness/pilots/q3-workload/v6-active/controlled-u2.report.json",
    expectedDigest: "f29425ddaa4549cddb720735e856d3aea0ba4ff32dce41e4cc5a87b10c628c64",
  }),
});

export const PR_338_FINAL_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "fa893beae3fd25bdf585a0c8df17b028ec07236d62723e93641f29591f1045e9",
  decisionRef: "human:2026-07-18:pr338-contract-reconciliation-non-workload",
  changedPaths: Object.freeze([
    "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
    "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
    "app/components/research-route-renderers/search-result-generated-content.tsx",
    "app/components/research-route-renderers/search-result-item.tsx",
    "app/components/research/AgentPanel.tsx",
    "app/components/research/__tests__/AgentPanel.test.tsx",
    "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
    "app/components/research/attach-inline-ai-comment-body-slot.tsx",
    "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
  ]),
  rationale:
    "The exact reviewed PR #338 tree adds only presentation, accessibility, Fragment-slot robustness, approved contract and Decision Log reconciliation, and their tests; provider/search execution, admission, readiness detection, and configuration remain unchanged.",
});

export const PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "4be8a4050a45a467c32744dae8a3fd2f87776a996cec68f8a390bb3a9ce29b5b",
  decisionRef: "human:2026-07-18:production-auth-callback-non-workload",
  changedPaths: Object.freeze([
    "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
    "app/api/auth/magic-link/__tests__/route.test.ts",
    "supabase/config.toml",
  ]),
  rationale:
    "The exact reviewed production auth callback tree changes only same-origin PKCE callback tests and the Supabase redirect allowlist; provider/search execution, admission, readiness detection, and workload configuration remain unchanged.",
});

export const PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "ea909751493d6a5730279b0ed9717d29e7123166deeaef9cb207edd5057eaf01",
  decisionRef: "human:2026-07-18:pr338-main-integration-non-workload",
  changedPaths: Object.freeze([
    "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
    "app/api/auth/magic-link/__tests__/route.test.ts",
    "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
    "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
    "app/components/research-route-renderers/search-result-generated-content.tsx",
    "app/components/research-route-renderers/search-result-item.tsx",
    "app/components/research/AgentPanel.tsx",
    "app/components/research/__tests__/AgentPanel.test.tsx",
    "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
    "app/components/research/attach-inline-ai-comment-body-slot.tsx",
    "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
    "supabase/config.toml",
  ]),
  rationale:
    "The exact reviewed integration tree combines the approved PR #338 presentation and contract reconciliation with the production auth callback tests and redirect allowlist; provider/search execution, admission, readiness detection, and workload configuration remain unchanged.",
});

export const PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "687cb5c089fe368a002eeb406e84ec54c7b114fa54734c4ede565611c9a89bd2",
  decisionRef: "human:2026-07-18:pr379-canonical-host-non-workload",
  changedPaths: Object.freeze([
    "app/(admin)/admin/decision-log/admin-decision-log-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-379-entries.ts",
    "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
    "app/api/auth/magic-link/__tests__/route.test.ts",
    "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
    "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
    "app/components/research-route-renderers/search-result-generated-content.tsx",
    "app/components/research-route-renderers/search-result-item.tsx",
    "app/components/research/AgentPanel.tsx",
    "app/components/research/__tests__/AgentPanel.test.tsx",
    "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
    "app/components/research/attach-inline-ai-comment-body-slot.tsx",
    "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-379.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-recent.ts",
    "next.config.ts",
    "supabase/config.toml",
  ]),
  rationale:
    "The exact reviewed PR #379 tree combines the approved PR #338 presentation, production auth callback defense, a compatibility-host-only redirect with regression coverage, and the internal canonical-host Decision Log; canonical/local search execution, provider calls, admission, readiness detection, and workload configuration remain unchanged.",
});

export const AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "034443c37027d0a49a9ec64a34e494c2e43c9f5aab9c277b826d8b1e157327e2",
  decisionRef: "human:2026-07-18:ai-comment-hydration-terminal-repair-non-amplifying",
  changedPaths: Object.freeze([
    "app/(admin)/admin/decision-log/admin-decision-log-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-379-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-381-entries.ts",
    "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
    "app/api/auth/magic-link/__tests__/route.test.ts",
    "app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts",
    "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
    "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
    "app/components/research-route-renderers/search-result-generated-content.tsx",
    "app/components/research-route-renderers/search-result-item.tsx",
    "app/components/research/AgentPanel.tsx",
    "app/components/research/ResearchRouteRuntime.tsx",
    "app/components/research/__tests__/AgentPanel.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.targeting.test.tsx",
    "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
    "app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts",
    "app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts",
    "app/components/research/attach-inline-ai-comment-body-slot.tsx",
    "app/components/research/research-route-runtime.helpers.ts",
    "app/components/research/route-ai-comment-generation-runtime.ts",
    "app/domain/__tests__/view-snapshot.test.ts",
    "app/domain/view-snapshot.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-379.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-381.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-recent.ts",
    "app/lib/__tests__/view-snapshot.test.ts",
    "app/lib/view-snapshot.ts",
    "app/server/agent/__tests__/route-ai-comment-generation.test.ts",
    "app/server/domain-access/__tests__/search-enrichment-access.test.ts",
    "app/server/domain-access/search-enrichment-access.ts",
    "app/server/services/__tests__/search-hydration.test.ts",
    "app/server/services/search-hydration.ts",
    "app/stores/__tests__/research-route-store.ai-comment-generation.test.ts",
    "next.config.ts",
    "supabase/config.toml",
  ]),
  rationale:
    "The exact reviewed tree combines the approved PR #338 presentation and auth changes, the PR #379 canonical-host and internal Decision Log changes, the published PR #381 Decision Log surface, and AI-comment hydration stabilization. It preserves the Q3 journey arrival, input/provider/topology profiles, healthy-provider search fan-out, admission, route deadline, and concurrency. Server hydration preserves first-commit terrain metadata, records a successful-empty 200 from either initial hydration or repair as terminal, and returns provider errors or aborts to the existing sequential maximum-three client retry path; exhausted retries preserve lightweight evidence and settle ready with a terminal repair marker so faceted comments neither wait forever nor duplicate generation. This is not new latency, production-health, or real-provider evidence.",
});

export const SKILL_RUNTIME_INSTALL_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "344706358c2217a4e75a9b10c808096501360480d0c1261f3adba6f07870fa15",
  decisionRef: "human:2026-07-19:skill-runtime-install-non-workload",
  changedPaths: Object.freeze([
    "app/(admin)/admin/decision-log/admin-decision-log-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-379-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-381-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-386-entries.ts",
    "app/admin/__tests__/story-chain-guide-page.test.tsx",
    "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
    "app/api/auth/magic-link/__tests__/route.test.ts",
    "app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts",
    "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
    "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
    "app/components/research-route-renderers/search-result-generated-content.tsx",
    "app/components/research-route-renderers/search-result-item.tsx",
    "app/components/research/AgentPanel.tsx",
    "app/components/research/ResearchRouteRuntime.tsx",
    "app/components/research/__tests__/AgentPanel.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.targeting.test.tsx",
    "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
    "app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts",
    "app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts",
    "app/components/research/attach-inline-ai-comment-body-slot.tsx",
    "app/components/research/research-route-runtime.helpers.ts",
    "app/components/research/route-ai-comment-generation-runtime.ts",
    "app/domain/__tests__/view-snapshot.test.ts",
    "app/domain/view-snapshot.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-379.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-381.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-386.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-recent.ts",
    "app/i18n/messages/story-chain-guide.ts",
    "app/lib/__tests__/view-snapshot.test.ts",
    "app/lib/view-snapshot.ts",
    "app/server/agent/__tests__/route-ai-comment-generation.test.ts",
    "app/server/domain-access/__tests__/search-enrichment-access.test.ts",
    "app/server/domain-access/search-enrichment-access.ts",
    "app/server/services/__tests__/search-hydration.test.ts",
    "app/server/services/alignment-audit/findings.ts",
    "app/server/services/search-hydration.ts",
    "app/stores/__tests__/research-route-store.ai-comment-generation.test.ts",
    "next.config.ts",
    "supabase/config.toml",
  ]),
  rationale:
    "The exact reviewed tree adds only the internal Agent Skill source/install/drift projection, its tests, and the corresponding internal Decision Log entry on top of the previously reviewed AI-comment hydration tree. It does not change search execution, provider calls, admission, readiness detection, route deadlines, concurrency, or workload configuration.",
});

export const ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "e392727463a7fa59361312c2b4265963e63da5105d3935d3e55cae676a0441e2",
  decisionRef: "human:2026-07-19:issue208-error-catalog-non-workload",
  changedPaths: Object.freeze([
    "app/(admin)/admin/decision-log/admin-decision-log-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-379-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-381-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-386-entries.ts",
    "app/admin/__tests__/story-chain-guide-page.test.tsx",
    "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
    "app/api/auth/magic-link/__tests__/route.test.ts",
    "app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts",
    "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
    "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
    "app/components/research-route-renderers/search-result-generated-content.tsx",
    "app/components/research-route-renderers/search-result-item.tsx",
    "app/components/research/AgentPanel.tsx",
    "app/components/research/ResearchRouteRuntime.tsx",
    "app/components/research/__tests__/AgentPanel.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.targeting.test.tsx",
    "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
    "app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts",
    "app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts",
    "app/components/research/attach-inline-ai-comment-body-slot.tsx",
    "app/components/research/research-route-runtime.helpers.ts",
    "app/components/research/route-ai-comment-generation-runtime.ts",
    "app/domain/__tests__/view-snapshot.test.ts",
    "app/domain/error-catalog.ts",
    "app/domain/view-snapshot.ts",
    "app/i18n/messages.ts",
    "app/i18n/messages/argument-map.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-379.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-381.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-386.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-recent.ts",
    "app/i18n/messages/community-map.ts",
    "app/i18n/messages/knowledge-map-interpret.ts",
    "app/i18n/messages/story-chain-guide.ts",
    "app/lib/__tests__/view-snapshot.test.ts",
    "app/lib/view-snapshot.ts",
    "app/server/agent/__tests__/route-ai-comment-generation.test.ts",
    "app/server/domain-access/__tests__/search-enrichment-access.test.ts",
    "app/server/domain-access/search-enrichment-access.ts",
    "app/server/services/__tests__/search-hydration.test.ts",
    "app/server/services/alignment-audit/findings.ts",
    "app/server/services/search-hydration.ts",
    "app/stores/__tests__/research-route-store.ai-comment-generation.test.ts",
    "next.config.ts",
    "supabase/config.toml",
  ]),
  rationale:
    "The exact reviewed tree removes only zero-caller error catalog entries and retired fixed-copy messages on top of the approved skill-runtime tree. It does not change search execution, provider calls, admission, readiness detection, route deadlines, concurrency, workload configuration, or any active message caller.",
});

export const ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "0c5001e9d6b048b4cb4b549608883bd80e62ec335259326fe2734ef9d4c554ef",
  decisionRef: "human:2026-07-19:issue208-principal-fixture-non-workload",
  changedPaths: Object.freeze([
    "app/(admin)/admin/decision-log/admin-decision-log-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-379-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-381-entries.ts",
    "app/(admin)/admin/decision-log/admin-decision-log-pr-386-entries.ts",
    "app/admin/__tests__/story-chain-guide-page.test.tsx",
    "app/api/analytics-events/__tests__/route.test.ts",
    "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
    "app/api/auth/magic-link/__tests__/route.test.ts",
    "app/api/gap-reports/[id]/reaction/__tests__/route.test.ts",
    "app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts",
    "app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbor-states.test.tsx",
    "app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx",
    "app/components/research-route-renderers/__tests__/CitationLineageView.inline-analysis-budget.test.tsx",
    "app/components/research-route-renderers/__tests__/CitationLineageView.test.tsx",
    "app/components/research-route-renderers/__tests__/GapNetworkView.enrichment.test.tsx",
    "app/components/research-route-renderers/__tests__/GapNetworkView.progress-pacing.test.tsx",
    "app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx",
    "app/components/research-route-renderers/__tests__/GraphNeighborsView.inline-analysis-terms.test.tsx",
    "app/components/research-route-renderers/__tests__/SearchView.citation-lineage.test.tsx",
    "app/components/research-route-renderers/__tests__/SearchView.library-action.test.tsx",
    "app/components/research-route-renderers/__tests__/SearchView.similar-paper.test.tsx",
    "app/components/research-route-renderers/__tests__/SearchView.visible-window.test.tsx",
    "app/components/research-route-renderers/__tests__/gap-network-view-persistence.fixtures.ts",
    "app/components/research-route-renderers/__tests__/gap-network-view.helpers.test.ts",
    "app/components/research-route-renderers/__tests__/graph-neighbors-view.test.tsx",
    "app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx",
    "app/components/research-route-renderers/__tests__/relationship-view-ai-comment-actions.test.tsx",
    "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
    "app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx",
    "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
    "app/components/research-route-renderers/__tests__/search-view-agent-actions.test.ts",
    "app/components/research-route-renderers/__tests__/search-view-content.analytics.test.tsx",
    "app/components/research-route-renderers/__tests__/search-view-content.representative-filter.test.tsx",
    "app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx",
    "app/components/research-route-renderers/__tests__/search-view-content.result-interactions.test.tsx",
    "app/components/research-route-renderers/__tests__/search-view-content.reveal.test.tsx",
    "app/components/research-route-renderers/__tests__/search-view-content.spelling-correction.test.tsx",
    "app/components/research-route-renderers/__tests__/search-view-content.term-discovery.test.tsx",
    "app/components/research-route-renderers/__tests__/search-view-content.test.tsx",
    "app/components/research-route-renderers/__tests__/search-view-content.year-range.test.tsx",
    "app/components/research-route-renderers/__tests__/search-view-knowledge-map.test.ts",
    "app/components/research-route-renderers/__tests__/search-view.helpers.test.ts",
    "app/components/research-route-renderers/__tests__/search-view.inline-analysis-persistence.test.ts",
    "app/components/research-route-renderers/__tests__/use-graph-neighbors-handler.test.tsx",
    "app/components/research-route-renderers/__tests__/use-search-view-controller.library-availability.test.tsx",
    "app/components/research-route-renderers/search-result-generated-content.tsx",
    "app/components/research-route-renderers/search-result-item.tsx",
    "app/components/research/AgentPanel.tsx",
    "app/components/research/ResearchRouteRuntime.tsx",
    "app/components/research/__tests__/AgentPanel.auto-expand.test.tsx",
    "app/components/research/__tests__/AgentPanel.citation-lineage.test.tsx",
    "app/components/research/__tests__/AgentPanel.reaction-cards.test.tsx",
    "app/components/research/__tests__/AgentPanel.test.tsx",
    "app/components/research/__tests__/ResearchBackgroundTasks.condition-ownership.test.ts",
    "app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx",
    "app/components/research/__tests__/ResearchBackgroundTasks.inline-analysis-canonical.test.tsx",
    "app/components/research/__tests__/ResearchBackgroundTasks.inline-analysis-continuation.test.tsx",
    "app/components/research/__tests__/ResearchBackgroundTasks.inline-analysis-order.test.tsx",
    "app/components/research/__tests__/ResearchBackgroundTasks.inline-analysis-window.test.tsx",
    "app/components/research/__tests__/ResearchBackgroundTasks.term-discovery.test.tsx",
    "app/components/research/__tests__/ResearchBackgroundTasks.test.tsx",
    "app/components/research/__tests__/ResearchRouteLayout.narrow.test.tsx",
    "app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx",
    "app/components/research/__tests__/ResearchRouteLayout.view-mode.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.execution-lifecycle.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-cleanup.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx",
    "app/components/research/__tests__/ResearchRouteRuntime.targeting.test.tsx",
    "app/components/research/__tests__/ResearchRouteSearchBar.test.tsx",
    "app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx",
    "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
    "app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts",
    "app/components/research/__tests__/research-route-shell.test.tsx",
    "app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts",
    "app/components/research/attach-inline-ai-comment-body-slot.tsx",
    "app/components/research/research-route-runtime.helpers.ts",
    "app/components/research/route-ai-comment-generation-runtime.ts",
    "app/domain/__tests__/view-snapshot.test.ts",
    "app/domain/error-catalog.ts",
    "app/domain/view-snapshot.ts",
    "app/i18n/messages.ts",
    "app/i18n/messages/argument-map.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-379.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-381.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-386.ts",
    "app/i18n/messages/commitment-admin-decision-log-pr-recent.ts",
    "app/i18n/messages/community-map.ts",
    "app/i18n/messages/knowledge-map-interpret.ts",
    "app/i18n/messages/story-chain-guide.ts",
    "app/lib/__tests__/track.different-position.test.ts",
    "app/lib/__tests__/track.test.ts",
    "app/lib/__tests__/view-snapshot.test.ts",
    "app/lib/analytics/__tests__/client.test.ts",
    "app/lib/analytics/__tests__/event-router.ai-comment-expand.test.ts",
    "app/lib/analytics/__tests__/event-router.test.ts",
    "app/lib/view-snapshot.ts",
    "app/server/agent/__tests__/route-ai-comment-generation.test.ts",
    "app/server/domain-access/__tests__/search-backed-knowledge-map-persistence.test.ts",
    "app/server/domain-access/__tests__/search-enrichment-access.test.ts",
    "app/server/domain-access/__tests__/server-analytics.test.ts",
    "app/server/domain-access/search-enrichment-access.ts",
    "app/server/repository/__tests__/analytics-events.test.ts",
    "app/server/services/__tests__/graph-neighbor-papers.test.ts",
    "app/server/services/__tests__/search-hydration.test.ts",
    "app/server/services/__tests__/search-service.test.ts",
    "app/server/services/__tests__/search-view-payload.test.ts",
    "app/server/services/alignment-audit/findings.ts",
    "app/server/services/search-hydration.ts",
    "app/stores/__tests__/background-task-store.inline-analysis.test.ts",
    "app/stores/__tests__/research-route-store.ai-comment-active-session.test.ts",
    "app/stores/__tests__/research-route-store.ai-comment-cards.test.ts",
    "app/stores/__tests__/research-route-store.ai-comment-generation.test.ts",
    "next.config.ts",
    "supabase/config.toml",
  ]),
  rationale:
    "The exact reviewed tree renames only test fixture values that represent owner or viewer principals across 76 test and fixture files. It does not change production or runtime implementation, search execution, provider calls, admission, readiness detection, route deadlines, concurrency, workload configuration, or analytics event contracts.",
});

export const ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "957eca07faf715c281ec618b8b5ac78eec37c14fe8fa02cb20e70c200c960a5e",
  decisionRef: "human:2026-07-19:issue208-stale-fixture-css-non-workload",
  changedPaths: Object.freeze(
    [
      ...ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.changedPaths,
      "app/globals.css",
      "app/server/services/__tests__/intent-surface-audit.test.ts",
    ].sort(),
  ),
  rationale:
    "The exact reviewed tree removes only redundant empty-directory scaffolding from the intent surface audit fixture and zero-caller global CSS tokens and selectors on top of the approved principal fixture tree. It does not change production component markup, search execution, provider calls, admission, readiness detection, route deadlines, concurrency, workload configuration, or analytics event contracts.",
});

export const ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "e3eb178ddd5b2954da5a01deb979d5a7f53e0f999dafc141cebb3c8c5368734e",
  decisionRef: "implementation:2026-07-19:issue399-url-budget-non-workload",
  changedPaths: Object.freeze(
    [
      ...new Set([
        ...ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths,
        "app/(admin)/admin/decision-log/admin-decision-log-pr-416-entries.ts",
        "app/(admin)/admin/decision-log/admin-decision-log-pr-418-entries.ts",
        "app/(research)/__tests__/relationship-route-page.test.tsx",
        "app/(research)/__tests__/research-routes.test.tsx",
        "app/(research)/relationship-route-page.tsx",
        "app/(research)/research-route-shell.tsx",
        "app/(research)/search-route-page.tsx",
        "app/components/CitationLink.tsx",
        "app/components/artifacts/renderers/ResearchRouteResultCard.tsx",
        "app/components/research-route-renderers/SearchView.tsx",
        "app/components/research-route-renderers/__tests__/search-view-empty-state-route-selection.test.tsx",
        "app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx",
        "app/components/research-route-renderers/__tests__/search-view-states.test.tsx",
        "app/components/research-route-renderers/knowledge-map/GapNetworkFocusedSelectionSummary.tsx",
        "app/components/research-route-renderers/search-view-content.tsx",
        "app/components/research-route-renderers/search-view-followup-handlers.ts",
        "app/components/research-route-renderers/search-view-states.tsx",
        "app/components/research-route-renderers/use-graph-neighbors-handler.ts",
        "app/components/research-route-renderers/view-followup-window.ts",
        "app/components/research/ConditionUrlRejectedState.tsx",
        "app/components/research/ResearchRouteSearchBar.tsx",
        "app/components/research/SearchFollowupActivationStatus.tsx",
        "app/components/research/__tests__/research-route-local-navigation.test.tsx",
        "app/components/research/__tests__/search-followup-activation.test.tsx",
        "app/components/research/search-followup-activation.tsx",
        "app/i18n/messages/search.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-416.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-418.ts",
        "app/lib/__tests__/api-routes.test.ts",
        "app/lib/__tests__/search-condition-url-budget.test.ts",
        "app/lib/api-routes.ts",
        "app/lib/search-condition-url-budget.ts",
        "app/server/services/__tests__/relationship-execution.test.ts",
        "app/server/services/__tests__/search-execution.test.ts",
        "app/server/services/relationship-execution.ts",
        "app/server/services/search-execution.ts",
      ]),
    ].sort(),
  ),
  rationale:
    "The exact reviewed tree combines the Search-first condition URL byte budget, reject-only UI feedback, parser-before-identity ordering, tests, generic validation copy, the latest-main citation Evidence Ledger helper call-site alignment, its approved content-keyed internal Decision Log entry, and the already-approved Issue #208 gap-lifetime regression and Decision Log tree on top of the approved Issue #208 stale-fixture/CSS compatibility. It does not add provider calls, admission work, route deadlines, concurrency, workload configuration, or production capacity evidence.",
});

export const ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY = Object.freeze({
  guardedTreeDigest: "49fbe648a02727a551158f20434d2ba1e038477d74d3132db7c0e4254592dc7c",
  decisionRef: "human:2026-07-19:issue208-gap-lifetime-regression-and-decision-log-non-workload",
  changedPaths: Object.freeze(
    [
      ...ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths,
      "app/(admin)/admin/decision-log/admin-decision-log-pr-416-entries.ts",
      "app/components/research-route-renderers/__tests__/search-view-states.test.tsx",
      "app/i18n/messages/commitment-admin-decision-log-pr-416.ts",
    ].sort(),
  ),
  rationale:
    "The exact reviewed tree adds a deterministic SearchView unmount regression that locks the existing shared detached-gap continuation after dispatch, keeps its close assertion lint-safe without changing test behavior, and includes the Human-approved internal Decision Log entry for that contract. It does not change production runtime implementation, search execution, provider calls, admission, readiness detection, route deadlines, concurrency, workload configuration, or analytics event contracts.",
});

export const Q3_WORKLOAD_REPORTS = [
  {
    scenarioRef: "scenario:q3-cold-u20",
    reportRef: "docs/architecture-fitness/pilots/q3-workload/v6-active/cold-u20.report.json",
    measurements: [
      {
        expectedDigest: PR_338_UNAVAILABLE_REPORT_BINDINGS["scenario:q3-cold-u20"].expectedDigest,
        measuredRevision: PR_338_MEASUREMENT_REVISION,
        guardedTreeDigest: PR_338_MEASURED_GUARDED_TREE_DIGEST,
        reviewedCompatibleTrees: [
          PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
          PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
          PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
          AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
          SKILL_RUNTIME_INSTALL_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
          ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
        ],
        measurementUnavailablePolicy: EXACT_REVIEWED_TARGET_UNAVAILABLE_POLICY,
      },
      {
        expectedDigest: "6040852a53e0ec0f20f1e0f005ce706145efff553e2c951062b916f665027e94",
        measuredRevision: "605ff8dfd17929a5615e343235176b01c42c9a26",
        guardedTreeDigest: "c695fce96986463cdcac628460ce8c7d429004fffcc8a775ccb72814bb54188b",
        reviewedCompatibleTrees: [PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY],
      },
    ],
    schemaVersion: "4",
    mode: "one-shot",
    users: 20,
    inputProfile: "typical-transformer-attention-first-session-v1",
    providerProfile: "real-episteme-approved-20-window-20260717",
    topologyProfile: "local-single-next-process-production-default-8x12",
    providerEvidence: false,
  },
  {
    scenarioRef: "scenario:q3-sustained-open-1ps-60s",
    reportRef:
      "docs/architecture-fitness/pilots/q3-workload/v6-active/sustained-open-1ps-60s.report.json",
    measurements: [
      {
        expectedDigest:
          PR_338_UNAVAILABLE_REPORT_BINDINGS["scenario:q3-sustained-open-1ps-60s"].expectedDigest,
        measuredRevision: PR_338_MEASUREMENT_REVISION,
        guardedTreeDigest: PR_338_MEASURED_GUARDED_TREE_DIGEST,
        reviewedCompatibleTrees: [
          PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
          PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
          PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
          AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
          SKILL_RUNTIME_INSTALL_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
          ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
        ],
        measurementUnavailablePolicy: EXACT_REVIEWED_TARGET_UNAVAILABLE_POLICY,
      },
      {
        expectedDigest: "47738014ecb544bbbb7a79a62e2d9874d269cfbd386ed32bb8c9c6809c4e972b",
        measuredRevision: "605ff8dfd17929a5615e343235176b01c42c9a26",
        guardedTreeDigest: "c695fce96986463cdcac628460ce8c7d429004fffcc8a775ccb72814bb54188b",
        reviewedCompatibleTrees: [PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY],
      },
    ],
    schemaVersion: "4",
    mode: "sustained-open",
    durationMs: 60_000,
    arrivalRatePerSecond: 1,
    maxInFlight: 20,
    inputProfile: "typical-transformer-attention-first-session-v1",
    providerProfile: "real-episteme-approved-20-window-20260717",
    topologyProfile: "local-single-next-process-production-default-8x12",
    providerEvidence: false,
  },
  {
    scenarioRef: "scenario:q3-controlled-u2-amplification",
    reportRef: "docs/architecture-fitness/pilots/q3-workload/v6-active/controlled-u2.report.json",
    measurements: [
      {
        expectedDigest:
          PR_338_UNAVAILABLE_REPORT_BINDINGS["scenario:q3-controlled-u2-amplification"]
            .expectedDigest,
        measuredRevision: PR_338_MEASUREMENT_REVISION,
        guardedTreeDigest: PR_338_MEASURED_GUARDED_TREE_DIGEST,
        reviewedCompatibleTrees: [
          PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
          PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
          PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
          AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
          SKILL_RUNTIME_INSTALL_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
          ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
        ],
        measurementUnavailablePolicy: EXACT_REVIEWED_TARGET_UNAVAILABLE_POLICY,
      },
      {
        expectedDigest: "6ef8e6aaf13b735b9df96a3e4a392b318eb8cbfaeb3d279ba942de7b599852c6",
        measuredRevision: "605ff8dfd17929a5615e343235176b01c42c9a26",
        guardedTreeDigest: "c695fce96986463cdcac628460ce8c7d429004fffcc8a775ccb72814bb54188b",
        reviewedCompatibleTrees: [PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY],
      },
    ],
    schemaVersion: "4",
    mode: "one-shot",
    users: 2,
    inputProfile: "deterministic-3-paper-v1",
    providerProfile: "local-fixture-healthy-v1",
    providerFixtureProfile: "healthy",
    topologyProfile: "local-single-next-process",
    providerEvidence: true,
  },
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalDigest(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nonNegativeInteger(value, label) {
  assert(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`);
  return value;
}

function positiveInteger(value, label) {
  const result = nonNegativeInteger(value, label);
  assert(result > 0, `${label} must be positive`);
  return result;
}

function positiveFinite(value, label) {
  assert(Number.isFinite(value) && value > 0, `${label} must be positive and finite`);
  return value;
}

function git(args, { accepted = new Set([0]), encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!accepted.has(result.status)) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : result.stdout;
    throw new Error(stderr?.trim() || stdout?.trim() || `git exited ${result.status}`);
  }
  return result;
}

export function readRevisionReport(revision, spec) {
  const result = git(["show", `${revision}:${spec.reportRef}`], { encoding: null });
  const content = result.stdout;
  const digest = sha256(content);
  const measurement = spec.measurements.find((candidate) => candidate.expectedDigest === digest);
  assert(
    measurement,
    `${spec.reportRef} digest mismatch: expected one of ${spec.measurements
      .map((candidate) => candidate.expectedDigest)
      .join(", ")}, observed ${digest}`,
  );
  return {
    report: JSON.parse(content.toString("utf8")),
    digest,
    resolvedSpec: { ...spec, ...measurement },
  };
}

function queryEndpoint(cohort) {
  const matches = (cohort.endpoints ?? []).filter(
    (item) => item.endpoint === "GET /search?q= (query execution)",
  );
  assert(matches.length === 1, "report must contain exactly one query-execution endpoint");
  return matches[0];
}

function countSuccessfulReadinessUnits(searchReadiness, schemaVersion) {
  if (schemaVersion === "4") {
    return searchReadiness.filter(
      (item) => Number.isInteger(item?.paperCount) && item.paperCount > 0,
    ).length;
  }

  assert(schemaVersion === "5", `unsupported load-smoke report schema ${schemaVersion}`);
  return searchReadiness.filter((item, index) => {
    assert(item && typeof item === "object", `v5 search readiness ${index} must be an object`);
    assert(
      !Object.hasOwn(item, "paperCount"),
      `v5 search readiness ${index} must not carry the retired paperCount field`,
    );
    const paperIds = item.paperIds;
    assert(
      paperIds === null || Array.isArray(paperIds),
      `v5 search readiness ${index} must carry paperIds`,
    );
    if (paperIds === null) return false;

    const seen = new Set();
    for (const paperId of paperIds) {
      assert(
        typeof paperId === "string" && paperId.trim() !== "" && !seen.has(paperId),
        `v5 search readiness ${index} has invalid paper identities`,
      );
      seen.add(paperId);
    }
    return paperIds.length > 0;
  }).length;
}

function normalizeProviderEvidence(report, completedUnits, expectedProfile) {
  const evidence = report.providerFixtureEvidence;
  assert(evidence && typeof evidence === "object", "provider fixture evidence is required");
  assert(evidence.source === "loopback-provider-fixture", "provider source is unsupported");
  assert(evidence.attribution === "zero-baseline", "provider attribution must use zero baseline");
  assert(
    evidence.completedJourneys === completedUnits,
    "provider completed journeys must match workload completion",
  );
  const baseline = evidence.baseline;
  const final = evidence.final;
  assert(baseline && final, "provider baseline and final stats are required");
  assert(
    baseline.profile === expectedProfile && final.profile === expectedProfile,
    "provider fixture profile does not match the declared scenario",
  );
  const baselineResponses = baseline.responses ?? {};
  const finalResponses = final.responses ?? {};
  assert(
    baseline.searchRequests === 0 &&
      baseline.inFlight === 0 &&
      baseline.maxInFlight === 0 &&
      Object.values(baselineResponses).every((value) => value === 0),
    "provider baseline must be fresh and empty",
  );
  const successCount = nonNegativeInteger(finalResponses.success, "provider successCount");
  const failureCount =
    nonNegativeInteger(finalResponses.rateLimited, "provider rateLimited") +
    nonNegativeInteger(finalResponses.serverError, "provider serverError");
  const requestCount = nonNegativeInteger(final.searchRequests, "provider requestCount");
  assert(final.inFlight === 0, "provider final in-flight work must drain");
  assert(successCount + failureCount === requestCount, "provider responses must equal requests");
  assert(
    evidence.requestsPerCompletedJourney === requestCount / completedUnits,
    "provider amplification ratio is inconsistent",
  );
  return { requestCount, successCount, failureCount };
}

export function normalizeReportArtifact(report, spec) {
  assert(report?.schemaVersion === spec.schemaVersion, "report schema version is unexpected");
  const config = report.config;
  assert(config && typeof config === "object", "report config is required");
  assert(config.targetRevision === spec.measuredRevision, "report target revision is unexpected");
  assert(config.workingTreeDirty === false, "dirty reports cannot establish workload evidence");
  assert(config.mode === spec.mode, "report mode is unexpected");
  assert(config.inputProfile === spec.inputProfile, "report input profile is unexpected");
  assert(config.providerProfile === spec.providerProfile, "report provider profile is unexpected");
  assert(config.topologyProfile === spec.topologyProfile, "report topology profile is unexpected");
  assert(Array.isArray(report.cohorts) && report.cohorts.length === 1, "one cohort is required");
  const cohort = report.cohorts[0];
  const endpoint = queryEndpoint(cohort);
  const errorUnits = nonNegativeInteger(cohort.totalErrorCount, "workload errorUnits");
  assert(Array.isArray(cohort.searchReadiness), "search readiness must be an array");
  const successfulUnits = countSuccessfulReadinessUnits(
    cohort.searchReadiness,
    report.schemaVersion,
  );
  const endpointCount = positiveInteger(endpoint.count, "query endpoint count");
  const outcomes = endpoint.outcomes ?? {};
  const outcomeCount = ["2xx", "4xx", "5xx", "timeout", "network-error"].reduce(
    (total, key) => total + nonNegativeInteger(outcomes[key], `query outcome ${key}`),
    0,
  );
  assert(outcomeCount === endpointCount, "query outcomes must equal endpoint count");
  const observedTotalErrorCount = (report.cohorts[0].endpoints ?? []).reduce((total, item) => {
    const endpointOutcomes = item.outcomes ?? {};
    return (
      total +
      nonNegativeInteger(endpointOutcomes["5xx"], "endpoint outcome 5xx") +
      nonNegativeInteger(endpointOutcomes.timeout, "endpoint outcome timeout") +
      nonNegativeInteger(endpointOutcomes["network-error"], "endpoint outcome network-error")
    );
  }, 0);
  assert(
    errorUnits === observedTotalErrorCount,
    "workload total error count must equal failing endpoint outcomes",
  );
  const latency = {
    percentile: "p95",
    millis: Math.ceil(positiveFinite(endpoint.p95, "query p95")),
  };

  let arrival;
  let scheduledUnits;
  let admittedUnits;
  let completedUnits;
  let shedUnits;
  if (spec.mode === "one-shot") {
    assert(config.users === spec.users, "one-shot users are unexpected");
    assert(cohort.users === spec.users, "cohort users must match one-shot users");
    assert(endpointCount === spec.users, "query endpoint count must match one-shot users");
    assert(cohort.searchReadiness.length === spec.users, "readiness count must match users");
    arrival = { model: "one-shot", concurrency: spec.users };
    scheduledUnits = spec.users;
    admittedUnits = spec.users;
    completedUnits = spec.users;
    shedUnits = 0;
  } else {
    const workload = report.sustainedWorkload;
    assert(workload && typeof workload === "object", "sustained workload facts are required");
    assert(workload.arrivalModel === "open", "sustained arrival model must be open");
    assert(config.durationMs === spec.durationMs, "sustained duration is unexpected");
    assert(config.warmupMs === 0, "sustained warmup must be zero");
    assert(config.cooldownPolicy === "drain-admitted", "cooldown policy is unexpected");
    assert(config.arrivalRatePerSecond === spec.arrivalRatePerSecond, "arrival rate is unexpected");
    assert(config.maxInFlight === spec.maxInFlight, "max in-flight is unexpected");
    assert(workload.configuredDurationMs === spec.durationMs, "workload duration mismatch");
    scheduledUnits = nonNegativeInteger(workload.scheduledArrivals, "scheduledUnits");
    admittedUnits = nonNegativeInteger(workload.admittedJourneys, "admittedUnits");
    completedUnits = nonNegativeInteger(workload.completedJourneys, "completedUnits");
    shedUnits = nonNegativeInteger(workload.shedArrivals, "shedUnits");
    assert(admittedUnits <= scheduledUnits, "admitted work exceeds scheduled work");
    assert(completedUnits <= admittedUnits, "completed work exceeds admitted work");
    assert(shedUnits === scheduledUnits - admittedUnits, "shed work is inconsistent");
    assert(cohort.users === admittedUnits, "cohort users must equal admitted work");
    assert(endpointCount === completedUnits, "query endpoint count must equal completed work");
    assert(
      cohort.searchReadiness.length === completedUnits,
      "readiness count must equal completed work",
    );
    arrival = {
      model: "sustained-open",
      durationMillis: spec.durationMs,
      warmupMillis: 0,
      cooldownPolicy: "drain-admitted",
      arrivalRateMilliPerSecond: spec.arrivalRatePerSecond * 1000,
      maxInFlight: spec.maxInFlight,
    };
  }

  const normalized = {
    scenarioRef: spec.scenarioRef,
    arrival,
    inputProfileRef: `input:${spec.inputProfile}`,
    providerProfileRef: `provider:${spec.providerProfile}`,
    topologyProfileRef: `topology:${spec.topologyProfile}`,
    scheduledUnits,
    admittedUnits,
    completedUnits,
    successfulUnits,
    errorUnits,
    shedUnits,
    latency,
  };
  if (spec.providerEvidence) {
    assert(spec.providerFixtureProfile, "controlled provider fixture profile is required");
    normalized.provider = normalizeProviderEvidence(
      report,
      completedUnits,
      spec.providerFixtureProfile,
    );
  } else {
    assert(
      report.providerFixtureEvidence == null,
      "live-provider reports cannot carry controlled provider evidence",
    );
  }
  return normalized;
}

function scenarioConfiguration(scenario) {
  return {
    scenarioRef: scenario.scenarioRef,
    arrival: scenario.arrival,
    inputProfileRef: scenario.inputProfileRef,
    providerProfileRef: scenario.providerProfileRef,
    topologyProfileRef: scenario.topologyProfileRef,
  };
}

function configurationFact(scenario) {
  return `scenario-config-sha256:${canonicalDigest(scenarioConfiguration(scenario))}`;
}

function measurementFact(scenario) {
  return `scenario-measurement-sha256:${canonicalDigest(scenario)}`;
}

export function guardedTreeDigest(revision) {
  git(["cat-file", "-e", `${revision}^{commit}`]);
  const tree = git(["ls-tree", "-r", "--full-tree", revision, "--", ...COMPATIBILITY_PATHS]).stdout;
  return sha256(tree);
}

function exactPathList(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function exactReviewedTree(left, right) {
  return (
    left?.guardedTreeDigest === right.guardedTreeDigest &&
    left?.decisionRef === right.decisionRef &&
    left?.rationale === right.rationale &&
    Array.isArray(left?.changedPaths) &&
    exactPathList(left.changedPaths, right.changedPaths)
  );
}

function hasExactUnavailableMeasurementBinding(spec) {
  const reportBinding = PR_338_UNAVAILABLE_REPORT_BINDINGS[spec.scenarioRef];
  const reviewedCompatibleTrees = spec.reviewedCompatibleTrees ?? [];
  const expectedReviewedCompatibleTrees = [
    PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
    PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
    PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
    AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
    SKILL_RUNTIME_INSTALL_GUARDED_TREE_COMPATIBILITY,
    ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
    ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
    ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
    ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
    ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
  ];
  return (
    reportBinding !== undefined &&
    spec.reportRef === reportBinding.reportRef &&
    spec.expectedDigest === reportBinding.expectedDigest &&
    spec.measuredRevision === PR_338_MEASUREMENT_REVISION &&
    spec.guardedTreeDigest === PR_338_MEASURED_GUARDED_TREE_DIGEST &&
    reviewedCompatibleTrees.length === expectedReviewedCompatibleTrees.length &&
    reviewedCompatibleTrees.every((candidate, index) =>
      exactReviewedTree(candidate, expectedReviewedCompatibleTrees[index]),
    )
  );
}

/**
 * @param {any} spec
 * @param {{
 *   observedGuardedTreeDigest: string;
 *   measurementBindingStatus: string;
 *   changedPaths: string[];
 * }} input
 */
export function classifyGuardedTreeCompatibility(
  spec,
  { observedGuardedTreeDigest, measurementBindingStatus, changedPaths },
) {
  if (measurementBindingStatus === "invalid") {
    return { compatible: false, compatibilityBasis: "measurement-binding-invalid" };
  }
  if (
    measurementBindingStatus === "unavailable" &&
    spec.measurementUnavailablePolicy !== EXACT_REVIEWED_TARGET_UNAVAILABLE_POLICY
  ) {
    return { compatible: false, compatibilityBasis: "measurement-revision-unavailable" };
  }
  if (measurementBindingStatus === "unavailable" && !hasExactUnavailableMeasurementBinding(spec)) {
    return { compatible: false, compatibilityBasis: "measurement-binding-invalid" };
  }
  if (measurementBindingStatus !== "verified" && measurementBindingStatus !== "unavailable") {
    return { compatible: false, compatibilityBasis: "measurement-binding-invalid" };
  }
  if (measurementBindingStatus === "unavailable" && changedPaths.length !== 0) {
    return { compatible: false, compatibilityBasis: "incompatible-tree" };
  }
  if (observedGuardedTreeDigest === spec.guardedTreeDigest) {
    return {
      compatible: true,
      compatibilityBasis:
        measurementBindingStatus === "verified"
          ? "measured-tree"
          : "exact-measured-tree-measurement-unavailable",
    };
  }
  const reviewedCompatibility = (spec.reviewedCompatibleTrees ?? []).find(
    (candidate) => candidate.guardedTreeDigest === observedGuardedTreeDigest,
  );
  if (!reviewedCompatibility) {
    return { compatible: false, compatibilityBasis: "incompatible-tree" };
  }
  if (
    measurementBindingStatus === "verified" &&
    !exactPathList(reviewedCompatibility.changedPaths, changedPaths)
  ) {
    return { compatible: false, compatibilityBasis: "incompatible-tree" };
  }
  return {
    compatible: true,
    compatibilityBasis:
      measurementBindingStatus === "verified"
        ? "human-reviewed-compatible-tree"
        : "human-reviewed-exact-tree-measurement-unavailable",
    reviewedCompatibility,
  };
}

export function reportCompatibility(spec, revision) {
  const observedGuardedTreeDigest = guardedTreeDigest(revision);
  const measuredRevisionAvailable =
    git(["rev-parse", "--verify", "--quiet", `${spec.measuredRevision}^{commit}`], {
      accepted: new Set([0, 1]),
    }).status === 0;
  const measuredGuardedTreeDigest = measuredRevisionAvailable
    ? guardedTreeDigest(spec.measuredRevision)
    : null;
  const measurementBindingStatus = !measuredRevisionAvailable
    ? "unavailable"
    : measuredGuardedTreeDigest === spec.guardedTreeDigest
      ? "verified"
      : "invalid";
  const changedPaths =
    measurementBindingStatus !== "verified" || observedGuardedTreeDigest === spec.guardedTreeDigest
      ? []
      : git([
          "diff",
          "--name-only",
          `${spec.measuredRevision}..${revision}`,
          "--",
          ...COMPATIBILITY_PATHS,
        ])
          .stdout.trim()
          .split("\n")
          .filter(Boolean);
  const classification = classifyGuardedTreeCompatibility(spec, {
    observedGuardedTreeDigest,
    measurementBindingStatus,
    changedPaths,
  });
  const reviewedChangedPaths = classification.reviewedCompatibility
    ? [...classification.reviewedCompatibility.changedPaths]
    : [];
  return {
    exitCode: classification.compatible ? 0 : 1,
    measuredRevision: spec.measuredRevision,
    revision,
    changedPaths,
    reviewedChangedPaths,
    changedPathsVerifiedAtRuntime: measurementBindingStatus === "verified",
    guardedPaths: COMPATIBILITY_PATHS,
    compatibilityBasis: classification.compatibilityBasis,
    reviewedCompatibility: classification.reviewedCompatibility ?? null,
    expectedGuardedTreeDigest: spec.guardedTreeDigest,
    observedGuardedTreeDigest,
    measuredGuardedTreeDigest,
    measuredRevisionAvailable,
    measurementBindingStatus,
  };
}

export async function collectorDefinitionDigest() {
  const definitions = [];
  for (const ref of [COLLECTOR_REF, TEST_REF, TRUST_POLICY_REF]) {
    const file = ref === COLLECTOR_REF ? COLLECTOR_PATH : path.join(ROOT, ref);
    definitions.push({ ref, digest: sha256(await readFile(file)) });
  }
  return canonicalDigest(definitions);
}

function normalizeTestReport(result) {
  try {
    const report = JSON.parse(result.stdout);
    const expected = TEST_REF;
    const testResults = (report.testResults ?? []).map((item) => ({
      name: String(item.name).replaceAll(ROOT, "<collector-authority>"),
      status: item.status,
      assertions: (item.assertionResults ?? []).map((assertion) => ({
        name: assertion.fullName,
        status: assertion.status,
      })),
    }));
    const expectedPresent = testResults.some((item) => item.name.endsWith(`/${expected}`));
    const passed =
      result.status === 0 &&
      expectedPresent &&
      testResults.length === 1 &&
      testResults.every(
        (item) =>
          item.status === "passed" &&
          item.assertions.every((assertion) => assertion.status === "passed"),
      );
    return {
      exitCode: passed ? 0 : 1,
      numTotalTests: report.numTotalTests,
      numPassedTests: report.numPassedTests,
      testResults,
    };
  } catch {
    return {
      exitCode: 1,
      stdout: result.stdout?.replaceAll(ROOT, "<collector-authority>"),
      stderr: result.stderr?.replaceAll(ROOT, "<collector-authority>"),
    };
  }
}

function executeBehaviorSuite(revision) {
  const result = spawnSync(
    path.join(ROOT, "node_modules", ".bin", "vitest"),
    ["run", path.join(ROOT, TEST_REF), "--reporter=json"],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, AF_Q3_TARGET_REVISION: revision },
    },
  );
  return normalizeTestReport(result);
}

function evidence({
  id,
  kind,
  role,
  source,
  revision,
  summary,
  command,
  exitCode,
  digest,
  runRef,
  target,
}) {
  return {
    id,
    kind,
    role,
    source,
    sourceRevision: revision,
    summary,
    freshness: "fresh",
    reproducible: true,
    command,
    commandExitCode: exitCode,
    artifactDigest: digest,
    collectorRunRef: runRef,
    target,
  };
}

export async function collectObservation({ policy, revision, runRef }) {
  const authority = policy.policySet?.collectorAuthority ?? {};
  assertLighthouseCollectorAuthority(authority);
  const definitionDigest = await collectorDefinitionDigest();
  assert(authority.adapterRef === COLLECTOR_REF, `policy adapterRef must equal ${COLLECTOR_REF}`);
  assert(
    authority.definitionDigest === definitionDigest,
    `collector definition digest mismatch: policy=${authority.definitionDigest} observed=${definitionDigest}`,
  );
  git(["cat-file", "-e", `${revision}^{commit}`]);

  const scenarios = [];
  const bindings = [];
  for (const spec of Q3_WORKLOAD_REPORTS) {
    const { report, digest, resolvedSpec } = readRevisionReport(revision, spec);
    const normalized = normalizeReportArtifact(report, resolvedSpec);
    const compatibility = reportCompatibility(resolvedSpec, revision);
    scenarios.push(normalized);
    bindings.push({ spec: resolvedSpec, digest, normalized, compatibility });
  }
  const policyScenarioRefs = new Set(policy.policies?.[0]?.scenarios?.map((item) => item.id));
  const collectorScenarioRefs = new Set(Q3_WORKLOAD_REPORTS.map((item) => item.scenarioRef));
  assert(
    policyScenarioRefs.size === collectorScenarioRefs.size &&
      [...policyScenarioRefs].every((ref) => collectorScenarioRefs.has(ref)),
    "policy and collector workload scenario inventories must match exactly",
  );

  const behavior = executeBehaviorSuite(revision);
  const behaviorDigest = canonicalDigest(behavior);
  const allCompatible = bindings.every((item) => item.compatibility.exitCode === 0);
  const inventoryDigest = canonicalDigest(
    bindings.map((item) => ({
      scenarioRef: item.spec.scenarioRef,
      reportDigest: item.digest,
      compatibility: item.compatibility,
      normalized: item.normalized,
    })),
  );
  const command = `node ${COLLECTOR_REF} --policy docs/architecture-fitness/pilots/issue-286-q3-workload.policy.json --revision ${revision} --run-ref ${runRef} --output docs/architecture-fitness/pilots/issue-286-q3-workload.observation.json`;
  const behaviorCommand = `AF_Q3_TARGET_REVISION=${revision} node_modules/.bin/vitest run ${TEST_REF} --reporter=json`;
  const scenarioRefs = scenarios.map((item) => item.scenarioRef);
  const evidenceItems = [
    evidence({
      id: "workload-coverage-static:q3",
      kind: "static",
      role: "workload-coverage-static",
      source: Q3_WORKLOAD_REPORTS.map((item) => item.reportRef).join(","),
      revision,
      summary:
        "The inventory contains the approved u20 burst, sustained 1/s, and controlled amplification scenarios with locked report digests.",
      command,
      exitCode: allCompatible ? 0 : 1,
      digest: inventoryDigest,
      runRef,
      target: {
        policyRef: POLICY_REF,
        capabilityRef: CAPABILITY_REF,
        scenarioRefs,
        factRefs: ["coverage:all-workload-scenarios"],
      },
    }),
    evidence({
      id: "workload-coverage-negative-guard:q3",
      kind: "test",
      role: "workload-coverage-negative-guard",
      source: TEST_REF,
      revision,
      summary:
        "The trusted base test rejects dirty, misattributed, inconsistent, and provider-counter-tampered reports.",
      command: behaviorCommand,
      exitCode: behavior.exitCode,
      digest: behaviorDigest,
      runRef,
      target: {
        policyRef: POLICY_REF,
        capabilityRef: CAPABILITY_REF,
        scenarioRefs,
        factRefs: ["coverage:workload-budget-negative-guard"],
      },
    }),
  ];
  for (const binding of bindings) {
    const suffix = binding.spec.scenarioRef.replace("scenario:q3-", "");
    const artifactDigest = canonicalDigest({
      reportDigest: binding.digest,
      compatibility: binding.compatibility,
      normalized: binding.normalized,
    });
    evidenceItems.push(
      evidence({
        id: `workload-scenario-static:${suffix}`,
        kind: "static",
        role: "workload-scenario-static",
        source: binding.spec.reportRef,
        revision,
        summary:
          "The locked report and relevant-source compatibility guard bind the declared arrival and profiles to this revision.",
        command,
        exitCode: binding.compatibility.exitCode,
        digest: artifactDigest,
        runRef,
        target: {
          policyRef: POLICY_REF,
          capabilityRef: CAPABILITY_REF,
          scenarioRefs: [binding.spec.scenarioRef],
          factRefs: [configurationFact(binding.normalized)],
        },
      }),
      evidence({
        id: `workload-measurement:${suffix}`,
        kind: "test",
        role: "workload-measurement",
        source: binding.spec.reportRef,
        revision,
        summary:
          "The locked report supplies internally consistent completion, readiness, error, shed, and p95 facts.",
        command,
        exitCode: binding.compatibility.exitCode,
        digest: artifactDigest,
        runRef,
        target: {
          policyRef: POLICY_REF,
          capabilityRef: CAPABILITY_REF,
          scenarioRefs: [binding.spec.scenarioRef],
          factRefs: ["measurement:workload-observed", measurementFact(binding.normalized)],
        },
      }),
    );
    if (binding.spec.providerEvidence) {
      evidenceItems.push(
        evidence({
          id: `workload-provider-measurement:${suffix}`,
          kind: "test",
          role: "workload-provider-measurement",
          source: `${binding.spec.reportRef}#/providerFixtureEvidence`,
          revision,
          summary:
            "The same locked report binds a fresh zero-baseline provider counter window to completed journeys.",
          command,
          exitCode: binding.compatibility.exitCode,
          digest: artifactDigest,
          runRef,
          target: {
            policyRef: POLICY_REF,
            capabilityRef: CAPABILITY_REF,
            scenarioRefs: [binding.spec.scenarioRef],
            factRefs: ["measurement:provider-observed", measurementFact(binding.normalized)],
          },
        }),
      );
    }
  }

  return {
    schemaVersion: "2",
    kind: "architecture-fitness-observation",
    serviceId: policy.service.id,
    policySetRef: policy.policySet.id,
    policySetVersion: policy.policySet.version,
    policyDigest: canonicalDigest(policy),
    revision,
    collector: {
      adapterRef: authority.adapterRef,
      id: authority.id,
      version: authority.version,
      scope: authority.scope,
      definitionDigest,
      attestorRef: authority.attestorRef,
      runRef,
      command,
      attestation: {
        algorithm: "hmac-sha256",
        keyRef: authority.attestationKeyRef,
        payloadDigest: ZERO_DIGEST,
        signature: ZERO_DIGEST,
      },
    },
    evidence: evidenceItems,
    observations: [
      {
        id: "observation:q3-search-workload-envelope",
        policyRef: POLICY_REF,
        capabilityRef: CAPABILITY_REF,
        completeness: allCompatible && behavior.exitCode === 0 ? "complete" : "partial",
        coverageEvidenceRefs: [
          "workload-coverage-static:q3",
          "workload-coverage-negative-guard:q3",
        ],
        scenarios: scenarios.map((scenario) => {
          const suffix = scenario.scenarioRef.replace("scenario:q3-", "");
          return {
            id: `observed-scenario:${suffix}`,
            ...scenario,
            evidenceRefs: [
              `workload-scenario-static:${suffix}`,
              `workload-measurement:${suffix}`,
              ...(scenario.provider ? [`workload-provider-measurement:${suffix}`] : []),
            ],
          };
        }),
      },
    ],
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!["--policy", "--revision", "--run-ref", "--output"].includes(value)) {
      throw new Error(`Unknown argument: ${value}`);
    }
    options[value.slice(2)] = argv[index + 1];
    index += 1;
  }
  for (const required of ["policy", "revision", "run-ref", "output"]) {
    if (!options[required]) throw new Error(`Missing --${required}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const policy = JSON.parse(await readFile(path.resolve(options.policy), "utf8"));
  const observation = await collectObservation({
    policy,
    revision: options.revision,
    runRef: options["run-ref"],
  });
  await writeFile(
    path.resolve(options.output),
    `${JSON.stringify(observation, null, 2)}\n`,
    "utf8",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
