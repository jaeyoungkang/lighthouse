import { existsSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { SEARCH_RESULTS_INITIAL_VISIBLE_COUNT } from "@/app/lib/constants";
import {
  researchRouteKindSchema,
  researchRoutePayloadSchema,
} from "@/app/domain/research-route-payload-schema";
import {
  viewSnapshotRouteKindSchema,
  buildViewSnapshotPromptContext,
} from "@/app/domain/view-snapshot";
import { buildViewSnapshot } from "@/app/lib/view-snapshot";
import { buildGapNetworkViewPayload } from "@/app/server/services/gap-network-builder";
import { buildKnowledgeMapTitle, KNOWLEDGE_MAP_LENS_IDS } from "@/app/lib/knowledge-map-lens";
import { createGapNetworkView, createSearchView, readRepoFile } from "./contract-fixtures";
import { deriveResearchPersistenceState } from "./migration-persistence-state";
import {
  CONTRACT_CHECK_CASES,
  isContractCheckSubcase,
  isContractCheckTarget,
  type ContractCheckTarget,
} from "../contract-check-registry";

function assertKnownSubcase(target: ContractCheckTarget, subcase: string): void {
  assert.ok(
    isContractCheckSubcase(target, subcase),
    `Unknown contract subcase for ${target}: ${subcase} (valid: all, ${CONTRACT_CHECK_CASES[target].join(", ")})`,
  );
}

function extractResearchRouteKinds(source: string): string[] {
  const unionMatch = source.match(/export type ResearchRouteKind =([\s\S]*?);/);
  assert.ok(unionMatch, "ResearchRouteKind union must exist");
  return [...unionMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function readOrderedMigrationSources(): string[] {
  const migrationDir = "supabase/migrations";
  return readdirSync(migrationDir)
    .filter((entry) => entry.endsWith(".sql"))
    .sort()
    .map((entry) => readRepoFile(`${migrationDir}/${entry}`));
}

function assertSearchFirstPersistenceBoundary(): void {
  const persistenceState = deriveResearchPersistenceState(readOrderedMigrationSources());
  assert.equal(persistenceState.documentsExists, false);
  assert.equal(persistenceState.gapReportsExists, true);
  assert.equal(persistenceState.gapReportsMetadataTypeConstrained, true);
}

function checkProductBoundary(): void {
  const subcase = process.argv[3] || "all";
  assertKnownSubcase("product-boundary", subcase);

  if (subcase === "all" || subcase === "document-model") {
    const researchRouteKinds = extractResearchRouteKinds(
      readRepoFile("app/domain/research-route-payload.ts"),
    );
    assert.deepEqual(researchRouteKinds, [
      "search",
      "gap_network",
      "citation_lineage",
      "graph_neighbors",
    ]);
    assert.deepEqual([...researchRouteKindSchema.options], researchRouteKinds);
    assertSearchFirstPersistenceBoundary();
    assert.deepEqual([...KNOWLEDGE_MAP_LENS_IDS], ["E2"]);
  }

  if (subcase === "all" || subcase === "route-kind-runtime-boundaries") {
    const researchRouteKinds = extractResearchRouteKinds(
      readRepoFile("app/domain/research-route-payload.ts"),
    ).sort();
    assert.deepEqual([...researchRouteKindSchema.options].sort(), researchRouteKinds);
    assert.deepEqual([...viewSnapshotRouteKindSchema.options].sort(), researchRouteKinds);

    const routeRuntimeSource = readRepoFile(
      "app/components/research/research-route-runtime.helpers.ts",
    );
    assert.ok(routeRuntimeSource.includes("buildRouteAiCommentGenerationCommand"));
    assert.ok(routeRuntimeSource.includes("buildViewSnapshot"));
    assert.ok(!routeRuntimeSource.includes("focusedDocumentContent"));
    assert.ok(!routeRuntimeSource.includes("switch (focusedDoc.type)"));
    assert.ok(!routeRuntimeSource.includes("switch (document.type)"));

    const viewSnapshotSource = readRepoFile("app/lib/view-snapshot.ts");
    const viewSnapshotDomainSource = readRepoFile("app/domain/view-snapshot.ts");
    assert.ok(viewSnapshotSource.includes("buildSearchViewSnapshot"));
    assert.ok(viewSnapshotSource.includes("buildGapNetworkViewSnapshot"));
    assert.ok(viewSnapshotSource.includes("buildCitationLineageViewSnapshot"));
    assert.ok(viewSnapshotSource.includes("buildGraphNeighborsViewSnapshot"));
    assert.ok(viewSnapshotDomainSource.includes("buildViewSnapshotPromptContext"));
  }

  if (subcase === "all" || subcase === "server-delegation-hubs") {
    const documentAccessSource = readRepoFile("app/server/domain-access/gap-report-access.ts");
    assert.ok(documentAccessSource.includes("requireOwnerPrincipalAuth"));
    assert.ok(documentAccessSource.includes("getGapReportUnchecked"));
    assert.ok(documentAccessSource.includes("getGapReportReactionPreferenceUnchecked"));
    assert.ok(documentAccessSource.includes("updateGapReportReactionPreferenceIfVersionUnchecked"));
    assert.ok(documentAccessSource.includes("applyGapReportReactionPreference"));
    assert.ok(!documentAccessSource.includes("getGapReportForOwnerUnchecked"));
    assert.ok(!documentAccessSource.includes("updateGapReportForOwnerIfVersionUnchecked"));
  }

  if (subcase === "all" || subcase === "agent-panel-input") {
    const panelSource = readRepoFile("app/components/research/AgentPanel.tsx");
    assert.ok(panelSource.includes('data-testid="agent-panel-reaction-card"'));
    assert.ok(panelSource.includes("state.reactionCardHistory"));
    assert.ok(panelSource.includes('data-layout="inline"'));
    assert.ok(panelSource.includes("trackAiCommentCardViewedOnce"));
  }

  if (subcase === "all" || subcase === "no-autonomous-search-rules") {
    const runtimeSource = readRepoFile("app/components/research/ResearchRouteRuntime.tsx");
    const routeSource = readRepoFile("app/api/route-ai-comments/generate/[id]/route.ts");
    assert.ok(runtimeSource.includes("useRouteAiCommentGenerationRuntime"));
    assert.ok(routeSource.includes("generateRouteAiComment"));
    assert.ok(!runtimeSource.includes("useChat"));
    assert.ok(!runtimeSource.includes("DefaultChatTransport"));
  }

  if (subcase === "all" || subcase === "route-view-ai-comment-surface") {
    const runtimeSource = readRepoFile("app/components/research/ResearchRouteRuntime.tsx");
    const generationClientSource = readRepoFile(
      "app/components/research/route-ai-comment-generation-client.ts",
    );
    const actionStoreSource = readRepoFile("app/stores/reaction-action-store.ts");
    const apiRoutesSource = readRepoFile("app/lib/api-routes.ts");
    const routeSource = readRepoFile("app/api/route-ai-comments/generate/[id]/route.ts");
    assert.ok(runtimeSource.includes("useRouteAiCommentGenerationRuntime"));
    assert.ok(generationClientSource.includes("routeAiCommentGenerateRoute"));
    assert.ok(routeSource.includes("generateRouteAiComment"));
    assert.ok(!runtimeSource.includes("sendUserMessage"));
    assert.ok(!runtimeSource.includes("useChat"));
    assert.ok(!actionStoreSource.includes("sendUserMessage"));
    assert.ok(!apiRoutesSource.includes("REACTION"));
    assert.equal(existsSync("app/api/reaction/route.ts"), false);
  }
}

function checkRuntimeContract(): void {
  const subcase = process.argv[3] || "all";
  assertKnownSubcase("runtime-contract", subcase);

  if (
    subcase === "all" ||
    subcase === "route-ai-comment-generation-boundary" ||
    subcase === "route-view-ai-comment-generation-boundary"
  ) {
    const documentReactionSource = readRepoFile("app/server/agent/route-ai-comment-generation.ts");
    const documentReactionClientSource = readRepoFile(
      "app/components/research/route-ai-comment-generation-client.ts",
    );
    const generationGatewaySource = readRepoFile("app/server/ai-generation/gateway.ts");
    assert.ok(documentReactionSource.includes("executeStructuredGeneration"));
    assert.ok(documentReactionSource.includes("GEMINI_LITE_MODEL"));
    assert.ok(documentReactionSource.includes("ROUTE_AI_COMMENT_MAX_OUTPUT_TOKENS = 768"));
    assert.ok(documentReactionSource.includes("ROUTE_AI_COMMENT_TIMEOUT_MS = 10_000"));
    assert.ok(
      documentReactionClientSource.includes(
        "RESEARCH_ROUTE_REACTION_GENERATION_REQUEST_TIMEOUT_MS = 15_000",
      ),
    );
    assert.ok(!documentReactionSource.includes("responseMimeType"));
    assert.ok(generationGatewaySource.includes('responseMimeType: "application/json"'));
    assert.ok(generationGatewaySource.includes("httpOptions"));
    assert.ok(generationGatewaySource.includes("retryOptions: { attempts: 1 }"));
    assert.ok(generationGatewaySource.includes('"TimeoutError"'));
    assert.ok(!documentReactionSource.includes("streamRespondGeneration"));
    assert.ok(!documentReactionSource.includes("createMainTools"));
    assert.ok(!documentReactionSource.includes("ResponseTraceContext"));
    assert.ok(!documentReactionSource.includes("toolChoice"));
    assert.ok(!documentReactionSource.includes("stopWhen"));
  }
}

function checkSearchFirstUrlModelContract(): void {
  const subcase = process.argv[3] || "all";
  assertKnownSubcase("search-first-url-model", subcase);

  if (subcase === "all" || subcase === "no-store-url-sync") {
    assert.equal(existsSync("app/components/research/document-url-sync.tsx"), false);

    const runtimeSource = readRepoFile("app/components/research/ResearchRouteRuntime.tsx");
    assert.ok(!runtimeSource.includes("documentUrlSync"));
    assert.ok(!runtimeSource.includes("useRouter("));
    assert.ok(!runtimeSource.includes("router.push"));
    assert.ok(!runtimeSource.includes("router.replace"));

    const routePages = [
      readRepoFile("app/(research)/search-route-page.tsx"),
      readRepoFile("app/(research)/relationship-route-page.tsx"),
      readRepoFile("app/(research)/research-route-pages.tsx"),
    ].join("\n");
    assert.ok(!routePages.includes("documentUrlSync"));

    const storeSource = readRepoFile("app/stores/research-route-store.ts");
    assert.ok(storeSource.includes("currentView: ResearchRoutePayload | null"));
    assert.ok(!storeSource.includes("documents: ResearchRoutePayload[]"));
    assert.ok(!storeSource.includes("tabs:"));
    assert.ok(!storeSource.includes("activeTab"));
    assert.ok(!storeSource.includes("currentOwnerPrincipalId"));
  }
}

function checkDocumentsContract(): void {
  const subcase = process.argv[3] || "all";
  assertKnownSubcase("documents", subcase);

  if (
    subcase === "all" ||
    subcase === "search-focused-context" ||
    subcase === "search-view-snapshot"
  ) {
    const searchSnapshot = buildViewSnapshot(createSearchView());
    assert.ok(searchSnapshot, "search view snapshot must be created");
    const searchContent = buildViewSnapshotPromptContext(searchSnapshot);
    assert.ok(searchContent.includes("10. Paper 10"));
    assert.ok(searchContent.includes("paper-10 | Paper 10"));
    assert.ok(!searchContent.includes("12. Paper 12"));
  }

  if (subcase === "all" || subcase === "gap-context" || subcase === "gap-view-snapshot") {
    const gapSnapshot = buildViewSnapshot(createGapNetworkView());
    assert.ok(gapSnapshot, "gap view snapshot must be created");
    const gapContent = buildViewSnapshotPromptContext(gapSnapshot);
    assert.ok(gapContent.includes("query: agent memory"));
    assert.ok(gapContent.includes("Agents-Memory Gap"));
    assert.ok(gapContent.includes("Memory-guided agent benchmark"));
  }

  if (subcase === "all" || subcase === "view-snapshot-context") {
    const searchSnapshot = buildViewSnapshot(createSearchView());
    const gapSnapshot = buildViewSnapshot(createGapNetworkView());
    assert.ok(searchSnapshot, "search view snapshot must be created");
    assert.ok(gapSnapshot, "gap view snapshot must be created");
    assert.ok(buildViewSnapshotPromptContext(searchSnapshot).includes("snapshot_type: search"));
    assert.ok(buildViewSnapshotPromptContext(gapSnapshot).includes("snapshot_type: gap_network"));
  }
}

function checkSearchResultWindowContract(): void {
  const subcase = process.argv[3] || "all";
  assertKnownSubcase("search-result-window", subcase);

  if (subcase === "all" || subcase === "visible-window") {
    assert.equal(SEARCH_RESULTS_INITIAL_VISIBLE_COUNT, 10);

    const constantsSource = readRepoFile("app/lib/constants.ts");
    const markerIndex = constantsSource.indexOf(
      "@check-removes-fails: acceptance-check:search-results-fast-window-initial-dom-window",
    );
    const declarationIndex = constantsSource.indexOf(
      "export const SEARCH_RESULTS_INITIAL_VISIBLE_COUNT",
    );
    assert.ok(markerIndex >= 0, "visible window check-removes-fails marker must exist");
    assert.ok(declarationIndex > markerIndex, "visible window marker must guard the constant");

    const controllerSource = readRepoFile(
      "app/components/research-route-renderers/use-search-view-controller.shared.ts",
    );
    assert.ok(controllerSource.includes("SEARCH_RESULTS_INITIAL_VISIBLE_COUNT"));
    assert.ok(controllerSource.includes("setSearchVisibleCount"));
  }

  if (subcase === "all" || subcase === "no-llm-critical-path") {
    const normalizationSource = readRepoFile(
      "app/server/services/query-clause-normalization-service.ts",
    );
    assert.ok(normalizationSource.includes("createDefaultSearchQueryClauses"));
    assert.ok(!normalizationSource.includes("executeJudgment"));
    assert.ok(!normalizationSource.includes("generateObject"));
    assert.ok(!normalizationSource.includes("streamText"));

    const searchServiceSource = readRepoFile("app/server/services/search-service.ts");
    assert.ok(searchServiceSource.includes("normalizeSearchQueryClauses"));
    assert.ok(!searchServiceSource.includes("resolveSearchSpellingCorrection"));
    assert.ok(!searchServiceSource.includes("search-spelling-correction-service"));
  }
}

async function checkGapNetworkE2Contract(): Promise<void> {
  const subcase = process.argv[3] || "all";
  assertKnownSubcase("gap-network-e2", subcase);
  const papers = [
    {
      paperId: "p1",
      title: "Agent Planning for Discovery",
      abstract: "Agents plan experiments for scientific discovery.",
      year: 2024,
      citationCount: 50,
      url: "https://example.com/p1",
      authors: [{ name: "A" }],
      referenceIds: ["p2"],
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
    {
      paperId: "p2",
      title: "Hypothesis Agents",
      abstract: "Hypothesis generation for scientific discovery agents.",
      year: 2024,
      citationCount: 40,
      url: "https://example.com/p2",
      authors: [{ name: "B" }],
      referenceIds: ["p1"],
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
    {
      paperId: "p3",
      title: "Workflow Memory for Benchmarks",
      abstract: "Workflow memory supports benchmark automation.",
      year: 2025,
      citationCount: 30,
      url: "https://example.com/p3",
      authors: [{ name: "C" }],
      referenceIds: ["p4"],
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
    {
      paperId: "p4",
      title: "Benchmark Automation Memory",
      abstract: "Benchmark automation tracks workflow memory.",
      year: 2025,
      citationCount: 20,
      url: "https://example.com/p4",
      authors: [{ name: "D" }],
      referenceIds: ["p3"],
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
  ];

  const payload = await buildGapNetworkViewPayload(
    {
      viewerPrincipalId: "principal-1",
      sourceSnapshotId: "search-1",
      query: "agent workflow memory",
      createdBy: "user",
      papers,
    },
    {
      enrichNetwork: async () => {
        await Promise.resolve();
        return [];
      },
      clusterNetwork: () => ({
        clusterLabels: {
          p1: "Discovery Agents",
          p2: "Discovery Agents",
          p3: "Workflow Memory",
          p4: "Workflow Memory",
        },
        clusters: [
          { id: 0, label: "Discovery Agents", paperIds: ["p1", "p2"] },
          { id: 1, label: "Workflow Memory", paperIds: ["p3", "p4"] },
        ],
      }),
      interpretGapNetwork: async ({ report }) => {
        await Promise.resolve();
        return {
          hypotheses: report.gapPairs.slice(0, 1).map((gapPair) => ({
            id: "hyp-1",
            gapPairId: gapPair.id,
            title: "Bridge hypothesis",
            description: "Connect the two clusters.",
            sourceConcept: gapPair.leftConcepts[0] ?? gapPair.leftLabel,
            targetConcept: gapPair.rightConcepts[0] || gapPair.rightLabel,
            confidence: "medium" as const,
          })),
        };
      },
      interpretClusterNarrative: async ({ clusters }) => {
        await Promise.resolve();
        return new Map(
          clusters.map((cluster) => [
            cluster.id,
            `${cluster.label} papers form a distinct research cluster.`,
          ]),
        );
      },
      interpretGapNarrative: async ({ gapPairs }) => {
        await Promise.resolve();
        return new Map(
          gapPairs.map((gapPair) => [
            gapPair.id,
            {
              metaQualitative: `${gapPair.leftLabel} and ${gapPair.rightLabel} remain weakly bridged.`,
              proposals: [
                {
                  hypothesis: `Study how ${gapPair.leftLabel} methods can support ${gapPair.rightLabel} workflows.`,
                  grounding: `The gap is grounded in ${gapPair.displayLabel} and its bridge concepts.`,
                },
              ],
            },
          ]),
        );
      },
      interpretDomain: async () => {
        await Promise.resolve();
        return "Agent Workflow Memory";
      },
      interpretContentNarrative: async ({ clusters }) => {
        await Promise.resolve();
        return {
          overview: "Agent Workflow Memory connects discovery agents with workflow memory studies.",
          clusterParagraphs: clusters.map((cluster) => ({
            clusterId: cluster.id,
            paragraph: `${cluster.label} captures a distinct research direction in the fixture.`,
          })),
          gapInferenceParagraph:
            "The fixture compares expected cross-cluster links against observed links and uses bridge concepts to identify the representative gap.",
        };
      },
    },
  );
  assert.equal(payload.metadata.type, "gap_network");
  const report = payload.metadata.gapNetworkReport;

  if (subcase === "all" || subcase === "gap-report-payload-shape") {
    assert.equal(payload.type, "gap_network");
    assert.equal(payload.viewerPrincipalId, "principal-1");
    assert.ok(!("ownerPrincipalId" in payload));
    const wirePayload = {
      ...createGapNetworkView(),
      ownerPrincipalId: "principal-1",
    };
    assert.equal(researchRoutePayloadSchema.safeParse(wirePayload).success, false);
    assert.deepEqual(payload.refs, ["search-1"]);
    assert.equal(
      payload.title,
      buildKnowledgeMapTitle("E2", "agent workflow memory", {
        domainLabel: "Agent Workflow Memory",
      }),
    );
    assert.equal(payload.metadata.version, 1);
  }

  if (subcase === "all" || subcase === "report-shape") {
    assert.ok(Array.isArray(report.clusters));
    assert.ok(Array.isArray(report.gapPairs));
    assert.ok(Array.isArray(report.insight.hypotheses));
    assert.equal(report.metrics.clusterCount, 2);
    assert.equal(report.metrics.gapPairCount, 1);
  }

  if (subcase === "all" || subcase === "hypothesis-linkage") {
    assert.equal(report.gapPairs[0]?.displayLabel, "Discovery Agents-Workflow Memory Gap");
    assert.equal(report.insight.hypotheses[0]?.gapPairId, report.gapPairs[0]?.id);
    assert.ok(payload.content.includes("- 대표 gap: Discovery Agents-Workflow Memory Gap"));
  }

  if (subcase === "all" || subcase === "reaction-preparation") {
    assert.ok(payload.metadata.reactionPreparation);
    const reactionPreparation = payload.metadata.reactionPreparation;
    assert.equal(reactionPreparation.overviewReaction.id, "gap-network-overview");
    assert.equal(reactionPreparation.clusterReactions.length, 2);
    assert.equal(reactionPreparation.gapReactions[0]?.gapPairId, report.gapPairs[0]?.id);
  }
}

async function main(): Promise<void> {
  const target = process.argv[2] || "";

  if (!isContractCheckTarget(target)) {
    throw new Error(`Unknown contract target: ${target || "(missing)"}`);
  }

  switch (target) {
    case "product-boundary":
      checkProductBoundary();
      break;
    case "runtime-contract":
      checkRuntimeContract();
      break;
    case "search-first-url-model":
      checkSearchFirstUrlModelContract();
      break;
    case "documents":
      checkDocumentsContract();
      break;
    case "search-result-window":
      checkSearchResultWindowContract();
      break;
    case "gap-network-e2":
      await checkGapNetworkE2Contract();
      break;
  }
}

void main();
