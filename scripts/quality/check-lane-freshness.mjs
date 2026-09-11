// guard:lane-freshness — manual-lane freshness budget guard (issue #652).
//
// Some authoritative verification lanes run only on manual operator dispatch
// (e.g. the Architecture Fitness signed attestation, docs/ci-structure.md
// § "Contract Architecture Impact Review" 2026-08-07: cron was deliberately
// removed and is not coming back). Those lanes carry their own freshness
// contract — a machine verdict is only valid for the exact attested revision
// (docs/architecture-fitness/README.md, protected-signed-target freshness).
// Nothing else made that staleness deterministic or visible at PR time. This
// guard reads a declared budget per lane, computes how many commits main has
// moved past the lane's last verified target, and reports it — always, not
// only when it exceeds budget. "no silent state" is the point: a lane that
// has drifted out of budget must show up on every PR run, not just when
// someone remembers to look.
//
// Enforcement is per-lane and declared, not hardcoded here:
// - "warn"  → print a `::warning` annotation and exit 0 (the lane is stale,
//             but this guard does not decide that every PR must block on an
//             operator dispatching a manual workflow).
// - "block" → print a `::error` annotation and exit 1.
//
// Integrity: a lane's `lastTargetSha` must be a real commit that is actually
// part of this repository's history, or the declaration itself is not
// trustworthy ("the declaration is lying"). A strict `git merge-base
// --is-ancestor` check is the primary signal. This repo squash-merges PRs
// (see docs/architecture-fitness/README.md's own note that a signed PR
// target SHA and the resulting main SHA differ after a squash merge, and
// that this is normal, not an error): the pre-merge PR head commit that a
// lane attested is legitimately real and legitimately integrated, but is not
// a literal git ancestor of HEAD afterward, because the squash merge commit
// on HEAD's line carries a new SHA with the same tree. To honor the
// integrity check without hard-failing on that ordinary, documented case,
// a sha that is not a strict ancestor is still accepted if its tree content
// appears on a commit between the merge-base and HEAD (i.e. it was
// integrated, just under a different commit identity). A sha that shares no
// history with HEAD at all, or whose tree never landed on HEAD's line, is
// still a hard integrity failure.
//
// Shallow clones (local dev) do not have full history; CI checkouts use
// fetch-depth: 0. A shallow clone missing the declared sha is not a lying
// declaration, it is an expected local limitation — skip that lane with a
// clear notice and exit 0 rather than false-failing local runs.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PREFIX = "[guard:lane-freshness]";
const SHA_RE = /^[0-9a-f]{40}$/i;
const ENFORCEMENT_VALUES = new Set(["warn", "block"]);
const LANE_REQUIRED_FIELDS = [
  "id",
  "lastTargetSha",
  "budgetCommits",
  "enforcement",
  "owner",
  "onExceeded",
];
const LANE_KNOWN_FIELDS = new Set([
  "$comment",
  "id",
  "description",
  "lastTargetSha",
  "budgetCommits",
  "enforcement",
  "owner",
  "onExceeded",
  "refs",
]);
const TOP_LEVEL_KNOWN_FIELDS = new Set(["$comment", "lanes"]);

export class LaneFreshnessDeclarationError extends Error {}

/**
 * Strictly validate a parsed lane-freshness declaration.
 * Unknown keys are tolerated only when the key is literally "$comment" (at
 * either the top level or lane level) — anything else outside the declared
 * shape is a hard failure, because a malformed declaration must not silently
 * degrade into "no lanes checked."
 */
export function validateDeclaration(raw) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LaneFreshnessDeclarationError("최상위 값이 object가 아닙니다.");
  }

  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KNOWN_FIELDS.has(key)) {
      throw new LaneFreshnessDeclarationError(`알 수 없는 최상위 필드 '${key}'.`);
    }
  }

  if (!Array.isArray(raw.lanes)) {
    throw new LaneFreshnessDeclarationError("'lanes'가 배열이 아닙니다.");
  }
  if (raw.lanes.length === 0) {
    throw new LaneFreshnessDeclarationError(
      "'lanes'가 비어 있습니다 — 최소 1개 lane을 선언해야 합니다. " +
        "모든 lane을 제거하는 것은 이 guard의 wiring(quality:guards)을 함께 제거해야 하는 " +
        "Human decision이며, 선언만 비워서는 안 됩니다.",
    );
  }

  const seenIds = new Set();
  const lanes = raw.lanes.map((lane, index) => validateLane(lane, index, seenIds));
  return lanes;
}

