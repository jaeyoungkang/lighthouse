import path from "node:path";

import {
  isAcceptanceCheckRef,
  isAspectRef,
  isIntentCheckRef,
  isPromiseRef,
  traceabilityNodePattern,
  type AcceptanceCheckRef,
  type IntentCheckRef,
  type PromiseRef,
} from "@/app/domain/story-chain";
import { isPair, isScalar, parseAllDocuments, stringify, visit } from "yaml";
import { z } from "zod";

import {
  CONTRACT_CHECK_CASES,
  isContractCheckSubcase,
  isContractCheckTarget,
} from "@/scripts/evidence-ledger/contract-check-registry";
import { StoryChainParseError } from "./parser-shared";

export const EVIDENCE_LEDGER_SCHEMA_VERSION = 2 as const;

export const REGISTERED_GUARD_SCRIPTS = [
  "guard:auth-hot-path",
  "guard:korean",
  "guard:landing-auth-source-boundary",
  "guard:product-owned-navigation",
  "guard:search-condition-url-budget",
  "guard:search-first-paint-no-db",
  "guard:state-boundaries",
] as const;

export const REGISTERED_EVIDENCE_SCRIPTS = [
  "gap-report-concurrency",
  "mc-check-critical-findings",
  "message-registry-contract",
  "relationship-seed-sticky-browser",
] as const;

const nonBlank = z.string().refine((value) => value.trim().length > 0, "must not be blank");
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const promiseRef = z.string().refine(isPromiseRef, "must be a promise: ref");
const aspectRef = z.string().refine(isAspectRef, "must be an aspect: ref");

const promiseKeyPattern = traceabilityNodePattern("promise", "[A-Za-z0-9_-]+");
const intentKey = z
  .string()
  .regex(
    new RegExp(
      `^${promiseKeyPattern}#${traceabilityNodePattern("intent-check", "[A-Za-z0-9_-]+")}$`,
    ),
  );
const acceptanceKey = z
  .string()
  .regex(
    new RegExp(
      `^${promiseKeyPattern}#${traceabilityNodePattern("acceptance-check", "[A-Za-z0-9_-]+")}$`,
    ),
  );
const executionRef = z
  .string()
  .regex(new RegExp(`^${traceabilityNodePattern("execution", "[a-z0-9][a-z0-9-]*")}$`));
const scenarioRef = z
  .string()
  .regex(
    new RegExp(`^${traceabilityNodePattern("scenario", "[A-Za-z0-9_-]+")}$`),
    "must be a scenario: ref",
  );

function isCanonicalRepoPath(value: string): boolean {
  if (value.includes("\\") || value.startsWith("-") || path.posix.isAbsolute(value)) return false;
  if (/^[A-Za-z]:/.test(value) || value.startsWith("//")) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value && value !== "." && !value.split("/").includes("..");
}

const repoPath = nonBlank.refine(isCanonicalRepoPath, {
  message: "must be a canonical POSIX repository-relative path without traversal or option prefix",
});

const intentSchema = z
  .object({
    mode: z.enum(["explicit", "absorbed", "delegated"]),
    checks: z.array(z.object({ key: intentKey, evidence: nonBlank }).strict()).default([]),
    delegations: z.array(z.object({ key: intentKey, ledger: slug }).strict()).default([]),
  })
  .strict();

const executionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: executionRef,
      kind: z.literal("vitest"),
      files: z.array(repoPath.refine((value) => /\.test\.tsx?$/.test(value))).min(1),
      testNamePattern: nonBlank.optional(),
    })
    .strict(),
  z
    .object({
      id: executionRef,
      kind: z.literal("contract-check"),
      target: slug,
      subcase: slug.or(z.literal("all")),
    })
    .strict(),
  z
    .object({
      id: executionRef,
      kind: z.literal("guard"),
      script: z.enum(REGISTERED_GUARD_SCRIPTS),
    })
    .strict(),
  z
    .object({
      id: executionRef,
      kind: z.literal("registered-script"),
      script: z.enum(REGISTERED_EVIDENCE_SCRIPTS),
    })
    .strict(),
]);

