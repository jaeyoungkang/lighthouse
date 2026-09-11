#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const CORPUS_PATH = "shared-skills/skill-governance-steward/references/skill-routing-corpus.json";
const EVALUATION_PATH =
  "shared-skills/skill-governance-steward/references/skill-routing-evaluation.json";
const CANONICAL_SKILL_ROOT = "shared-skills";
const EXTERNAL_SKILL_PROVENANCE = "shared-skills/architecture-fitness-review.provenance.json";
const AGENT_SKILLS_PATH = "docs/agent-skills.md";
const CORPUS_SCHEMA = "lighthouse.skill-routing-corpus.v3";
const PREDICTION_SCHEMA = "lighthouse.skill-routing-predictions.v3";
const SCORE_SCHEMA = "lighthouse.skill-routing-score.v3";
const EVALUATION_SCHEMA = "lighthouse.skill-routing-evaluation.v1";
const REQUIRED_OVERLAPS = [
  "overlap:about-korean",
  "overlap:mission-runtime",
  "overlap:contract-map-runtime",
];
const REQUIRED_THRESHOLDS = [
  "firstRouteAccuracy",
  "requiredRouteRecall",
  "allowedRoutePrecision",
  "forbiddenSelections",
  "unknownRoutes",
];

function fail(message) {
  console.error(`skill-routing-corpus — FAIL: ${message}`);
  process.exit(1);
}

function readJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function skillFrontmatter(value, label) {
  const match = value.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) fail(`${label} has no YAML frontmatter.`);
  return match[1].replace(/\r\n/g, "\n").trim();
}

function firstRouteRules(value, label) {
  const normalized = value.replace(/\r\n/g, "\n");
  const heading = normalized.match(/^## First-Route Rules[ \t]*$/m);
  if (!heading || heading.index === undefined) {
    fail(`${label} has no First-Route Rules section.`);
  }
  const bodyStart = heading.index + heading[0].length;
  const remainder = normalized.slice(bodyStart).replace(/^\n/, "");
  const nextHeading = remainder.search(/^## /m);
  return (nextHeading === -1 ? remainder : remainder.slice(0, nextHeading)).trim();
}

function digestParts(parts) {
  return createHash("sha256").update(parts.join("\n\0\n")).digest("hex");
}

function externalSkillIdentity() {
  let provenance;
  try {
    provenance = readJson(
      readFileSync(EXTERNAL_SKILL_PROVENANCE, "utf8"),
      EXTERNAL_SKILL_PROVENANCE,
    );
  } catch {
    fail(`committed external skill provenance is missing: ${EXTERNAL_SKILL_PROVENANCE}.`);
  }
  const skillFileDigest = provenance.files?.["SKILL.md"];
  if (typeof provenance.skill !== "string" || !/^[0-9a-f]{64}$/.test(skillFileDigest ?? "")) {
    fail(`${EXTERNAL_SKILL_PROVENANCE} lacks skill and SKILL.md digest identity.`);
  }
  return {
    name: provenance.skill,
    sourceIdentity: `external-skill-file-sha256:${skillFileDigest}`,
  };
}

function committedRoutingSources() {
  const frontmatters = new Map();
  let entries;
  try {
    entries = readdirSync(CANONICAL_SKILL_ROOT, { withFileTypes: true });
  } catch {
    fail(`canonical skill root is missing: ${CANONICAL_SKILL_ROOT}.`);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(CANONICAL_SKILL_ROOT, entry.name, "SKILL.md");
    let value;
    try {
      value = readFileSync(skillPath, "utf8");
    } catch {
      continue;
    }
    frontmatters.set(entry.name, skillFrontmatter(value, skillPath));
  }
  const external = externalSkillIdentity();
  if (frontmatters.has(external.name)) {
    fail(`external skill '${external.name}' conflicts with a canonical unpacked skill.`);
  }
  return { frontmatters, external };
}

function worktreeRoutingSourceDigest() {
  const { frontmatters, external } = committedRoutingSources();
  const parts = [...frontmatters]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, frontmatter]) => `skill:${name}\n${frontmatter}`);
  parts.push(`skill:${external.name}\n${external.sourceIdentity}`);
  parts.push(
    `first-route-rules\n${firstRouteRules(
      readFileSync(AGENT_SKILLS_PATH, "utf8"),
      AGENT_SKILLS_PATH,
    )}`,
  );
  return digestParts(parts);
}

