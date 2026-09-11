import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  GENERATED_EVENT_COVERAGE_PATH,
  buildGeneratedCoverage,
  buildImpactReport,
  runEventImpactCli,
  shouldRunEventImpactCli,
  syncEventContract,
} from "../mc-event-impact";
import { loadEventContract } from "@/app/server/services/analytics/event-contract";
import { loadStoryChain } from "@/app/server/services/story-chain/loader";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const contract = loadEventContract(repoRoot);
const chain = loadStoryChain(repoRoot);
const generatedCoverage = buildGeneratedCoverage(
  chain.promises
    .map((promise) => ({
      promiseRef: promise.id,
      title: promise.title,
      analyticsExempt: promise.analyticsExempt,
      eventNames: contract.events
        .filter(
          (event) =>
            event.storyRefs.promiseRef === promise.id ||
            (event.storyRefs.relatedPromiseRefs ?? []).includes(promise.id),
        )
        .map((event) =>
          Object.keys(event.sinks).length === 0 ? `${event.name} (draft)` : event.name,
        )
        .sort(),
    }))
    .sort((a, b) => a.promiseRef.localeCompare(b.promiseRef)),
);

function createDeps(
  changedFiles: string[],
  generatedSource = generatedCoverage,
  eventContract = contract,
) {
  const writes: Record<string, string> = {};
  const stdoutWrites: string[] = [];
  const stderrWrites: string[] = [];
  return {
    writes,
    stdoutWrites,
    stderrWrites,
    deps: {
      repoRoot,
      stdout: {
        write: (chunk: string) => {
          stdoutWrites.push(chunk);
          return true;
        },
      },
      stderr: {
        write: (chunk: string) => {
          stderrWrites.push(chunk);
          return true;
        },
      },
      loadEventContract: () => eventContract,
      loadStoryChain: () => chain,
      readFile: (file: string) => {
        if (file.endsWith(GENERATED_EVENT_COVERAGE_PATH)) return generatedSource;
        if (file.endsWith("changed-surface.tsx")) {
          return "// @promise promise:inline-analysis-auto-run\nexport const changed = true;\n";
        }
        return "";
      },
      writeFile: (file: string, source: string) => {
        writes[file] = source;
      },
      exists: (file: string) =>
        file.endsWith(GENERATED_EVENT_COVERAGE_PATH) || file.endsWith("changed-surface.tsx"),
      gitChangedFiles: () => changedFiles,
    },
  };
}

