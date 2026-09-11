#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function inspectObservationPublication(observation) {
  const failures = [];

  if (observation?.schemaVersion !== "2") {
    failures.push("schemaVersion is not 2");
  }
  if (observation?.kind !== "architecture-fitness-observation") {
    failures.push("kind is not architecture-fitness-observation");
  }
  for (const field of [
    "serviceId",
    "policySetRef",
    "policySetVersion",
    "policyDigest",
    "revision",
  ]) {
    if (typeof observation?.[field] !== "string" || observation[field].length === 0) {
      failures.push(`${field} is missing`);
    }
  }
  for (const field of ["id", "version", "definitionDigest", "runRef", "command"]) {
    if (
      typeof observation?.collector?.[field] !== "string" ||
      observation.collector[field].length === 0
    ) {
      failures.push(`collector.${field} is missing`);
    }
  }
  if (!Array.isArray(observation?.observations) || observation.observations.length === 0) {
    failures.push("observations are missing");
  } else {
    for (const item of observation.observations) {
      if (item?.completeness !== "complete") {
        failures.push(
          `observation ${String(item?.id ?? "<unknown>")} completeness=${String(item?.completeness)}`,
        );
      }
    }
  }
  if (!Array.isArray(observation?.evidence) || observation.evidence.length === 0) {
    failures.push("evidence is missing");
  } else {
    for (const item of observation.evidence) {
      const id = String(item?.id ?? "<unknown>");
      if (item?.commandExitCode !== 0) {
        failures.push(`evidence ${id} commandExitCode=${String(item?.commandExitCode)}`);
      }
      if (item?.reproducible !== true) {
        failures.push(`evidence ${id} declared reproducible=${String(item?.reproducible)}`);
      }
    }
  }

  return {
    publishable: failures.length === 0,
    failures,
  };
}

export async function checkObservationFiles(paths) {
  const results = [];
  for (const inputPath of paths) {
    const absolutePath = path.resolve(inputPath);
    const observation = JSON.parse(await readFile(absolutePath, "utf8"));
    results.push({
      path: inputPath,
      ...inspectObservationPublication(observation),
    });
  }
  return results;
}

function parseArgs(argv) {
  const paths = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--observation" && argv[index + 1]) {
      paths.push(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`unknown or incomplete argument: ${argv[index]}`);
  }
  if (paths.length === 0) {
    throw new Error("at least one --observation <path> is required");
  }
  return paths;
}

async function main() {
  try {
    const results = await checkObservationFiles(parseArgs(process.argv.slice(2)));
    const failures = results.filter((result) => !result.publishable);
    if (failures.length === 0) {
      console.log(
        `architecture-fitness observation publication — ${String(results.length)} artifact(s) complete with successful evidence exits and declared reproducibility. PASS.`,
      );
      return;
    }
    for (const result of failures) {
      console.error(`architecture-fitness observation publication — FAIL: ${result.path}`);
      for (const failure of result.failures) console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } catch (error) {
    console.error(
      `architecture-fitness observation publication — FAIL: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
