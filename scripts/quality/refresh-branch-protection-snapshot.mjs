// gate:snapshot — operator script (issue #652).
//
// Refreshes scripts/quality/branch-protection.snapshot.json from the live
// GitHub branch protection state for main. This snapshot is the observed
// half of the gate enforcement-status parity guard: scripts/quality/gate-status.json
// declares the canonical intent (which contexts are required, which jobs are
// advisory or manual), this file records what GitHub actually enforces, and
// scripts/quality/check-gate-parity.mjs (offline, no network) checks that
// the two agree.
//
// Run manually: `npm run gate:snapshot` (or
// `node scripts/quality/refresh-branch-protection-snapshot.mjs`). Requires an
// authenticated `gh` CLI with read access to jaeyoungkang/lighthouse. This script
// only reads branch protection state and writes the local snapshot file — it
// never mutates GitHub state.

import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REPO = "jaeyoungkang/lighthouse";
const BRANCH = "main";
const API_PATH = `repos/${REPO}/branches/${BRANCH}/protection`;
const SNAPSHOT_PATH = path.join("scripts", "quality", "branch-protection.snapshot.json");

function fetchProtection() {
  let raw;
  try {
    raw = execFileSync("gh", ["api", API_PATH], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = error?.stderr?.toString?.() ?? String(error?.message ?? error);
    console.error(
      [
        `refresh-branch-protection-snapshot — FAIL: \`gh api ${API_PATH}\` did not succeed.`,
        "This usually means the gh CLI is unauthenticated or lacks read access to the repo.",
        "Run `gh auth status` (and `gh auth login` if needed), then re-run `npm run gate:snapshot`.",
        "",
        stderr.trim(),
      ].join("\n"),
    );
    process.exit(1);
  }

  try {
    return JSON.parse(raw);
  } catch {
    console.error(
      `refresh-branch-protection-snapshot — FAIL: \`gh api ${API_PATH}\` did not return valid JSON.`,
    );
    process.exit(1);
  }
}

function normalize(protection) {
  return {
    fetchedAt: new Date().toISOString(),
    source: `gh api ${API_PATH}`,
    requiredStatusChecks: {
      strict: Boolean(protection?.required_status_checks?.strict),
      contexts: [...(protection?.required_status_checks?.contexts ?? [])],
    },
    enforceAdmins: Boolean(protection?.enforce_admins?.enabled),
    allowForcePushes: Boolean(protection?.allow_force_pushes?.enabled),
    allowDeletions: Boolean(protection?.allow_deletions?.enabled),
    requiredApprovingReviewCount: Number(
      protection?.required_pull_request_reviews?.required_approving_review_count ?? 0,
    ),
  };
}

async function readExistingSnapshot() {
  try {
    const raw = await readFile(SNAPSHOT_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function diffSummary(before, after) {
  if (!before) return ["(no existing snapshot; creating new file)"];

  const lines = [];
  const beforeContexts = new Set(before.requiredStatusChecks?.contexts ?? []);
  const afterContexts = new Set(after.requiredStatusChecks.contexts);
  for (const context of afterContexts) {
    if (!beforeContexts.has(context)) lines.push(`+ requiredStatusChecks.contexts: ${context}`);
  }
  for (const context of beforeContexts) {
    if (!afterContexts.has(context)) lines.push(`- requiredStatusChecks.contexts: ${context}`);
  }

  const scalarFields = [
    ["requiredStatusChecks.strict", (obj) => obj.requiredStatusChecks?.strict],
    ["enforceAdmins", (obj) => obj.enforceAdmins],
    ["allowForcePushes", (obj) => obj.allowForcePushes],
    ["allowDeletions", (obj) => obj.allowDeletions],
    ["requiredApprovingReviewCount", (obj) => obj.requiredApprovingReviewCount],
  ];
  for (const [label, get] of scalarFields) {
    const beforeValue = get(before);
    const afterValue = get(after);
    if (beforeValue !== afterValue) {
      lines.push(`~ ${label}: ${String(beforeValue)} -> ${String(afterValue)}`);
    }
  }

  return lines.length > 0 ? lines : ["(no changes)"];
}

async function main() {
  const before = await readExistingSnapshot();
  const protection = fetchProtection();
  const after = normalize(protection);
  const summary = diffSummary(before, after);

  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(after, null, 2)}\n`, "utf8");

  console.log(`gate:snapshot — wrote ${SNAPSHOT_PATH}`);
  for (const line of summary) console.log(`  ${line}`);
}

await main();
