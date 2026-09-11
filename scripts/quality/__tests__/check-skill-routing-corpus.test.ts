import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.join(process.cwd(), "scripts/quality/check-skill-routing-corpus.mjs");
const CORPUS = path.join(
  process.cwd(),
  "shared-skills/skill-governance-steward/references/skill-routing-corpus.json",
);
const temporaryRoots: string[] = [];

function evaluationId(index: number): string {
  return `case-${String(index + 1).padStart(2, "0")}`;
}

type RoutingCase = {
  id: string;
  expectedFirstRoute: string | null;
  requiredAdditionalRoutes: string[];
  tags: string[];
};

type RoutingCorpus = {
  schema: string;
  inputProvenanceHead: string;
  evaluationProvenanceHead: string;
  inputsDigest: string;
  evaluationSpecDigest: string;
  routingSourceDigest: string;
  emitOrder: string[];
  cases: RoutingCase[];
};

function loadCorpus(): RoutingCorpus {
  return JSON.parse(readFileSync(CORPUS, "utf8")) as RoutingCorpus;
}

function orderedCases(corpus: RoutingCorpus): RoutingCase[] {
  const byId = new Map(corpus.cases.map((routeCase) => [routeCase.id, routeCase]));
  return corpus.emitOrder.map((id) => {
    const routeCase = byId.get(id);
    if (!routeCase) throw new Error(`missing case ${id}`);
    return routeCase;
  });
}

function predictionEnvelope(
  corpus: RoutingCorpus,
  predictions: Array<{ id: string; firstRoute: string | null; additionalRoutes: string[] }>,
) {
  return {
    schema: "lighthouse.skill-routing-predictions.v3",
    inputsDigest: corpus.inputsDigest,
    evaluationSpecDigest: corpus.evaluationSpecDigest,
    routingSourceDigest: corpus.routingSourceDigest,
    predictions,
  };
}

function run(args: string[], input?: string) {
  return spawnSync("node", [SCRIPT, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    input,
  });
}

function runAt(root: string, command: string, args: string[]) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8" });
}