function evaluationRoutingSourceSnapshot() {
  const { frontmatters, external } = committedRoutingSources();
  return {
    skills: [
      ...[...frontmatters]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, frontmatter]) => ({ name, frontmatter })),
      { name: external.name, frontmatter: external.sourceIdentity },
    ],
    firstRouteRules: firstRouteRules(readFileSync(AGENT_SKILLS_PATH, "utf8"), AGENT_SKILLS_PATH),
  };
}

function skillInventory() {
  const { frontmatters, external } = committedRoutingSources();
  const skills = new Set(frontmatters.keys());
  skills.add(external.name);
  return skills;
}

function validateStringArray(value, label, inventory) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    fail(`${label} must be an array of strings.`);
  }
  for (const route of value) {
    if (!inventory.has(route)) fail(`${label} names unknown skill '${route}'.`);
  }
  if (new Set(value).size !== value.length) fail(`${label} contains a duplicate route.`);
}

function evaluationCases(corpus) {
  const byId = new Map(corpus.cases.map((routeCase) => [routeCase.id, routeCase]));
  return corpus.emitOrder.map((id) => byId.get(id));
}

function evaluationId(index) {
  return `case-${String(index + 1).padStart(2, "0")}`;
}

function evaluationInputs(corpus) {
  return evaluationCases(corpus).map(({ prompt }, index) => ({
    id: evaluationId(index),
    prompt,
  }));
}

function inputsDigest(corpus) {
  return createHash("sha256")
    .update(JSON.stringify(evaluationInputs(corpus)))
    .digest("hex");
}

function evaluationSpecDigest(corpus) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        schema: corpus.schema,
        thresholds: corpus.thresholds,
        emitOrder: corpus.emitOrder,
        cases: corpus.cases,
      }),
    )
    .digest("hex");
}