describe("mc:event-impact", () => {
  it("detects the CLI wrapper", () => {
    expect(
      shouldRunEventImpactCli(["node", "/repo/scripts/mission-control/mc-event-impact.ts"]),
    ).toBe(true);
  });

  it("reports changed promise surfaces and fails uncovered impact unless events.yaml changed", () => {
    const contractWithoutInlineAnalysis = {
      events: contract.events.filter(
        (event) => event.storyRefs.promiseRef !== "promise:inline-analysis-auto-run",
      ),
    };
    const report = buildImpactReport({
      repoRoot,
      changedFiles: ["app/components/research-route-renderers/changed-surface.tsx"],
      contract: contractWithoutInlineAnalysis,
      chain,
      readFile: (file) =>
        file.endsWith("changed-surface.tsx")
          ? "// @promise promise:inline-analysis-auto-run\n"
          : generatedCoverage,
      exists: () => true,
    });

    expect(report.impactedPromiseRefs).toContain("promise:inline-analysis-auto-run");
    expect(report.uncoveredPromiseRefs).toContain("promise:inline-analysis-auto-run");
  });

  it("uses related Promise refs for coverage without changing the primary event owner", () => {
    const relatedPromiseRef = "promise:research-route-cap-feedback";
    const searchSubmitted = contract.events.find((event) => event.name === "search_submitted");
    expect(searchSubmitted?.storyRefs.promiseRef).toBe("promise:search-query-route-transition");
    expect(searchSubmitted?.storyRefs.relatedPromiseRefs).toContain(relatedPromiseRef);

    const report = buildImpactReport({
      repoRoot,
      changedFiles: ["docs/contracts/story-chain/promises/research-route-cap-feedback.md"],
      contract,
      chain,
      readFile: () => generatedCoverage,
      exists: () => true,
    });

    const row = report.coverageRows.find((candidate) => candidate.promiseRef === relatedPromiseRef);
    expect(row?.eventNames).toContain("search_submitted");
    expect(report.uncoveredPromiseRefs).not.toContain(relatedPromiseRef);
  });

  it("reports every Promise owned by a changed Moment using its canonical id", () => {
    const momentSource = `---
id: moment:search-results-first-review
slug: search-results-first-review
title: Search results first review
experience: experience:research-and-discovery
---

# Search results first review
`;
    const report = buildImpactReport({
      repoRoot,
      changedFiles: ["docs/contracts/story-chain/moments/renamed-file.md"],
      contract,
      chain,
      readFile: () => momentSource,
      exists: () => true,
    });
    const expectedPromiseRefs = chain.promises
      .filter((promise) => promise.moment === "moment:search-results-first-review")
      .map((promise) => promise.id);

    expect(expectedPromiseRefs.length).toBeGreaterThan(0);
    expect(report.impactedPromiseRefs).toEqual(expect.arrayContaining(expectedPromiseRefs));
  });

  it("does not require analytics coverage for a retired Promise", () => {
    const report = buildImpactReport({
      repoRoot,
      changedFiles: ["docs/contracts/story-chain/promises/retired-in-this-change.md"],
      contract,
      chain,
      readFile: () => generatedCoverage,
      exists: () => false,
    });

    expect(report.impactedPromiseRefs).toContain("promise:retired-in-this-change");
    expect(report.uncoveredPromiseRefs).not.toContain("promise:retired-in-this-change");
  });

  it("fails when generated coverage is stale", async () => {
    const { deps, stderrWrites } = createDeps([], "stale");

    const result = await runEventImpactCli(["node", "mc-event-impact.ts"], deps);

    expect(result).toBe(1);
    expect(stderrWrites.join("")).toContain("event-coverage.generated.md is stale");
  });

  it("updates generated coverage on request", async () => {
    const { deps, writes } = createDeps([], "stale");

    const result = await runEventImpactCli(["node", "mc-event-impact.ts", "--update"], deps);

    expect(result).toBe(0);
    expect(writes[path.join(repoRoot, GENERATED_EVENT_COVERAGE_PATH)]).toContain(
      "Analytics Event Coverage",
    );
  });

  it("fails when --base or --head is missing its value", async () => {
    const missingBase = createDeps([]);
    const missingHead = createDeps([]);

    const baseResult = await runEventImpactCli(
      ["node", "mc-event-impact.ts", "--base", "--head", "HEAD"],
      missingBase.deps,
    );
    const headResult = await runEventImpactCli(
      ["node", "mc-event-impact.ts", "--head"],
      missingHead.deps,
    );

    expect(baseResult).toBe(1);
    expect(missingBase.stderrWrites.join("")).toContain("--base requires a value");
    expect(headResult).toBe(1);
    expect(missingHead.stderrWrites.join("")).toContain("--head requires a value");
  });

  it("passes uncovered impacts when events.yaml is part of the change", async () => {
    const { deps, stderrWrites } = createDeps([
      "app/components/research-route-renderers/changed-surface.tsx",
      "docs/analytics/events.yaml",
    ]);

    const result = await runEventImpactCli(["node", "mc-event-impact.ts"], deps);

    expect(result).toBe(0);
    expect(stderrWrites.join("")).toBe("");
  });

  it("labels analyticsExempt promises in the detailed impact summary", async () => {
    const { deps, stdoutWrites } = createDeps([
      "docs/contracts/story-chain/promises/hardening-tier-policy.md",
    ]);

    const result = await runEventImpactCli(["node", "mc-event-impact.ts"], deps);

    expect(result).toBe(0);
    expect(stdoutWrites.join("")).toContain("promise:hardening-tier-policy: analytics-exempt:");
    expect(stdoutWrites.join("")).not.toContain(
      "promise:hardening-tier-policy: no canonical event",
    );
  });

  it("syncs missing, stale, and moved promise event contract entries", () => {
    const inlinePromise = chain.promises.find(
      (promise) => promise.id === "promise:inline-analysis-auto-run",
    );
    const searchPromise = chain.promises.find(
      (promise) => promise.id === "promise:search-query-route-transition",
    );
    const baseEvent = contract.events[0];
    expect(inlinePromise).toBeDefined();
    expect(searchPromise).toBeDefined();

    const result = syncEventContract({
      contract: {
        events: [
          {
            ...baseEvent,
            storyRefs: {
              ...baseEvent.storyRefs,
              experienceRef: "experience:stale-example",
              momentRef: "moment:open-pdf-and-extract-structure",
              acceptanceCheckRefs: ["acceptance-check:inline-analysis-auto-run-exposed-card-start"],
            },
          },
          {
            ...baseEvent,
            name: "product.retired.clicked",
            storyRefs: {
              ...baseEvent.storyRefs,
              promiseRef: "promise:retired-promise",
            },
          },
        ],
      },
      chain,
      impactedPromiseRefs: ["promise:inline-analysis-auto-run"],
    });

    expect(result.added).toEqual(["product.inline_analysis.queued"]);
    expect(result.removed).toEqual(["product.retired.clicked"]);
    expect(result.updated).toEqual(["search_submitted"]);
    const updatedSearch = result.contract.events.find((event) => event.name === "search_submitted");
    const searchMoment = chain.moments.find((moment) => moment.id === searchPromise?.moment);
    expect(updatedSearch?.storyRefs.experienceRef).toBe(searchMoment?.experience);
    expect(updatedSearch?.storyRefs.momentRef).toBe(searchPromise?.moment);
    expect(updatedSearch?.storyRefs.acceptanceCheckRefs).toEqual([]);
  });

  it("does not sync an event when the Promise Moment points to an undeclared Experience", () => {
    const searchPromise = chain.promises.find(
      (promise) => promise.id === "promise:search-results-fast-window",
    );
    expect(searchPromise).toBeDefined();
    if (!searchPromise) throw new Error("search Promise fixture missing");
    const invalidChain = {
      ...chain,
      moments: chain.moments.map((moment) =>
        moment.id === searchPromise.moment
          ? { ...moment, experience: "experience:missing" as const }
          : moment,
      ),
    };

    expect(() =>
      syncEventContract({
        contract,
        chain: invalidChain,
        impactedPromiseRefs: [searchPromise.id],
      }),
    ).toThrow(/derived Experience experience:missing .* is not declared/);
  });

  it("writes synced events.yaml and generated coverage", async () => {
    const contractWithoutInlineAnalysis = {
      events: contract.events.filter(
        (event) => event.storyRefs.promiseRef !== "promise:inline-analysis-auto-run",
      ),
    };
    const { deps, writes } = createDeps(
      ["app/components/research-route-renderers/changed-surface.tsx"],
      "stale",
      contractWithoutInlineAnalysis,
    );

    const result = await runEventImpactCli(["node", "mc-event-impact.ts", "--sync"], deps);

    expect(result).toBe(0);
    expect(writes[path.join(repoRoot, "docs/analytics/events.yaml")]).toContain(
      "product.inline_analysis.queued",
    );
    expect(writes[path.join(repoRoot, GENERATED_EVENT_COVERAGE_PATH)]).toContain(
      "product.inline_analysis.queued",
    );
  });
});