function validateLane(lane, index, seenIds) {
  const where = `lanes[${index}]`;
  if (lane === null || typeof lane !== "object" || Array.isArray(lane)) {
    throw new LaneFreshnessDeclarationError(`${where}가 object가 아닙니다.`);
  }

  for (const key of Object.keys(lane)) {
    if (!LANE_KNOWN_FIELDS.has(key)) {
      throw new LaneFreshnessDeclarationError(`${where}에 알 수 없는 필드 '${key}'가 있습니다.`);
    }
  }

  for (const field of LANE_REQUIRED_FIELDS) {
    if (!(field in lane)) {
      throw new LaneFreshnessDeclarationError(`${where}에 필수 필드 '${field}'가 없습니다.`);
    }
  }

  if (typeof lane.id !== "string" || lane.id.trim().length === 0) {
    throw new LaneFreshnessDeclarationError(`${where}.id는 비어있지 않은 문자열이어야 합니다.`);
  }
  if (seenIds.has(lane.id)) {
    throw new LaneFreshnessDeclarationError(`lane id '${lane.id}'가 중복 선언되었습니다.`);
  }
  seenIds.add(lane.id);

  if (typeof lane.lastTargetSha !== "string" || !SHA_RE.test(lane.lastTargetSha)) {
    throw new LaneFreshnessDeclarationError(
      `${where}.lastTargetSha('${String(lane.lastTargetSha)}')는 40자리 hex commit sha여야 합니다.`,
    );
  }
  if (
    typeof lane.budgetCommits !== "number" ||
    !Number.isInteger(lane.budgetCommits) ||
    lane.budgetCommits <= 0
  ) {
    throw new LaneFreshnessDeclarationError(
      `${where}.budgetCommits는 양의 정수여야 합니다 (받은 값: ${String(lane.budgetCommits)}).`,
    );
  }
  if (typeof lane.enforcement !== "string" || !ENFORCEMENT_VALUES.has(lane.enforcement)) {
    throw new LaneFreshnessDeclarationError(
      `${where}.enforcement는 'warn' 또는 'block'이어야 합니다 (받은 값: ${String(lane.enforcement)}).`,
    );
  }
  if (typeof lane.owner !== "string" || lane.owner.trim().length === 0) {
    throw new LaneFreshnessDeclarationError(`${where}.owner는 비어있지 않은 문자열이어야 합니다.`);
  }
  if (typeof lane.onExceeded !== "string" || lane.onExceeded.trim().length === 0) {
    throw new LaneFreshnessDeclarationError(
      `${where}.onExceeded는 비어있지 않은 문자열이어야 합니다.`,
    );
  }
  if ("description" in lane && typeof lane.description !== "string") {
    throw new LaneFreshnessDeclarationError(`${where}.description은 문자열이어야 합니다.`);
  }
  if ("refs" in lane) {
    if (!Array.isArray(lane.refs) || lane.refs.some((ref) => typeof ref !== "string")) {
      throw new LaneFreshnessDeclarationError(`${where}.refs는 문자열 배열이어야 합니다.`);
    }
  }

  return lane;
}

