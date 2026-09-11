#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { runRelationshipStateBoundaryGuard } from "./check-relationship-state-boundaries.mjs";
import {
  createSearchStateBoundaryAnalysis,
  runSearchStateBoundaryGuard,
} from "./check-search-state-boundaries.mjs";

const SURFACES = new Set(["all", "search", "relationship"]);
const DEFAULT_DEPENDENCIES = {
  createAnalysis: createSearchStateBoundaryAnalysis,
  runSearch: runSearchStateBoundaryGuard,
  runRelationship: runRelationshipStateBoundaryGuard,
};

export async function runStateBoundaryGuard(
  { root = process.cwd(), surface = "all" } = {},
  dependencies = DEFAULT_DEPENDENCIES,
) {
  if (!SURFACES.has(surface)) throw new Error(`Unknown state-boundary surface: ${surface}`);

  let analysis;
  try {
    analysis = await dependencies.createAnalysis(root);
  } catch {
    // Each surface guard owns a declared-source fallback that preserves
    // structured diagnostics when the shared production inventory cannot load.
  }
  const results = {};
  if (surface === "all" || surface === "search") {
    results.search = await dependencies.runSearch({ root, analysis });
  }
  if (surface === "all" || surface === "relationship") {
    const sharedResult = results.search ?? (await dependencies.runSearch({ root, analysis }));
    results.relationship = await dependencies.runRelationship({
      root,
      analysis,
      sharedResult,
    });
  }
  return {
    ok: Object.values(results).every((result) => result.ok),
    results,
  };
}

function parseSurface(argv) {
  const surfaceArgument = argv.find((value) => value.startsWith("--surface="));
  return surfaceArgument ? surfaceArgument.slice("--surface=".length) : "all";
}

async function main() {
  const result = await runStateBoundaryGuard({ surface: parseSurface(process.argv.slice(2)) });
  if (!result.ok) {
    console.error("[architecture-fitness:state-boundaries] declared boundary drift:");
    for (const [surface, surfaceResult] of Object.entries(result.results)) {
      for (const file of surfaceResult.missing) console.error(`- ${surface}: missing ${file}`);
      for (const violation of surfaceResult.violations) {
        console.error(`- ${surface}/${violation.rule}: ${violation.file}`);
        for (const error of violation.errors) console.error(`  ${error}`);
      }
    }
    process.exit(1);
  }
  console.log(
    `[architecture-fitness:state-boundaries] OK (${Object.keys(result.results).join("+")}; one shared production analysis).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
