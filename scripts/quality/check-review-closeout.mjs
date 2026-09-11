#!/usr/bin/env node
// Review-closeout gate (issue #318).
//
// A PR may merge only when its exact content head carries a review record in
// the checklist usage log. This is the machine form of the three-state PR
// review closeout (clean / findings remain / stale) owned by
// review-checklist-steward references and docs/agent-skills.md
// § Review Closeout Status:
//
// - content head = the newest commit in <base>..HEAD whose diff is not
//   record-only and not empty. Trailing record-only commits (the usage-log
//   append itself) and empty commits do
//   not advance the reviewed head — this is the record-only diff allowance.
// - clean = the latest non-dirty review record whose `head:` field matches
//   the content head declares `closeout: clean` and `findings: valid 0`.
//   A new content commit makes prior records stale and this gate red until a
//   re-review record lands.
// - Merge commits are skipped (--no-merges): a base-branch update-merge does
//   not invalidate the branch review. Conflict-resolution content inside a
//   merge commit is a documented limitation of this gate, not proof of review.
// - Reviewer-role completeness and escape-record state stay prose/Human-owned
//   until their required set and resolution state are machine-readable. This
//   gate binds the record to the exact head and rejects an explicit non-clean
//   or valid-finding record.
//
// External bot review state (e.g. CodeRabbit) is deliberately not an input:
// bot reviews are reference signals and escape measurement, not closeout
// authority (issue #318).

import { execFileSync } from "node:child_process";

import {
  findAddedEscapeRecords,
  findAddedReviewRecords,
  parseReviewRecord,
  REVIEW_RECORD_POLICY,
  validateAppliedGroups,
  validateEscapeFeedback,
  validateHitEntries,
  validateModelAttribution,
} from "./review-record-schema.mjs";

const RECORD_LOG = "shared-skills/review-checklist-steward/references/checklist-usage-log.md";
const DEFAULT_CHECKLIST = "shared-skills/review-checklist-steward/references/default-checklist.md";
const RECORD_ONLY_PATHS = new Set([RECORD_LOG]);

const REVIEW_RECORD =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2} \|.*?\| head: ([0-9a-f]{12,40})(\+dirty)? \|.*?\| findings: valid (\d+), invalid \d+, already-fixed \d+, duplicate \d+, needs-human \d+ \|.*?\| closeout: (clean|findings remain|stale) \|/;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function parseArgs(argv) {
  let base;
  let describePolicy = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--base" && argv[i + 1]) {
      base = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--describe-policy") {
      describePolicy = true;
    }
  }
  if (!base && !describePolicy) {
    console.error("review-closeout — FAIL: --base <ref> is required.");
    process.exit(1);
  }
  return { base, describePolicy };
}

const { base, describePolicy } = parseArgs(process.argv.slice(2));

if (base && describePolicy) {
  console.error(
    "review-closeout — FAIL: --describe-policy is diagnostic-only and cannot be combined with --base.",
  );
  process.exit(1);
}

if (describePolicy) {
  console.log(
    JSON.stringify({
      recordLog: RECORD_LOG,
      recordOnlyPaths: [...RECORD_ONLY_PATHS],
      requiredNewReviewFields: REVIEW_RECORD_POLICY.requiredModelFields,
      invalidModelValues: REVIEW_RECORD_POLICY.invalidModelValues,
      movingModelAliases: REVIEW_RECORD_POLICY.movingModelAliases,
      validHitEntry: REVIEW_RECORD_POLICY.validHitEntry,
      validEscapeEntry: REVIEW_RECORD_POLICY.validEscapeEntry,
    }),
  );
  process.exit(0);
}

let baseSha;
try {
  baseSha = git(["rev-parse", "--verify", `${base}^{commit}`]).trim();
} catch {
  // Fail closed: an unresolvable declared base must not silently narrow the
  // comparison (same stance as the cache-contract guard, docs/ci-structure.md).
  console.error(`review-closeout — FAIL: base ref '${base}' cannot be resolved.`);
  process.exit(1);
}

const commits = git(["log", "--no-merges", "--format=%H", `${baseSha}..HEAD`])
  .split("\n")
  .filter(Boolean);

let log;
try {
  log = git(["show", `HEAD:${RECORD_LOG}`]);
} catch {
  console.error(`review-closeout — FAIL: ${RECORD_LOG} is missing at HEAD.`);
  process.exit(1);
}

let baseLog = "";
try {
  baseLog = git(["show", `${baseSha}:${RECORD_LOG}`]);
} catch {
  // A base before the canonical log existed has no grandfathered lines. Every
  // review record introduced by the branch must use the current schema.
}

