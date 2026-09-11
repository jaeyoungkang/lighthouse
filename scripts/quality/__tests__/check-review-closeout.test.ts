import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.join(process.cwd(), "scripts/quality/check-review-closeout.mjs");
const RECORD_SCHEMA = path.join(process.cwd(), "scripts/quality/review-record-schema.mjs");
const RECORD_LOG = "shared-skills/review-checklist-steward/references/checklist-usage-log.md";
const DEFAULT_CHECKLIST_PATH =
  "shared-skills/review-checklist-steward/references/default-checklist.md";
const ARCHIVE_LOG = "docs/archive/checklist-usage-log-through-2026-07-18-pr381-4f887feb.md";
const DEFAULT_CHECKLIST = path.join(
  process.cwd(),
  "shared-skills/review-checklist-steward/references/default-checklist.md",
);
const REVIEW_SKILL = path.join(process.cwd(), "shared-skills/review-checklist-steward/SKILL.md");
const AGENT_SKILLS = path.join(process.cwd(), "docs/agent-skills.md");
const REQUIRED_MODEL_FIELDS =
  "author-model: gpt-5.6-sol | review-model: claude-opus-5 | verdict-model: gpt-5.6-sol";
const temporaryRoots: string[] = [];

function withRequiredModelFields(line: string): string {
  if (!line.includes(" | head:") || !line.includes(" | role:") || line.includes("author-model:")) {
    return line;
  }
  return line.replace(" | surface:", ` | ${REQUIRED_MODEL_FIELDS} | surface:`);
}

function run(root: string, command: string, args: string[]) {
  return spawnSync(command, args, { cwd: root, encoding: "utf-8" });
}

function commitAll(root: string, message: string): void {
  const result = run(root, "git", ["add", "."]);
  expect(result.status, result.stderr).toBe(0);
  const commit = run(root, "git", [
    "-c",
    "user.name=Review Test",
    "-c",
    "user.email=review-test@example.com",
    "commit",
    "-q",
    "-m",
    message,
  ]);
  expect(commit.status, commit.stderr).toBe(0);
}

