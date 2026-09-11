import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

async function loadGuard(): Promise<{
  buildTypeScriptContractDigest: (
    sources: Array<{
      filePath: string;
      contents: string;
      includeNames?: string[];
      includeImportNames?: string[];
      includePropertyNames?: string[];
      normalizeLocalBindings?: boolean;
      normalizeConsoleDiagnostics?: boolean;
    }>,
  ) => string;
  validateInlineAnalysisVersionTransition: (params: {
    baseDigest: string;
    baseVersion: number;
    baseReason?: string;
    currentDigest: string;
    currentVersion: number;
    currentReason?: string;
  }) => { ok: boolean; violations: string[] };
  validateInlineAnalysisCacheVersionContract: (
    root?: string,
    options?: { baseRef?: string },
  ) => Promise<{ ok: boolean; violations: string[]; comparedRef: string | null }>;
  resolveInlineAnalysisContractBaseRef: (root: string) => Promise<string | null>;
  readGitFileWithFallback: (
    root: string,
    gitRef: string,
    filePath: string,
    legacyFilePaths?: string[],
  ) => Promise<string>;
  normalizeInlineAnalysisComparisonSource: (contents: string) => string;
}> {
  const cachePath = path.resolve(__dirname, "..", "check-inline-analysis-cache-contract.mjs");
  return (await import(pathToFileURL(cachePath).href)) as never;
}
describe("inline-analysis cache contract guard", () => {
  it("canonicalizes TypeScript formatting before comparing inline-analysis semantics", async () => {
    const { buildTypeScriptContractDigest } = await loadGuard();
    const compact = buildTypeScriptContractDigest([
      {
        filePath: "contract.ts",
        contents:
          'import { z } from "zod";\nimport { model } from "./model";\nconst PROMPT="extract claim";\nfunction normalize(value:string){return value.trim();}\n',
      },
    ]);
    const formatted = buildTypeScriptContractDigest([
      {
        filePath: "contract.ts",
        contents: `import { model } from "./model";
import { z } from "zod";

const PROMPT = "extract claim";

function normalize(value: string) {
  return value.trim();
}
`,
      },
    ]);

    expect(formatted).toBe(compact);
  });

  it("requires a cache version increase when cache-relevant semantics change", async () => {
    const { buildTypeScriptContractDigest, validateInlineAnalysisVersionTransition } =
      await loadGuard();
    const baseDigest = buildTypeScriptContractDigest([
      { filePath: "contract.ts", contents: 'const PROMPT = "extract claim";\n' },
    ]);
    const currentDigest = buildTypeScriptContractDigest([
      { filePath: "contract.ts", contents: 'const PROMPT = "extract claim and method";\n' },
    ]);

    const result = validateInlineAnalysisVersionTransition({
      baseDigest,
      baseVersion: 7,
      currentDigest,
      currentVersion: 7,
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "inline-analysis cache contract changed but INLINE_ANALYSIS_VERSION did not increase (base=7, current=7)",
    );
  });

  it("does not bind unrelated scheduling declarations to the cache result version", async () => {
    const { buildTypeScriptContractDigest } = await loadGuard();
    const baseDigest = buildTypeScriptContractDigest([
      {
        filePath: "contract.ts",
        contents: 'const PROMPT = "extract claim";\nconst CONCURRENCY = 5;\n',
        includeNames: ["PROMPT"],
      },
    ]);
    const currentDigest = buildTypeScriptContractDigest([
      {
        filePath: "contract.ts",
        contents: 'const PROMPT = "extract claim";\nconst CONCURRENCY = 10;\n',
        includeNames: ["PROMPT"],
      },
    ]);

    expect(currentDigest).toBe(baseDigest);
  });

  it("binds the Gemini thinking level to the cache result version", async () => {
    const { buildTypeScriptContractDigest } = await loadGuard();
    const source = {
      filePath: "app/server/ai-generation/gemini.ts",
      includeImportNames: ["ThinkingLevel"],
      includeNames: ["GEMINI_MODEL", "GEMINI_GENERATE_CONTENT_THINKING_LEVEL"],
    };
    const baseDigest = buildTypeScriptContractDigest([
      {
        ...source,
        contents: `import { ThinkingLevel } from "@google/genai";
export const GEMINI_MODEL = "gemini-3-flash-preview";
export const GEMINI_GENERATE_CONTENT_THINKING_LEVEL = ThinkingLevel.MINIMAL;
`,
      },
    ]);
    const currentDigest = buildTypeScriptContractDigest([
      {
        ...source,
        contents: `import { ThinkingLevel } from "@google/genai";
export const GEMINI_MODEL = "gemini-3-flash-preview";
export const GEMINI_GENERATE_CONTENT_THINKING_LEVEL = ThinkingLevel.HIGH;
`,
      },
    ]);

    expect(currentDigest).not.toBe(baseDigest);
  });

  it("binds every Gemini output-setting application without unrelated gateway code", async () => {
    const { buildTypeScriptContractDigest } = await loadGuard();
    const propertyNames = ["responseMimeType", "temperature", "topP", "seed", "thinkingConfig"];
    const source = {
      filePath: "app/server/ai-generation/gateway.ts",
      includeImportNames: ["GEMINI_GENERATE_CONTENT_THINKING_LEVEL"],
      includeNames: ["executeStructuredGenerationWithUsage"],
      includePropertyNames: propertyNames,
    };
    const buildGatewaySource = (
      overrides: Partial<Record<(typeof propertyNames)[number], string>> = {},
    ) => `import { GEMINI_GENERATE_CONTENT_THINKING_LEVEL } from "./gemini";
export async function executeStructuredGenerationWithUsage(params) {
  return client.generateContent({
    config: {
      ...(jsonMode ? { responseMimeType: ${overrides.responseMimeType ?? '"application/json"'} } : undefined),
      ...(params.temperature != null ? { temperature: ${overrides.temperature ?? "params.temperature"} } : undefined),
      ...(params.topP != null ? { topP: ${overrides.topP ?? "params.topP"} } : undefined),
      ...(params.seed != null ? { seed: ${overrides.seed ?? "params.seed"} } : undefined),
      thinkingConfig: ${overrides.thinkingConfig ?? "{ thinkingLevel: GEMINI_GENERATE_CONTENT_THINKING_LEVEL }"},
    },
  });
}
`;
    const baseDigest = buildTypeScriptContractDigest([
      {
        ...source,
        contents: buildGatewaySource(),
      },
    ]);
    const unrelatedDigest = buildTypeScriptContractDigest([
      {
        ...source,
        contents: buildGatewaySource().replace(
          "  return client.generateContent",
          "  const retryAttempts = 2;\n  return client.generateContent",
        ),
      },
    ]);

    expect(unrelatedDigest).toBe(baseDigest);
    for (const propertyName of propertyNames) {
      const changedDigest = buildTypeScriptContractDigest([
        {
          ...source,
          contents: buildGatewaySource({ [propertyName]: "undefined" }),
        },
      ]);
      expect(changedDigest, propertyName).not.toBe(baseDigest);
    }
    for (const condition of [
      "jsonMode",
      "params.temperature != null",
      "params.topP != null",
      "params.seed != null",
    ]) {
      const changedDigest = buildTypeScriptContractDigest([
        {
          ...source,
          contents: buildGatewaySource().replace(`...(${condition} ?`, "...(false ?"),
        },
      ]);
      expect(changedDigest, condition).not.toBe(baseDigest);
    }

    expect(() =>
      buildTypeScriptContractDigest([
        {
          ...source,
          contents: `import { GEMINI_GENERATE_CONTENT_THINKING_LEVEL } from "./gemini";
export async function executeStructuredGenerationWithUsage() {
  return client.generateContent({ config: {} });
}
`,
        },
      ]),
    ).toThrow(
      "app/server/ai-generation/gateway.ts: missing inline-analysis contract property assignment(s): responseMimeType, temperature, topP, seed, thinkingConfig",
    );
  });

  it("binds the complete shared-cache orchestration declaration", async () => {
    const { buildTypeScriptContractDigest } = await loadGuard();
    const source = {
      filePath: "app/server/domain-access/inline-analysis-access.ts",
      includeNames: ["resolveInlineAnalysis"],
      normalizeLocalBindings: true,
      normalizeConsoleDiagnostics: true,
    };
    const buildSource = ({
      claimFilter = "claimed.has(paper.id)",
      failureFilter = "!isInlineAnalysisFailurePlaceholder(result.analysis)",
      completionInput = "successfulCompletions",
      mutation = "claimedPapers.sort()",
      result = "successfulCandidates",
    } = {}) => `
export async function resolveInlineAnalysis(candidates, analyzeInline, claimed) {
  const claimedPapers = candidates.filter((paper) => ${claimFilter});
  ${mutation};
  const analyzedResults = await analyzeClaimedPapersInIsolation(claimedPapers, analyzeInline);
  const successfulCandidates = analyzedResults.filter(
    (result) => ${failureFilter},
  );
  const successfulCompletions = successfulCandidates.map((candidate) => ({
    paperId: candidate.paperId,
    analysis: candidate.analysis,
  }));
  await completeInlineAnalysisGeneration(${completionInput});
  return ${result};
}
`;
    const digest = (contents: string) => buildTypeScriptContractDigest([{ ...source, contents }]);
    const baseDigest = digest(buildSource());

    expect(digest(buildSource({ claimFilter: "true" }))).not.toBe(baseDigest);
    expect(digest(buildSource({ mutation: "claimedPapers.reverse()" }))).not.toBe(baseDigest);
    expect(digest(buildSource({ failureFilter: "true" }))).not.toBe(baseDigest);
    expect(digest(buildSource({ completionInput: "successfulCandidates" }))).not.toBe(baseDigest);
    expect(digest(buildSource({ result: "analyzedResults" }))).not.toBe(baseDigest);
    expect(() => digest("export function unrelated() {}")).toThrow(
      "app/server/domain-access/inline-analysis-access.ts: missing inline-analysis contract declaration(s): resolveInlineAnalysis",
    );
  });

  it("binds referenced runtime import and local declaration dependencies", async () => {
    const { buildTypeScriptContractDigest } = await loadGuard();
    const source = {
      filePath: "app/server/domain-access/inline-analysis-access.ts",
      includeNames: ["resolveInlineAnalysis"],
      includeReferencedLocalDeclarations: true,
      includeReferencedRuntimeImports: true,
      includeRuntimeModuleEffects: true,
      normalizeLocalBindings: true,
      normalizeConsoleDiagnostics: true,
    };
    const buildSource = ({
      ownerModule = "canonical-owner",
      failureFilter = "!isFailurePlaceholder(record.analysis)",
      unrelatedResult = "false",
      sideEffectImports = "",
      topLevelHook = "",
      runtimeExportModule = "",
    } = {}) => `
import { getCanonicalAnalyzablePapers } from "${ownerModule}";
import { isFailurePlaceholder } from "failure-owner";
import { unrelatedRuntime } from "unrelated-owner";
import type { AnalysisRecord } from "analysis-types";
${sideEffectImports}
${runtimeExportModule ? `export * from "${runtimeExportModule}";` : ""}
${topLevelHook}

function successfulCacheEntries(records: AnalysisRecord[]) {
  return records.filter((record) => ${failureFilter});
}

function unrelatedHelper() {
  return ${unrelatedResult};
}

export function resolveInlineAnalysis(records: AnalysisRecord[]) {
  const canonicalRecords = getCanonicalAnalyzablePapers(records);
  return successfulCacheEntries(canonicalRecords);
}
`;
    const digest = (contents: string) => buildTypeScriptContractDigest([{ ...source, contents }]);
    const baseDigest = digest(buildSource());

    expect(digest(buildSource({ ownerModule: "alternate-owner" }))).not.toBe(baseDigest);
    expect(digest(buildSource({ failureFilter: "true" }))).not.toBe(baseDigest);
    expect(digest(buildSource({ unrelatedResult: "true" }))).toBe(baseDigest);
    expect(digest(buildSource({ sideEffectImports: 'import "side-effect-owner";' }))).not.toBe(
      baseDigest,
    );
    expect(
      digest(buildSource({ sideEffectImports: 'import "alternate-side-effect-owner";' })),
    ).not.toBe(digest(buildSource({ sideEffectImports: 'import "side-effect-owner";' })));
    expect(
      digest(
        buildSource({
          sideEffectImports: 'import "install-cache-hook";\nimport "clear-cache-hook";',
        }),
      ),
    ).not.toBe(
      digest(
        buildSource({
          sideEffectImports: 'import "clear-cache-hook";\nimport "install-cache-hook";',
        }),
      ),
    );
    expect(
      digest(buildSource({ topLevelHook: 'unrelatedRuntime("install-cache-hook");' })),
    ).not.toBe(baseDigest);
    expect(digest(buildSource({ runtimeExportModule: "cache-export-owner" }))).not.toBe(baseDigest);
  });

  it("normalizes local alpha-renames and console-only diagnostics", async () => {
    const { buildTypeScriptContractDigest } = await loadGuard();
    const source = {
      filePath: "app/server/domain-access/inline-analysis-access.ts",
      includeNames: ["resolveInlineAnalysis"],
      normalizeLocalBindings: true,
      normalizeConsoleDiagnostics: true,
    };
    const buildSource = ({
      condition = "debug",
      diagnostic = '"message"',
      itemName = "paper",
      userBinding = "user",
      userReference = "user",
    } = {}) => `
import { getCanonicalAnalyzablePapers } from "@/app/server/domain-access/inline-analysis-identity";
export async function resolveInlineAnalysis(context, candidates: unknown[], claimed, debug) {
  const { db, ${userBinding} } = context;
  const canonicalCandidates = getCanonicalAnalyzablePapers(candidates);
  const claimedPapers = canonicalCandidates.filter(
    (${itemName}) => claimed.has(${itemName}.id),
  );
  if (${condition}) {
    console.warn(${diagnostic});
  }
  return analyzeClaimedPapersInIsolation(claimedPapers, db, ${userReference}.id);
}
`;
    const digest = (contents: string) => buildTypeScriptContractDigest([{ ...source, contents }]);

    const baseDigest = digest(buildSource());
    expect(digest(buildSource({ diagnostic: '"renamed"', itemName: "candidate" }))).toBe(
      baseDigest,
    );
    expect(digest(buildSource({ userBinding: "user: actor", userReference: "actor" }))).toBe(
      baseDigest,
    );
    expect(digest(buildSource({ diagnostic: "claimedPapers.splice(0)" }))).not.toBe(baseDigest);
    const effectfulDiagnostic = (condition: string) =>
      digest(
        buildSource({
          condition,
          diagnostic: "claimedPapers.splice(0)",
        }),
      );
    expect(effectfulDiagnostic("debug")).not.toBe(effectfulDiagnostic("!debug"));
    expect(effectfulDiagnostic("debug")).not.toBe(effectfulDiagnostic("false"));
    expect(digest(buildSource({ condition: "claimedPapers.splice(0).length > 0" }))).not.toBe(
      baseDigest,
    );
    expect(digest(buildSource({ diagnostic: "claimedPapers.length" }))).toBe(baseDigest);
    expect(digest(buildSource({ condition: "claimedPapers.length > 0" }))).toBe(baseDigest);
    expect(digest(buildSource({ diagnostic: "diagnosticObject.length" }))).not.toBe(baseDigest);
    expect(digest(buildSource({ condition: "claimedPapers.reverse().length > 0" }))).not.toBe(
      baseDigest,
    );
    expect(
      digest(
        buildSource({
          diagnostic: "({ filter: () => { claimedPapers.splice(0); return []; } }).filter().length",
        }),
      ),
    ).not.toBe(baseDigest);
    const objectProjection = (localName: string, property: string) => `
export function resolveInlineAnalysis(input) {
  const ${localName} = input.value;
  return { ${property} };
}
`;
    expect(digest(objectProjection("local", "local"))).toBe(
      digest(objectProjection("renamed", "local: renamed")),
    );
    const restProjection = (localName: string) => `
export function resolveInlineAnalysis(input) {
  const { ...${localName} } = input;
  return ${localName};
}
`;
    expect(digest(restProjection("rest"))).toBe(digest(restProjection("remaining")));
    const computedBinding = (keyName: string) => `
export function resolveInlineAnalysis(input) {
  const ${keyName} = "db";
  const { [${keyName}]: value } = input;
  return value;
}
`;
    expect(digest(computedBinding("key"))).toBe(digest(computedBinding("field")));
    const shadowedConsole = (method: string) => `
export function resolveInlineAnalysis(console, claimedPapers) {
  console.warn(claimedPapers.${method}());
}
`;
    expect(digest(shadowedConsole("reverse"))).not.toBe(digest(shadowedConsole("sort")));
    const computedConsole = (method: string) => `
export function resolveInlineAnalysis(claimedPapers) {
  console[claimedPapers.${method}()]();
}
`;
    expect(digest(computedConsole("reverse"))).not.toBe(digest(computedConsole("sort")));

    const branchedDiagnostic = (branches: string) => `
export function resolveInlineAnalysis(claimedPapers, debug) {
  if (debug) ${branches}
  return claimedPapers;
}
`;
    expect(
      digest(
        branchedDiagnostic('console.warn(claimedPapers.splice(0)); else console.warn("message");'),
      ),
    ).not.toBe(
      digest(
        branchedDiagnostic('console.warn("message"); else console.warn(claimedPapers.splice(0));'),
      ),
    );

    expect(digest(buildSource({ diagnostic: "await pendingDiagnostic" }))).not.toBe(
      digest(buildSource({ diagnostic: "pendingDiagnostic" })),
    );

    const reassignedDiagnosticItems = (condition: string) => `
export function resolveInlineAnalysis(candidates, getDiagnosticProxy) {
  let diagnosticItems = [];
  diagnosticItems = getDiagnosticProxy(candidates);
  if (${condition}) console.warn("message");
  return candidates;
}
`;
    expect(digest(reassignedDiagnosticItems("diagnosticItems.length > 0"))).not.toBe(
      digest(reassignedDiagnosticItems("true")),
    );

    const factoryDiagnosticItems = ({
      imported,
      condition,
    }: {
      imported: boolean;
      condition: string;
    }) => `
${
  imported
    ? 'import { getCanonicalAnalyzablePapers } from "@/app/server/domain-access/inline-analysis-identity";'
    : ""
}
export function resolveInlineAnalysis(${imported ? "candidates" : "getCanonicalAnalyzablePapers, candidates"}) {
  const diagnosticItems = getCanonicalAnalyzablePapers(candidates);
  if (${condition}) console.warn("message");
  return candidates;
}
`;
    expect(
      digest(
        factoryDiagnosticItems({
          imported: false,
          condition: "diagnosticItems.length > 0",
        }),
      ),
    ).not.toBe(digest(factoryDiagnosticItems({ imported: false, condition: "true" })));
    expect(
      digest(
        factoryDiagnosticItems({
          imported: true,
          condition: "diagnosticItems.length > 0",
        }),
      ),
    ).toBe(digest(factoryDiagnosticItems({ imported: true, condition: "true" })));

    const coercingConsoleKey = (call: string) => `
export function resolveInlineAnalysis(claimedPapers) {
  const key: any = {
    toString() {
      claimedPapers.splice(0);
      return "warn";
    },
  };
  ${call};
  return claimedPapers;
}
`;
    expect(digest(coercingConsoleKey('console[key]("message")'))).not.toBe(
      digest(coercingConsoleKey('console.warn("message")')),
    );
  });

  it("preserves regex and bigint literal values in the contract digest", async () => {
    const { buildTypeScriptContractDigest } = await loadGuard();
    const digest = (pattern: string, count: string) =>
      buildTypeScriptContractDigest([
        {
          filePath: "app/domain/analysis.ts",
          contents: `const NORMALIZATION_PATTERN = ${pattern};
const MAX_COUNT = ${count};`,
        },
      ]);

    const baseDigest = digest("/[A-Za-z]/u", "10n");
    expect(digest("/[0-9]/u", "10n")).not.toBe(baseDigest);
    expect(digest("/[A-Za-z]/u", "11n")).not.toBe(baseDigest);
  });

  it("ignores unrelated and type-only imports while binding selected runtime imports", async () => {
    const { buildTypeScriptContractDigest } = await loadGuard();
    const source = {
      filePath: "contract.ts",
      includeImportNames: ["model"],
      includeNames: ["PROMPT"],
    };
    const baseDigest = buildTypeScriptContractDigest([
      {
        ...source,
        contents: 'import { model } from "./model";\nconst PROMPT = "extract claim";\n',
      },
    ]);
    const unrelatedDigest = buildTypeScriptContractDigest([
      {
        ...source,
        contents:
          'import type { Schedule } from "./schedule";\nimport { model } from "./model";\nconst PROMPT = "extract claim";\n',
      },
    ]);
    const reboundDigest = buildTypeScriptContractDigest([
      {
        ...source,
        contents: 'import { model } from "./new-model";\nconst PROMPT = "extract claim";\n',
      },
    ]);

    expect(unrelatedDigest).toBe(baseDigest);
    expect(reboundDigest).not.toBe(baseDigest);
  });

  it("ignores trailing commas in cache-relevant declarations", async () => {
    const { buildTypeScriptContractDigest } = await loadGuard();
    const compact = buildTypeScriptContractDigest([
      { filePath: "contract.ts", contents: 'const FIELDS = ["claim", "method"];\n' },
    ]);
    const trailingComma = buildTypeScriptContractDigest([
      { filePath: "contract.ts", contents: 'const FIELDS = ["claim", "method",];\n' },
    ]);

    expect(trailingComma).toBe(compact);
  });

  it("requires a new compatibility reason for a digest-neutral cache version bump", async () => {
    const { buildTypeScriptContractDigest, validateInlineAnalysisVersionTransition } =
      await loadGuard();
    const digest = buildTypeScriptContractDigest([
      { filePath: "contract.ts", contents: 'const PROMPT = "extract claim";\n' },
    ]);

    const result = validateInlineAnalysisVersionTransition({
      baseDigest: digest,
      baseVersion: 7,
      currentDigest: digest,
      currentVersion: 8,
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "app/domain/analysis.ts: INLINE_ANALYSIS_VERSION changed from 7 to 8 without a cache-relevant contract change or a new INLINE_ANALYSIS_VERSION_REASON",
    );

    expect(
      validateInlineAnalysisVersionTransition({
        baseDigest: digest,
        baseVersion: 7,
        baseReason: "v7: semantic contract",
        currentDigest: digest,
        currentVersion: 8,
        currentReason: "v8: provider alias compatibility invalidation",
      }).ok,
    ).toBe(true);
  });

  it("rejects non-PostgreSQL cache versions and version decreases", async () => {
    const { validateInlineAnalysisVersionTransition } = await loadGuard();

    for (const currentVersion of [-1, 7.5, Number.MAX_SAFE_INTEGER]) {
      const result = validateInlineAnalysisVersionTransition({
        baseDigest: "same",
        baseVersion: 7,
        currentDigest: "same",
        currentVersion,
      });
      expect(result.ok).toBe(false);
      expect(result.violations[0]).toContain(
        "current INLINE_ANALYSIS_VERSION must be a positive PostgreSQL integer",
      );
    }

    const decrease = validateInlineAnalysisVersionTransition({
      baseDigest: "changed-base",
      baseVersion: 7,
      currentDigest: "changed-current",
      currentVersion: 6,
    });
    expect(decrease.ok).toBe(false);
    expect(decrease.violations).toContain(
      "app/domain/analysis.ts: INLINE_ANALYSIS_VERSION must not decrease (base=7, current=6)",
    );
  });

  it("uses the full push base while retaining a clean-main first-parent fallback", async () => {
    const { resolveInlineAnalysisContractBaseRef } = await loadGuard();
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-cache-version-base-"));
    const originalPushBaseRef = process.env.INLINE_ANALYSIS_CONTRACT_BASE_REF;
    const originalGitHubBaseRef = process.env.GITHUB_BASE_REF;
    try {
      delete process.env.INLINE_ANALYSIS_CONTRACT_BASE_REF;
      delete process.env.GITHUB_BASE_REF;
      const git = async (...args: string[]) => {
        const { stdout } = await execFileAsync("git", args, { cwd: root });
        return stdout.trim();
      };

      await git("init", "--initial-branch=main");
      await git("config", "user.email", "quality-gate@example.com");
      await git("config", "user.name", "Quality Gate Test");
      await writeFile(path.join(root, "tracked.txt"), "base\n");
      await git("add", "tracked.txt");
      await git("commit", "-m", "base");
      const firstParent = await git("rev-parse", "HEAD");

      await writeFile(path.join(root, "tracked.txt"), "current\n");
      await git("add", "tracked.txt");
      await git("commit", "-m", "current");

      await expect(resolveInlineAnalysisContractBaseRef(root)).resolves.toBe(firstParent);

      await writeFile(path.join(root, "tracked.txt"), "unrelated follow-up\n");
      await git("add", "tracked.txt");
      await git("commit", "-m", "follow-up");
      process.env.INLINE_ANALYSIS_CONTRACT_BASE_REF = firstParent;

      await expect(resolveInlineAnalysisContractBaseRef(root)).resolves.toBe(firstParent);

      const unavailablePushBase = "refs/heads/unavailable-push-base";
      process.env.INLINE_ANALYSIS_CONTRACT_BASE_REF = unavailablePushBase;
      await expect(resolveInlineAnalysisContractBaseRef(root)).resolves.toBe(unavailablePushBase);
    } finally {
      if (originalPushBaseRef === undefined) {
        delete process.env.INLINE_ANALYSIS_CONTRACT_BASE_REF;
      } else {
        process.env.INLINE_ANALYSIS_CONTRACT_BASE_REF = originalPushBaseRef;
      }
      if (originalGitHubBaseRef === undefined) {
        delete process.env.GITHUB_BASE_REF;
      } else {
        process.env.GITHUB_BASE_REF = originalGitHubBaseRef;
      }
      await rm(root, { force: true, recursive: true });
    }
  });

  it("compares a relocated contract source with its exact legacy path", async () => {
    const { normalizeInlineAnalysisComparisonSource, readGitFileWithFallback } = await loadGuard();
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-cache-source-relocation-"));
    try {
      const git = async (...args: string[]) => {
        const { stdout } = await execFileAsync("git", args, { cwd: root });
        return stdout.trim();
      };
      await git("init", "--initial-branch=main");
      await git("config", "user.email", "quality-gate@example.com");
      await git("config", "user.name", "Quality Gate Test");
      await mkdir(path.join(root, "app/lib"), { recursive: true });
      await writeFile(path.join(root, "app/lib/gemini.ts"), "export const MODEL = 'legacy';\n");
      await git("add", ".");
      await git("commit", "-m", "legacy owner");

      await expect(
        readGitFileWithFallback(root, "HEAD", "app/server/ai-generation/gemini.ts", [
          "app/lib/gemini.ts",
        ]),
      ).resolves.toBe("export const MODEL = 'legacy';");
      expect(
        normalizeInlineAnalysisComparisonSource(
          'import { executeJudgment } from "@/app/lib/llm-judgment";\n' +
            'import { GEMINI_MODEL } from "@/app/lib/gemini";\n',
        ),
      ).toBe(
        'import { executeJudgment } from "@/app/server/ai-generation/judgment";\n' +
          'import { GEMINI_MODEL } from "@/app/server/ai-generation/gemini";\n',
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("fails closed when a declared comparison ref is unavailable", async () => {
    const { validateInlineAnalysisCacheVersionContract } = await loadGuard();
    const baseRef = "refs/heads/unavailable-inline-analysis-contract-base";

    const result = await validateInlineAnalysisCacheVersionContract(process.cwd(), { baseRef });

    expect(result.ok).toBe(false);
    expect(result.comparedRef).toBe(baseRef);
    expect(result.violations).toEqual([
      expect.stringContaining(`could not read comparison source at ${baseRef}`),
    ]);
  });
});
