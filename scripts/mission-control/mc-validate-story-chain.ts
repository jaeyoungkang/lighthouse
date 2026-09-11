// mc:validate-story-chain — the chain validator. Loads the Story Chain
// (Intent Weaving) under `docs/contracts/story-chain/` and runs the
// graph-wide validator. Throws StoryChainParseError on the first
// inconsistency; prints a summary on success.
//
// Story Chain is the canonical chain authority; this validator is the single
// chain gate.
//
// Usage:
//   tsx scripts/mission-control/mc-validate-story-chain.ts            # full audit
//   tsx scripts/mission-control/mc-validate-story-chain.ts --staged   # only run if staged files affect the chain

import { spawnSync } from "node:child_process";
import path from "node:path";

import { loadStoryChain } from "@/app/server/services/story-chain/loader";
import { validateStoryChain } from "@/app/server/services/story-chain/validator";

const STAGED_TRIGGERS = [
  "docs/contracts/story-chain/",
  "app/server/services/story-chain/",
  "app/domain/story-chain.ts",
  "scripts/mission-control/mc-validate-story-chain.ts",
];

const stagedOnly = process.argv.includes("--staged");

if (stagedOnly) {
  const staged = spawnSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf8",
  });
  const stagedFiles = staged.stdout.split("\n").filter((f) => f.length > 0);
  const affectsChain = stagedFiles.some((f) =>
    STAGED_TRIGGERS.some((trigger) => f.startsWith(trigger)),
  );
  if (!affectsChain) {
    process.stdout.write(
      "mc:validate-story-chain — no staged files affect the new chain. skipping.\n",
    );
    process.exit(0);
  }
  process.stdout.write(
    "mc:validate-story-chain — staged files affect new chain. running full audit.\n",
  );
}

const repoRoot = path.resolve(__dirname, "..", "..");

try {
  const chain = loadStoryChain(repoRoot);
  const summary = validateStoryChain(chain);
  process.stdout.write("mc:validate-story-chain — Story Chain green\n");
  const lines = [
    `  scenarios    ${String(summary.scenarioCount).padStart(3)}`,
    `  experiences  ${String(summary.experienceCount).padStart(3)}`,
    `  moments      ${String(summary.momentCount).padStart(3)}`,
    `  promises     ${String(summary.promiseCount).padStart(3)}` +
      `   met=${String(summary.promisesByVerdict.met)}` +
      `  unknown=${String(summary.promisesByVerdict.unknown)}` +
      `  not-met=${String(summary.promisesByVerdict["not-met"])}`,
    `  aspects      ${String(summary.aspectCount).padStart(3)}`,
    `  evidence ledgers ${String(summary.evidenceLedgerCount).padStart(3)}` +
      `   explicit=${String(summary.explicitIntentLedgerCount)}` +
      ` · absorbed=${String(summary.absorbedIntentLedgerCount)}` +
      ` · delegated=${String(summary.delegatedIntentLedgerCount)}` +
      `   met=${String(summary.ledgersByVerdict.met)}` +
      `  unknown=${String(summary.ledgersByVerdict.unknown)}` +
      `  not-met=${String(summary.ledgersByVerdict["not-met"])}`,
    `  cardinality relations ${String(summary.traceabilityRelationCount).padStart(3)}`,
    "",
  ];
  process.stdout.write(lines.join("\n"));
  process.exit(0);
} catch (err) {
  if (err instanceof Error) {
    process.stderr.write(`mc:validate-story-chain — FAIL\n  ${err.message}\n`);
  } else {
    process.stderr.write(`mc:validate-story-chain — FAIL\n  ${String(err)}\n`);
  }
  process.exit(1);
}