export const evidenceLedgerRecordSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_LEDGER_SCHEMA_VERSION),
    slug,
    review: repoPath.optional(),
    sourcePromises: z.array(promiseRef).min(1),
    appliedAspects: z.array(aspectRef),
    intentJudgmentRefs: z
      .array(
        z
          .object({
            promise: promiseRef,
            anchor: promiseRef,
          })
          .strict(),
      )
      .optional(),
    intent: intentSchema,
    acceptanceChecks: z
      .array(
        z
          .object({
            key: acceptanceKey,
            assertion: nonBlank,
            executionRefs: z.array(executionRef).min(1),
            scenarios: z.array(scenarioRef).default([]),
          })
          .strict(),
      )
      .min(1),
    executions: z.array(executionSchema).min(1),
    implementationContracts: z.array(nonBlank),
    verdict: z.enum(["met", "not-met", "unknown"]),
  })
  .strict()
  .superRefine((record, context) => {
    const duplicate = (values: readonly string[]): string | undefined => {
      const seen = new Set<string>();
      return values.find((value) => (seen.has(value) ? true : (seen.add(value), false)));
    };
    const fields: Array<[readonly string[], Array<string | number>]> = [
      [record.sourcePromises, ["sourcePromises"]],
      [record.appliedAspects, ["appliedAspects"]],
      [
        (record.intentJudgmentRefs ?? []).map((entry) => `${entry.promise}->${entry.anchor}`),
        ["intentJudgmentRefs"],
      ],
      [record.intent.checks.map((entry) => entry.key), ["intent", "checks"]],
      [record.intent.delegations.map((entry) => entry.key), ["intent", "delegations"]],
      [record.acceptanceChecks.map((entry) => entry.key), ["acceptanceChecks"]],
      [record.executions.map((entry) => entry.id), ["executions"]],
    ];
    for (const [values, issuePath] of fields) {
      const found = duplicate(values);
      if (found) {
        const label = issuePath[0] === "acceptanceChecks" ? "Acceptance Check " : "";
        context.addIssue({
          code: "custom",
          path: issuePath,
          message: `duplicate ${label}${found}`,
        });
      }
    }
    record.intentJudgmentRefs?.forEach((entry, index) => {
      if (!record.sourcePromises.includes(entry.promise)) {
        context.addIssue({
          code: "custom",
          path: ["intentJudgmentRefs", index, "promise"],
          message: `${entry.promise} is not a Source Promise`,
        });
      }
    });

    const executionIds = new Set(record.executions.map((entry) => entry.id));
    const referenced = new Set<string>();
    record.acceptanceChecks.forEach((check, index) => {
      const repeated = duplicate(check.executionRefs);
      if (repeated) {
        context.addIssue({
          code: "custom",
          path: ["acceptanceChecks", index, "executionRefs"],
          message: `duplicate ${repeated}`,
        });
      }
      for (const ref of check.executionRefs) {
        referenced.add(ref);
        if (!executionIds.has(ref)) {
          context.addIssue({
            code: "custom",
            path: ["acceptanceChecks", index, "executionRefs"],
            message: `unknown execution ${ref}`,
          });
        }
      }
    });
    record.executions.forEach((entry, index) => {
      if (!referenced.has(entry.id)) {
        context.addIssue({
          code: "custom",
          path: ["executions", index, "id"],
          message: `unreferenced execution ${entry.id}`,
        });
      }
      if (entry.kind === "contract-check") {
        if (!isContractCheckTarget(entry.target)) {
          context.addIssue({
            code: "custom",
            path: ["executions", index, "target"],
            message: `unknown contract-check target ${entry.target}`,
          });
        } else if (!isContractCheckSubcase(entry.target, entry.subcase)) {
          context.addIssue({
            code: "custom",
            path: ["executions", index, "subcase"],
            message: `unknown subcase ${entry.subcase}; valid: all, ${CONTRACT_CHECK_CASES[entry.target].join(", ")}`,
          });
        }
      }
    });

    if (record.intent.mode === "explicit") {
      if (record.intent.checks.length === 0 || record.intent.delegations.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["intent"],
          message: "explicit mode requires local checks only",
        });
      }
    } else if (record.intent.mode === "absorbed") {
      if (record.intent.checks.length > 0 || record.intent.delegations.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["intent"],
          message: "absorbed mode cannot carry checks or delegations",
        });
      }
    } else if (record.intent.checks.length > 0 || record.intent.delegations.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["intent"],
        message: "delegated mode requires delegations only",
      });
    }
  });

