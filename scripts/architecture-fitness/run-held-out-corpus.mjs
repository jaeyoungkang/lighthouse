#!/usr/bin/env node
// Held-out mutation corpus runner (issue #318).
//
// Verifies that the active Q1 profiles reject a FROZEN corpus of bypass
// mutations and close collector/verifier failures deterministically. The
// corpus was authored from the PR #308 escape classes, independently of the
// fixtures used to develop the collectors and guards, and must stay held-out:
// do not copy corpus cases into the built-in negative-mutation suites or the
// guard dev tests. Rotation rule: docs/architecture-fitness/README.md
// § Held-out mutation corpus.

import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CORPUS_PATH = path.join(REPO, "docs/architecture-fitness/pilots/held-out/corpus.json");
const HELD_OUT_DIR = path.dirname(CORPUS_PATH);
const CORE_SCRIPTS = path.join(REPO, ".agents/skills/architecture-fitness-review/scripts");

// Frozen corpus digest. A mismatch means the corpus changed without a
// rotation: bump corpusVersion, archive the previous corpus under
// held-out-archive/, and update this constant in the same change.
const EXPECTED_CORPUS_SHA256 = "d839aaf60563458be4a56df40734202d7037a1560ff51248c57f2c0b2e9a5a66";

// Local, non-authoritative signing key for NC-5. Self-issued HMAC never
// produces an authority verdict; the runner only asserts evaluator semantics.
const LOCAL_KEY = "held-out-corpus-non-authoritative-local-key-0001";

const { runLeastAuthorityBoundaryGuard } = await import(
  path.join(REPO, "scripts/architecture-fitness/check-least-authority-boundaries.mjs")
);
const { runSearchStateBoundaryGuard } = await import(
  path.join(REPO, "scripts/architecture-fitness/check-search-state-boundaries.mjs")
);

const guards = {
  "issue-278-least-authority": async (root) => {
    const result = await runLeastAuthorityBoundaryGuard({ root });
    return result.violations.map((item) => ({
      rule: item.rule,
      file: item.file,
      detail: item.detail,
    }));
  },
  "issue-276-search-state-boundary": async (root) => {
    const result = await runSearchStateBoundaryGuard({ root });
    return result.violations.flatMap((item) =>
      item.errors.map((error) => ({ rule: item.rule, file: item.file, detail: error })),
    );
  },
};

let failed = 0;
const report = (ok, label, extra = "") => {
  if (!ok) failed += 1;
  console.log(`[${ok ? "ok" : "FAIL"}] ${label}${extra ? ` — ${extra}` : ""}`);
};

const corpusBytes = await readFile(CORPUS_PATH);
const corpusDigest = createHash("sha256").update(corpusBytes).digest("hex");
if (corpusDigest !== EXPECTED_CORPUS_SHA256) {
  console.error(
    `held-out corpus digest mismatch: expected ${EXPECTED_CORPUS_SHA256} observed ${corpusDigest}.\n` +
      "The corpus is frozen. To rotate: bump corpusVersion, archive the previous file under " +
      "docs/architecture-fitness/pilots/held-out-archive/, and update EXPECTED_CORPUS_SHA256 " +
      "in the same change (README § Held-out mutation corpus).",
  );
  process.exit(1);
}
const corpus = JSON.parse(corpusBytes.toString("utf8"));
if (corpus.previousCorpus) {
  const archivedCorpusPath = path.join(REPO, corpus.previousCorpus);
  const archivedCorpusDigest = createHash("sha256")
    .update(await readFile(archivedCorpusPath))
    .digest("hex");
  if (archivedCorpusDigest !== corpus.previousCorpusSha256) {
    console.error(
      `held-out archive digest mismatch: expected ${corpus.previousCorpusSha256} observed ${archivedCorpusDigest}.`,
    );
    process.exit(1);
  }
}

async function materialize() {
  const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-heldout-corpus-"));
  for (const entry of [
    "app",
    "proxy.ts",
    "instrumentation-client.ts",
    "tsconfig.json",
    "next-env.d.ts",
    "package.json",
    "package-lock.json",
  ]) {
    await cp(path.join(REPO, entry), path.join(root, entry), { recursive: true });
  }
  await symlink(path.join(REPO, "node_modules"), path.join(root, "node_modules"), "dir");
  return root;
}