function makeRepository(): { root: string; base: string } {
  const root = mkdtempSync(path.join(tmpdir(), "lighthouse-review-closeout-"));
  temporaryRoots.push(root);
  expect(run(root, "git", ["init", "-q", "-b", "main"]).status).toBe(0);

  const recordPath = path.join(root, RECORD_LOG);
  mkdirSync(path.dirname(recordPath), { recursive: true });
  writeFileSync(recordPath, "# Usage log\n");
  writeFileSync(
    path.join(root, DEFAULT_CHECKLIST_PATH),
    "# Default checklist\n\n### root-cause — owner checks\n\n- `root-cause-01` owner\n- `root-cause-06` semantic drift\n\n### code — code checks\n\n- `code-01` code\n- `code-96` `status: workflow` workflow\n- `code-97` `status: covered` covered\n- `code-98` `status: retired` retired\n- `code-99` `status: candidate` candidate\n",
  );
  commitAll(root, "base");

  const base = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
  return { root, base };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("review closeout record-only boundary", () => {
  it("declares only the canonical usage log as authority and record-only", () => {
    const { root } = makeRepository();
    const result = run(root, "node", [SCRIPT, "--describe-policy"]);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      recordLog: RECORD_LOG,
      recordOnlyPaths: [RECORD_LOG],
      requiredNewReviewFields: ["author-model", "review-model", "verdict-model"],
      invalidModelValues: ["none", "unknown", "n/a", "na", "tbd"],
      movingModelAliases: ["opus", "latest"],
      validHitEntry: "<active-or-workflow-entry-id | none>",
      validEscapeEntry: "<active-or-workflow-entry-id | candidate:stable-entry-id>",
    });
  });

  it("rejects combining policy diagnostics with a closeout base", () => {
    const { root, base } = makeRepository();
    const result = run(root, "node", [SCRIPT, "--base", base, "--describe-policy"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("diagnostic-only");
  });

  it("keeps the canonical review log append-only without a fixed size limit", () => {
    const policy = readFileSync(DEFAULT_CHECKLIST, "utf-8");
    expect(policy).toMatch(
      /Append new records to the canonical log without a fixed record limit or\s+size-triggered compaction\./,
    );
    expect(policy).toMatch(
      /existing `docs\/archive\/` usage-log files remain\s+immutable history, but no new archive is required merely because the canonical\s+log grows\./,
    );
    expect(policy).toMatch(
      /`scripts\/quality\/check-review-closeout\.mjs` continues to read only\s+the canonical log as merge authority\./,
    );
  });

  it("requires a semantic-cluster sweep before a new exact-head certification", () => {
    const skill = readFileSync(REVIEW_SKILL, "utf-8");
    const checklist = readFileSync(DEFAULT_CHECKLIST, "utf-8");

    expect(skill).toMatch(
      /first valid semantic-drift finding is a signal to stop per-file correction\s+and sweep the whole causal cluster before scope freeze/,
    );
    expect(skill).toMatch(
      /new valid semantic drift during exact-head closeout invalidates the\s+current freeze and returns the work to discovery, sweep, and correction/,
    );
    expect(skill).toMatch(
      /historical-looking\s+file is not excluded when it claims current policy, current ownership, current\s+execution conditions, or current closeout authority/,
    );
    expect(checklist).toContain("`root-cause-06`");
    expect(checklist).toMatch(
      /\| workstream: <stable issue, PR, or task id> \| workstream-root: <canonical repository task id> \| applied:.*\| round: <discovery-sweep \| exact-head-certification> \| design-cycle: <positive integer> \| iteration: <1-5> \| reset-from: <none \| retired-state identity> \| countermeasure-from: <none \| restart record id> \| reason: <initial entry or rerun reason> \| cluster: <stable semantic-cluster name, or none> \| sweep:/,
    );
    expect(checklist).toMatch(
      /Records created before the Issue #441 metadata extension remain valid in their\s+original format/,
    );
  });

  it("keeps the Issue #504 model vocabulary aligned between parser and template", () => {
    const schema = readFileSync(RECORD_SCHEMA, "utf-8");
    const checklist = readFileSync(DEFAULT_CHECKLIST, "utf-8");

    expect(checklist).toContain(
      "author-model: <canonical-model-id(s)-or-human> | review-model: <canonical-model-id(s)-or-human> | verdict-model: <canonical-model-id(s)-or-human>",
    );
    expect(checklist).toContain(
      "New records may not use `none`, `unknown`, `n/a`,\n  `na`, `tbd`, or an unfilled template placeholder",
    );
    expect(schema).toContain(
      'invalidModelValues: Object.freeze(["none", "unknown", "n/a", "na", "tbd"])',
    );
    expect(schema).toContain('movingModelAliases: Object.freeze(["opus", "latest"])');
    expect(schema).toContain(
      'requiredModelFields: Object.freeze(["author-model", "review-model", "verdict-model"])',
    );
  });

  it("rejects a newly added review record that applies a retired group label", () => {
    const { root, base } = makeRepository();
    const dirtyHead = "d".repeat(40);
    const record = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${dirtyHead}+dirty | role: independent-subagent | ${REQUIRED_MODEL_FIELDS} | surface: process | applied: quality-gates | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: none | closeout: clean | gap: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${record}\n`);
    commitAll(root, "append stale lens record");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("applied names non-current group(s): quality-gates");
  });

  it("rejects a newly added review record that hits a historical entry id", () => {
    const { root, base } = makeRepository();
    const dirtyHead = "d".repeat(40);
    const record = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${dirtyHead}+dirty | role: independent-subagent | ${REQUIRED_MODEL_FIELDS} | surface: process | applied: code | excluded: none | hit: security/privacy-01: stale owner | findings: valid 1, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: none | closeout: findings remain | gap: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${record}\n`);
    commitAll(root, "append historical hit record");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "hit names non-current or unknown entry(s): security/privacy-01",
    );
  });

  it("accepts comma-only active hit ids", () => {
    const { root, base } = makeRepository();
    const dirtyHead = "d".repeat(40);
    const record = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${dirtyHead}+dirty | role: independent-subagent | ${REQUIRED_MODEL_FIELDS} | surface: process | applied: root-cause, code | excluded: none | hit: root-cause-01, code-01 | findings: valid 2, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: none | closeout: findings remain | gap: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${record}\n`);
    commitAll(root, "append comma hit record");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("accepts workflow and repeated hit ids with free semicolon prose", () => {
    const { root, base } = makeRepository();
    const dirtyHead = "d".repeat(40);
    const record = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${dirtyHead}+dirty | role: independent-subagent | ${REQUIRED_MODEL_FIELDS} | surface: process | applied: code | excluded: none | hit: code-96: workflow gap; explanation continues without another id; code-96: second finding | findings: valid 2, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: none | closeout: findings remain | gap: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${record}\n`);
    commitAll(root, "append workflow repeated-hit record");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("requires every new valid escape to map to an entry or explicit candidate", () => {
    const { root, base } = makeRepository();
    const escape = `2026-07-25 | escape | pr: #1 | head: ${"a".repeat(40)} | source: human | classification: valid | finding: missing lens | entry: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${escape}\n`);
    commitAll(root, "append unmapped valid escape");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`head ${"a".repeat(12)} (missing lens)`);
    expect(result.stderr).toContain("valid escape may not use entry:none");
  });

  it("accepts an explicit candidate mapping for a new valid escape", () => {
    const { root, base } = makeRepository();
    const escape = `2026-07-25 | escape | pr: #1 | head: ${"a".repeat(40)} | source: human | classification: valid | finding: missing lens | entry: candidate:code-99`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${escape}\n`);
    commitAll(root, "append candidate-mapped valid escape");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("accepts an existing checklist entry mapping for a new valid escape", () => {
    const { root, base } = makeRepository();
    const escape = `2026-07-25 | escape | pr: #1 | head: ${"a".repeat(40)} | source: human | classification: valid | finding: code gap | entry: code-01`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${escape}\n`);
    commitAll(root, "append existing-entry valid escape");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    ["code-97", "covered"],
    ["code-98", "retired"],
    ["code-99", "candidate"],
  ])("rejects a direct valid escape mapping to a %s entry", (entry, status) => {
    const { root, base } = makeRepository();
    const escape = `2026-07-25 | escape | pr: #1 | head: ${"a".repeat(40)} | source: human | classification: valid | finding: stale owner | entry: ${entry}`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${escape}\n`);
    commitAll(root, `append ${status} valid escape`);

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`has status '${status}'; use its active/workflow owner`);
  });

  it("accepts a workflow entry mapping for a new valid escape", () => {
    const { root, base } = makeRepository();
    const escape = `2026-07-25 | escape | pr: #1 | head: ${"a".repeat(40)} | source: human | classification: valid | finding: workflow gap | entry: code-96`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${escape}\n`);
    commitAll(root, "append workflow valid escape");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("grandfathers an unchanged valid escape with entry:none", () => {
    const { root } = makeRepository();
    const escape = `2026-07-19 | escape | pr: #1 | head: ${"a".repeat(40)} | source: human | classification: valid | finding: historical gap | entry: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${escape}\n`);
    commitAll(root, "append legacy unmapped escape");
    const base = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
    writeFileSync(path.join(root, "content.ts"), "export const current = true;\n");
    commitAll(root, "add current content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
    const record = withRequiredModelFields(
      `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: current | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted | closeout: clean | gap: none`,
    );
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${escape}\n${record}\n`);
    commitAll(root, "append current review");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("requires a new design cycle instead of a sixth substantive review", () => {
    const skill = readFileSync(REVIEW_SKILL, "utf-8");
    const checklist = readFileSync(DEFAULT_CHECKLIST, "utf-8");
    const agentSkills = readFileSync(AGENT_SKILLS, "utf-8");

    expect(skill).toMatch(
      /If iteration five reports any new `valid` finding, do not patch the\s+same design and start iteration six/,
    );
    expect(skill).toMatch(
      /Prior findings become adversarial\s+acceptance inputs, not a template for the new\s+implementation/,
    );
    expect(skill).toMatch(
      /If the fifth-iteration finding is semantic drift, `Semantic Cluster Sweep`\s+still owns the inventory/,
    );
    expect(skill).toMatch(
      /compatibility before removing anything and record one verdict for\s+each protected, deployed, persisted, or public artifact/,
    );
    expect(checklist).toContain("`root-cause-07` `status: workflow`");
    expect(checklist).toMatch(
      /\| design-reset \|.*\| retired-state: <published commit sha> \| retired-ref: <shared workstream, PR, or forensic ref> \| trigger: iteration-5-valid \| compatibility: <artifact@canonical-owner=verdict, …; verdict is preserve \/ migrate-read-only \/ remove>/,
    );
    expect(skill).toMatch(/a local stash commit to a\s+durable shared forensic ref/);
    expect(agentSkills).toContain("A local-only stash or reflog is not reset evidence.");
    expect(agentSkills).toMatch(/One\s+design receives at most five substantive iterations/);
  });

  it("keeps the Human-owned three-cycle countermeasure policy in sync", () => {
    const skill = readFileSync(REVIEW_SKILL, "utf-8");
    const checklist = readFileSync(DEFAULT_CHECKLIST, "utf-8");
    const agentSkills = readFileSync(AGENT_SKILLS, "utf-8");

    expect(skill).toMatch(
      /Count the unique, chained qualifying resets for retired cycles one, two, and\s+three/,
    );
    expect(skill).toMatch(
      /After\s+every restart condition is satisfied, append a separate\s+`countermeasure-restart` activation record/,
    );
    expect(checklist).toContain("`root-cause-08` `status: workflow`");
    expect(checklist).toMatch(
      /\| countermeasure-stop \|.*\| trigger: <third-iteration-5-valid \| grandfathered-next-iteration-5-valid \| post-countermeasure-iteration-5-valid> \| reset-records:.*\| prior-countermeasure:.*\| chain-validation:.*\| status: implementation-stopped \| next: human-countermeasure-meeting/,
    );
    expect(checklist).toMatch(
      /\| countermeasure-decision \|.*\| disposition: <abandon \| split \| restart-later> \|.*\| human-approval: <durable approval ref>/,
    );
    expect(checklist).toMatch(
      /\| countermeasure-restart \|.*\| condition-evidence:.*\| activation-approval: <durable Human approval ref> \| restart-cycle: <next positive integer> \| reset-from: <latest retired-state>/,
    );
    expect(checklist).toContain("policy: three-cycle-countermeasure-stop-v1");
    expect(agentSkills).toMatch(/A split receives a new root only\s+when the Human decision/);
    expect(agentSkills).toMatch(/merge-path\s+chain enforcement remains a separate/);
    expect(skill).toMatch(
      /The next numbered cycle begins at iteration one only after\s+that record exists/,
    );
    expect(skill).toMatch(
      /every later iteration-five retirement\s+with a new valid finding triggers another stop/,
    );
  });

  it("keeps the canonical usage log record-only", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, RECORD_LOG), "# Usage log\n\ncanonical record\n");
    commitAll(root, "append canonical record");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("record-only or empty");
  });

  it("accepts a matching canonical record after a reviewable content commit", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = true;\n");
    commitAll(root, "add reviewable content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    writeFileSync(
      path.join(root, RECORD_LOG),
      [
        "# Usage log",
        "",
        `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
        "",
      ]
        .map(withRequiredModelFields)
        .join("\n"),
    );
    commitAll(root, "append exact-head canonical record");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`content head ${contentHead.slice(0, 12)}`);
  });

  it("rejects a newly added review record without the three model roles even when backdated", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = true;\n");
    commitAll(root, "add reviewable content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    writeFileSync(
      path.join(root, RECORD_LOG),
      [
        "# Usage log",
        "",
        `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
        "",
      ].join("\n"),
    );
    commitAll(root, "append backdated model-less record");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("newly added review records");
    expect(result.stderr).toContain("author-model missing");
    expect(result.stderr).toContain("review-model missing");
    expect(result.stderr).toContain("verdict-model missing");
  });

  it.each([
    [
      "duplicate field",
      "author-model: gpt-5.6-sol | author-model: claude-opus-5 | review-model: claude-opus-5 | verdict-model: gpt-5.6-sol",
      "author-model duplicated",
    ],
    [
      "template placeholder",
      "author-model: <canonical-model-id> | review-model: claude-opus-5 | verdict-model: gpt-5.6-sol",
      "author-model has placeholder value",
    ],
    [
      "empty field",
      "author-model: gpt-5.6-sol | review-model: | verdict-model: gpt-5.6-sol",
      "review-model has placeholder value ''",
    ],
    [
      "forbidden shorthand",
      "author-model: gpt-5.6-sol | review-model: claude-opus-5 | verdict-model: na",
      "verdict-model has placeholder value 'na'",
    ],
    [
      "joined placeholder",
      "author-model: gpt-5.6-sol | review-model: claude-opus-5+tbd | verdict-model: gpt-5.6-sol",
      "review-model has placeholder value 'claude-opus-5+tbd'",
    ],
    [
      "moving alias",
      "author-model: gpt-5.6-sol | review-model: opus | verdict-model: gpt-5.6-sol",
      "review-model has moving alias 'opus'",
    ],
    [
      "non-identifier filler",
      "author-model: x | review-model: claude-opus-5 | verdict-model: gpt-5.6-sol",
      "author-model has invalid model id 'x'",
    ],
  ])("rejects a newly added review record with a %s", (_label, modelFields, message) => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = true;\n");
    commitAll(root, "add reviewable content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
    const record = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | ${modelFields} | surface: content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${record}\n`);
    commitAll(root, "append invalid model attribution");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(message);
  });

  it.each([
    ["-", "invalid model id"],
    ["?", "invalid model id"],
    [".", "invalid model id"],
    ["TBD", "placeholder value"],
    ["latest", "moving alias"],
  ])("rejects the non-model filler %s", (filler, problem) => {
    const { root, base } = makeRepository();
    const dirtyHead = "d".repeat(40);
    const record = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${dirtyHead}+dirty | role: independent-subagent | author-model: ${filler} | review-model: claude-opus-5 | verdict-model: gpt-5.6-sol | surface: dirty content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: none | closeout: clean | gap: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${record}\n`);
    commitAll(root, "append invalid model filler");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`author-model has ${problem} '${filler}'`);
  });

  it.each(["deepseek-chat", "command-r-plus", "gpt-oss"])(
    "accepts the digit-free canonical model id %s",
    (reviewModel) => {
      const { root, base } = makeRepository();
      const dirtyHead = "d".repeat(40);
      const record = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${dirtyHead}+dirty | role: independent-subagent | author-model: human | review-model: ${reviewModel} | verdict-model: o3 | surface: dirty content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: none | closeout: clean | gap: none`;
      writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${record}\n`);
      commitAll(root, "append valid digit-free model attribution");

      const result = run(root, "node", [SCRIPT, "--base", base]);
      expect(result.status, result.stderr).toBe(0);
    },
  );

  it("accepts human and multiple canonical model ids", () => {
    const { root, base } = makeRepository();
    const dirtyHead = "d".repeat(40);
    const record = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${dirtyHead}+dirty | role: independent-subagent | author-model: human | review-model: claude-opus-5+gpt-5.6-sol | verdict-model: o3 | surface: dirty content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: none | closeout: clean | gap: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${record}\n`);
    commitAll(root, "append valid multi-model attribution");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("validates new records when only a merge commit exists beyond the base", () => {
    const root = mkdtempSync(path.join(tmpdir(), "lighthouse-review-closeout-"));
    temporaryRoots.push(root);
    expect(run(root, "git", ["init", "-q", "-b", "main"]).status).toBe(0);
    writeFileSync(path.join(root, "initial.txt"), "initial\n");
    commitAll(root, "initial");
    const initial = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    const recordPath = path.join(root, RECORD_LOG);
    mkdirSync(path.dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, "# Usage log\n");
    writeFileSync(
      path.join(root, DEFAULT_CHECKLIST_PATH),
      "# Default checklist\n\n### root-cause — owner checks\n\n- `root-cause-01` owner\n\n### code — code checks\n\n- `code-01` code\n- `code-99` `status: candidate` candidate\n",
    );
    commitAll(root, "base with canonical log");
    const base = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    const mergeHead = "d".repeat(40);
    const modelLessRecord = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${mergeHead}+dirty | role: independent-subagent | surface: merge resolution | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: none | closeout: clean | gap: none`;
    writeFileSync(recordPath, `# Usage log\n\n${modelLessRecord}\n`);
    expect(run(root, "git", ["add", RECORD_LOG]).status).toBe(0);
    const tree = run(root, "git", ["write-tree"]).stdout.trim();
    const merge = run(root, "git", [
      "-c",
      "user.name=Review Test",
      "-c",
      "user.email=review-test@example.com",
      "commit-tree",
      tree,
      "-p",
      base,
      "-p",
      initial,
      "-m",
      "merge-only resolution",
    ]);
    expect(merge.status, merge.stderr).toBe(0);
    expect(run(root, "git", ["reset", "--hard", "-q", merge.stdout.trim()]).status).toBe(0);

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("author-model missing");
  });

  it("treats every record as new when the base predates the canonical log", () => {
    const root = mkdtempSync(path.join(tmpdir(), "lighthouse-review-closeout-"));
    temporaryRoots.push(root);
    expect(run(root, "git", ["init", "-q", "-b", "main"]).status).toBe(0);
    writeFileSync(path.join(root, "initial.txt"), "initial\n");
    commitAll(root, "base before canonical log");
    const base = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    const recordPath = path.join(root, RECORD_LOG);
    mkdirSync(path.dirname(recordPath), { recursive: true });
    writeFileSync(
      path.join(root, DEFAULT_CHECKLIST_PATH),
      "# Default checklist\n\n### root-cause — owner checks\n\n- `root-cause-01` owner\n\n### code — code checks\n\n- `code-01` code\n- `code-99` `status: candidate` candidate\n",
    );
    const modelLessRecord = `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${base} | role: independent-subagent | surface: historical content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: historical test | closeout: clean | gap: none`;
    writeFileSync(recordPath, `# Usage log\n\n${modelLessRecord}\n`);
    commitAll(root, "introduce canonical log without model fields");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("author-model missing");
  });

  it("rejects a model-less dirty review record in a record-only commit", () => {
    const { root, base } = makeRepository();
    const dirtyHead = "d".repeat(40);
    const dirtyRecord = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${dirtyHead}+dirty | role: independent-subagent | surface: dirty content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: none | closeout: clean | gap: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${dirtyRecord}\n`);
    commitAll(root, "append model-less dirty record only");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("newly added review records");
    expect(result.stderr).toContain(`head ${dirtyHead.slice(0, 12)}`);
  });

  it.each(["duplicate", "modified"])(
    "treats a %s legacy line as a newly added record",
    (changeKind) => {
      const { root } = makeRepository();
      const legacyHead = "a".repeat(40);
      const legacyRecord = `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${legacyHead} | role: independent-subagent | surface: historical content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: historical test | closeout: clean | gap: none`;
      writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${legacyRecord}\n`);
      commitAll(root, "add legacy base record");
      const base = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

      const changedRecord =
        changeKind === "duplicate"
          ? `${legacyRecord}\n${legacyRecord}`
          : legacyRecord.replace("surface: historical content", "surface: modified history");
      writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${changedRecord}\n`);
      commitAll(root, `${changeKind} legacy record`);

      const result = run(root, "node", [SCRIPT, "--base", base]);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("author-model missing");
    },
  );

  it("accepts a required model field in the final record position", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = true;\n");
    commitAll(root, "add reviewable content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
    const record = `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | author-model: gpt-5.6-sol | review-model: claude-opus-5 | surface: content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none | verdict-model: gpt-5.6-sol`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${record}\n`);
    commitAll(root, "append final-position model attribution");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("preserves an unchanged legacy base record without model roles", () => {
    const { root } = makeRepository();
    const legacyHead = "0".repeat(40);
    const legacyRecord = `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${legacyHead} | role: independent-subagent | surface: historical content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: historical test | closeout: clean | gap: none`;
    writeFileSync(path.join(root, RECORD_LOG), `# Usage log\n\n${legacyRecord}\n`);
    commitAll(root, "add legacy base record");
    const base = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    writeFileSync(path.join(root, "content.ts"), "export const reviewed = true;\n");
    commitAll(root, "add reviewable content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
    const currentRecord = withRequiredModelFields(
      `2026-07-25T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: current content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
    );
    writeFileSync(
      path.join(root, RECORD_LOG),
      `# Usage log\n\n${legacyRecord}\n${currentRecord}\n`,
    );
    commitAll(root, "append current model-attributed record");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`content head ${contentHead.slice(0, 12)}`);
  });

  it("accepts procedural and design metadata without changing exact-head semantics", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = true;\n");
    commitAll(root, "add reviewable content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
    const retiredStateOne = "1".repeat(40);
    const retiredStateTwo = "2".repeat(40);
    const retiredStateThree = "3".repeat(40);

    writeFileSync(
      path.join(root, RECORD_LOG),
      [
        "# Usage log",
        "",
        `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: implementation-author | surface: content | applied: root-cause | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
        `2026-07-20T06:10 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: content | applied: root-cause | excluded: none | round: exact-head-certification | reason: semantic-drift:retry-policy | cluster: retry-policy | sweep: owner docs/runtime-flow and tests; excluded dated reviews | hit: none | findings: valid 0, invalid 0, already-fixed 1, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
        `2026-07-23T14:15 | design-reset | record-id: retry-cycle-1-reset | repo: jaeyoungkang/lighthouse | workstream: retry-policy | workstream-root: repo:jaeyoungkang/lighthouse#issue:485 | retired-cycle: 1 | retired-state: ${retiredStateOne} | retired-ref: refs/heads/forensic/retry-policy-cycle-1 | trigger: iteration-5-valid | compatibility: branch-only-code@review-branch=remove | preserved: retry requirements and counterexamples | discarded: retired retry helper and implementation-shaped tests | cause: retry ownership was split | replacement-owner: canonical runtime flow | validation: remote retired commit, matching iteration-five record, compatibility, and scope audit`,
        `2026-07-23T14:15 | design-reset | record-id: retry-cycle-2-reset | repo: jaeyoungkang/lighthouse | workstream: retry-policy | workstream-root: repo:jaeyoungkang/lighthouse#issue:485 | retired-cycle: 2 | retired-state: ${retiredStateTwo} | retired-ref: refs/heads/forensic/retry-policy-cycle-2 | trigger: iteration-5-valid | compatibility: branch-only-code@review-branch=remove | preserved: retry requirements and counterexamples | discarded: retired retry helper and implementation-shaped tests | cause: retry ownership was split | replacement-owner: canonical runtime flow | validation: remote retired commit, matching iteration-five record, compatibility, and scope audit`,
        `2026-07-23T14:15 | design-reset | record-id: retry-cycle-3-reset | repo: jaeyoungkang/lighthouse | workstream: retry-policy | workstream-root: repo:jaeyoungkang/lighthouse#issue:485 | retired-cycle: 3 | retired-state: ${retiredStateThree} | retired-ref: refs/heads/forensic/retry-policy-cycle-3 | trigger: iteration-5-valid | compatibility: branch-only-code@review-branch=remove | preserved: retry requirements and counterexamples | discarded: retired retry helper and implementation-shaped tests | cause: retry ownership was split | replacement-owner: canonical runtime flow | validation: remote retired commit, matching iteration-five record, compatibility, and scope audit`,
        `2026-07-23T14:16 | countermeasure-stop | record-id: retry-stop | repo: jaeyoungkang/lighthouse | workstream: retry-policy | workstream-root: repo:jaeyoungkang/lighthouse#issue:485 | trigger: third-iteration-5-valid | reset-records: retry-cycle-1-reset, retry-cycle-2-reset, retry-cycle-3-reset | chain-validation: cycle 1 through 3 iteration-five records and reset-from links | status: implementation-stopped | next: human-countermeasure-meeting`,
        `2026-07-23T14:17 | countermeasure-decision | record-id: retry-decision | repo: jaeyoungkang/lighthouse | workstream-root: repo:jaeyoungkang/lighthouse#issue:485 | stop-record: retry-stop | convergence-failure: retry ownership stayed split | recurring-causes: retry ownership stayed split | options-considered: abandon, split, change ownership, restart | disposition: restart-later | countermeasures: assign one retry owner | cause-action-owners: split ownership=consolidate@runtime-owner | restart-conditions: owner boundary review passes | child-workstreams: none | human-approval: issue-485-comment`,
        `2026-07-23T14:18 | countermeasure-restart | record-id: retry-restart | repo: jaeyoungkang/lighthouse | workstream-root: repo:jaeyoungkang/lighthouse#issue:485 | stop-record: retry-stop | decision-record: retry-decision | condition-evidence: owner boundary=review-485 | activation-approval: issue-485-comment-2 | restart-cycle: 4 | reset-from: ${retiredStateThree}`,
        `2026-07-23T14:20 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: content | workstream: retry-policy | workstream-root: repo:jaeyoungkang/lighthouse#issue:485 | applied: root-cause | excluded: none | round: exact-head-certification | design-cycle: 4 | iteration: 1 | reset-from: ${retiredStateThree} | countermeasure-from: retry-restart | reason: countermeasure-restart:retry-policy | cluster: retry-policy | sweep: canonical owner and replacement tests; excluded retired implementation | hit: none | findings: valid 0, invalid 0, already-fixed 1, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
        "",
      ]
        .map(withRequiredModelFields)
        .join("\n"),
    );
    commitAll(root, "append legacy and design metadata review records");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`content head ${contentHead.slice(0, 12)}`);
  });

  it("still rejects valid findings in an Issue #441 metadata record", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = false;\n");
    commitAll(root, "add content with semantic drift");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    writeFileSync(
      path.join(root, RECORD_LOG),
      [
        "# Usage log",
        "",
        `2026-07-20T06:10 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: implementation-author | surface: content | applied: root-cause | excluded: none | round: discovery-sweep | reason: semantic-drift:retry-policy | cluster: retry-policy | sweep: owner docs/runtime-flow and tests; excluded dated reviews | hit: root-cause-06: adjacent drift remains | findings: valid 1, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
        "",
      ]
        .map(withRequiredModelFields)
        .join("\n"),
    );
    commitAll(root, "record unresolved metadata review");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("closeout=clean, valid findings=1");
  });

  it("rejects a matching record that explicitly leaves findings", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = false;\n");
    commitAll(root, "add content with an open finding");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    writeFileSync(
      path.join(root, RECORD_LOG),
      [
        "# Usage log",
        "",
        `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: content | applied: code | excluded: none | hit: code-01: unresolved defect | findings: valid 1, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: findings remain | gap: none`,
        "",
      ]
        .map(withRequiredModelFields)
        .join("\n"),
    );
    commitAll(root, "record unresolved finding");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("closeout=findings remain, valid findings=1");
  });

  it("uses the latest matching record when a later review closes findings", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = true;\n");
    commitAll(root, "add reviewed content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    writeFileSync(
      path.join(root, RECORD_LOG),
      [
        "# Usage log",
        "",
        `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: implementation-author | surface: content | applied: code | excluded: none | hit: code-01: fixed defect | findings: valid 1, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: findings remain | gap: none`,
        `2026-07-19T06:10 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 1, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
        "",
      ]
        .map(withRequiredModelFields)
        .join("\n"),
    );
    commitAll(root, "record clean follow-up review");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status, result.stderr).toBe(0);
  });

  it("rejects a later non-clean record for the same head", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = false;\n");
    commitAll(root, "add reviewed content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    writeFileSync(
      path.join(root, RECORD_LOG),
      [
        "# Usage log",
        "",
        `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: implementation-author | surface: content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
        `2026-07-20T06:10 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: content | applied: root-cause, code | excluded: none | round: exact-head-certification | reason: scope-reopened:retry-policy | cluster: retry-policy | sweep: owner docs/runtime-flow and tests; excluded dated reviews | hit: root-cause-06: newly found semantic drift | findings: valid 1, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: findings remain | gap: none`,
        "",
      ]
        .map(withRequiredModelFields)
        .join("\n"),
    );
    commitAll(root, "record later unresolved finding");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("closeout=findings remain, valid findings=1");
  });

  it("fails closed when the latest same-head record is malformed", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = false;\n");
    commitAll(root, "add reviewed content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    writeFileSync(
      path.join(root, RECORD_LOG),
      [
        "# Usage log",
        "",
        `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: implementation-author | surface: content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
        `2026-07-19T06:10 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: content | applied: code | excluded: none | hit: code-01: newly found defect | findings: valid 1, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | gap: closeout field accidentally omitted`,
        "",
      ]
        .map(withRequiredModelFields)
        .join("\n"),
    );
    commitAll(root, "append malformed latest review record");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Latest matching record is malformed");
  });

  it("does not read archive records as closeout authority", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = true;\n");
    commitAll(root, "add reviewable content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    const archivePath = path.join(root, ARCHIVE_LOG);
    mkdirSync(path.dirname(archivePath), { recursive: true });
    writeFileSync(
      archivePath,
      [
        "# Historical archive",
        "",
        `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: old content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: none | closeout: clean | gap: none`,
        "",
      ]
        .map(withRequiredModelFields)
        .join("\n"),
    );
    commitAll(root, "add archive record and manifest");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("stale or unreviewed");
    expect(result.stderr).toContain("No parseable review records found");
  });

  it("treats an archive commit as new reviewable content", () => {
    const { root, base } = makeRepository();
    writeFileSync(path.join(root, "content.ts"), "export const reviewed = true;\n");
    commitAll(root, "add reviewable content");
    const contentHead = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();

    writeFileSync(
      path.join(root, RECORD_LOG),
      [
        "# Usage log",
        "",
        `2026-07-19T06:00 | repo: jaeyoungkang/lighthouse | pr: local | head: ${contentHead} | role: independent-subagent | surface: content | applied: code | excluded: none | hit: none | findings: valid 0, invalid 0, already-fixed 0, duplicate 0, needs-human 0 | validation: targeted test | closeout: clean | gap: none`,
        "",
      ]
        .map(withRequiredModelFields)
        .join("\n"),
    );
    commitAll(root, "append exact-head canonical record");

    const archivePath = path.join(root, ARCHIVE_LOG);
    mkdirSync(path.dirname(archivePath), { recursive: true });
    writeFileSync(archivePath, "# Historical archive\n\nmanifest changed\n");
    commitAll(root, "change archive manifest");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("stale or unreviewed");
  });

  it("treats a generated runtime-copy log change as reviewable content", () => {
    const { root, base } = makeRepository();
    const generatedLog = path.join(
      root,
      ".agents/skills/review-checklist-steward/references/checklist-usage-log.md",
    );
    mkdirSync(path.dirname(generatedLog), { recursive: true });
    writeFileSync(generatedLog, "generated copy mutation\n");
    commitAll(root, "change generated runtime copy");

    const result = run(root, "node", [SCRIPT, "--base", base]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("stale or unreviewed");
  });
});