let checklist;
try {
  checklist = git(["show", `HEAD:${DEFAULT_CHECKLIST}`]);
} catch {
  console.error(`review-closeout — FAIL: ${DEFAULT_CHECKLIST} is missing at HEAD.`);
  process.exit(1);
}
const currentGroups = new Set(
  [...checklist.matchAll(/^### ([a-z][a-z0-9-]*)\b/gm)].map((match) => match[1]),
);
const entryStarts = [...checklist.matchAll(/^- `([a-z][a-z0-9-]*-\d+)`/gm)];
const entryStatuses = new Map(
  entryStarts.map((match) => {
    const lineEnd = checklist.indexOf("\n", match.index);
    const entryLine = checklist.slice(match.index, lineEnd === -1 ? checklist.length : lineEnd);
    const status = entryLine.match(/`status: (candidate|active|covered|retired|workflow)`/)?.[1];
    return [match[1], status ?? "active"];
  }),
);
const acceptedEntries = new Set(
  [...entryStatuses]
    .filter(([, status]) => status === "active" || status === "workflow")
    .map(([entry]) => entry),
);
const candidateEntries = new Set(
  [...entryStatuses].filter(([, status]) => status === "candidate").map(([entry]) => entry),
);
if (currentGroups.size === 0) {
  console.error(
    `review-closeout — FAIL: no current checklist groups found in ${DEFAULT_CHECKLIST}.`,
  );
  process.exit(1);
}

const invalidNewRecords = [];
for (const record of findAddedReviewRecords(baseLog, log)) {
  const problems = [
    ...validateModelAttribution(record),
    ...validateAppliedGroups(record, currentGroups),
    ...validateHitEntries(record, acceptedEntries),
  ];
  if (problems.length > 0) {
    invalidNewRecords.push({
      head: record.head,
      problems,
    });
  }
}

const invalidNewEscapes = [];
for (const record of findAddedEscapeRecords(baseLog, log)) {
  const problems = validateEscapeFeedback(record, {
    accepted: acceptedEntries,
    candidates: candidateEntries,
    statuses: entryStatuses,
  });
  if (problems.length > 0) {
    invalidNewEscapes.push({
      head: record.head,
      finding: record.finding,
      problems,
    });
  }
}

if (invalidNewEscapes.length > 0) {
  console.error(
    [
      "review-closeout — FAIL: newly added valid escape records must map to feedback.",
      ...invalidNewEscapes.map(
        (record) =>
          `  head ${record.head.slice(0, 12)} (${record.finding.slice(0, 48)}): ` +
          record.problems.join(", "),
      ),
      "Use an existing checklist entry id, or add a candidate entry at HEAD and map it as",
      "`candidate:<stable-entry-id>` when no existing entry fits.",
      "Existing base and archive escape records remain unchanged.",
    ].join("\n"),
  );
  process.exit(1);
}

if (invalidNewRecords.length > 0) {
  console.error(
    [
      "review-closeout — FAIL: newly added review records violate the prospective schema.",
      ...invalidNewRecords.map(
        (record) => `  head ${record.head.slice(0, 12)}: ${record.problems.join(", ")}`,
      ),
      "Required fields: author-model, review-model, verdict-model.",
      "Applied groups must be current and hit ids must name active/workflow entries at HEAD.",
      "Use exact model identifiers, or `human` when that role was performed without a model.",
      "Existing base and archive records remain valid without these fields.",
    ].join("\n"),
  );
  process.exit(1);
}

if (commits.length === 0) {
  console.log(`review-closeout — no non-merge commits beyond ${base}. PASS.`);
  process.exit(0);
}

let contentHead;
for (const sha of commits) {
  const files = git(["show", "--name-only", "--format=", sha]).split("\n").filter(Boolean);
  if (files.length === 0) continue; // empty commit
  if (files.every((file) => RECORD_ONLY_PATHS.has(file))) continue; // record-only
  contentHead = sha;
  break;
}

if (!contentHead) {
  console.log(
    `review-closeout — all ${String(commits.length)} commit(s) beyond ${base} are ` +
      "record-only or empty; no reviewable content head. PASS.",
  );
  process.exit(0);
}

const records = [];
for (const line of log.split("\n")) {
  const parsed = parseReviewRecord(line);
  if (!parsed || parsed.dirty) continue;
  const match = line.match(REVIEW_RECORD);
  if (!match) {
    records.push({
      head: parsed.head,
      validFindings: null,
      closeout: "malformed",
    });
    continue;
  }
  records.push({
    head: match[1],
    validFindings: Number(match[3]),
    closeout: match[4],
  });
}

const matchingRecords = records.filter((record) => contentHead.startsWith(record.head));
const latestMatchingRecord = matchingRecords.at(-1);
const matched =
  latestMatchingRecord?.closeout === "clean" && latestMatchingRecord.validFindings === 0;

if (matched) {
  console.log(
    `review-closeout — clean: review record found for content head ${contentHead.slice(0, 12)}. PASS.`,
  );
  process.exit(0);
}

console.error(
  [
    `review-closeout — FAIL (stale or unreviewed): no review record for content head ${contentHead.slice(0, 12)}.`,
    "",
    "The exact content head of this branch has no matching review record in",
    `  ${RECORD_LOG}`,
    "A new content commit makes prior `clean` claims stale. Close the loop by",
    "reviewing the current head and appending a review record for it (format:",
    "review-checklist-steward references/default-checklist.md § Usage Records",
    "and Hit Rate). Trailing record-only or empty commits are allowed and do",
    "not advance the content head.",
    latestMatchingRecord
      ? latestMatchingRecord.closeout === "malformed"
        ? "Latest matching record is malformed; required findings and closeout fields were not parsed."
        : `Latest matching record: closeout=${latestMatchingRecord.closeout}, valid findings=${String(latestMatchingRecord.validFindings)}.`
      : records.length > 0
        ? `Most recent recorded heads: ${records
            .slice(-3)
            .map((record) => record.head)
            .join(", ")}`
        : "No parseable review records found in the log.",
  ].join("\n"),
);
process.exit(1);