function makeRoutingRepository(): { root: string } {
  const root = mkdtempSync(path.join(tmpdir(), "lighthouse-routing-corpus-"));
  temporaryRoots.push(root);
  mkdirSync(path.join(root, "scripts/quality"), { recursive: true });
  mkdirSync(path.join(root, "docs"), { recursive: true });
  cpSync(SCRIPT, path.join(root, "scripts/quality/check-skill-routing-corpus.mjs"));
  cpSync(path.join(process.cwd(), "shared-skills"), path.join(root, "shared-skills"), {
    recursive: true,
  });
  cpSync(path.join(process.cwd(), "docs/agent-skills.md"), path.join(root, "docs/agent-skills.md"));
  return { root };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("skill routing evaluation corpus", () => {
  it("keeps a bounded corpus with the three required overlap pairs", () => {
    const result = run([]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("20 cases");
    expect(result.stdout).toContain("3 overlap pairs");
    expect(result.stdout).toContain("20 routable skills");
    expect(result.stdout).toContain(loadCorpus().inputsDigest.slice(0, 12));
  });

  it("emits unlabeled inputs rather than answer-bearing expected routes", () => {
    const result = run(["--emit-evaluation-prompt"]);
    expect(result.status, result.stderr).toBe(0);
    const emittedIds = [...result.stdout.matchAll(/"id": "(case-\d{2})"/g)].map(
      (match) => match[1],
    );
    expect(emittedIds).toHaveLength(20);
    expect(new Set(emittedIds).size).toBe(20);
    expect(result.stdout).not.toContain("about-korean-commitment");
    expect(result.stdout).not.toContain("expectedFirstRoute");
    expect(result.stdout).not.toContain("forbiddenRoutes");
    expect(result.stdout).toContain("lighthouse.skill-routing-predictions.v3");
    expect(result.stdout).toContain(loadCorpus().inputsDigest);
    expect(result.stdout).toContain(loadCorpus().evaluationSpecDigest);
    expect(result.stdout).toContain(loadCorpus().routingSourceDigest);
    expect(
      emittedIds.every((id) => !/(about|korean|mission|runtime|contract|skill)/.test(id)),
    ).toBe(true);
  });

  it("separates every overlap pair in the frozen emission order", () => {
    const corpus = loadCorpus();
    for (const overlap of [
      "overlap:about-korean",
      "overlap:mission-runtime",
      "overlap:contract-map-runtime",
    ]) {
      const positions = corpus.cases
        .filter((routeCase) => routeCase.tags.includes(overlap))
        .map((routeCase) => corpus.emitOrder.indexOf(routeCase.id));
      expect(Math.abs(positions[0] - positions[1])).toBeGreaterThan(1);
    }
  });

  it("scores exact expected routing at full recall and precision", () => {
    const corpus = loadCorpus();
    const predictions = orderedCases(corpus).map((routeCase, index) => ({
      id: evaluationId(index),
      firstRoute: routeCase.expectedFirstRoute,
      additionalRoutes: routeCase.requiredAdditionalRoutes,
    }));
    const result = run(["--score", "-"], JSON.stringify(predictionEnvelope(corpus, predictions)));
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema: "lighthouse.skill-routing-score.v3",
      corpusSchema: corpus.schema,
      inputsDigest: corpus.inputsDigest,
      evaluationSpecDigest: corpus.evaluationSpecDigest,
      routingSourceDigest: corpus.routingSourceDigest,
      passed: true,
      caseCount: 20,
      metrics: {
        firstRouteAccuracy: 1,
        requiredRouteRecall: 1,
        allowedRoutePrecision: 1,
        forbiddenSelections: 0,
        unknownRoutes: 0,
      },
      unknownRoutes: [],
    });
  });

  it("fails a high-frequency but indiscriminate route selection", () => {
    const corpus = loadCorpus();
    const predictions = orderedCases(corpus).map((_routeCase, index) => ({
      id: evaluationId(index),
      firstRoute: "mission-control",
      additionalRoutes: [],
    }));
    const result = run(["--score", "-"], JSON.stringify(predictionEnvelope(corpus, predictions)));
    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ passed: false });
  });

  it("hard-fails a skill selection for the explicit no-skill default case", () => {
    const corpus = loadCorpus();
    const predictions = orderedCases(corpus).map((routeCase, index) => ({
      id: evaluationId(index),
      firstRoute:
        routeCase.id === "plain-helper-default" ? "mission-control" : routeCase.expectedFirstRoute,
      additionalRoutes: routeCase.requiredAdditionalRoutes,
    }));
    const result = run(["--score", "-"], JSON.stringify(predictionEnvelope(corpus, predictions)));

    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      passed: false,
      metrics: { forbiddenSelections: 1 },
      forbidden: ["plain-helper-default:unexpected-route:mission-control"],
    });
  });

  it("scores an unknown predicted route as a hard failing miss instead of aborting", () => {
    const corpus = loadCorpus();
    const predictions = orderedCases(corpus).map((routeCase, index) => ({
      id: evaluationId(index),
      firstRoute: index === 0 ? "runtime-flow-steward" : routeCase.expectedFirstRoute,
      additionalRoutes: routeCase.requiredAdditionalRoutes,
    }));
    const result = run(["--score", "-"], JSON.stringify(predictionEnvelope(corpus, predictions)));
    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      metrics: { firstRouteAccuracy: 19 / 20 },
      unknownRoutes: ["about-korean-commitment:runtime-flow-steward"],
      passed: false,
    });
  });

  it("recognizes the externally owned Architecture Fitness skill as routable", () => {
    const corpus = loadCorpus();
    const predictions = orderedCases(corpus).map((routeCase, index) => ({
      id: evaluationId(index),
      firstRoute: index === 0 ? "architecture-fitness-review" : routeCase.expectedFirstRoute,
      additionalRoutes: routeCase.requiredAdditionalRoutes,
    }));
    const result = run(["--score", "-"], JSON.stringify(predictionEnvelope(corpus, predictions)));
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ unknownRoutes: [] });
  });

  it("rejects predictions bound to another frozen input digest", () => {
    const corpus = loadCorpus();
    const predictions = orderedCases(corpus).map((routeCase, index) => ({
      id: evaluationId(index),
      firstRoute: routeCase.expectedFirstRoute,
      additionalRoutes: routeCase.requiredAdditionalRoutes,
    }));
    const envelope = predictionEnvelope(corpus, predictions);
    envelope.inputsDigest = "a".repeat(64);

    const result = run(["--score", "-"], JSON.stringify(envelope));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("inputsDigest does not match");
  });

  it("does not require branch-only provenance heads to remain reachable after merge", () => {
    const { root } = makeRoutingRepository();
    const corpusPath = path.join(
      root,
      "shared-skills/skill-governance-steward/references/skill-routing-corpus.json",
    );
    const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as RoutingCorpus & {
      auditBaseHead: string;
    };
    corpus.auditBaseHead = "a".repeat(40);
    corpus.inputProvenanceHead = "b".repeat(40);
    corpus.evaluationProvenanceHead = "c".repeat(40);
    writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);

    const result = runAt(root, "node", ["scripts/quality/check-skill-routing-corpus.mjs"]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("rejects current routing-source drift from the stored evaluation", () => {
    const { root } = makeRoutingRepository();
    const agentSkillsPath = path.join(root, "docs/agent-skills.md");
    writeFileSync(
      agentSkillsPath,
      readFileSync(agentSkillsPath, "utf8").replace(
        "| Visual command-board treatment without changing workflow meaning |",
        "| New frozen routing drift probe | `skill-governance-steward` |\n| Visual command-board treatment without changing workflow meaning |",
      ),
    );
    const result = runAt(root, "node", ["scripts/quality/check-skill-routing-corpus.mjs"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("routing source digest drifted");

    const digest = runAt(root, "node", [
      "scripts/quality/check-skill-routing-corpus.mjs",
      "--print-routing-source-digest",
    ]);
    expect(digest.status, digest.stderr).toBe(0);
    const prompt = runAt(root, "node", [
      "scripts/quality/check-skill-routing-corpus.mjs",
      "--emit-evaluation-prompt",
    ]);
    expect(prompt.status, prompt.stderr).toBe(0);
    expect(prompt.stdout).toContain(digest.stdout.trim());

    const evaluation = JSON.parse(
      readFileSync(
        path.join(
          root,
          "shared-skills/skill-governance-steward/references/skill-routing-evaluation.json",
        ),
        "utf8",
      ),
    ) as {
      predictions: { routingSourceDigest: string };
    };
    evaluation.predictions.routingSourceDigest = digest.stdout.trim();
    const suppliedScore = spawnSync(
      "node",
      ["scripts/quality/check-skill-routing-corpus.mjs", "--score", "-"],
      {
        cwd: root,
        encoding: "utf8",
        input: JSON.stringify(evaluation.predictions),
      },
    );
    expect(suppliedScore.status, suppliedScore.stderr).toBe(0);
    expect(JSON.parse(suppliedScore.stdout)).toMatchObject({
      passed: true,
      routingSourceDigest: digest.stdout.trim(),
    });
  });

  it("normalizes CRLF before reading First-Route Rules", () => {
    const { root } = makeRoutingRepository();
    const agentSkillsPath = path.join(root, "docs/agent-skills.md");
    writeFileSync(agentSkillsPath, readFileSync(agentSkillsPath, "utf8").replace(/\n/g, "\r\n"));

    const result = runAt(root, "node", ["scripts/quality/check-skill-routing-corpus.mjs"]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("rejects a stored score that no longer matches rescored predictions", () => {
    const { root } = makeRoutingRepository();
    const evaluationPath = path.join(
      root,
      "shared-skills/skill-governance-steward/references/skill-routing-evaluation.json",
    );
    const evaluation = JSON.parse(readFileSync(evaluationPath, "utf8")) as {
      score: { passed: boolean };
    };
    evaluation.score.passed = false;
    writeFileSync(evaluationPath, `${JSON.stringify(evaluation, null, 2)}\n`);

    const result = runAt(root, "node", ["scripts/quality/check-skill-routing-corpus.mjs"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("stored evaluation score does not match");
  });

  it("rejects relabeling a stored prediction to a changed routing source", () => {
    const { root } = makeRoutingRepository();
    const agentSkillsPath = path.join(root, "docs/agent-skills.md");
    writeFileSync(
      agentSkillsPath,
      readFileSync(agentSkillsPath, "utf8").replace(
        "| Visual command-board treatment without changing workflow meaning |",
        "| New sealed routing drift probe | `skill-governance-steward` |\n| Visual command-board treatment without changing workflow meaning |",
      ),
    );
    const digest = runAt(root, "node", [
      "scripts/quality/check-skill-routing-corpus.mjs",
      "--print-routing-source-digest",
    ]).stdout.trim();
    const corpusPath = path.join(
      root,
      "shared-skills/skill-governance-steward/references/skill-routing-corpus.json",
    );
    const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as RoutingCorpus;
    corpus.routingSourceDigest = digest;
    writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);
    const evaluationPath = path.join(
      root,
      "shared-skills/skill-governance-steward/references/skill-routing-evaluation.json",
    );
    const evaluation = JSON.parse(readFileSync(evaluationPath, "utf8")) as {
      predictions: { routingSourceDigest: string };
      score: { routingSourceDigest: string };
    };
    evaluation.predictions.routingSourceDigest = digest;
    evaluation.score.routingSourceDigest = digest;
    writeFileSync(evaluationPath, `${JSON.stringify(evaluation, null, 2)}\n`);

    const result = runAt(root, "node", ["scripts/quality/check-skill-routing-corpus.mjs"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("stored evaluation seal does not bind");
  });
});
