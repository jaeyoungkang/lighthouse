#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const IMPACT_VALUES = new Set(["none", "declared"]);
const CAIR_VALUES = new Set(["none", "constrain-existing", "reshape"]);
const DECISION_ROOTS = new Set(["promise", "architectureNeed", "mixed", "uncertain"]);

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function evaluateImpactDeclaration({ changedPaths, declaration, adapter }) {
  const normalized = changedPaths.map((value) => value.split(path.sep).join("/"));
  const matches = [];
  for (const hint of adapter.sensitivePathHints ?? []) {
    const paths = normalized.filter((value) =>
      (hint.prefixes ?? []).some((prefix) => value === prefix || value.startsWith(`${prefix}/`)),
    );
    if (paths.length > 0) matches.push({ id: hint.id, paths });
  }

  const findings = [];
  if (!declaration) {
    if (matches.length > 0) {
      findings.push({
        id: "architecture-impact:missing-declaration",
        severity: "advisory",
        message: "Sensitive architecture paths changed without architectureImpact declaration.",
        hintRefs: matches.map((item) => item.id),
      });
    }
  } else {
    if (!IMPACT_VALUES.has(declaration.architectureImpact)) {
      findings.push({
        id: "architecture-impact:unsupported-value",
        severity: "advisory",
        message: "architectureImpact must be none or declared.",
      });
    }
    if (!DECISION_ROOTS.has(declaration.decisionRoot)) {
      findings.push({
        id: "architecture-impact:missing-decision-root",
        severity: "advisory",
        message:
          "decisionRoot must stay separate as promise, architectureNeed, mixed, or uncertain.",
      });
    }
    if (!CAIR_VALUES.has(declaration.cairVerdict)) {
      findings.push({
        id: "architecture-impact:missing-cair-verdict",
        severity: "advisory",
        message: "The canonical CAIR verdict must remain none, constrain-existing, or reshape.",
      });
    }
    if (declaration.architectureImpact === "none" && !nonEmpty(declaration.rationale)) {
      findings.push({
        id: "architecture-impact:none-without-rationale",
        severity: "advisory",
        message: "architectureImpact none requires existing-boundary rationale.",
      });
    }
    if (declaration.architectureImpact === "declared" && !nonEmpty(declaration.recordRef)) {
      findings.push({
        id: "architecture-impact:declared-without-record",
        severity: "advisory",
        message: "architectureImpact declared requires a durable CAIR recordRef.",
      });
    }
  }

  return {
    schemaVersion: "1",
    architectureImpact: declaration?.architectureImpact ?? "missing",
    cairVerdict: declaration?.cairVerdict ?? null,
    decisionRoot: declaration?.decisionRoot ?? null,
    sensitiveMatches: matches,
    findings,
    advisory: true,
  };
}

function parseArgs(argv) {
  const args = { base: "origin/main", head: "HEAD", declaration: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--base") args.base = argv[++index];
    else if (value === "--head") args.head = argv[++index];
    else if (value === "--declaration") args.declaration = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const adapter = JSON.parse(
    await readFile("docs/architecture-fitness/lighthouse.adapter.json", "utf8"),
  );
  const declaration = args.declaration
    ? JSON.parse(await readFile(args.declaration, "utf8"))
    : null;
  const output = execFileSync("git", ["diff", "--name-only", args.base, args.head], {
    encoding: "utf8",
  });
  const changedPaths = output.split("\n").filter(Boolean);
  process.stdout.write(
    `${JSON.stringify(evaluateImpactDeclaration({ changedPaths, declaration, adapter }), null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