function loadCorpus({ allowRoutingSourceDrift = false } = {}) {
  const corpus = readJson(readFileSync(CORPUS_PATH, "utf8"), CORPUS_PATH);
  const inventory = skillInventory();
  if (corpus.schema !== CORPUS_SCHEMA) {
    fail(`unsupported schema '${String(corpus.schema)}'.`);
  }
  for (const field of ["auditBaseHead", "inputProvenanceHead", "evaluationProvenanceHead"]) {
    if (!/^[0-9a-f]{40}$/.test(corpus[field] ?? "")) {
      fail(`${field} must be a full 40-character commit SHA.`);
    }
  }
  for (const field of ["inputsDigest", "evaluationSpecDigest", "routingSourceDigest"]) {
    if (!/^[0-9a-f]{64}$/.test(corpus[field] ?? "")) {
      fail(`${field} must be a full SHA-256 digest.`);
    }
  }
  const currentSourceDigest = worktreeRoutingSourceDigest();
  if (!allowRoutingSourceDrift && corpus.routingSourceDigest !== currentSourceDigest) {
    fail("routing source digest drifted; freeze the source and rerun blind evaluation.");
  }
  if (!Array.isArray(corpus.cases) || corpus.cases.length < 10 || corpus.cases.length > 20) {
    fail("cases must contain 10 through 20 held-out prompts.");
  }

  const ids = new Set();
  for (const routeCase of corpus.cases) {
    if (!/^[a-z0-9-]+$/.test(routeCase.id ?? "")) fail("every case needs a stable kebab id.");
    if (ids.has(routeCase.id)) fail(`duplicate case id '${routeCase.id}'.`);
    ids.add(routeCase.id);
    if (typeof routeCase.prompt !== "string" || routeCase.prompt.trim().length < 20) {
      fail(`${routeCase.id}.prompt must be a non-trivial string.`);
    }
    if (routeCase.expectedFirstRoute !== null && !inventory.has(routeCase.expectedFirstRoute)) {
      fail(
        `${routeCase.id}.expectedFirstRoute names unknown skill '${routeCase.expectedFirstRoute}'.`,
      );
    }
    validateStringArray(
      routeCase.requiredAdditionalRoutes,
      `${routeCase.id}.requiredAdditionalRoutes`,
      inventory,
    );
    validateStringArray(
      routeCase.allowedAdditionalRoutes,
      `${routeCase.id}.allowedAdditionalRoutes`,
      inventory,
    );
    validateStringArray(routeCase.forbiddenRoutes, `${routeCase.id}.forbiddenRoutes`, inventory);
    if (
      routeCase.requiredAdditionalRoutes.some(
        (route) => !routeCase.allowedAdditionalRoutes.includes(route),
      )
    ) {
      fail(`${routeCase.id} requires a route that is not allowed.`);
    }
    if (
      routeCase.expectedFirstRoute !== null &&
      routeCase.allowedAdditionalRoutes.includes(routeCase.expectedFirstRoute)
    ) {
      fail(`${routeCase.id} repeats its first route as an additional route.`);
    }
    if (
      [routeCase.expectedFirstRoute, ...routeCase.allowedAdditionalRoutes]
        .filter((route) => route !== null)
        .some((route) => routeCase.forbiddenRoutes.includes(route))
    ) {
      fail(`${routeCase.id} both allows and forbids the same route.`);
    }
    if (
      routeCase.expectedFirstRoute === null &&
      (routeCase.requiredAdditionalRoutes.length > 0 ||
        routeCase.allowedAdditionalRoutes.length > 0)
    ) {
      fail(`${routeCase.id} cannot allow additional routes when its first route is null.`);
    }
    if (!Array.isArray(routeCase.tags) || routeCase.tags.length === 0) {
      fail(`${routeCase.id}.tags must be a non-empty array.`);
    }
  }

  if (
    !Array.isArray(corpus.emitOrder) ||
    corpus.emitOrder.length !== corpus.cases.length ||
    new Set(corpus.emitOrder).size !== corpus.cases.length ||
    corpus.emitOrder.some((id) => !ids.has(id))
  ) {
    fail("emitOrder must contain every case id exactly once.");
  }
  for (const overlap of REQUIRED_OVERLAPS) {
    const matching = corpus.cases.filter((routeCase) => routeCase.tags.includes(overlap));
    if (
      matching.length < 2 ||
      !matching.some((routeCase) => routeCase.forbiddenRoutes.length > 0)
    ) {
      fail(`${overlap} needs at least two cases including a negative control.`);
    }
    const positions = matching.map((routeCase) => corpus.emitOrder.indexOf(routeCase.id));
    if (
      positions.some((position, index) =>
        positions.some(
          (other, otherIndex) => index !== otherIndex && Math.abs(position - other) === 1,
        ),
      )
    ) {
      fail(`${overlap} cases may not be adjacent in emitOrder.`);
    }
  }

  if (
    !corpus.thresholds ||
    REQUIRED_THRESHOLDS.some((threshold) => !(threshold in corpus.thresholds)) ||
    Object.keys(corpus.thresholds).some((threshold) => !REQUIRED_THRESHOLDS.includes(threshold))
  ) {
    fail(`thresholds must contain exactly: ${REQUIRED_THRESHOLDS.join(", ")}.`);
  }
  for (const [key, value] of Object.entries(corpus.thresholds)) {
    if (key === "forbiddenSelections" || key === "unknownRoutes") {
      if (value !== 0) fail(`${key} threshold must remain zero.`);
    } else if (typeof value !== "number" || value < 0 || value > 1) {
      fail(`${key} threshold must be between zero and one.`);
    }
  }
  if (corpus.inputsDigest !== inputsDigest(corpus)) {
    fail("inputsDigest does not match the frozen opaque inputs.");
  }
  if (corpus.evaluationSpecDigest !== evaluationSpecDigest(corpus)) {
    fail("evaluationSpecDigest does not match the corpus cases, order, and thresholds.");
  }
  return { corpus, inventory, currentSourceDigest };
}

