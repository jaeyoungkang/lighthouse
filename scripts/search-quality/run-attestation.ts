import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  buildSearchQualityEvidenceCandidate,
  searchQualityEvidenceInvocationFromEnvironment,
  selfCheckSearchQualityEvidenceCandidate,
  type RawSearchQualityReportInput,
} from "./attestation";
import { parseSearchQualityEvaluationSet } from "./contract";

const usage = `Light House synthetic search-quality candidate evidence

Usage:
  npm run search-quality:build-candidate -- --set <set.json> --manifest <manifest.json> --output <bundle.json>
  npm run search-quality:self-check -- --set <set.json> --manifest <manifest.json> --bundle <bundle.json> --output <verification.json>

The manifest and raw load-smoke v5 reports remain runner-local. Only the aggregate bundle and verification output may be uploaded.`;

const manifestSchema = z
  .object({
    reports: z
      .array(
        z.object({ queryId: z.string().trim().min(1), path: z.string().trim().min(1) }).strict(),
      )
      .min(1),
  })
  .strict();

class SearchQualityAttestationCliError extends Error {}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new SearchQualityAttestationCliError("cannot read or parse JSON input");
  }
}

function readRawInputs(manifestPath: string): RawSearchQualityReportInput[] {
  const manifest = manifestSchema.parse(readJson(manifestPath));
  return manifest.reports.map((report) => {
    try {
      return { queryId: report.queryId, raw: readFileSync(report.path) };
    } catch {
      throw new SearchQualityAttestationCliError("cannot read a declared report");
    }
  });
}

function requireOption(value: string | undefined, flag: string): string {
  if (value === undefined) throw new SearchQualityAttestationCliError(`${flag} is required`);
  return value;
}

function writeJson(path: string, value: unknown): void {
  try {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  } catch {
    throw new SearchQualityAttestationCliError("cannot create output artifact");
  }
}

function main(): void {
  try {
    const [command, ...argv] = process.argv.slice(2);
    const { values } = parseArgs({
      args: argv,
      options: {
        set: { type: "string" },
        manifest: { type: "string" },
        bundle: { type: "string" },
        output: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help === true) return void process.stdout.write(`${usage}\n`);
    if (command !== "build-candidate" && command !== "self-check") {
      throw new SearchQualityAttestationCliError("command must be build-candidate or self-check");
    }

    const set = parseSearchQualityEvaluationSet(readJson(requireOption(values.set, "--set")));
    const rawInputs = readRawInputs(requireOption(values.manifest, "--manifest"));
    const invocation = searchQualityEvidenceInvocationFromEnvironment();
    const output = requireOption(values.output, "--output");

    if (command === "build-candidate") {
      if (values.bundle !== undefined) {
        throw new SearchQualityAttestationCliError("--bundle is valid only for self-check");
      }
      writeJson(output, buildSearchQualityEvidenceCandidate({ set, rawInputs, invocation }));
      return;
    }

    const bundle = readJson(requireOption(values.bundle, "--bundle"));
    writeJson(
      output,
      selfCheckSearchQualityEvidenceCandidate({ bundle, set, rawInputs, invocation }),
    );
  } catch (error) {
    const message =
      error instanceof SearchQualityAttestationCliError
        ? error.message
        : "candidate evidence validation failed";
    process.stderr.write(`search-quality candidate validation failed: ${message}\n`);
    process.exitCode = 1;
  }
}

main();