function runPython(script, args, { env = {} } = {}) {
  return spawnSync("python3", ["-B", path.join(CORE_SCRIPTS, script), ...args], {
    cwd: REPO,
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
  });
}

function runCollector(collector, policyPath, outputPath) {
  return spawnSync(
    "node",
    [
      path.join(REPO, collector),
      "--policy",
      policyPath,
      "--revision",
      "HEAD",
      "--run-ref",
      "held-out-corpus-nc",
      "--output",
      outputPath,
    ],
    { cwd: REPO, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
}

async function bindFrozenObservationToCurrentPolicy(policyPath, fixturePath, outputPath) {
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const observation = JSON.parse(await readFile(fixturePath, "utf8"));
  const authority = policy.policySet?.collectorAuthority;
  const collector = observation.collector;
  if (
    !authority ||
    !collector ||
    observation.policySetRef !== policy.policySet.id ||
    collector.adapterRef !== authority.adapterRef ||
    collector.id !== authority.id ||
    collector.attestorRef !== authority.attestorRef
  ) {
    throw new Error(
      "frozen observation stable policy/collector identity drifted; rotate the corpus instead of rebinding it",
    );
  }

  observation.policySetVersion = policy.policySet.version;
  collector.version = authority.version;
  collector.scope = authority.scope;
  collector.definitionDigest = authority.definitionDigest;
  await writeFile(outputPath, `${JSON.stringify(observation, null, 2)}\n`, "utf8");
}

const root = await materialize();
const tmp = await mkdtemp(path.join(os.tmpdir(), "lighthouse-heldout-nc-"));
try {
  // Healthy baseline: both guards must report zero violations on the
  // unmutated tree, otherwise mutation rejections prove nothing.
  for (const [profile, run] of Object.entries(guards)) {
    const healthy = await run(root);
    report(healthy.length === 0, `healthy baseline ${profile}`, `${healthy.length} violations`);
    if (healthy.length > 0) console.log(JSON.stringify(healthy, null, 1).slice(0, 1500));
  }

  // Frozen mutation cases: apply one at a time, require the expected rule.
  for (const mutation of corpus.mutationCases) {
    const file = path.join(root, mutation.relative);
    const original = await readFile(file, "utf8");
    const occurrences = original.split(mutation.before).length - 1;
    if (occurrences !== 1) {
      report(false, mutation.id, `before-anchor occurrences=${occurrences} (expected 1)`);
      continue;
    }
    try {
      await writeFile(file, original.replace(mutation.before, mutation.after), "utf8");
      const violations = await guards[mutation.profile](root);
      const hit = violations.filter((item) => item.rule === mutation.rule);
      report(hit.length > 0, mutation.id, `rule=${mutation.rule} matches=${hit.length}`);
      if (hit.length === 0) {
        console.log("  violations:", JSON.stringify(violations, null, 1).slice(0, 1500));
      }
    } finally {
      await writeFile(file, original, "utf8");
    }
  }

  // Negative controls: collector/verifier failures must close
  // deterministically (degraded/unknown/fail-closed), never as an uncaught
  // exception or a false healthy.
  for (const control of corpus.negativeControls) {
    if (control.kind === "malformed-tsconfig") {
      const tsconfig = path.join(root, "tsconfig.json");
      const original = await readFile(tsconfig, "utf8");
      try {
        await writeFile(tsconfig, "{ malformed", "utf8");
        const result = await runSearchStateBoundaryGuard({ root });
        const facts = result.facts ?? {};
        const inventoryClosed =
          facts["url-to-execution-projection"] === false &&
          facts["canonical-ephemeral-view-identity"] === false &&
          facts["route-owned-result-snapshot"] === false;
        const sharedError = result.violations.some((item) =>
          item.errors.some((error) => error.includes("production inventory failed")),
        );
        report(
          result.ok === false &&
            inventoryClosed &&
            sharedError &&
            facts["url-condition-authority"] === true,
          control.id,
        );
      } catch (error) {
        report(false, control.id, `threw instead of degrading: ${error.message}`);
      } finally {
        await writeFile(tsconfig, original, "utf8");
      }
    } else if (control.kind === "missing-target-file") {
      const target = path.join(root, control.target);
      const original = await readFile(target, "utf8");
      try {
        await unlink(target);
        const result = await runSearchStateBoundaryGuard({ root });
        const missing = (result.missing ?? []).includes(control.target);
        const ruleError = result.violations.some(
          (item) =>
            item.rule === "canonical-ephemeral-view-identity" &&
            item.errors.some((error) => error.includes("identity constant source missing")),
        );
        report(result.ok === false && missing && ruleError, control.id);
      } catch (error) {
        report(false, control.id, `threw instead of degrading: ${error.message}`);
      } finally {
        await writeFile(target, original, "utf8");
      }
    } else if (control.kind === "tampered-policy-digest") {
      const policy = JSON.parse(await readFile(path.join(REPO, control.policy), "utf8"));
      policy.policySet.collectorAuthority.definitionDigest = "0".repeat(64);
      const policyPath = path.join(tmp, "tampered-digest.policy.json");
      const outputPath = path.join(tmp, "tampered-digest.observation.json");
      await writeFile(policyPath, JSON.stringify(policy), "utf8");
      const result = runCollector(control.collector, policyPath, outputPath);
      report(
        result.status === 1 &&
          `${result.stderr}`.includes("collector definition digest mismatch") &&
          !existsSync(outputPath),
        control.id,
        `exit=${result.status}`,
      );
    } else if (control.kind === "malformed-policy-json") {
      const policyPath = path.join(tmp, "malformed.policy.json");
      const outputPath = path.join(tmp, "malformed.observation.json");
      await writeFile(policyPath, "{ malformed", "utf8");
      const result = runCollector(control.collector, policyPath, outputPath);
      report(result.status !== 0 && !existsSync(outputPath), control.id, `exit=${result.status}`);
    } else if (control.kind === "observation-validate") {
      const result = runPython("evaluate.py", [
        "--policy",
        path.join(REPO, control.policy),
        "--observation",
        path.join(HELD_OUT_DIR, control.fixture),
        "--validate-only",
      ]);
      const output = `${result.stdout}\n${result.stderr}`;
      report(
        result.status === control.expectExit && output.includes(control.expectMessage),
        control.id,
        `exit=${result.status}`,
      );
    } else if (control.kind === "frozen-observation-evaluate") {
      const policyPath = path.join(REPO, control.policy);
      const reboundPath = path.join(tmp, `${control.id}.rebound.json`);
      const signedPath = path.join(tmp, `${control.id}.signed.json`);
      const assessmentPath = path.join(tmp, `${control.id}.assessment.json`);
      try {
        await bindFrozenObservationToCurrentPolicy(
          policyPath,
          path.join(HELD_OUT_DIR, control.fixture),
          reboundPath,
        );
      } catch (error) {
        report(false, control.id, `rebind failed: ${error.message}`);
        continue;
      }
      const attest = runPython(
        "attest.py",
        ["--policy", policyPath, "--observation", reboundPath, "--output", signedPath],
        { env: { ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1: LOCAL_KEY } },
      );
      if (attest.status !== 0) {
        report(false, control.id, `attest exit=${attest.status} ${attest.stderr}`.slice(0, 300));
        continue;
      }
      const evaluate = runPython(
        "evaluate.py",
        ["--policy", policyPath, "--observation", signedPath, "--output", assessmentPath],
        { env: { ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1: LOCAL_KEY } },
      );
      const assessment = existsSync(assessmentPath) ? await readFile(assessmentPath, "utf8") : "";
      report(
        evaluate.status === control.expectExit && assessment.includes(control.expectFinding),
        control.id,
        `exit=${evaluate.status} (expected ${control.expectExit})`,
      );
    } else {
      report(false, control.id, `unknown control kind: ${control.kind}`);
    }
  }
} finally {
  await rm(root, { recursive: true, force: true });
  await rm(tmp, { recursive: true, force: true });
}

console.log(
  failed === 0
    ? `held-out corpus: all ${corpus.mutationCases.length} mutations rejected, all ${corpus.negativeControls.length} negative controls closed deterministically (corpus v${corpus.corpusVersion}).`
    : `held-out corpus: ${failed} case(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);