function parseArgs(argv) {
  let score;
  let emitEvaluationPrompt = false;
  let printRoutingSourceDigest = false;
  let printInputsDigest = false;
  let printEvaluationSpecDigest = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--score" && argv[index + 1]) {
      score = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--emit-evaluation-prompt") {
      emitEvaluationPrompt = true;
    } else if (argv[index] === "--print-routing-source-digest") {
      printRoutingSourceDigest = true;
    } else if (argv[index] === "--print-inputs-digest") {
      printInputsDigest = true;
    } else if (argv[index] === "--print-evaluation-spec-digest") {
      printEvaluationSpecDigest = true;
    } else {
      fail(`unknown or incomplete argument '${argv[index]}'.`);
    }
  }
  if (
    [
      Boolean(score),
      emitEvaluationPrompt,
      printRoutingSourceDigest,
      printInputsDigest,
      printEvaluationSpecDigest,
    ].filter(Boolean).length > 1
  ) {
    fail("score, prompt, and digest diagnostic modes are exclusive.");
  }
  return {
    score,
    emitEvaluationPrompt,
    printRoutingSourceDigest,
    printInputsDigest,
    printEvaluationSpecDigest,
  };
}

function emitPrompt(corpus, currentSourceDigest) {
  const inputs = evaluationInputs(corpus);
  console.log(
    [
      "Route each input using routable skill frontmatter plus docs/agent-skills.md",
      "First-Route Rules. Select the smallest sufficient route set. Return JSON only as an object",
      `with schema '${PREDICTION_SCHEMA}', inputsDigest '${corpus.inputsDigest}',`,
      `evaluationSpecDigest '${corpus.evaluationSpecDigest}', routingSourceDigest '${currentSourceDigest}',`,
      'and predictions [{"id":"...","firstRoute":"skill-name-or-null","additionalRoutes":["skill-name"]}].',
      "Use firstRoute null with no additional routes when the task intentionally needs no repo-local skill.",
      "Do not open the corpus file. The complete digest-bound routing source snapshot follows.",
      JSON.stringify(evaluationRoutingSourceSnapshot(), null, 2),
      "The unlabeled evaluation inputs follow.",
      JSON.stringify(inputs, null, 2),
    ].join("\n"),
  );
}

function validatePredictionRoutes(prediction) {
  if (
    prediction.firstRoute !== null &&
    (typeof prediction.firstRoute !== "string" || prediction.firstRoute.trim().length === 0)
  ) {
    fail(`${prediction.id}.firstRoute must be null or a non-empty string.`);
  }
  if (
    !Array.isArray(prediction.additionalRoutes) ||
    prediction.additionalRoutes.some(
      (route) => typeof route !== "string" || route.trim().length === 0,
    )
  ) {
    fail(`${prediction.id}.additionalRoutes must be an array of non-empty strings.`);
  }
  if (new Set(prediction.additionalRoutes).size !== prediction.additionalRoutes.length) {
    fail(`${prediction.id}.additionalRoutes contains a duplicate route.`);
  }
  if (
    prediction.firstRoute !== null &&
    prediction.additionalRoutes.includes(prediction.firstRoute)
  ) {
    fail(`${prediction.id} repeats its first route as an additional route.`);
  }
  if (prediction.firstRoute === null && prediction.additionalRoutes.length > 0) {
    fail(`${prediction.id} cannot select additional routes when firstRoute is null.`);
  }
}