export function loadDeclaration(declarationPath) {
  let raw;
  try {
    raw = readFileSync(declarationPath, "utf8");
  } catch (error) {
    throw new LaneFreshnessDeclarationError(
      `선언 파일을 읽을 수 없습니다: ${declarationPath} (${error.message})`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new LaneFreshnessDeclarationError(
      `선언 파일이 유효한 JSON이 아닙니다: ${declarationPath} (${error.message})`,
    );
  }

  return validateDeclaration(parsed);
}

/**
 * Evaluate one lane against pre-collected git facts. Pure and
 * dependency-injected on purpose: real git plumbing lives in
 * `collectLaneGitFacts` below, this function only implements the decision
 * table so it can be unit-tested without a git process.
 *
 * facts: {
 *   isShallow: boolean,
 *   commitExists: boolean,
 *   integrated: boolean,   // ancestor-of-HEAD, or squash-merge tree match
 *   staleness: number | null,
 * }
 */
export function evaluateLane(lane, facts) {
  if (!facts.commitExists && facts.isShallow) {
    return {
      laneId: lane.id,
      outcome: "shallow-skip",
      exitCode: 0,
      lines: [
        `${PREFIX} ${lane.id}: shallow clone에 lastTargetSha(${lane.lastTargetSha.slice(0, 12)})가 없습니다 — ` +
          "local shallow clone으로 판단해 이 lane을 건너뜁니다 (CI는 fetch-depth: 0이라 영향받지 않습니다).",
      ],
      errorLines: [],
      annotation: null,
    };
  }

  if (!facts.commitExists || !facts.integrated) {
    const reason = !facts.commitExists
      ? `commit ${lane.lastTargetSha}이(가) 이 저장소에 존재하지 않습니다`
      : `commit ${lane.lastTargetSha}이(가) HEAD 히스토리에 통합된 것으로 확인되지 않습니다`;
    return {
      laneId: lane.id,
      outcome: "integrity-fail",
      exitCode: 1,
      lines: [],
      errorLines: [
        `${PREFIX} FAIL: lane '${lane.id}'의 lastTargetSha 선언을 신뢰할 수 없습니다 — ${reason}.`,
        `${PREFIX} scripts/quality/lane-freshness.json의 lastTargetSha가 실제로 검증된 revision을 가리키는지 확인하세요.`,
      ],
      annotation: null,
    };
  }

  const statusLine =
    `${PREFIX} ${lane.id}: staleness=${facts.staleness} commits, ` +
    `budget=${lane.budgetCommits}, enforcement=${lane.enforcement}`;

  if (facts.staleness <= lane.budgetCommits) {
    return {
      laneId: lane.id,
      outcome: "within-budget",
      exitCode: 0,
      lines: [statusLine],
      errorLines: [],
      annotation: null,
    };
  }

  const message =
    `lane '${lane.id}' staleness ${facts.staleness} commits exceeds budget ${lane.budgetCommits}. ` +
    `${lane.onExceeded}`;

  if (lane.enforcement === "warn") {
    return {
      laneId: lane.id,
      outcome: "warn",
      exitCode: 0,
      lines: [statusLine],
      errorLines: [],
      annotation: `::warning title=lane-freshness::${message}`,
    };
  }

  return {
    laneId: lane.id,
    outcome: "block",
    exitCode: 1,
    lines: [statusLine],
    errorLines: [],
    annotation: `::error title=lane-freshness::${message}`,
  };
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function isShallowRepository(root) {
  try {
    return git(root, ["rev-parse", "--is-shallow-repository"]).trim() === "true";
  } catch {
    return false;
  }
}

function commitExists(root, sha) {
  try {
    git(root, ["cat-file", "-e", `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function isAncestor(root, sha, head) {
  try {
    git(root, ["merge-base", "--is-ancestor", sha, head]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Squash-merge-tolerant integration check: `sha` counts as integrated into
 * `head`'s line if its tree content appears on some commit between the
 * merge-base of (sha, head) and head. This is what a squash merge produces —
 * a new commit identity carrying the same tree as the pre-merge PR head.
 */
function isIntegratedViaTreeMatch(root, sha, head) {
  let mergeBase;
  try {
    mergeBase = git(root, ["merge-base", sha, head]).trim();
  } catch {
    return false; // no shared history at all
  }
  if (!mergeBase) return false;

  let targetTree;
  try {
    targetTree = git(root, ["rev-parse", `${sha}^{tree}`]).trim();
  } catch {
    return false;
  }

  const treesSinceMergeBase = git(root, ["log", "--format=%T", `${mergeBase}..${head}`])
    .split("\n")
    .filter(Boolean);
  return treesSinceMergeBase.includes(targetTree);
}

function revListCount(root, sha, head) {
  const output = git(root, ["rev-list", "--count", `${sha}..${head}`]).trim();
  return Number(output);
}

export function collectLaneGitFacts(lane, root, head = "HEAD") {
  const shallow = isShallowRepository(root);
  const exists = commitExists(root, lane.lastTargetSha);

  if (!exists) {
    return { isShallow: shallow, commitExists: false, integrated: false, staleness: null };
  }

  const integrated =
    isAncestor(root, lane.lastTargetSha, head) ||
    isIntegratedViaTreeMatch(root, lane.lastTargetSha, head);

  if (!integrated) {
    return { isShallow: shallow, commitExists: true, integrated: false, staleness: null };
  }

  return {
    isShallow: shallow,
    commitExists: true,
    integrated: true,
    staleness: revListCount(root, lane.lastTargetSha, head),
  };
}

const isDirectExecution =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href;

if (isDirectExecution) {
  const root = process.cwd();
  const declarationPath = path.join(root, "scripts/quality/lane-freshness.json");

  let lanes = null;
  try {
    lanes = loadDeclaration(declarationPath);
  } catch (error) {
    // Malformed declaration blocks every lane — there is nothing else to check.
    console.error(`${PREFIX} FAIL: ${error.message}`);
    process.exitCode = 1;
  }

  if (lanes) {
    let exitCode = 0;
    for (const lane of lanes) {
      const facts = collectLaneGitFacts(lane, root);
      const result = evaluateLane(lane, facts);
      for (const line of result.lines) console.log(line);
      for (const line of result.errorLines) console.error(line);
      if (result.annotation) console.log(result.annotation);
      if (result.exitCode !== 0) exitCode = 1;
    }
    process.exitCode = exitCode;
  }
}