export type EvidenceLedgerRecord = z.infer<typeof evidenceLedgerRecordSchema>;
export type EvidenceExecution = EvidenceLedgerRecord["executions"][number];

function parseYaml(source: string, file: string): unknown {
  const documents = parseAllDocuments(source, {
    strict: true,
    uniqueKeys: true,
    version: "1.2",
    schema: "core",
    merge: false,
    resolveKnownTags: false,
  });
  if (documents.length !== 1) {
    throw new StoryChainParseError(`${file}: expected exactly one YAML document`);
  }
  const document = documents[0];
  if (document.errors.length > 0) {
    throw new StoryChainParseError(
      `${file}: invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`,
    );
  }
  let forbidden: string | undefined;
  visit(document, {
    Alias: () => {
      forbidden ??= "aliases are forbidden";
    },
    Node: (_key, node) => {
      if ("anchor" in node && node.anchor) forbidden ??= "anchors are forbidden";
      if (node.tag) forbidden ??= "explicit tags are forbidden";
    },
    Pair: (_key, pair) => {
      if (isPair(pair) && isScalar(pair.key) && pair.key.value === "<<") {
        forbidden ??= "merge keys are forbidden";
      }
    },
  });
  if (forbidden) throw new StoryChainParseError(`${file}: ${forbidden}`);
  return document.toJS({ maxAliasCount: 0 });
}

export function serializeEvidenceLedgerRecord(record: EvidenceLedgerRecord): string {
  return stringify(evidenceLedgerRecordSchema.parse(record), { indent: 2, lineWidth: 0 });
}

export function parseEvidenceLedgerRecord(input: {
  source: string;
  file: string;
  canonical?: boolean;
}): EvidenceLedgerRecord {
  const parsed = evidenceLedgerRecordSchema.safeParse(parseYaml(input.source, input.file));
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new StoryChainParseError(`${input.file}: invalid Evidence Ledger v2: ${message}`);
  }
  const expectedSlug = path.basename(input.file).replace(/\.ledger\.yaml$/, "");
  if (parsed.data.slug !== expectedSlug) {
    throw new StoryChainParseError(`${input.file}: slug must match ${expectedSlug}`);
  }
  const expectedReview = `reviews/${expectedSlug}.reviews.md`;
  if (parsed.data.review && parsed.data.review !== expectedReview) {
    throw new StoryChainParseError(`${input.file}: review pointer must be ${expectedReview}`);
  }
  if (input.canonical !== false && input.source !== serializeEvidenceLedgerRecord(parsed.data)) {
    throw new StoryChainParseError(`${input.file}: YAML is not in canonical serialized form`);
  }
  return parsed.data;
}

export function splitAcceptanceCheckKey(
  key: string,
  file: string,
): [PromiseRef, AcceptanceCheckRef] {
  const [promise, check, extra] = key.split("#");
  if (extra || !isPromiseRef(promise) || !isAcceptanceCheckRef(check)) {
    throw new StoryChainParseError(`${file}: invalid Acceptance Check key ${key}`);
  }
  return [promise, check];
}

export function splitIntentCheckKey(key: string, file: string): [PromiseRef, IntentCheckRef] {
  const [promise, check, extra] = key.split("#");
  if (extra || !isPromiseRef(promise) || !isIntentCheckRef(check)) {
    throw new StoryChainParseError(`${file}: invalid Intent Check key ${key}`);
  }
  return [promise, check];
}