function calculateScore(
  corpus,
  inventory,
  envelope,
  expectedRoutingSourceDigest = corpus.routingSourceDigest,
) {
  if (!envelope || Array.isArray(envelope) || typeof envelope !== "object") {
    fail("predictions must use the digest-bound prediction envelope.");
  }
  if (envelope.schema !== PREDICTION_SCHEMA) {
    fail(`prediction schema must be '${PREDICTION_SCHEMA}'.`);
  }
  for (const field of ["inputsDigest", "evaluationSpecDigest"]) {
    if (envelope[field] !== corpus[field]) {
      fail(`prediction ${field} does not match the corpus.`);
    }
  }
  if (envelope.routingSourceDigest !== expectedRoutingSourceDigest) {
    fail("prediction routingSourceDigest does not match the current routing source.");
  }
  const predictions = envelope.predictions;
  if (!Array.isArray(predictions)) fail("predictions must be a JSON array.");
  const byId = new Map();
  for (const prediction of predictions) {
    if (!prediction || typeof prediction.id !== "string" || byId.has(prediction.id)) {
      fail("predictions need unique string ids.");
    }
    validatePredictionRoutes(prediction);
    byId.set(prediction.id, prediction);
  }
  if (byId.size !== corpus.cases.length) fail("predictions must cover every corpus case exactly.");

  let correctFirst = 0;
  let requiredSelected = 0;
  let requiredTotal = 0;
  let allowedSelected = 0;
  let selectedTotal = 0;
  const forbidden = [];
  const misses = [];
  const unknownRoutes = [];

  for (const [index, routeCase] of evaluationCases(corpus).entries()) {
    const prediction = byId.get(evaluationId(index));
    if (!prediction) fail(`prediction missing for '${evaluationId(index)}'.`);
    const selected = new Set(
      [prediction.firstRoute, ...prediction.additionalRoutes].filter((route) => route !== null),
    );
    const required = new Set(
      [routeCase.expectedFirstRoute, ...routeCase.requiredAdditionalRoutes].filter(
        (route) => route !== null,
      ),
    );
    const allowed = new Set(
      [routeCase.expectedFirstRoute, ...routeCase.allowedAdditionalRoutes].filter(
        (route) => route !== null,
      ),
    );
    if (prediction.firstRoute === routeCase.expectedFirstRoute) correctFirst += 1;
    else {
      misses.push(
        `${routeCase.id}: first=${String(prediction.firstRoute)}, expected=${String(routeCase.expectedFirstRoute)}`,
      );
    }
    requiredTotal += required.size;
    selectedTotal += selected.size;
    for (const route of required) if (selected.has(route)) requiredSelected += 1;
    for (const route of selected) {
      if (allowed.has(route)) allowedSelected += 1;
      if (routeCase.forbiddenRoutes.includes(route)) forbidden.push(`${routeCase.id}:${route}`);
      if (routeCase.expectedFirstRoute === null) {
        forbidden.push(`${routeCase.id}:unexpected-route:${route}`);
      }
      if (!inventory.has(route)) unknownRoutes.push(`${routeCase.id}:${route}`);
    }
  }

  const metrics = {
    firstRouteAccuracy: correctFirst / corpus.cases.length,
    requiredRouteRecall: requiredSelected / requiredTotal,
    allowedRoutePrecision: allowedSelected / selectedTotal,
    forbiddenSelections: forbidden.length,
    unknownRoutes: unknownRoutes.length,
  };
  const passed =
    metrics.firstRouteAccuracy >= corpus.thresholds.firstRouteAccuracy &&
    metrics.requiredRouteRecall >= corpus.thresholds.requiredRouteRecall &&
    metrics.allowedRoutePrecision >= corpus.thresholds.allowedRoutePrecision &&
    metrics.forbiddenSelections <= corpus.thresholds.forbiddenSelections &&
    metrics.unknownRoutes <= corpus.thresholds.unknownRoutes;

  return {
    schema: SCORE_SCHEMA,
    corpusSchema: corpus.schema,
    inputsDigest: corpus.inputsDigest,
    evaluationSpecDigest: corpus.evaluationSpecDigest,
    routingSourceDigest: expectedRoutingSourceDigest,
    predictionEnvelopeDigest: createHash("sha256").update(JSON.stringify(envelope)).digest("hex"),
    passed,
    caseCount: corpus.cases.length,
    metrics,
    misses,
    forbidden,
    unknownRoutes,
  };
}

