import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const RECALL_SCRIPT = path.join(PROJECT_ROOT, "scripts/project-knowledge/recall.ts");
const TSX_BIN = path.join(PROJECT_ROOT, "node_modules/.bin/tsx");

function referencedRepoPaths(store: string): Set<string> {
  const paths = new Set<string>();
  for (const match of store.matchAll(
    /^\s+(?:- |path: )([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)(?:#\S*)?\s*$/gm,
  )) {
    paths.add(match[1]);
  }
  return paths;
}

function recall(args: string[], cwd = PROJECT_ROOT): string {
  return execFileSync(TSX_BIN, [RECALL_SCRIPT, ...args], {
    cwd,
    encoding: "utf8",
  });
}

describe("Project Knowledge record-level recall", () => {
  const fixedQueries: Array<[string, string]> = [
    ["Research Route gap artifact 왜 이런 모습인가", "product.research-route-lifetime-model"],
    ["조건 URL 영속 gap artifact 긴장 기각 대안", "product.condition-owned-research-route"],
    [
      "비슷한 route-state 구조를 예전에 시도 무엇이 달라졌는가",
      "product.search-first-runtime-observation",
    ],
    ["Concept Shift Architecture Review 왜 존재하는가", "product-making.concept-shift-review"],
    ["rollout 관행이 막은 false pass", "product-making.evidence-governed-rollout"],
    ["source basis 바꾸면 provider 계약 가정 재검토", "product.source-basis"],
    ["현재 rollout에서 무엇을 해야 하는가", "product-making.evidence-governed-rollout"],
    ["gap report enrichment 실패 core 유지 이유", "product.gap-report-recoverable-artifact"],
    ["Evidence Ledger YAML structured execution 왜", "product-making.executable-contract-evidence"],
    [
      "구현을 frontend backend API 하나로 분류하지 않는 이유",
      "product-making.owner-routed-implementation-context",
    ],
  ];

  it.each(fixedQueries)("answers the bounded-pilot query: %s", (query, expectedId) => {
    const output = recall([query]);
    const firstResult = output.split("\n- ")[1] ?? "";
    const firstObject = firstResult.match(/object: ([^ |]+)/)?.[1];

    expect(firstObject).toBe(expectedId);
  });

  it("returns structured object identity, facets, status, and authority", () => {
    const output = recall(["provider", "omission"]);

    expect(output).toContain("object: product.provider-omission-limitation");
    expect(output).toContain("plane=product | kind=case | status=current");
    expect(output).toContain("authority:");
    expect(output).toContain("evidenced_by->product.provider-omission-limitation");
  });

  it("filters structured objects by plane, kind, and temporal status", () => {
    const output = recall([
      "--plane",
      "product-making",
      "--kind",
      "model",
      "--status",
      "superseded",
      "deployment",
    ]);

    expect(output).toContain("object: product-making.deployment-success-sufficiency");
    expect(output).not.toContain("object: product.false-ready-observation");
  });

  it("points current-action queries to authority instead of treating PK as instruction", () => {
    const output = recall(["현재", "rollout", "해야"]);

    expect(output).toContain("현재 행동 질의: Project Knowledge는 설명을 제공하며");
    expect(output).toContain("authority:");
  });

  it("marks unforwarded legacy records as lazy-migration candidates", () => {
    const fixtureRoot = mkdtempSync(path.join(tmpdir(), "lighthouse-pk-recall-"));
    const fixtureTitle = "FixtureOnlyUnforwardedRecallSentinelZeta";

    let output: string;
    try {
      cpSync(path.join(PROJECT_ROOT, "docs"), path.join(fixtureRoot, "docs"), {
        recursive: true,
      });
      // 공유 객체의 authority_refs와 grounding path는 docs/ 밖(예: scripts/**)을
      // 가리킬 수 있다. fixture root에서도 경로 검증이 통과하도록 참조된 파일을
      // 그대로 복사한다.
      for (const referenced of referencedRepoPaths(
        readFileSync(
          path.join(PROJECT_ROOT, "docs/project-knowledge/knowledge-objects.md"),
          "utf8",
        ),
      )) {
        if (referenced.startsWith("docs/") || !existsSync(path.join(PROJECT_ROOT, referenced))) {
          continue;
        }
        cpSync(path.join(PROJECT_ROOT, referenced), path.join(fixtureRoot, referenced));
      }
      appendFileSync(
        path.join(fixtureRoot, "docs/project-knowledge/shared-memory.md"),
        `\n# Narrative: ${fixtureTitle}\n\nThis marker exists only inside the isolated recall fixture.\n`,
      );
      output = recall([fixtureTitle], fixtureRoot);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }

    expect(output).toContain(`\n  ${fixtureTitle}\n`);
    expect(output).toContain("legacy migration candidate:");
  });
});
