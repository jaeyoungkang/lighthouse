import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  parseSearchQualityEvaluationSet,
  parseSearchQualityExpectedTargetRevision,
  parseSearchQualityLoadSmokeReport,
  parseSearchQualityReleasePolicy,
} from "./contract";
import { evaluateSearchQuality, isSuccessfulSearchQualityEvaluation } from "./evaluator";

const usage = `Light House search-quality evaluator

Usage: npm run eval:search-quality -- --set <set.json> \\
  --expected-target-revision <git-sha> \\
  --report <query-id>=<load-smoke-v5.json> [--report ...] [--policy <policy.json>]

Reads existing load-smoke v5 reports; it does not run search, store reports, or authorize release.`;

class SearchQualityCliError extends Error {}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new SearchQualityCliError("cannot read or parse JSON input");
  }
}

function reportSpec(value: string): { queryId: string; path: string } {
  const separator = value.indexOf("=");
  if (separator <= 0 || separator === value.length - 1) {
    throw new SearchQualityCliError("--report requires <query-id>=<load-smoke-v5.json>");
  }
  return { queryId: value.slice(0, separator), path: value.slice(separator + 1) };
}

function main(): void {
  try {
    const { values } = parseArgs({
      options: {
        set: { type: "string" },
        "expected-target-revision": { type: "string" },
        report: { type: "string", multiple: true, default: [] },
        policy: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help === true) return void process.stdout.write(`${usage}\n`);
    if (values.set === undefined) throw new SearchQualityCliError("--set is required");
    if (values["expected-target-revision"] === undefined) {
      throw new SearchQualityCliError("--expected-target-revision is required");
    }
    const set = parseSearchQualityEvaluationSet(readJson(values.set));
    const expectedTargetRevision = parseSearchQualityExpectedTargetRevision(
      values["expected-target-revision"],
    );
    const policy =
      values.policy === undefined
        ? undefined
        : parseSearchQualityReleasePolicy(readJson(values.policy));
    const reports = values.report.map(reportSpec).map(({ queryId, path }) => ({
      queryId,
      report: parseSearchQualityLoadSmokeReport(readJson(path)),
    }));
    const result = evaluateSearchQuality(set, reports, policy, new Date(), expectedTargetRevision);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!isSuccessfulSearchQualityEvaluation(result)) process.exitCode = 1;
  } catch (error) {
    const message =
      error instanceof SearchQualityCliError ? error.message : "input validation failed";
    process.stderr.write(`search-quality evaluation failed: ${message}\n`);
    process.exitCode = 1;
  }
}

main();