function scorePredictions(corpus, inventory, envelope, currentSourceDigest) {
  const score = calculateScore(corpus, inventory, envelope, currentSourceDigest);
  console.log(JSON.stringify(score));
  if (!score.passed) process.exit(1);
}

function evaluationSeal(evaluation) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        model: evaluation.model,
        evaluatedAt: evaluation.evaluatedAt,
        inputs: evaluation.inputs,
        predictions: evaluation.predictions,
      }),
    )
    .digest("hex");
}

function validateStoredEvaluation(corpus, inventory) {
  let value;
  try {
    value = readFileSync(EVALUATION_PATH, "utf8");
  } catch {
    fail(`${EVALUATION_PATH} is missing.`);
  }
  const evaluation = readJson(value, EVALUATION_PATH);
  if (evaluation.schema !== EVALUATION_SCHEMA) {
    fail(`stored evaluation schema must be '${EVALUATION_SCHEMA}'.`);
  }
  if (
    typeof evaluation.model !== "string" ||
    evaluation.model.trim().length < 3 ||
    ["opus", "latest"].includes(evaluation.model.toLowerCase())
  ) {
    fail("stored evaluation model must be a canonical model id.");
  }
  if (JSON.stringify(evaluation.inputs) !== JSON.stringify(evaluationInputs(corpus))) {
    fail("stored evaluation inputs do not match the emitted opaque inputs.");
  }
  const seal = evaluationSeal(evaluation);
  if (evaluation.seal !== seal || evaluation.score?.evaluationSeal !== seal) {
    fail("stored evaluation seal does not bind its model, inputs, predictions, and score.");
  }
  const recalculated = calculateScore(corpus, inventory, evaluation.predictions);
  if (
    JSON.stringify(evaluation.score) !== JSON.stringify({ ...recalculated, evaluationSeal: seal })
  ) {
    fail("stored evaluation score does not match the rescored predictions.");
  }
  if (!recalculated.passed) {
    fail("stored evaluation does not pass the frozen thresholds.");
  }
}

const {
  score,
  emitEvaluationPrompt,
  printRoutingSourceDigest,
  printInputsDigest,
  printEvaluationSpecDigest,
} = parseArgs(process.argv.slice(2));

if (printRoutingSourceDigest) {
  console.log(worktreeRoutingSourceDigest());
  process.exit(0);
}

if (printInputsDigest || printEvaluationSpecDigest) {
  const diagnosticCorpus = readJson(readFileSync(CORPUS_PATH, "utf8"), CORPUS_PATH);
  console.log(
    printInputsDigest ? inputsDigest(diagnosticCorpus) : evaluationSpecDigest(diagnosticCorpus),
  );
  process.exit(0);
}

const evaluationMode = emitEvaluationPrompt || Boolean(score);
const { corpus, inventory, currentSourceDigest } = loadCorpus({
  allowRoutingSourceDrift: evaluationMode,
});
if (!evaluationMode) validateStoredEvaluation(corpus, inventory);

if (emitEvaluationPrompt) {
  emitPrompt(corpus, currentSourceDigest);
} else if (score) {
  const input = score === "-" ? readFileSync(0, "utf8") : readFileSync(score, "utf8");
  scorePredictions(corpus, inventory, readJson(input, "predictions"), currentSourceDigest);
} else {
  console.log(
    `skill-routing-corpus — PASS: ${String(corpus.cases.length)} cases, ` +
      `${String(REQUIRED_OVERLAPS.length)} overlap pairs, ${String(inventory.size)} routable skills, ` +
      `inputs ${corpus.inputsDigest.slice(0, 12)}, ` +
      `source ${corpus.routingSourceDigest.slice(0, 12)}.`,
  );
}
