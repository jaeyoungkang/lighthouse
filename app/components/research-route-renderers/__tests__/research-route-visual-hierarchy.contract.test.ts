// @promise promise:research-route-cap-feedback
// @promise promise:search-results-fast-window
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:gap-report-prepared-reaction
// @aspect aspect:research-route-visual-hierarchy

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}
describe("research route visual hierarchy contract", () => {
  it("defines one semantic type and tone vocabulary in the global design-system owner", () => {
    const css = readRepoFile("app/globals.css");
    const typeRoles = [
      "route-heading",
      "section-heading",
      "paper-title",
      "reading-body",
      "control-label",
      "compact-control",
      "metadata",
      "micro",
    ];
    const tones = ["primary", "secondary", "tertiary", "control"];

    for (const role of typeRoles) {
      expect(css).toContain(`.lh-type-${role}`);
    }
    for (const tone of tones) {
      expect(css).toContain(`.lh-tone-${tone}`);
    }
  });
  it("sets a materially larger research reading scale than the legacy compact aliases", () => {
    const css = readRepoFile("app/globals.css");
    const expectedTokens = [
      ["route-heading-size", "24px"],
      ["route-heading-line", "32px"],
      ["section-heading-size", "20px"],
      ["section-heading-line", "28px"],
      ["paper-title-size", "16px"],
      ["paper-title-line", "24px"],
      ["reading-body-size", "16px"],
      ["reading-body-line", "28px"],
      ["control-label-size", "15px"],
      ["control-label-line", "22px"],
      ["compact-control-size", "13px"],
      ["compact-control-line", "20px"],
      ["metadata-size", "13px"],
      ["metadata-line", "20px"],
      ["micro-size", "12px"],
      ["micro-line", "18px"],
    ];
    for (const [token, value] of expectedTokens) {
      expect(css).toContain(`--lh-type-${token}: ${value};`);
    }
    expect(css).toMatch(
      /\.lh-chip\.lh-type-control-label\s*\{[^}]*font-size:\s*var\(--lh-type-control-label-size\)/,
    );
    expect(css).toMatch(
      /\.lh-chip\.lh-type-compact-control\s*\{[^}]*font-size:\s*var\(--lh-type-compact-control-size\)/,
    );
    expect(css).toMatch(
      /\.lh-chip\.lh-card-action,[\s\S]*?\{[^}]*border-bottom-width:\s*1px[^}]*letter-spacing:\s*0[^}]*text-transform:\s*none/,
    );
    expect(css).toMatch(/\.lh-kicker\s*\{[^}]*font-size:\s*var\(--lh-type-micro-size\)/);
    expect(css).toMatch(/\.lh-chip\s*\{[^}]*font-size:\s*var\(--lh-type-micro-size\)/);
    expect(css).toContain("@media (min-width: 640px) and (max-width: 1023px)");
    const searchBar = readRepoFile("app/components/research/ResearchRouteSearchBar.tsx");
    expect(searchBar).toContain("lh-research-route-search-rail");
  });
  it.each([
    [
      "app/components/research/ResearchRouteSearchBar.tsx",
      ["lh-type-reading-body", "lh-type-control-label", "lh-type-compact-control"],
    ],
    ["app/components/research-route-renderers/search-view-states.tsx", ["lh-type-reading-body"]],
    ["app/components/research-route-renderers/search-results-header.tsx", ["lh-type-metadata"]],
    [
      "app/components/research-route-renderers/search-results-facets.tsx",
      ["lh-type-control-label"],
    ],
    [
      "app/components/research-route-renderers/SearchYearRangeFilter.tsx",
      ["lh-type-control-label"],
    ],
    [
      "app/components/research-route-renderers/search-result-item.tsx",
      ["lh-type-paper-title", "lh-type-compact-control"],
    ],
    [
      "app/components/research-route-renderers/search-result-item-actions.tsx",
      ["lh-type-compact-control"],
    ],
    [
      "app/components/research-route-renderers/search-result-author-row.tsx",
      ["lh-type-metadata", "lh-type-compact-control"],
    ],
    [
      "app/components/research-route-renderers/search-result-inline-analysis.tsx",
      ["lh-type-reading-body", "lh-type-compact-control", "lh-type-micro"],
    ],
    [
      "app/components/research-route-renderers/search-result-generated-content.tsx",
      ["lh-type-metadata", "lh-type-compact-control"],
    ],
    ["app/components/research/AgentPanel.tsx", ["lh-type-reading-body"]],
    ["app/components/research/agent-panel-frame.tsx", ["lh-type-metadata"]],
    ["app/components/research/SearchFollowupActivationStatus.tsx", ["lh-type-metadata"]],
    ["app/components/research/ResearchRouteLayout.tsx", ["lh-type-metadata"]],
    ["app/components/research/inline-ai-comment-treatment.ts", ["lh-type-reading-body"]],
    ["app/components/research/search-results-overview-panel.tsx", ["lh-type-micro"]],
    ["app/components/research-route-renderers/search-view-content.tsx", ["lh-type-control-label"]],
    [
      "app/components/research-route-renderers/followup-pending-view.tsx",
      ["lh-type-route-heading"],
    ],
    ["app/components/research-route-renderers/graph-neighbors-view.tsx", ["lh-type-reading-body"]],
    [
      "app/components/research-route-renderers/PendingKnowledgeMapViewState.tsx",
      ["lh-type-reading-body"],
    ],
    [
      "app/components/research-route-renderers/citation-lineage-view.tsx",
      ["lh-type-section-heading"],
    ],
    [
      "app/components/research-route-renderers/graph-neighbor-section.tsx",
      ["lh-type-section-heading", "lh-type-micro"],
    ],
    ["app/components/research-route-renderers/GapNetworkView.tsx", ["lh-type-route-heading"]],
    [
      "app/components/research-route-renderers/knowledge-map/GapNetworkContentReport.tsx",
      ["lh-type-section-heading", "lh-type-reading-body"],
    ],
    [
      "app/components/research-route-renderers/knowledge-map/GapNetworkReport.tsx",
      ["lh-type-reading-body"],
    ],
    [
      "app/components/research-route-renderers/knowledge-map/GapNetworkFocusedSelectionSummary.tsx",
      ["lh-type-control-label"],
    ],
  ])("assigns semantic roles on %s", (relativePath, roles) => {
    const source = readRepoFile(relativePath);
    expect(source).toContain("aspect:research-route-visual-hierarchy");
    for (const role of roles) {
      expect(source).toContain(role);
    }
  });
  it("does not mix undefined legacy aliases into the governed role assignments", () => {
    const governedFiles = [
      "app/components/research/ResearchRouteSearchBar.tsx",
      "app/components/research/AgentPanel.tsx",
      "app/components/research/agent-panel-frame.tsx",
      "app/components/research/SearchFollowupActivationStatus.tsx",
      "app/components/research/ResearchRouteLayout.tsx",
      "app/components/research/search-results-overview-panel.tsx",
      "app/components/research-route-renderers/search-view-states.tsx",
      "app/components/research-route-renderers/search-results-header.tsx",
      "app/components/research-route-renderers/search-results-facets.tsx",
      "app/components/research-route-renderers/SearchYearRangeFilter.tsx",
      "app/components/research-route-renderers/search-result-item.tsx",
      "app/components/research-route-renderers/search-result-item-actions.tsx",
      "app/components/research-route-renderers/search-result-author-row.tsx",
      "app/components/research-route-renderers/search-result-inline-analysis.tsx",
      "app/components/research-route-renderers/search-result-generated-content.tsx",
      "app/components/research-route-renderers/citation-lineage-view.tsx",
      "app/components/research-route-renderers/graph-neighbor-section.tsx",
      "app/components/research-route-renderers/GapNetworkView.tsx",
      "app/components/research-route-renderers/knowledge-map/GapNetworkContentReport.tsx",
    ];
    const source = governedFiles.map((relativePath) => readRepoFile(relativePath)).join("\n");

    expect(source).not.toMatch(
      /\b(?:text-lh-xl|text-text-primary|text-text-secondary|bg-surface-muted|bg-surface-raised|text-destructive)\b/,
    );
  });
  it("removes compact legacy typography and undefined surfaces from governed descendants", () => {
    const paths = [
      "app/components/research/inline-ai-comment-treatment.ts",
      "app/components/research-route-renderers/search-view-content.tsx",
      "app/components/research-route-renderers/followup-pending-view.tsx",
      "app/components/research-route-renderers/graph-neighbors-view.tsx",
      "app/components/research-route-renderers/PendingKnowledgeMapViewState.tsx",
      "app/components/research-route-renderers/search-result-inline-analysis.tsx",
      "app/components/research-route-renderers/search-result-generated-content.tsx",
      "app/components/research-route-renderers/knowledge-map/GapNetworkReport.tsx",
      "app/components/research-route-renderers/knowledge-map/GapNetworkFocusedSelectionSummary.tsx",
    ];
    const source = paths.map((relativePath) => readRepoFile(relativePath)).join("\n");
    expect(source).not.toMatch(
      /\b(?:text-(?:xs|sm|base|lg|xl)|text-lh-(?:2xs|xs|sm|base)|leading-[456]|bg-surface-raised)\b/,
    );
  });
  it("keeps facet counts subordinate to their control labels", () => {
    const source = readRepoFile(
      "app/components/research-route-renderers/search-results-header.tsx",
    );
    expect(source).toContain(
      '<span className="lh-type-metadata lh-tone-tertiary">{hasPdfCount}</span>',
    );
    expect(source).toContain(
      '<span className="lh-type-metadata lh-tone-tertiary">{representativeCount}</span>',
    );
  });
});
