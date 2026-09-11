import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

type Assessment = {
  policySetRef: string;
  revision: string;
  collectorAttestation: { status: string };
  caseAssessments: Array<{ caseRef: string; verdicts: string[] }>;
  coverageAssessments: Array<{ coverageRef: string; status: string; verdicts: string[] }>;
};

type MergePolicy = {
  requiredCaseRefs: string[];
  unknownHandling: Record<string, Record<string, string>>;
  blockers: unknown[];
  riskAcceptance: Record<string, unknown> | null;
};

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const processRoot = path.join(repoRoot, "scripts", "architecture-fitness");
const pilotRoot = path.join(repoRoot, "docs", "architecture-fitness", "pilots");
const policyPath = path.join(pilotRoot, "issue-278.policy.json");
const observationPath = path.join(pilotRoot, "issue-278.observation.json");
const statePolicyPath = path.join(pilotRoot, "issue-276.policy.json");
const stateObservationPath = path.join(pilotRoot, "issue-276.observation.json");
const q2ObservationPath = path.join(pilotRoot, "issue-280-281.observation.json");
const q3ObservationPath = path.join(pilotRoot, "issue-286-q3-workload.observation.json");
const q4ObservationPath = path.join(pilotRoot, "issue-297-q4-technical-grain.observation.json");
const q5ObservationPath = path.join(pilotRoot, "issue-298-q5-cache-lifecycle.observation.json");
const candidatePath = path.join(pilotRoot, "issue-278.candidates.json");
const packagedSkill = path.join(repoRoot, "shared-skills", "architecture-fitness-review.skill");
const packagedSkillProvenance = path.join(
  repoRoot,
  "shared-skills",
  "architecture-fitness-review.provenance.json",
);
const coreScripts = path.join(
  repoRoot,
  ".agents",
  "skills",
  "architecture-fitness-review",
  "scripts",
);
const evaluator = path.join(coreScripts, "evaluate.py");
const attestor = path.join(coreScripts, "attest.py");
const candidateValidator = path.join(coreScripts, "validate_candidates.py");
const collector = path.join(processRoot, "collect-least-authority.mjs");
const spoofedLocalTrustEnv = {
  ...process.env,
  ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1: "test-only-architecture-fitness-key-v1",
  ARCHITECTURE_FITNESS_TRUSTED_GATE: "github-actions",
  ARCHITECTURE_FITNESS_RUN_REF: "github-actions:12345:1",
  GITHUB_ACTIONS: "true",
  GITHUB_RUN_ID: "12345",
  GITHUB_RUN_ATTEMPT: "1",
  CI: "true",
};

async function loadMergeAdvisory(): Promise<{
  evaluateMergeEligibility: (
    assessment: Assessment,
    policy: MergePolicy,
  ) => { eligibility: string; architectureFitnessVerdictsPreserved: boolean };
}> {
  const modulePath = path.join(processRoot, "merge-advisory.mjs");
  return (await import(pathToFileURL(modulePath).href)) as never;
}

async function loadLighthouseAdapter(): Promise<{
  resolveAttestationMode: (environment?: NodeJS.ProcessEnv) => string;
  assertLighthouseCollectorAuthority: (authority: Record<string, unknown>) => void;
  evaluateUnsignedObservation: (observation: string, environment?: NodeJS.ProcessEnv) => Assessment;
  evaluateUnsignedObservationWithExitCode: (
    observation: string,
    environment?: NodeJS.ProcessEnv,
    policy?: string,
  ) => { assessment: Assessment; exitCode: number };
  resolveVerdictExitCode: (exitCodes: number[]) => number;
  resolveReviewProcessExitCode: (
    options: { verdictExit: boolean },
    verdictExitCode: number,
  ) => number;
}> {
  const modulePath = path.join(processRoot, "lighthouse-adapter.mjs");
  return (await import(pathToFileURL(modulePath).href)) as never;
}

async function loadImpactAdvisory(): Promise<{
  evaluateImpactDeclaration: (input: {
    changedPaths: string[];
    declaration: Record<string, string> | null;
    adapter: { sensitivePathHints: Array<{ id: string; prefixes: string[] }> };
  }) => {
    findings: Array<{ id: string }>;
    cairVerdict: string | null;
    decisionRoot: string | null;
  };
}> {
  const modulePath = path.join(processRoot, "impact-advisory.mjs");
  return (await import(pathToFileURL(modulePath).href)) as never;
}

async function loadAuthoritativeAttestation(): Promise<{
  attestAuthoritativeBundle: (input: {
    rawDirectory: string;
    bundleDirectory: string;
    invocation: Record<string, string>;
    environment?: NodeJS.ProcessEnv;
    profileId?: string;
  }) => Promise<Record<string, unknown>>;
  verifyAuthoritativeBundle: (input: {
    bundleDirectory: string;
    invocation: Record<string, string>;
    environment?: NodeJS.ProcessEnv;
    profileId?: string;
  }) => Promise<{
    status: string;
    mergeEligibility: string;
    target: { caseVerdicts: Record<string, string[]>; coverageVerdicts: Record<string, string[]> };
  }>;
}> {
  const modulePath = path.join(processRoot, "authoritative-attestation.mjs");
  return (await import(pathToFileURL(modulePath).href)) as never;
}

async function loadLighthouseTrustPolicy(): Promise<{
  assertAuthoritativeInvocation: (invocation: typeof authoritativeInvocation) => unknown;
  resolveAuthoritativeAttestationKey: (environment?: NodeJS.ProcessEnv) => string;
}> {
  const modulePath = path.join(processRoot, "lighthouse-trust-policy.mjs");
  return (await import(pathToFileURL(modulePath).href)) as never;
}

async function loadLighthouseProfiles(): Promise<{
  listProtectedArchitectureFitnessProfiles: () => Array<{
    id: string;
    policy: string;
    collector: string;
  }>;
  resolveArchitectureFitnessProfile: (profileId: string) => {
    id: string;
    policy: string;
    collector: string;
    mergePolicy: { requiredCaseRefs: string[] };
  };
}> {
  const modulePath = path.join(processRoot, "lighthouse-profiles.mjs");
  return (await import(pathToFileURL(modulePath).href)) as never;
}

const authoritativeInvocation = {
  repository: "corca-ai/lighthouse",
  event: "workflow_dispatch",
  workflowRef:
    "corca-ai/lighthouse/.github/workflows/architecture-fitness-attestation.yml@refs/heads/main",
  workflowSha: "87877a1a6448c5b355f4c3e7a07273b00c29776c",
  baseRef: "refs/heads/main",
  baseRevision: "2066f24671d2f24d89c59359888df19f8befb89d",
  targetRepository: "corca-ai/lighthouse",
  targetRevision: "87877a1a6448c5b355f4c3e7a07273b00c29776c",
  actor: "external-contributor",
  pullRequestNumber: "0",
  runId: "12345",
  runAttempt: "1",
  rawArtifactId: "67890",
  rawArtifactDigest: "a".repeat(64),
};

async function writeInvocationBoundRawObservations(directory: string) {
  await mkdir(directory, { recursive: true });
  const sources = {
    base: path.join(pilotRoot, "baselines", "issue-278.observation.json"),
    target: observationPath,
  };
  for (const [subject, source] of Object.entries(sources)) {
    const observation = JSON.parse(await readFile(source, "utf8")) as {
      collector: { runRef: string; command: string };
      evidence: Array<{ collectorRunRef: string; command: string }>;
    };
    const revision =
      subject === "base"
        ? authoritativeInvocation.baseRevision
        : authoritativeInvocation.targetRevision;
    const runRef = `github-actions:${authoritativeInvocation.repository}:${authoritativeInvocation.runId}:${authoritativeInvocation.runAttempt}:${subject}:${revision}`;
    observation.collector.runRef = runRef;
    observation.collector.command = `trusted collector ${subject} ${revision} ${runRef}`;
    for (const evidence of observation.evidence) {
      evidence.collectorRunRef = runRef;
      if (evidence.command.includes("collect-least-authority.mjs")) {
        evidence.command = observation.collector.command;
      }
    }
    await writeFile(
      path.join(directory, `${subject}.observation.json`),
      `${JSON.stringify(observation, null, 2)}\n`,
      "utf8",
    );
  }
}

async function writeInvocationBoundStateObservations(directory: string) {
  await mkdir(directory, { recursive: true });
  for (const subject of ["base", "target"] as const) {
    const observation = JSON.parse(await readFile(stateObservationPath, "utf8")) as {
      revision: string;
      collector: { runRef: string; command: string };
      evidence: Array<{
        role: string;
        collectorRunRef: string;
        sourceRevision: string;
        command: string;
        commandExitCode: number;
        target: { stateRefs: string[]; factRefs: string[] };
      }>;
      observations: Array<{
        completeness: string;
        states: Array<{
          stateRef: string;
          authorityRefs: string[];
          carrierRefs: string[];
        }>;
        canonicalIdentities: Array<{
          participatingStateRefs: string[];
          normalizationRefs: string[];
        }>;
      }>;
    };
    const revision =
      subject === "base"
        ? authoritativeInvocation.baseRevision
        : authoritativeInvocation.targetRevision;
    const runRef = `github-actions:${authoritativeInvocation.repository}:${authoritativeInvocation.runId}:${authoritativeInvocation.runAttempt}:${subject}:${revision}`;
    observation.revision = revision;
    observation.collector.runRef = runRef;
    observation.collector.command = `trusted state collector ${subject} ${revision} ${runRef}`;
    observation.observations[0].completeness = "complete";
    for (const state of observation.observations[0].states) {
      if (state.stateRef === "state:search-execution-condition") {
        state.authorityRefs = ["authority:condition-url"];
        state.carrierRefs = ["carrier:condition-url", "carrier:server-execution-input"];
      } else if (state.stateRef === "state:current-result-snapshot") {
        state.authorityRefs = ["authority:route-search-execution"];
        state.carrierRefs = ["carrier:route-payload", "carrier:client-current-view-store"];
      }
    }
    observation.observations[0].canonicalIdentities[0].participatingStateRefs = [
      "state:search-execution-condition",
    ];
    observation.observations[0].canonicalIdentities[0].normalizationRefs = [
      "normalization:canonical-search-execution-v1",
    ];
    for (const evidence of observation.evidence) {
      evidence.collectorRunRef = runRef;
      evidence.sourceRevision = revision;
      evidence.commandExitCode = 0;
      if (
        (evidence.role === "state-static" || evidence.role === "state-test") &&
        evidence.target.stateRefs.includes("state:search-execution-condition")
      ) {
        evidence.target.factRefs = [
          "authority:condition-url",
          "carrier:condition-url",
          "carrier:server-execution-input",
        ];
      } else if (
        (evidence.role === "state-static" || evidence.role === "state-test") &&
        evidence.target.stateRefs.includes("state:current-result-snapshot")
      ) {
        evidence.target.factRefs = [
          "authority:route-search-execution",
          "carrier:route-payload",
          "carrier:client-current-view-store",
        ];
      } else if (evidence.role === "identity-static" || evidence.role === "identity-test") {
        evidence.target.factRefs = [
          "state:search-execution-condition",
          "normalization:canonical-search-execution-v1",
        ];
      }
      if (evidence.command.includes("collect-search-state-boundary.mjs")) {
        evidence.command = observation.collector.command;
      }
    }
    await writeFile(
      path.join(directory, `${subject}.observation.json`),
      `${JSON.stringify(observation, null, 2)}\n`,
      "utf8",
    );
  }
}

async function writeInvocationBoundQ2Observations(directory: string) {
  await mkdir(directory, { recursive: true });
  for (const subject of ["base", "target"] as const) {
    const observation = JSON.parse(await readFile(q2ObservationPath, "utf8")) as {
      revision: string;
      collector: { runRef: string; command: string };
      evidence: Array<{
        collectorRunRef: string;
        sourceRevision: string;
      }>;
    };
    const revision =
      subject === "base"
        ? authoritativeInvocation.baseRevision
        : authoritativeInvocation.targetRevision;
    const runRef = `github-actions:${authoritativeInvocation.repository}:${authoritativeInvocation.runId}:${authoritativeInvocation.runAttempt}:${subject}:${revision}`;
    observation.revision = revision;
    observation.collector.runRef = runRef;
    observation.collector.command = `trusted Q2 collector ${subject} ${revision} ${runRef}`;
    for (const evidence of observation.evidence) {
      evidence.collectorRunRef = runRef;
      evidence.sourceRevision = revision;
    }
    await writeFile(
      path.join(directory, `${subject}.observation.json`),
      `${JSON.stringify(observation, null, 2)}\n`,
      "utf8",
    );
  }
}

async function writeInvocationBoundQ3Observations(directory: string) {
  await mkdir(directory, { recursive: true });
  for (const subject of ["base", "target"] as const) {
    const observation = JSON.parse(await readFile(q3ObservationPath, "utf8")) as {
      revision: string;
      collector: { runRef: string; command: string };
      evidence: Array<{ collectorRunRef: string; sourceRevision: string }>;
    };
    const revision =
      subject === "base"
        ? authoritativeInvocation.baseRevision
        : authoritativeInvocation.targetRevision;
    const runRef = `github-actions:${authoritativeInvocation.repository}:${authoritativeInvocation.runId}:${authoritativeInvocation.runAttempt}:${subject}:${revision}`;
    observation.revision = revision;
    observation.collector.runRef = runRef;
    observation.collector.command = `trusted Q3 collector ${subject} ${revision} ${runRef}`;
    for (const evidence of observation.evidence) {
      evidence.collectorRunRef = runRef;
      evidence.sourceRevision = revision;
    }
    await writeFile(
      path.join(directory, `${subject}.observation.json`),
      `${JSON.stringify(observation, null, 2)}\n`,
      "utf8",
    );
  }
}

async function writeInvocationBoundQ4Observations(directory: string) {
  await mkdir(directory, { recursive: true });
  for (const subject of ["base", "target"] as const) {
    const observation = JSON.parse(await readFile(q4ObservationPath, "utf8")) as {
      revision: string;
      collector: { runRef: string; command: string };
      evidence: Array<{ collectorRunRef: string; sourceRevision: string }>;
    };
    const revision =
      subject === "base"
        ? authoritativeInvocation.baseRevision
        : authoritativeInvocation.targetRevision;
    const runRef = `github-actions:${authoritativeInvocation.repository}:${authoritativeInvocation.runId}:${authoritativeInvocation.runAttempt}:${subject}:${revision}`;
    observation.revision = revision;
    observation.collector.runRef = runRef;
    observation.collector.command = `trusted Q4 collector ${subject} ${revision} ${runRef}`;
    for (const evidence of observation.evidence) {
      evidence.collectorRunRef = runRef;
      evidence.sourceRevision = revision;
    }
    await writeFile(
      path.join(directory, `${subject}.observation.json`),
      `${JSON.stringify(observation, null, 2)}\n`,
      "utf8",
    );
  }
}

async function writeInvocationBoundQ5Observations(directory: string) {
  await mkdir(directory, { recursive: true });
  for (const subject of ["base", "target"] as const) {
    const observation = JSON.parse(await readFile(q5ObservationPath, "utf8")) as {
      revision: string;
      collector: { runRef: string; command: string };
      evidence: Array<{ collectorRunRef: string; sourceRevision: string }>;
    };
    const revision =
      subject === "base"
        ? authoritativeInvocation.baseRevision
        : authoritativeInvocation.targetRevision;
    const runRef = `github-actions:${authoritativeInvocation.repository}:${authoritativeInvocation.runId}:${authoritativeInvocation.runAttempt}:${subject}:${revision}`;
    observation.revision = revision;
    observation.collector.runRef = runRef;
    observation.collector.command = `trusted Q5 collector ${subject} ${revision} ${runRef}`;
    for (const evidence of observation.evidence) {
      evidence.collectorRunRef = runRef;
      evidence.sourceRevision = revision;
    }
    await writeFile(
      path.join(directory, `${subject}.observation.json`),
      `${JSON.stringify(observation, null, 2)}\n`,
      "utf8",
    );
  }
}

describe("Architecture Fitness external skill provenance", () => {
  it("keeps protected exact-revision observations registered by the adapter and authority doc", async () => {
    const adapter = await readFile(path.join(processRoot, "lighthouse-adapter.mjs"), "utf8");
    const authority = await readFile(
      path.join(repoRoot, "docs", "architecture-fitness", "README.md"),
      "utf8",
    );

    for (const revision of [
      "87877a1a6448c5b355f4c3e7a07273b00c29776c",
      "aa4f0b495cdb1f8083d3e24d0cc02be127b3a09e",
      "bb7e361ab69a11f3237dffb51fc0f6e25b176037",
      "b9ba8c42b484e933860f591c807f7b6f56f7c543",
    ]) {
      expect(adapter).toContain(`revision: "${revision}"`);
      expect(authority).toContain(`\`${revision.slice(0, 8)}\``);
    }
  });

  it("registers the relationship state-boundary as a separate protected profile", async () => {
    const { resolveArchitectureFitnessProfile } = await loadLighthouseProfiles();

    const profile = resolveArchitectureFitnessProfile("issue-276-relationship-state-boundary");

    expect(profile.id).toBe("issue-276-relationship-state-boundary");
    expect(profile.policy).toBe(path.join(pilotRoot, "issue-276-relationship.policy.json"));
    expect(profile.collector).toBe(
      path.join(processRoot, "collect-relationship-state-boundary.mjs"),
    );
    expect(profile.mergePolicy.requiredCaseRefs).toEqual([
      "issue-276:relationship-seed-state-boundary",
    ]);
  });

  it("registers topology and critical path as one cost-bounded Q2 profile", async () => {
    const { resolveArchitectureFitnessProfile } = await loadLighthouseProfiles();

    const profile = resolveArchitectureFitnessProfile("issue-280-281-q2-macro");

    expect(profile.id).toBe("issue-280-281-q2-macro");
    expect(profile.policy).toBe(path.join(pilotRoot, "issue-280-281.policy.json"));
    expect(profile.collector).toBe(path.join(processRoot, "collect-q2-macro.mjs"));
    expect(profile.mergePolicy.requiredCaseRefs).toEqual([
      "issue-280:episteme-breaker-process-scope",
      "issue-281:first-ready-search-payload",
    ]);
  });

  it("normalizes Q2 behavior evidence independently of reporter order", async () => {
    const { normalizeTestReport } = (await import(
      pathToFileURL(path.join(processRoot, "collect-q2-macro.mjs")).href
    )) as {
      normalizeTestReport: (
        result: { status: number; stdout: string; stderr: string },
        targetRoot: string,
      ) => Record<string, unknown>;
    };
    const targetRoot = "/target";
    const reports = [
      {
        name: `${repoRoot}/scripts/architecture-fitness/__tests__/q2-macro-boundaries.test.ts`,
        status: "passed",
        assertionResults: [
          { fullName: "second assertion", status: "passed" },
          { fullName: "first assertion", status: "passed" },
        ],
      },
      {
        name: `${repoRoot}/app/server/services/__tests__/search-execution.test.ts`,
        status: "passed",
        assertionResults: [{ fullName: "search assertion", status: "passed" }],
      },
    ];
    const makeResult = (testResults: typeof reports) => ({
      status: 0,
      stderr: "",
      stdout: JSON.stringify({
        numTotalTestSuites: 2,
        numPassedTestSuites: 2,
        numTotalTests: 3,
        numPassedTests: 3,
        testResults,
      }),
    });

    const normalized = normalizeTestReport(makeResult(reports), targetRoot);
    expect(normalized).toEqual(
      normalizeTestReport(
        makeResult(
          reports
            .map((item) => ({
              ...item,
              assertionResults: [...item.assertionResults].reverse(),
            }))
            .reverse(),
        ),
        targetRoot,
      ),
    );
    expect(JSON.stringify(normalized)).toContain("<collector-authority>");
    expect(JSON.stringify(normalized)).not.toContain(repoRoot);
  });

  it("registers burst, sustained load, and amplification as one Q3 profile", async () => {
    const { resolveArchitectureFitnessProfile } = await loadLighthouseProfiles();

    const profile = resolveArchitectureFitnessProfile("issue-286-q3-workload");

    expect(profile.id).toBe("issue-286-q3-workload");
    expect(profile.policy).toBe(path.join(pilotRoot, "issue-286-q3-workload.policy.json"));
    expect(profile.collector).toBe(path.join(processRoot, "collect-q3-workload.mjs"));
    expect(profile.mergePolicy.requiredCaseRefs).toEqual(["issue-286:search-workload-envelope"]);
  });

  it("registers approved effect seams and propagation as one Q4 profile", async () => {
    const { resolveArchitectureFitnessProfile } = await loadLighthouseProfiles();

    const profile = resolveArchitectureFitnessProfile("issue-297-q4-technical-grain");

    expect(profile.id).toBe("issue-297-q4-technical-grain");
    expect(profile.policy).toBe(path.join(pilotRoot, "issue-297-q4-technical-grain.policy.json"));
    expect(profile.collector).toBe(path.join(processRoot, "collect-q4-technical-grain.mjs"));
    expect(profile.mergePolicy.requiredCaseRefs).toEqual(["issue-297:technical-grain-conformance"]);
  });

  it("registers the bounded preset-title cache lifecycle as one Q5 profile", async () => {
    const { resolveArchitectureFitnessProfile } = await loadLighthouseProfiles();

    const profile = resolveArchitectureFitnessProfile("issue-298-q5-cache-lifecycle");

    expect(profile.id).toBe("issue-298-q5-cache-lifecycle");
    expect(profile.policy).toBe(path.join(pilotRoot, "issue-298-q5-cache-lifecycle.policy.json"));
    expect(profile.collector).toBe(path.join(processRoot, "collect-q5-cache-lifecycle.mjs"));
    expect(profile.mergePolicy.requiredCaseRefs).toEqual([
      "issue-298:preset-title-cache-lifecycle",
    ]);
  });

  it("registers the Search-first condition URL budget as an independent profile", async () => {
    const { resolveArchitectureFitnessProfile } = await loadLighthouseProfiles();

    const profile = resolveArchitectureFitnessProfile("issue-399-serialized-input-budget");

    expect(profile.id).toBe("issue-399-serialized-input-budget");
    expect(profile.policy).toBe(
      path.join(pilotRoot, "issue-399-serialized-input-budget.policy.json"),
    );
    expect(profile.collector).toBe(
      path.join(processRoot, "collect-search-condition-url-budget.mjs"),
    );
    expect(profile.mergePolicy.requiredCaseRefs).toEqual([
      "issue-399:search-first-condition-url-budget",
    ]);
  });

  it("registers the issue 401 gap and inline-analysis cases as independent profiles", async () => {
    const { resolveArchitectureFitnessProfile } = await loadLighthouseProfiles();

    const gap = resolveArchitectureFitnessProfile("issue-401-gap-shared-state-boundary");
    expect(gap.policy).toBe(path.join(pilotRoot, "issue-401-gap-shared-state.policy.json"));
    expect(gap.collector).toBe(path.join(processRoot, "collect-gap-shared-state-boundary.mjs"));
    expect(gap.mergePolicy.requiredCaseRefs).toEqual([
      "issue-401:gap-shared-artifact-viewer-state-boundary",
    ]);

    const inline = resolveArchitectureFitnessProfile("issue-401-inline-analysis-cache-lifecycle");
    expect(inline.policy).toBe(
      path.join(pilotRoot, "issue-401-inline-analysis-cache-lifecycle.policy.json"),
    );
    expect(inline.collector).toBe(
      path.join(processRoot, "collect-inline-analysis-cache-lifecycle.mjs"),
    );
    expect(inline.mergePolicy.requiredCaseRefs).toEqual([
      "issue-401:inline-analysis-cache-lifecycle",
    ]);
  });

  it("executes Q2 behavior from the digest-covered base harness", async () => {
    const targetRoot = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-q2-target-"));
    try {
      const archive = execFileSync("git", ["archive", "--format=tar", "HEAD"], {
        cwd: repoRoot,
        maxBuffer: 64 * 1024 * 1024,
      });
      const extracted = spawnSync("tar", ["-x", "-C", targetRoot], {
        input: archive,
        maxBuffer: 64 * 1024 * 1024,
      });
      expect(extracted.status, String(extracted.stderr)).toBe(0);
      await symlink(
        path.join(repoRoot, "node_modules"),
        path.join(targetRoot, "node_modules"),
        "dir",
      );
      const tamperedTest =
        'import { describe, expect, it } from "vitest"; describe("tampered", () => { it("always passes", () => expect(true).toBe(true)); });\n';
      await writeFile(
        path.join(
          targetRoot,
          "scripts",
          "architecture-fitness",
          "__tests__",
          "q2-macro-boundaries.test.ts",
        ),
        tamperedTest,
        "utf8",
      );
      await writeFile(
        path.join(targetRoot, "app", "server", "services", "__tests__", "search-execution.test.ts"),
        tamperedTest,
        "utf8",
      );
      const renamedKeywordSearchExport = "loadKeywordPapersFromProvider";
      const targetSearchServicePath = path.join(
        targetRoot,
        "app",
        "server",
        "services",
        "search-service.ts",
      );
      const targetSearchExecutionPath = path.join(
        targetRoot,
        "app",
        "server",
        "services",
        "search-execution.ts",
      );
      const targetSearchService = await readFile(targetSearchServicePath, "utf8");
      const targetSearchExecution = await readFile(targetSearchExecutionPath, "utf8");
      const { executeBehaviorSuite, inspectSearchCriticalPathRole } = (await import(
        pathToFileURL(path.join(processRoot, "collect-q2-macro.mjs")).href
      )) as {
        executeBehaviorSuite: (root: string) => {
          exitCode: number;
          testResults: Array<{
            assertionResults: Array<{ fullName: string; status: string }>;
          }>;
        };
        inspectSearchCriticalPathRole: (
          source: string,
          targetRoot: string,
        ) => { keywordSearchExport: string };
      };
      const { keywordSearchExport } = inspectSearchCriticalPathRole(
        targetSearchExecution,
        targetRoot,
      );
      expect(targetSearchService).toContain(keywordSearchExport);
      expect(targetSearchExecution).toContain(keywordSearchExport);
      await writeFile(
        targetSearchServicePath,
        targetSearchService.replaceAll(keywordSearchExport, renamedKeywordSearchExport),
        "utf8",
      );
      await writeFile(
        targetSearchExecutionPath,
        targetSearchExecution.replaceAll(keywordSearchExport, renamedKeywordSearchExport),
        "utf8",
      );

      const report = executeBehaviorSuite(targetRoot);
      const assertionNames = report.testResults.flatMap((result) =>
        result.assertionResults.map((assertion) => assertion.fullName),
      );
      expect(report.exitCode, JSON.stringify(report, null, 2)).toBe(0);
      expect(assertionNames).toContain(
        "Q2 deployment topology rejects a dummy local declaration when breaker operations use external state",
      );
      expect(assertionNames).not.toContain("tampered always passes");

      const breakerPath = path.join(
        targetRoot,
        "app",
        "server",
        "external-http-gateway",
        "episteme-circuit-breaker.ts",
      );
      const breakerSource = await readFile(breakerPath, "utf8");
      await writeFile(
        breakerPath,
        breakerSource.replace("const circuitLanes", "const movedCircuitLanes"),
        "utf8",
      );
      expect(executeBehaviorSuite(targetRoot).exitCode).toBe(1);
    } finally {
      await rm(targetRoot, { recursive: true, force: true });
    }
  }, 30_000);

  it("pins the v0.9.1 portable archive and installs the exact generated core", async () => {
    const provenance = JSON.parse(await readFile(packagedSkillProvenance, "utf8")) as {
      schemaVersion: number;
      packageVersion: string;
      sourceRevision: string;
      artifactArchiveSha256: string;
      artifactTreeSha256: string;
      fileCount: number;
    };
    const archiveDigest = createHash("sha256")
      .update(await readFile(packagedSkill))
      .digest("hex");

    expect(provenance).toMatchObject({
      schemaVersion: 2,
      packageVersion: "0.9.1",
      sourceRevision: "6518ce21f0f755f85331ba7a8813772e4a43d51b",
      artifactArchiveSha256: archiveDigest,
      artifactTreeSha256: "408d008b26054cd017fe7542d8ebe4c08cd6ce10c3a4ca88b6208013b6d24ab8",
      fileCount: 49,
    });
    const result = spawnSync("python3", ["scripts/sync-agent-skills.py", "--check"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(
      await readFile(
        path.join(
          repoRoot,
          ".agents",
          "skills",
          "architecture-fitness-review",
          ".skill-sync-generated",
        ),
        "utf8",
      ),
    ).toContain("shared-skills/architecture-fitness-review.skill");
  });
});

describe("Architecture Fitness v0.9.1 executable contract", () => {
  it("normalizes Vitest paths across checkout aliases", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-path-alias-"));
    try {
      const realRoot = path.join(root, "real");
      const aliasRoot = path.join(root, "alias");
      const relativeTest = path.join(
        "app",
        "server",
        "domain-access",
        "__tests__",
        "reviewed-paper-access.auth-boundary.test.ts",
      );
      const reportedTest = path.join(realRoot, relativeTest);
      await mkdir(path.dirname(reportedTest), { recursive: true });
      await writeFile(reportedTest, "", "utf8");
      await symlink(realRoot, aliasRoot, "dir");
      const { normalizeVitestTestName } = (await import(pathToFileURL(collector).href)) as {
        normalizeVitestTestName: (name: string, targetRoot: string) => string;
      };

      expect(normalizeVitestTestName(reportedTest, aliasRoot)).toBe(
        `<target-revision>/${relativeTest.split(path.sep).join("/")}`,
      );
      const outsideTest = path.join(root, "outside.test.ts");
      await writeFile(outsideTest, "", "utf8");
      expect(() => normalizeVitestTestName(outsideTest, aliasRoot)).toThrow(
        "Vitest reported a test outside the target revision",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("collects the committed exact-revision observation deterministically", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-collector-"));
    try {
      const output = path.join(root, "observation.json");
      const result = spawnSync(
        process.execPath,
        [
          collector,
          "--policy",
          policyPath,
          "--revision",
          "87877a1a6448c5b355f4c3e7a07273b00c29776c",
          "--run-ref",
          "fixture-run:issue-449-least-authority:87877a1a",
          "--output",
          output,
        ],
        { cwd: repoRoot, encoding: "utf8" },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(await readFile(output, "utf8")).toBe(await readFile(observationPath, "utf8"));
      const observation = JSON.parse(await readFile(output, "utf8")) as {
        observations: Array<{
          completeness: string;
          paths: Array<{ enforcementRefs: string[] }>;
        }>;
      };
      expect(observation.observations[0]?.completeness).toBe("complete");
      expect(observation.observations[0]?.paths[0]?.enforcementRefs).toContain(
        "enforcement:opaque-repository-db-handle",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("rejects strict collector identity and source-revision mismatches", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-identity-"));
    try {
      const invalidPath = path.join(root, "invalid.json");
      const observation = JSON.parse(await readFile(observationPath, "utf8")) as {
        collector: { definitionDigest: string };
        evidence: Array<{ sourceRevision: string }>;
      };
      observation.collector.definitionDigest = "f".repeat(64);
      observation.evidence[0].sourceRevision = "wrong-revision";
      await writeFile(invalidPath, `${JSON.stringify(observation, null, 2)}\n`, "utf8");
      const result = spawnSync(
        "python3",
        ["-B", evaluator, "--policy", policyPath, "--observation", invalidPath, "--validate-only"],
        { cwd: repoRoot, encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("must equal /revision");
      expect(result.stderr).toContain("must match /policySet/collectorAuthority/definitionDigest");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports malformed evidence target refs without a validator traceback", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-target-shape-"));
    try {
      const invalidPath = path.join(root, "invalid-state-observation.json");
      const observation = JSON.parse(await readFile(stateObservationPath, "utf8")) as {
        evidence: Array<{ target: { stateRefs: unknown } }>;
      };
      observation.evidence[0].target.stateRefs = 7;
      await writeFile(invalidPath, `${JSON.stringify(observation, null, 2)}\n`, "utf8");
      const result = spawnSync(
        "python3",
        [
          "-B",
          evaluator,
          "--policy",
          path.join(pilotRoot, "issue-276.policy.json"),
          "--observation",
          invalidPath,
          "--validate-only",
        ],
        { cwd: repoRoot, encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("target/stateRefs must be an array");
      expect(result.stderr).not.toContain("Traceback");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports non-string evidence policy refs without a validator traceback", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-policy-ref-"));
    try {
      for (const [index, invalid] of [[], {}].entries()) {
        const invalidPath = path.join(root, `invalid-policy-ref-${String(index)}.json`);
        const observation = JSON.parse(await readFile(stateObservationPath, "utf8")) as {
          evidence: Array<{ target: { policyRef: unknown } }>;
        };
        observation.evidence[0].target.policyRef = invalid;
        await writeFile(invalidPath, `${JSON.stringify(observation, null, 2)}\n`, "utf8");
        const result = spawnSync(
          "python3",
          [
            "-B",
            evaluator,
            "--policy",
            path.join(pilotRoot, "issue-276.policy.json"),
            "--observation",
            invalidPath,
            "--validate-only",
          ],
          { cwd: repoRoot, encoding: "utf8" },
        );
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("target/policyRef must be a non-empty string");
        expect(result.stderr).not.toContain("Traceback");
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validates dispatch keys before policy lookup", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-dispatch-key-"));
    try {
      for (const [index, invalid] of [[], {}].entries()) {
        const invalidObservationPath = path.join(root, `invalid-observation-${String(index)}.json`);
        const observation = JSON.parse(await readFile(stateObservationPath, "utf8")) as {
          observations: Array<{ policyRef: unknown }>;
        };
        observation.observations[0].policyRef = invalid;
        await writeFile(
          invalidObservationPath,
          `${JSON.stringify(observation, null, 2)}\n`,
          "utf8",
        );
        const observationResult = spawnSync(
          "python3",
          [
            "-B",
            evaluator,
            "--policy",
            path.join(pilotRoot, "issue-276.policy.json"),
            "--observation",
            invalidObservationPath,
            "--validate-only",
          ],
          { cwd: repoRoot, encoding: "utf8" },
        );
        expect(observationResult.status).toBe(1);
        expect(observationResult.stderr).toContain("policyRef must be a non-empty string");
        expect(observationResult.stderr).not.toContain("Traceback");

        const invalidPolicyPath = path.join(root, `invalid-policy-${String(index)}.json`);
        const policy = JSON.parse(await readFile(statePolicyPath, "utf8")) as {
          policies: Array<{ caseKind: unknown }>;
        };
        policy.policies[0].caseKind = invalid;
        await writeFile(invalidPolicyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
        const policyResult = spawnSync(
          "python3",
          [
            "-B",
            evaluator,
            "--policy",
            invalidPolicyPath,
            "--observation",
            stateObservationPath,
            "--validate-only",
          ],
          { cwd: repoRoot, encoding: "utf8" },
        );
        expect(policyResult.status).toBe(1);
        expect(policyResult.stderr).toContain("caseKind must be a non-empty string");
        expect(policyResult.stderr).not.toContain("Traceback");
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps Lighthouse unsigned when the external core can verify a local HMAC", async () => {
    const { assertLighthouseCollectorAuthority, evaluateUnsignedObservation } =
      await loadLighthouseAdapter();
    const unsignedAssessment = evaluateUnsignedObservation(observationPath, spoofedLocalTrustEnv);
    expect(unsignedAssessment.collectorAttestation.status).toBe("unverified");
    expect(
      unsignedAssessment.caseAssessments.find(
        (item) => item.caseRef === "issue-278:reviewed-paper-owner-read",
      )?.verdicts,
    ).toEqual(["unknown"]);

    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-tamper-"));
    try {
      const signedPath = path.join(root, "signed.json");
      const signed = spawnSync(
        "python3",
        [
          "-B",
          attestor,
          "--policy",
          policyPath,
          "--observation",
          observationPath,
          "--output",
          signedPath,
        ],
        { cwd: repoRoot, encoding: "utf8", env: spoofedLocalTrustEnv },
      );
      expect(signed.status, signed.stderr).toBe(0);
      const selfSigned = spawnSync(
        "python3",
        ["-B", evaluator, "--policy", policyPath, "--observation", signedPath],
        { cwd: repoRoot, encoding: "utf8", env: spoofedLocalTrustEnv },
      );
      expect(selfSigned.status).toBe(3);
      const selfSignedAssessment = JSON.parse(selfSigned.stdout) as Assessment;
      expect(selfSignedAssessment.collectorAttestation.status).toBe("verified");
      expect(
        selfSignedAssessment.caseAssessments.find(
          (item) => item.caseRef === "issue-278:reviewed-paper-owner-read",
        )?.verdicts,
      ).toEqual(["healthy"]);

      const lighthouseAssessment = evaluateUnsignedObservation(signedPath, spoofedLocalTrustEnv);
      expect(lighthouseAssessment.collectorAttestation.status).toBe("unverified");
      expect(
        lighthouseAssessment.caseAssessments.find(
          (item) => item.caseRef === "issue-278:reviewed-paper-owner-read",
        )?.verdicts,
      ).toEqual(["unknown"]);
      const { evaluateMergeEligibility } = await loadMergeAdvisory();
      expect(
        evaluateMergeEligibility(lighthouseAssessment, {
          requiredCaseRefs: ["issue-278:reviewed-paper-owner-read"],
          unknownHandling: {
            "issue-278:reviewed-paper-owner-read": { mode: "requiredBeforeMerge" },
          },
          blockers: [],
          riskAcceptance: null,
        }).eligibility,
      ).toBe("block");

      const policy = JSON.parse(await readFile(policyPath, "utf8")) as {
        policySet: { collectorAuthority: Record<string, unknown> };
      };
      expect(() => {
        assertLighthouseCollectorAuthority({
          ...policy.policySet.collectorAuthority,
          attestorRef: "configured-looking:local-hmac",
        });
      }).toThrow("Unexpected Lighthouse authoritative attestor");

      const observation = JSON.parse(await readFile(signedPath, "utf8")) as {
        evidence: Array<{ summary: string }>;
      };
      observation.evidence[0].summary = "tampered after local signing";
      await writeFile(signedPath, `${JSON.stringify(observation, null, 2)}\n`, "utf8");
      const tampered = spawnSync(
        "python3",
        ["-B", evaluator, "--policy", policyPath, "--observation", signedPath],
        { cwd: repoRoot, encoding: "utf8", env: spoofedLocalTrustEnv },
      );
      expect(tampered.status).toBe(3);
      const assessment = JSON.parse(tampered.stdout) as Assessment;
      expect(assessment.collectorAttestation.status).toBe("unverified");
      expect(assessment.caseAssessments[0].verdicts).toEqual(["unknown"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validates bounded LLM candidates separately from verdict evidence", async () => {
    const valid = spawnSync(
      "python3",
      [
        "-B",
        candidateValidator,
        "--policy",
        policyPath,
        "--observation",
        observationPath,
        "--candidates",
        candidatePath,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(valid.status, valid.stderr).toBe(0);

    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-candidates-"));
    try {
      const invalidPath = path.join(root, "invalid-candidates.json");
      await writeFile(
        invalidPath,
        JSON.stringify({
          schemaVersion: "2",
          kind: "architecture-fitness-llm-candidates",
          serviceId: "lighthouse",
          policySetRef: "issue-278-least-authority",
          revision: "87877a1a6448c5b355f4c3e7a07273b00c29776c",
          candidates: [
            {
              id: "candidate:orphan",
              caseRef: "orphan-policy",
              claim: "candidate only",
              evidenceRefs: ["orphan-evidence"],
              causalPath: "candidate path",
              rejectedAlternative: "none",
              action: "verify deterministically",
              confidence: "medium",
              verificationPlan: ["run a deterministic check"],
              status: "verified",
            },
          ],
        }),
        "utf8",
      );
      const invalid = spawnSync(
        "python3",
        [
          "-B",
          candidateValidator,
          "--policy",
          policyPath,
          "--observation",
          observationPath,
          "--candidates",
          invalidPath,
        ],
        { cwd: repoRoot, encoding: "utf8" },
      );
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain("status must equal 'unverified'");
      expect(invalid.stderr).toContain("orphan policy ref");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps spoofed local key and GitHub-like environment values non-authoritative", async () => {
    const { resolveAttestationMode } = await loadLighthouseAdapter();

    expect(resolveAttestationMode(spoofedLocalTrustEnv)).toBe("unsigned-local");
  });
});

describe("Lighthouse protected Architecture Fitness attestation", () => {
  it("attests only the invocation-bound observations and independently verifies the bundle", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-authoritative-"));
    try {
      const rawDirectory = path.join(root, "raw");
      const bundleDirectory = path.join(root, "bundle");
      await writeInvocationBoundRawObservations(rawDirectory);
      const { attestAuthoritativeBundle, verifyAuthoritativeBundle } =
        await loadAuthoritativeAttestation();
      await attestAuthoritativeBundle({
        rawDirectory,
        bundleDirectory,
        invocation: authoritativeInvocation,
        environment: spoofedLocalTrustEnv,
      });
      const verification = await verifyAuthoritativeBundle({
        bundleDirectory,
        invocation: authoritativeInvocation,
        environment: spoofedLocalTrustEnv,
      });

      expect(verification.status).toBe("verified");
      expect(verification.mergeEligibility).toBe("allow");
      expect(verification.target.caseVerdicts["issue-278:reviewed-paper-owner-read"]).toEqual([
        "healthy",
      ]);
      expect(
        verification.target.caseVerdicts["issue-278:least-authority-boundary-conformance"],
      ).toEqual(["unknown"]);
      expect(verification.target.coverageVerdicts["coverage:resilience"]).toEqual(["unknown"]);
      const provenancePath = path.join(bundleDirectory, "provenance.json");
      const originalProvenance = await readFile(provenancePath, "utf8");
      const provenance = JSON.parse(originalProvenance) as {
        rawInputArtifact: {
          archiveSha256: string;
          observations: Record<string, { file: string; sha256: string }>;
        };
      };
      expect(provenance.rawInputArtifact.archiveSha256).toBe(
        authoritativeInvocation.rawArtifactDigest,
      );
      expect(provenance.rawInputArtifact.observations.target.file).toBe(
        "target.raw-observation.json",
      );
      for (const file of await readdir(bundleDirectory)) {
        expect(await readFile(path.join(bundleDirectory, file), "utf8")).not.toContain(
          spoofedLocalTrustEnv.ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1,
        );
      }

      const provenanceTamperCases: Array<(value: Record<string, unknown>) => void> = [
        (value) => {
          const core = value.core as Record<string, unknown>;
          core.sourceRevision = "f".repeat(40);
        },
        (value) => {
          value.policyDigest = "f".repeat(64);
        },
        (value) => {
          value.collectorDefinitionDigest = "f".repeat(64);
        },
        (value) => {
          const target = value.target as { caseVerdicts: Record<string, string[]> };
          target.caseVerdicts["issue-278:reviewed-paper-owner-read"] = ["degraded"];
        },
        (value) => {
          value.mergeEligibility = "block";
        },
      ];
      for (const tamper of provenanceTamperCases) {
        const changed = JSON.parse(originalProvenance) as Record<string, unknown>;
        tamper(changed);
        await writeFile(provenancePath, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
        await expect(
          verifyAuthoritativeBundle({
            bundleDirectory,
            invocation: authoritativeInvocation,
            environment: spoofedLocalTrustEnv,
          }),
        ).rejects.toThrow();
      }
      await writeFile(provenancePath, originalProvenance, "utf8");

      const signedTarget = path.join(bundleDirectory, "target.observation.json");
      const originalTarget = await readFile(signedTarget, "utf8");
      const tampered = JSON.parse(originalTarget) as { evidence: Array<{ summary: string }> };
      tampered.evidence[0].summary = "tampered after protected attestation";
      await writeFile(signedTarget, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
      await expect(
        verifyAuthoritativeBundle({
          bundleDirectory,
          invocation: authoritativeInvocation,
          environment: spoofedLocalTrustEnv,
        }),
      ).rejects.toThrow("Artifact payload digest mismatch");
      await writeFile(signedTarget, originalTarget, "utf8");

      const rawTarget = path.join(bundleDirectory, "target.raw-observation.json");
      const originalRawTarget = await readFile(rawTarget, "utf8");
      const tamperedRaw = JSON.parse(originalRawTarget) as {
        evidence: Array<{ summary: string }>;
      };
      tamperedRaw.evidence[0].summary = "tampered raw input after protected attestation";
      await writeFile(rawTarget, `${JSON.stringify(tamperedRaw, null, 2)}\n`, "utf8");
      await expect(
        verifyAuthoritativeBundle({
          bundleDirectory,
          invocation: authoritativeInvocation,
          environment: spoofedLocalTrustEnv,
        }),
      ).rejects.toThrow("Artifact payload digest mismatch: target.raw-observation.json");

      const forgedRawDigest = createHash("sha256")
        .update(await readFile(rawTarget))
        .digest("hex");
      provenance.rawInputArtifact.observations.target.sha256 = forgedRawDigest;
      const provenanceArtifacts = provenance as typeof provenance & {
        artifacts: Record<string, { sha256: string }>;
      };
      provenanceArtifacts.artifacts["target.raw-observation.json"].sha256 = forgedRawDigest;
      await writeFile(provenancePath, `${JSON.stringify(provenanceArtifacts, null, 2)}\n`, "utf8");
      await expect(
        verifyAuthoritativeBundle({
          bundleDirectory,
          invocation: authoritativeInvocation,
          environment: spoofedLocalTrustEnv,
        }),
      ).rejects.toThrow("target signed observation does not match protected verifier output");
      await writeFile(rawTarget, originalRawTarget, "utf8");
      await writeFile(provenancePath, originalProvenance, "utf8");

      await expect(
        verifyAuthoritativeBundle({
          bundleDirectory,
          invocation: { ...authoritativeInvocation, runId: "54321" },
          environment: spoofedLocalTrustEnv,
        }),
      ).rejects.toThrow("Invocation provenance does not match");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("attests the Q1 state-boundary profile without upgrading unsupported lenses", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-state-authority-"));
    try {
      const rawDirectory = path.join(root, "raw");
      const bundleDirectory = path.join(root, "bundle");
      await writeInvocationBoundStateObservations(rawDirectory);
      const { attestAuthoritativeBundle, verifyAuthoritativeBundle } =
        await loadAuthoritativeAttestation();
      const profileId = "issue-276-search-state-boundary";
      await attestAuthoritativeBundle({
        rawDirectory,
        bundleDirectory,
        invocation: authoritativeInvocation,
        environment: spoofedLocalTrustEnv,
        profileId,
      });
      const verification = await verifyAuthoritativeBundle({
        bundleDirectory,
        invocation: authoritativeInvocation,
        environment: spoofedLocalTrustEnv,
        profileId,
      });

      expect(verification.status).toBe("verified");
      expect(verification.mergeEligibility).toBe("allow");
      expect(verification.target.caseVerdicts["issue-276:keyword-search-state-boundary"]).toEqual([
        "healthy",
      ]);
      expect(verification.target.coverageVerdicts["coverage:issue-276-product-outcome"]).toEqual([
        "unknown",
      ]);
      expect(verification.target.coverageVerdicts["coverage:issue-276-technical-grain"]).toEqual([
        "unknown",
      ]);
      expect(
        verification.target.coverageVerdicts["coverage:issue-276-process-effectiveness"],
      ).toEqual(["unknown"]);
      const provenance = JSON.parse(
        await readFile(path.join(bundleDirectory, "provenance.json"), "utf8"),
      ) as { profileId: string };
      expect(provenance.profileId).toBe(profileId);

      await expect(
        verifyAuthoritativeBundle({
          bundleDirectory,
          invocation: authoritativeInvocation,
          environment: spoofedLocalTrustEnv,
        }),
      ).rejects.toThrow("provenance profile does not match");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("attests both Q2 cases without upgrading fleet or latency coverage", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-q2-authority-"));
    try {
      const rawDirectory = path.join(root, "raw");
      const bundleDirectory = path.join(root, "bundle");
      await writeInvocationBoundQ2Observations(rawDirectory);
      const { attestAuthoritativeBundle, verifyAuthoritativeBundle } =
        await loadAuthoritativeAttestation();
      const profileId = "issue-280-281-q2-macro";
      await attestAuthoritativeBundle({
        rawDirectory,
        bundleDirectory,
        invocation: authoritativeInvocation,
        environment: spoofedLocalTrustEnv,
        profileId,
      });
      const verification = await verifyAuthoritativeBundle({
        bundleDirectory,
        invocation: authoritativeInvocation,
        environment: spoofedLocalTrustEnv,
        profileId,
      });

      expect(verification.status).toBe("verified");
      expect(verification.mergeEligibility).toBe("allow");
      expect(verification.target.caseVerdicts["issue-280:episteme-breaker-process-scope"]).toEqual([
        "healthy",
      ]);
      expect(verification.target.caseVerdicts["issue-281:first-ready-search-payload"]).toEqual([
        "healthy",
      ]);
      expect(
        verification.target.coverageVerdicts["coverage:issue-280-provider-account-hard-cap"],
      ).toEqual(["unknown"]);
      expect(verification.target.coverageVerdicts["coverage:issue-281-production-latency"]).toEqual(
        ["unknown"],
      );
      expect(verification.target.coverageVerdicts["coverage:q2-process-effectiveness"]).toEqual([
        "unknown",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("attests the Q3 launch envelope without upgrading production coverage", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-q3-authority-"));
    try {
      const rawDirectory = path.join(root, "raw");
      const bundleDirectory = path.join(root, "bundle");
      await writeInvocationBoundQ3Observations(rawDirectory);
      const { attestAuthoritativeBundle, verifyAuthoritativeBundle } =
        await loadAuthoritativeAttestation();
      const profileId = "issue-286-q3-workload";
      await attestAuthoritativeBundle({
        rawDirectory,
        bundleDirectory,
        invocation: authoritativeInvocation,
        environment: spoofedLocalTrustEnv,
        profileId,
      });
      const verification = await verifyAuthoritativeBundle({
        bundleDirectory,
        invocation: authoritativeInvocation,
        environment: spoofedLocalTrustEnv,
        profileId,
      });

      expect(verification.status).toBe("verified");
      expect(verification.mergeEligibility).toBe("allow");
      expect(verification.target.caseVerdicts["issue-286:search-workload-envelope"]).toEqual([
        "healthy",
      ]);
      expect(
        verification.target.coverageVerdicts["coverage:issue-286-production-fleet-provider-cap"],
      ).toEqual(["unknown"]);
      expect(
        verification.target.coverageVerdicts["coverage:issue-286-production-operational-slo"],
      ).toEqual(["unknown"]);
      expect(
        verification.target.coverageVerdicts["coverage:issue-286-real-provider-amplification"],
      ).toEqual(["unknown"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("attests the Q4 seams without upgrading runtime or process coverage", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-q4-authority-"));
    try {
      const rawDirectory = path.join(root, "raw");
      const bundleDirectory = path.join(root, "bundle");
      await writeInvocationBoundQ4Observations(rawDirectory);
      const { attestAuthoritativeBundle, verifyAuthoritativeBundle } =
        await loadAuthoritativeAttestation();
      const profileId = "issue-297-q4-technical-grain";
      await attestAuthoritativeBundle({
        rawDirectory,
        bundleDirectory,
        invocation: authoritativeInvocation,
        environment: spoofedLocalTrustEnv,
        profileId,
      });
      const verification = await verifyAuthoritativeBundle({
        bundleDirectory,
        invocation: authoritativeInvocation,
        environment: spoofedLocalTrustEnv,
        profileId,
      });

      expect(verification.status).toBe("verified");
      expect(verification.mergeEligibility).toBe("allow");
      expect(verification.target.caseVerdicts["issue-297:technical-grain-conformance"]).toEqual([
        "healthy",
      ]);
      for (const coverageRef of [
        "coverage:issue-297-dynamic-effect-paths",
        "coverage:issue-297-mechanism-only-future-locality",
        "coverage:issue-297-production-background-lifetime",
        "coverage:q4-process-effectiveness",
      ]) {
        expect(verification.target.coverageVerdicts[coverageRef]).toEqual(["unknown"]);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("attests the bounded Q5 cache lifecycle without upgrading fleet coverage", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-q5-authority-"));
    try {
      const rawDirectory = path.join(root, "raw");
      const bundleDirectory = path.join(root, "bundle");
      await writeInvocationBoundQ5Observations(rawDirectory);
      const { attestAuthoritativeBundle, verifyAuthoritativeBundle } =
        await loadAuthoritativeAttestation();
      const profileId = "issue-298-q5-cache-lifecycle";
      const q5Invocation = {
        ...authoritativeInvocation,
        rawArtifactId: "29800",
        rawArtifactDigest: "5".repeat(64),
      };
      await attestAuthoritativeBundle({
        rawDirectory,
        bundleDirectory,
        invocation: q5Invocation,
        environment: spoofedLocalTrustEnv,
        profileId,
      });
      const verification = await verifyAuthoritativeBundle({
        bundleDirectory,
        invocation: q5Invocation,
        environment: spoofedLocalTrustEnv,
        profileId,
      });

      expect(verification.status).toBe("verified");
      expect(verification.mergeEligibility).toBe("allow");
      expect(verification.target.caseVerdicts["issue-298:preset-title-cache-lifecycle"]).toEqual([
        "healthy",
      ]);
      for (const coverageRef of [
        "coverage:issue-298-reviewed-papers-fleet",
        "coverage:issue-298-inline-analysis-fleet",
        "coverage:issue-298-cache-cleanup-effects",
        "coverage:issue-298-production-cache-observability",
        "coverage:q5-process-effectiveness",
      ]) {
        expect(verification.target.coverageVerdicts[coverageRef]).toEqual(["unknown"]);
      }
      const provenance = JSON.parse(
        await readFile(path.join(bundleDirectory, "provenance.json"), "utf8"),
      ) as {
        rawInputArtifact: { id: string; archiveSha256: string };
      };
      expect(provenance.rawInputArtifact).toMatchObject({
        id: q5Invocation.rawArtifactId,
        archiveSha256: q5Invocation.rawArtifactDigest,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an untrusted workflow ref or missing protected key before signing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-authority-reject-"));
    try {
      const rawDirectory = path.join(root, "raw");
      await writeInvocationBoundRawObservations(rawDirectory);
      const { attestAuthoritativeBundle } = await loadAuthoritativeAttestation();
      await expect(
        attestAuthoritativeBundle({
          rawDirectory,
          bundleDirectory: path.join(root, "wrong-workflow"),
          invocation: {
            ...authoritativeInvocation,
            workflowRef:
              "external-contributor/lighthouse/.github/workflows/architecture-fitness-attestation.yml@refs/heads/main",
          },
          environment: spoofedLocalTrustEnv,
        }),
      ).rejects.toThrow("Authoritative workflow ref must equal");

      await expect(
        attestAuthoritativeBundle({
          rawDirectory,
          bundleDirectory: path.join(root, "fork-target"),
          invocation: {
            ...authoritativeInvocation,
            targetRepository: "external-contributor/lighthouse",
          },
          environment: spoofedLocalTrustEnv,
        }),
      ).rejects.toThrow("Authoritative target repository must equal corca-ai/lighthouse");

      const environment: NodeJS.ProcessEnv = { ...spoofedLocalTrustEnv };
      delete environment.ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1;
      await expect(
        attestAuthoritativeBundle({
          rawDirectory,
          bundleDirectory: path.join(root, "missing-key"),
          invocation: authoritativeInvocation,
          environment,
        }),
      ).rejects.toThrow("Protected attestation key");

      await expect(
        attestAuthoritativeBundle({
          rawDirectory,
          bundleDirectory: path.join(root, "missing-python"),
          invocation: authoritativeInvocation,
          environment: { ...spoofedLocalTrustEnv, PATH: "/definitely-missing" },
        }),
      ).rejects.toThrow("evaluate.py failed to start");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("measures protected key minimums in UTF-8 bytes", async () => {
    const { resolveAuthoritativeAttestationKey } = await loadLighthouseTrustPolicy();
    const key = "é".repeat(16);

    expect(
      resolveAuthoritativeAttestationKey({
        NODE_ENV: "test",
        ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1: key,
      }),
    ).toBe(key);
  });

  it("accepts only the exact protected-main authority tuple", async () => {
    const { assertAuthoritativeInvocation } = await loadLighthouseTrustPolicy();
    const mainInvocation = { ...authoritativeInvocation };

    expect(assertAuthoritativeInvocation(mainInvocation)).toBe(mainInvocation);
    expect(() =>
      assertAuthoritativeInvocation({
        ...mainInvocation,
        workflowSha: mainInvocation.baseRevision,
      }),
    ).toThrow("Trusted workflow SHA must equal the protected main target revision");
    expect(() =>
      assertAuthoritativeInvocation({
        ...mainInvocation,
        pullRequestNumber: "287",
      }),
    ).toThrow("Protected main rebind must not claim a pull request number");
    expect(() =>
      assertAuthoritativeInvocation({
        ...mainInvocation,
        event: "pull_request_target",
      }),
    ).toThrow("Authoritative event must equal workflow_dispatch");
  });

  it("rejects an observation collected for a different target revision", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-target-mismatch-"));
    try {
      const rawDirectory = path.join(root, "raw");
      await writeInvocationBoundRawObservations(rawDirectory);
      const targetPath = path.join(rawDirectory, "target.observation.json");
      const target = JSON.parse(await readFile(targetPath, "utf8")) as { revision: string };
      target.revision = "f".repeat(40);
      await writeFile(targetPath, `${JSON.stringify(target, null, 2)}\n`, "utf8");

      const { attestAuthoritativeBundle } = await loadAuthoritativeAttestation();
      await expect(
        attestAuthoritativeBundle({
          rawDirectory,
          bundleDirectory: path.join(root, "bundle"),
          invocation: authoritativeInvocation,
          environment: spoofedLocalTrustEnv,
        }),
      ).rejects.toThrow("target observation revision does not match the invocation");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("seals Q4 source evidence and isolates Q5 target behavior before protected attestation", async () => {
    const workflow = await readFile(
      path.join(repoRoot, ".github", "workflows", "architecture-fitness-attestation.yml"),
      "utf8",
    );
    const parsed = YAML.parse(workflow) as {
      on: Record<string, unknown>;
      concurrency?: Record<string, unknown>;
      jobs: Record<
        string,
        {
          environment?: string;
          needs?: string | string[];
          permissions?: Record<string, string>;
          env?: Record<string, string>;
          if?: string;
          outputs?: Record<string, string>;
          strategy?: {
            matrix?: {
              include?: Array<{ policy?: string }>;
            };
          };
          steps: Array<{
            env?: Record<string, string>;
            if?: string;
            name?: string;
            run?: string;
            uses?: string;
            with?: {
              ref?: string;
              "fetch-depth"?: number;
              "persist-credentials"?: boolean;
              "artifact-ids"?: string;
              cache?: string;
              "if-no-files-found"?: string;
              "merge-multiple"?: boolean;
              "python-version"?: string;
              "retention-days"?: number;
            };
          }>;
        }
      >;
    };
    const resolveJob = parsed.jobs.resolve;
    const profileCollectJob = parsed.jobs.collect_profiles;
    const collectJob = parsed.jobs.collect;
    const q5CollectJob = parsed.jobs.collect_q5;
    const protectedJob = parsed.jobs["attest-and-verify"];
    const workflowDispatch = parsed.on.workflow_dispatch;
    expect(Object.keys(parsed.on)).toEqual(["workflow_dispatch"]);
    expect(workflowDispatch).toEqual({});
    expect(parsed.concurrency?.["cancel-in-progress"]).toBe(true);
    expect(parsed.concurrency?.group).toBe("architecture-fitness-protected-main-rebind");
    expect(JSON.stringify(collectJob)).not.toContain("secrets.");
    expect(JSON.stringify(collectJob)).not.toContain("ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1");
    expect(JSON.stringify(q5CollectJob)).not.toContain("secrets.");
    expect(JSON.stringify(q5CollectJob)).not.toContain("ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1");
    expect(resolveJob.if).toBe("github.ref == 'refs/heads/main'");
    expect(JSON.stringify(resolveJob)).not.toContain("secrets.");
    expect(JSON.stringify(resolveJob)).toContain("protected workflow revision must equal");
    expect(JSON.stringify(resolveJob)).toContain(
      "Previous-main collector identity is not a bootstrap prerequisite",
    );
    expect(profileCollectJob.needs).toBe("resolve");
    expect(JSON.stringify(profileCollectJob)).toContain('"fail-fast":false');
    const { listProtectedArchitectureFitnessProfiles } = await loadLighthouseProfiles();
    expect(profileCollectJob.strategy?.matrix?.include?.map((item) => item.policy)).toEqual(
      listProtectedArchitectureFitnessProfiles()
        .filter(
          (profile) =>
            profile.id !== "issue-297-q4-technical-grain" &&
            profile.id !== "issue-298-q5-cache-lifecycle",
        )
        .map((profile) => path.relative(repoRoot, profile.policy)),
    );
    expect(JSON.stringify(profileCollectJob)).toContain("collect-relationship-state-boundary.mjs");
    expect(JSON.stringify(profileCollectJob)).toContain("collect-q2-macro.mjs");
    expect(JSON.stringify(profileCollectJob)).not.toContain("collect-q3-workload.mjs");
    expect(JSON.stringify(profileCollectJob)).toContain("architecture-fitness:check-publication");
    expect(JSON.stringify(profileCollectJob)).toContain(
      ".agents/skills/architecture-fitness-review/scripts/evaluate.py",
    );
    expect(JSON.stringify(profileCollectJob)).toContain("--validate-only");
    expect(JSON.stringify(profileCollectJob)).toContain("non-authoritative profile diagnostics");
    expect(collectJob.needs).toEqual(["resolve", "collect_profiles"]);
    expect(q5CollectJob.needs).toBe("resolve");
    expect(q5CollectJob.permissions).toEqual({ contents: "read" });
    expect(protectedJob.needs).toEqual(["resolve", "collect", "collect_q5"]);
    expect(protectedJob.environment).toBe("architecture-fitness-attestor");
    expect(JSON.stringify(protectedJob)).toContain(
      "secrets.ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1",
    );
    const protectedCheckout = protectedJob.steps.find((step) =>
      step.uses?.startsWith("actions/checkout@"),
    );
    expect(protectedCheckout?.with?.ref).toBe("${{ needs.resolve.outputs.target-revision }}");
    expect(protectedCheckout?.with?.["persist-credentials"]).toBe(false);
    expect(protectedCheckout?.uses).toMatch(/^actions\/checkout@[0-9a-f]{40}$/);
    for (const job of [collectJob, q5CollectJob, protectedJob]) {
      const pythonSetup = job.steps.find((step) => step.uses?.startsWith("actions/setup-python@"));
      expect(pythonSetup?.uses).toMatch(/^actions\/setup-python@[0-9a-f]{40}$/);
      expect(pythonSetup?.with?.["python-version"]).toBe("3.12");
    }
    const collectionCheckout = collectJob.steps.find((step) =>
      step.uses?.startsWith("actions/checkout@"),
    );
    expect(collectionCheckout?.with?.["fetch-depth"]).toBe(0);
    expect(collectionCheckout?.with?.["persist-credentials"]).toBe(false);
    const q5Checkout = q5CollectJob.steps.find((step) =>
      step.uses?.startsWith("actions/checkout@"),
    );
    expect(q5Checkout?.with?.ref).toBe("${{ needs.resolve.outputs.target-revision }}");
    expect(q5Checkout?.with?.["fetch-depth"]).toBe(0);
    expect(q5Checkout?.with?.["persist-credentials"]).toBe(false);
    const q5NodeSetup = q5CollectJob.steps.find((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    expect(q5NodeSetup?.with?.cache).toBeUndefined();
    const resolveCheckout = resolveJob.steps.find((step) =>
      step.uses?.startsWith("actions/checkout@"),
    );
    expect(resolveCheckout?.with?.ref).toBe("${{ github.sha }}");
    expect(resolveCheckout?.with?.["fetch-depth"]).toBe(0);
    expect(resolveCheckout?.with?.["persist-credentials"]).toBe(false);
    expect(resolveJob.outputs?.["base-revision"]).toContain("rebind-revisions");
    expect(resolveJob.outputs?.["target-revision"]).toContain("rebind-revisions");
    expect(JSON.stringify(collectJob)).not.toContain(
      "scripts/architecture-fitness/check-protected-collector-compatibility.mjs",
    );
    expect(JSON.stringify(collectJob)).toContain("architecture-fitness:check-publication");
    expect(JSON.stringify(q5CollectJob)).toContain("architecture-fitness:check-publication");
    expect(JSON.stringify(collectJob)).toContain(
      ".agents/skills/architecture-fitness-review/scripts/evaluate.py",
    );
    expect(JSON.stringify(collectJob)).toContain("--validate-only");
    expect(JSON.stringify(q5CollectJob)).toContain("--validate-only");
    expect(JSON.stringify(collectJob)).toContain("non-authoritative Q4 diagnostics");
    expect(JSON.stringify(q5CollectJob)).toContain("non-authoritative Q5 target diagnostics");
    const targetRevisionCheck = collectJob.steps.find(
      (step) => step.name === "Verify exact base-target revision pair is present",
    );
    expect(targetRevisionCheck?.run).toContain('git cat-file -e "${BASE_REVISION}^{commit}"');
    expect(targetRevisionCheck?.run).toContain('git cat-file -e "${TARGET_REVISION}^{commit}"');
    expect(targetRevisionCheck?.run).not.toContain("git merge-base --is-ancestor");
    const rebindRevisionStep = resolveJob.steps.find(
      (step) => step.name === "Resolve exact protected-main rebind revisions",
    );
    expect(rebindRevisionStep?.run).toContain(
      'BASE_REVISION="$(git rev-parse "${TARGET_REVISION}^")"',
    );
    expect(rebindRevisionStep?.run).toContain(
      'git merge-base --is-ancestor "$BASE_REVISION" "$TARGET_REVISION"',
    );
    expect(targetRevisionCheck?.run).not.toContain("git fetch");
    const q5TargetRevisionCheck = q5CollectJob.steps.find(
      (step) => step.name === "Verify exact Q5 target revision is present",
    );
    expect(q5TargetRevisionCheck?.run).toContain('git cat-file -e "${TARGET_REVISION}^{commit}"');
    expect(q5TargetRevisionCheck?.run).not.toContain("git fetch");
    const q4Collection = collectJob.steps.find(
      (step) => step.name === "Collect source-only Q4 observations before target behavior",
    );
    const q4Upload = collectJob.steps.find(
      (step) => step.name === "Seal immutable source-only Q4 artifact",
    );
    const q4Diagnostic = collectJob.steps.find(
      (step) => step.name === "Preserve non-authoritative Q4 diagnostics on failure",
    );
    const q5BaseDiagnostic = collectJob.steps.find(
      (step) => step.name === "Preserve non-authoritative Q5 base diagnostics on failure",
    );
    const collection = collectJob.steps.find(
      (step) => step.name === "Collect exact base and target observations without secrets",
    );
    const rawUpload = collectJob.steps.find(
      (step) => step.name === "Upload immutable raw observation artifact",
    );
    const protectedDiagnostic = collectJob.steps.find(
      (step) => step.name === "Preserve non-authoritative protected diagnostics on failure",
    );
    const profileCollection = profileCollectJob.steps.find(
      (step) => step.name === "Collect exact base and target profile observations",
    );
    const profilePublication = profileCollectJob.steps.find(
      (step) => step.name === "Refuse partial or failed profile publication",
    );
    const profileDiagnostic = profileCollectJob.steps.find(
      (step) => step.name === "Preserve non-authoritative profile diagnostics on failure",
    );
    const profileUpload = profileCollectJob.steps.find(
      (step) => step.name === "Seal profile observations",
    );
    if (!profileCollection || !profilePublication || !profileDiagnostic || !profileUpload) {
      throw new Error("Architecture Fitness profile publication steps are incomplete");
    }
    expect(profileCollectJob.steps.indexOf(profileCollection)).toBeLessThan(
      profileCollectJob.steps.indexOf(profilePublication),
    );
    expect(profileCollectJob.steps.indexOf(profilePublication)).toBeLessThan(
      profileCollectJob.steps.indexOf(profileUpload),
    );
    expect(profilePublication.run).toContain('"$OUTPUT_DIRECTORY/base.observation.json"');
    expect(profilePublication.run).toContain('"$OUTPUT_DIRECTORY/target.observation.json"');
    expect(profileDiagnostic.if).toBe("failure()");
    expect(profileDiagnostic.with?.["retention-days"]).toBe(3);
    expect(profileDiagnostic.with?.["if-no-files-found"]).toBe("warn");
    if (!q4Collection || !q4Upload || !collection) {
      throw new Error("Architecture Fitness collection steps are incomplete");
    }
    expect(q4Collection.run).toContain("collect-q4-technical-grain.mjs");
    expect(q4Collection.run).toContain("architecture-fitness-q4-raw/base.observation.json");
    expect(q4Collection.run).toContain("architecture-fitness-q4-raw/target.observation.json");
    expect(q4Upload.with?.["artifact-ids"]).toBeUndefined();
    expect(q4Upload.with?.["merge-multiple"]).toBeUndefined();
    expect(collectJob.steps.indexOf(q4Upload)).toBeLessThan(collectJob.steps.indexOf(collection));
    expect(collectJob.outputs?.["q4-artifact-id"]).toContain("q4-raw-artifact");
    expect(collection.uses).toContain("actions/download-artifact@");
    expect(JSON.stringify(collection.with)).toContain("architecture-fitness-profile-*");
    expect(collection.with?.["merge-multiple"]).toBe(true);
    const q5BaseCollection = collectJob.steps.find(
      (step) => step.name === "Collect trusted Q5 base behavior in the collector-authority lane",
    );
    const q5BaseUpload = collectJob.steps.find(
      (step) => step.name === "Seal immutable trusted Q5 base observation",
    );
    const q5Collection = q5CollectJob.steps.find(
      (step) => step.name === "Collect Q5 behavior in the credential-isolated target harness",
    );
    const q5Upload = q5CollectJob.steps.find(
      (step) => step.name === "Upload immutable Q5-only target observation artifact",
    );
    const q5TargetDiagnostic = q5CollectJob.steps.find(
      (step) => step.name === "Preserve non-authoritative Q5 target diagnostics on failure",
    );
    if (!q5BaseCollection || !q5BaseUpload || !q5Collection || !q5Upload) {
      throw new Error("Architecture Fitness Q5 isolation steps are incomplete");
    }
    expect(q5BaseCollection.run).toContain("collect-q5-cache-lifecycle.mjs");
    expect(q5BaseCollection.run).toContain(
      "architecture-fitness-q5-base-raw/base.observation.json",
    );
    expect(q5BaseCollection.run).not.toContain("TARGET_REVISION");
    expect(collectJob.steps.indexOf(q5BaseUpload)).toBeLessThan(
      collectJob.steps.indexOf(collection),
    );
    expect(collectJob.outputs?.["q5-base-artifact-id"]).toContain("q5-base-raw-artifact");
    expect(q5Collection.run).toContain("collect-q5-cache-lifecycle.mjs");
    expect(q5Collection.run).toContain(
      "architecture-fitness-q5-target-raw/target.observation.json",
    );
    expect(q5Collection.run).not.toContain("base.observation.json");
    expect(q5Collection.run).not.toContain("BASE_REVISION");
    expect(q5Collection.run).not.toContain("architecture-fitness-raw/");
    expect(q5Collection.run).not.toContain("architecture-fitness-q4-raw/");
    expect(JSON.stringify(q5Collection)).not.toContain("secrets.");
    expect(q5Upload.with?.["artifact-ids"]).toBeUndefined();
    expect(q5Upload.with?.["merge-multiple"]).toBeUndefined();
    expect(q5CollectJob.outputs?.["target-artifact-id"]).toContain("q5-target-raw-artifact");
    const rawDownload = protectedJob.steps.find(
      (step) => step.name === "Download raw observations from this workflow run",
    );
    expect(rawDownload?.with?.["artifact-ids"]).toBe("${{ needs.collect.outputs.artifact-id }}");
    expect(rawDownload?.with?.["merge-multiple"]).toBe(true);
    const q4Download = protectedJob.steps.find(
      (step) => step.name === "Download sealed source-only Q4 observations",
    );
    expect(q4Download?.with?.["artifact-ids"]).toBe("${{ needs.collect.outputs.q4-artifact-id }}");
    expect(q4Download?.with?.["merge-multiple"]).toBe(true);
    const q5BaseDownload = protectedJob.steps.find(
      (step) => step.name === "Download sealed Q5 base observation",
    );
    expect(q5BaseDownload?.with?.["artifact-ids"]).toBe(
      "${{ needs.collect.outputs.q5-base-artifact-id }}",
    );
    expect(q5BaseDownload?.with?.["merge-multiple"]).toBe(true);
    const q5TargetDownload = protectedJob.steps.find(
      (step) => step.name === "Download isolated Q5 target observation",
    );
    expect(q5TargetDownload?.with?.["artifact-ids"]).toBe(
      "${{ needs.collect_q5.outputs.target-artifact-id }}",
    );
    expect(q5TargetDownload?.with?.["merge-multiple"]).toBe(true);
    const q5Build = protectedJob.steps.find(
      (step) => step.name === "Build the exact Q5 base-target input",
    );
    const q5CombinedUpload = protectedJob.steps.find(
      (step) => step.name === "Seal the exact combined Q5 input",
    );
    const signedUpload = protectedJob.steps.find(
      (step) => step.name === "Upload immutable signed evidence bundle",
    );
    for (const diagnostic of [
      profileDiagnostic,
      q4Diagnostic,
      q5BaseDiagnostic,
      protectedDiagnostic,
      q5TargetDiagnostic,
    ]) {
      expect(diagnostic?.if).toBe("failure()");
      expect(diagnostic?.with?.["retention-days"]).toBe(3);
      expect(diagnostic?.with?.["if-no-files-found"]).toBe("warn");
    }
    for (const rawArtifact of [
      profileUpload,
      q4Upload,
      q5BaseUpload,
      rawUpload,
      q5Upload,
      q5CombinedUpload,
    ]) {
      expect(rawArtifact?.with?.["retention-days"]).toBe(14);
    }
    expect(signedUpload?.with?.["retention-days"]).toBe(90);
    expect(q5Build?.run).toContain("architecture-fitness-q5-base-raw/base.observation.json");
    expect(q5Build?.run).toContain("architecture-fitness-q5-target-raw/target.observation.json");
    expect(q5Build?.run).toContain('= "2"');
    expect(q5CombinedUpload?.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/);
    const attestStep = protectedJob.steps.find(
      (step) => step.name === "Attest and evaluate with the protected host gate",
    );
    const verifyStep = protectedJob.steps.find(
      (step) => step.name === "Independently verify invocation and artifact bindings",
    );
    for (const step of [attestStep, verifyStep]) {
      expect(step?.run).toContain("issue-276-search-state-boundary");
      expect(step?.run).toContain("issue-276-relationship-state-boundary");
      expect(step?.run).toContain("issue-280-281-q2-macro");
      expect(step?.run).not.toContain("issue-286-q3-workload");
      expect(step?.run).toContain("issue-297-q4-technical-grain");
      expect(step?.run).toContain("issue-298-q5-cache-lifecycle");
      expect(step?.run).toContain('AF_RAW_ARTIFACT_ID="$AF_Q4_RAW_ARTIFACT_ID"');
      expect(step?.run).toContain('AF_RAW_ARTIFACT_DIGEST="$AF_Q4_RAW_ARTIFACT_DIGEST"');
      expect(step?.run).toContain('AF_RAW_ARTIFACT_ID="$AF_Q5_RAW_ARTIFACT_ID"');
      expect(step?.run).toContain('AF_RAW_ARTIFACT_DIGEST="$AF_Q5_RAW_ARTIFACT_DIGEST"');
      expect(step?.env?.AF_Q5_RAW_ARTIFACT_ID).toBe(
        "${{ steps.q5-combined-raw-artifact.outputs.artifact-id }}",
      );
      expect(step?.env?.AF_Q5_RAW_ARTIFACT_DIGEST).toBe(
        "${{ steps.q5-combined-raw-artifact.outputs.artifact-digest }}",
      );
    }
    expect(attestStep?.run).toContain("architecture-fitness-q4-raw");
    expect(attestStep?.run).not.toContain("architecture-fitness-raw/issue-297-q4");
    expect(attestStep?.run).toContain("architecture-fitness-q5-raw");
    expect(attestStep?.run).not.toContain("collect-q5-cache-lifecycle.mjs");
    expect(JSON.stringify(protectedJob)).not.toContain("collect-q5-cache-lifecycle.mjs");
    expect(JSON.stringify(protectedJob)).not.toContain("AF_Q5_TARGET_ROOT");
    expect(JSON.stringify(protectedJob)).not.toContain("q5-cache-lifecycle-probe.test.ts");
    expect(JSON.stringify(protectedJob)).toContain(
      "Issue #286 Q3 workload envelope is unsupported / unknown",
    );
  });

  it("binds the rebind notifier to retained verified artifacts from the protected workflow", async () => {
    const workflow = await readFile(
      path.join(repoRoot, ".github", "workflows", "architecture-fitness-rebind-window.yml"),
      "utf8",
    );
    expect(workflow).toContain("actions/artifacts?per_page=100");
    expect(workflow).toContain("gh api --paginate");
    expect(workflow).toContain('"$run_event" != "workflow_dispatch"');
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).toContain('select(.status == "verified")');
    expect(workflow).not.toContain("gh pr view");
    expect(workflow).toContain('"$run_head_branch" != "main"');
    expect(workflow).toContain('"$run_head_sha" == "${verified_heads[0]}"');
    const currentHeadPriority = workflow.indexOf('if [[ "$candidate_head" == "$current_head" ]]');
    const staleFallback = workflow.indexOf('if [[ -z "$verified_head" ]]');
    expect(currentHeadPriority).toBeGreaterThanOrEqual(0);
    expect(staleFallback).toBeGreaterThan(currentHeadPriority);
    expect(workflow).not.toContain("gh run list");
  });

  it("keeps the Q5 target probe child on an explicit credential-free environment", async () => {
    const source = await readFile(path.join(processRoot, "collect-q5-cache-lifecycle.mjs"), "utf8");
    const start = source.indexOf("function executeProbe(targetRoot)");
    const end = source.indexOf("export async function collectorDefinitionDigest", start);
    const probeSource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(probeSource).toContain("PATH: process.env.PATH");
    expect(probeSource).toContain("HOME: process.env.HOME");
    expect(probeSource).toContain('NODE_ENV: "test"');
    expect(probeSource).toContain("AF_Q5_TARGET_ROOT: targetRoot");
    expect(probeSource).toContain("AF_Q5_TRUSTED_HARNESS_ROOT: ROOT");
    expect(probeSource).not.toContain("env: process.env");
    expect(probeSource).not.toContain("...process.env");
    expect(probeSource).not.toContain("GITHUB_TOKEN");
    expect(probeSource).not.toContain("ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1");
  });

  it("keeps Q4 target modules out of the protected collector execution graph across lock drift", async () => {
    const source = await readFile(path.join(processRoot, "collect-q4-technical-grain.mjs"), "utf8");

    expect(source).toContain("runTrustedGuard(targetRoot, script, allowHistoricalOwnerLayout)");
    expect(source).toContain("path.join(ROOT, scriptRef)");
    expect(source).toContain("executeTrustedPolicySuite(targetRoot)");
    expect(source).toContain("path.join(ROOT, TEST_REF)");
    expect(source).not.toContain('path.join(root, "package-lock.json")');
    expect(source).not.toContain("target revision package-lock");
    expect(source).not.toContain("TARGET_BEHAVIOR_TESTS");
    expect(source).not.toContain('symlink(path.join(ROOT, "node_modules")');
    expect(source).not.toContain("...process.env");
  });

  it("binds every delegated Q4 trusted guard to the collector definition digest", async () => {
    const collectorModule = (await import(
      pathToFileURL(path.join(processRoot, "collect-q4-technical-grain.mjs")).href
    )) as {
      COLLECTOR_DEFINITION_REFS: readonly string[];
      TRUSTED_GUARD_REFS: Readonly<Record<string, string>>;
      collectorDefinitionDigest: () => Promise<string>;
      digestCollectorDefinitionSources: (sources: Record<string, Uint8Array>) => string;
    };
    const resolveRelativeModuleRef = async (
      root: string,
      importerRef: string,
      specifier: string,
    ) => {
      const baseRef = path.posix.normalize(
        path.posix.join(path.posix.dirname(importerRef), specifier),
      );
      const candidates = path.posix.extname(baseRef)
        ? [baseRef]
        : [
            `${baseRef}.mjs`,
            `${baseRef}.js`,
            `${baseRef}.ts`,
            `${baseRef}.tsx`,
            path.posix.join(baseRef, "index.mjs"),
            path.posix.join(baseRef, "index.js"),
            path.posix.join(baseRef, "index.ts"),
            path.posix.join(baseRef, "index.tsx"),
          ];
      for (const candidate of candidates) {
        try {
          await readFile(path.join(root, candidate));
          return candidate;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      throw new Error(`unresolved Q4 trusted-guard dependency: ${importerRef} -> ${specifier}`);
    };
    const relativeModuleSpecifiers = (ref: string, source: string) => {
      const specifiers: string[] = [];
      const sourceFile = ts.createSourceFile(
        ref,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS,
      );
      const visit = (node: ts.Node) => {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteralLike(node.moduleSpecifier) &&
          node.moduleSpecifier.text.startsWith(".")
        ) {
          specifiers.push(node.moduleSpecifier.text);
        }
        if (
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments.length === 1 &&
          ts.isStringLiteralLike(node.arguments[0]) &&
          node.arguments[0].text.startsWith(".")
        ) {
          specifiers.push(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      return specifiers;
    };
    const collectRelativeModuleClosure = async (root: string, seedRefs: string[]) => {
      const closure = new Set<string>();
      const pendingRefs = [...seedRefs];
      while (pendingRefs.length > 0) {
        const ref = pendingRefs.shift();
        if (!ref || closure.has(ref)) continue;
        closure.add(ref);
        const source = await readFile(path.join(root, ref), "utf8");
        for (const specifier of relativeModuleSpecifiers(ref, source)) {
          const dependencyRef = await resolveRelativeModuleRef(root, ref, specifier);
          if (!closure.has(dependencyRef)) pendingRefs.push(dependencyRef);
        }
      }
      return closure;
    };
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "q4-definition-closure-"));
    try {
      await writeFile(
        path.join(fixtureRoot, "guard.mjs"),
        [
          '// from "./comment-only.mjs"',
          "const decoy = 'from \"./string-only.mjs\"';",
          'import "./side-effect.mjs";',
          'export { nested } from "./nested-export.mjs";',
        ].join("\n"),
      );
      await writeFile(path.join(fixtureRoot, "side-effect.mjs"), 'import "./second-hop.mjs";\n');
      await writeFile(path.join(fixtureRoot, "second-hop.mjs"), "export const value = 1;\n");
      await writeFile(path.join(fixtureRoot, "nested-export.mjs"), "export const nested = 1;\n");
      await expect(collectRelativeModuleClosure(fixtureRoot, ["guard.mjs"])).resolves.toEqual(
        new Set(["guard.mjs", "side-effect.mjs", "second-hop.mjs", "nested-export.mjs"]),
      );
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
    const guardDefinitionRefs = await collectRelativeModuleClosure(repoRoot, [
      ...Object.values(collectorModule.TRUSTED_GUARD_REFS),
    ]);
    expect(collectorModule.COLLECTOR_DEFINITION_REFS).toEqual(
      expect.arrayContaining([...guardDefinitionRefs]),
    );

    const sources: Record<string, Uint8Array> = {};
    for (const ref of collectorModule.COLLECTOR_DEFINITION_REFS) {
      sources[ref] = await readFile(path.join(repoRoot, ref));
    }
    const baselineDigest = collectorModule.digestCollectorDefinitionSources(sources);
    await expect(collectorModule.collectorDefinitionDigest()).resolves.toBe(baselineDigest);

    for (const guardRef of guardDefinitionRefs) {
      const guardSource = sources[guardRef];
      const mutatedSources: Record<string, Uint8Array> = {
        ...sources,
        [guardRef]: Buffer.concat([guardSource, Buffer.from("\n// semantic mutation\n")]),
      };
      expect(collectorModule.digestCollectorDefinitionSources(mutatedSources)).not.toBe(
        baselineDigest,
      );
    }
  });

  it("keeps every protected policy bound to its current collector definition", async () => {
    const { listProtectedArchitectureFitnessProfiles } = await loadLighthouseProfiles();

    for (const profile of listProtectedArchitectureFitnessProfiles()) {
      const collectorModule = (await import(pathToFileURL(profile.collector).href)) as Record<
        string,
        unknown
      >;
      const definitionDigestExports = Object.entries(collectorModule).filter(
        ([name, value]) => name.endsWith("DefinitionDigest") && typeof value === "function",
      );
      const policy = JSON.parse(await readFile(profile.policy, "utf8")) as {
        policySet: { collectorAuthority: { definitionDigest: string } };
      };

      expect(
        definitionDigestExports.map(([name]) => name),
        `${profile.id} must expose exactly one collector definition digest owner`,
      ).toHaveLength(1);
      const definitionDigest = definitionDigestExports[0]?.[1] as () => Promise<string>;
      await expect(definitionDigest(), profile.id).resolves.toBe(
        policy.policySet.collectorAuthority.definitionDigest,
      );
    }
  });

  it("keeps protected exact-revision collectors on collector-authority dependencies across lock drift", async () => {
    const collectors = [
      "collect-least-authority.mjs",
      "collect-search-state-boundary.mjs",
      "collect-relationship-state-boundary.mjs",
      "collect-q2-macro.mjs",
      "collect-search-condition-url-budget.mjs",
    ];

    for (const collector of collectors) {
      const source = await readFile(path.join(processRoot, collector), "utf8");

      expect(source).toContain('symlink(path.join(ROOT, "node_modules")');
      expect(source).toContain("collector-authority");
      expect(source).not.toContain("base-owned");
      expect(source).not.toContain("trusted-base");
      expect(source).not.toContain('path.join(root, "package-lock.json")');
      expect(source).not.toContain("dependencyLockMatches");
      expect(source).not.toContain("target revision package-lock");
    }
  });

  it("pins a supported Python runtime in every quality job that runs the snapshot tooling", async () => {
    const workflow = await readFile(
      path.join(repoRoot, ".github", "workflows", "quality.yml"),
      "utf8",
    );
    const parsed = YAML.parse(workflow) as {
      jobs: Record<
        string,
        {
          steps: Array<{
            uses?: string;
            with?: { "python-version"?: string };
          }>;
        }
      >;
    };

    for (const jobName of ["static", "test", "full"]) {
      const pythonSetup = parsed.jobs[jobName].steps.find((step) =>
        step.uses?.startsWith("actions/setup-python@"),
      );
      expect(pythonSetup?.uses).toMatch(/^actions\/setup-python@[0-9a-f]{40}$/);
      expect(pythonSetup?.with?.["python-version"]).toBe("3.12");
    }
  });
});

describe("Lighthouse Architecture Fitness advisory ownership", () => {
  it("preserves the core unknown verdict exit code", async () => {
    const { evaluateUnsignedObservationWithExitCode, resolveReviewProcessExitCode } =
      await loadLighthouseAdapter();

    const result = evaluateUnsignedObservationWithExitCode(
      stateObservationPath,
      process.env,
      statePolicyPath,
    );
    expect(result.exitCode).toBe(3);
    expect(resolveReviewProcessExitCode({ verdictExit: true }, result.exitCode)).toBe(3);
    expect(resolveReviewProcessExitCode({ verdictExit: false }, result.exitCode)).toBe(0);
  });

  it("preserves the core degraded precedence over unknown", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "architecture-fitness-verdict-exit-"));
    try {
      const observation = JSON.parse(await readFile(stateObservationPath, "utf8")) as {
        observations: Array<{
          states: Array<{
            authorityRefs: string[];
            carrierRefs: string[];
            evidenceRefs: string[];
          }>;
        }>;
        evidence: Array<{
          id: string;
          target: { factRefs: string[] };
        }>;
      };
      const mismatchedState = observation.observations[0].states[0];
      const mismatchedFactRefs = ["authority:client-current-view-store", "carrier:condition-url"];
      mismatchedState.authorityRefs = ["authority:client-current-view-store"];
      mismatchedState.carrierRefs = ["carrier:condition-url"];
      for (const evidenceRef of mismatchedState.evidenceRefs) {
        const evidence = observation.evidence.find((item) => item.id === evidenceRef);
        if (!evidence) throw new Error(`Missing state evidence: ${evidenceRef}`);
        evidence.target.factRefs = mismatchedFactRefs;
      }
      const mismatchPath = path.join(root, "degraded.observation.json");
      const signedPath = path.join(root, "degraded.signed.json");
      await writeFile(mismatchPath, `${JSON.stringify(observation, null, 2)}\n`, "utf8");

      const evaluationEnvironment = {
        ...process.env,
        ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1: "test-only-verdict-exit-key",
      };
      const attestation = spawnSync(
        "python3",
        [
          "-B",
          attestor,
          "--policy",
          statePolicyPath,
          "--observation",
          mismatchPath,
          "--output",
          signedPath,
        ],
        { cwd: repoRoot, encoding: "utf8", env: evaluationEnvironment },
      );
      expect(attestation.status, attestation.stderr || attestation.stdout).toBe(0);
      const evaluation = spawnSync(
        "python3",
        ["-B", evaluator, "--policy", statePolicyPath, "--observation", signedPath],
        { cwd: repoRoot, encoding: "utf8", env: evaluationEnvironment },
      );
      expect(evaluation.status, evaluation.stderr || evaluation.stdout).toBe(2);

      const { resolveReviewProcessExitCode, resolveVerdictExitCode } =
        await loadLighthouseAdapter();
      const verdictExitCode = resolveVerdictExitCode([3, evaluation.status ?? 1]);
      expect(resolveReviewProcessExitCode({ verdictExit: true }, verdictExitCode)).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps CAIR and decision root separate", async () => {
    const { evaluateImpactDeclaration } = await loadImpactAdvisory();
    const adapter = {
      sensitivePathHints: [{ id: "authority", prefixes: ["app/server/repository"] }],
    };
    const missing = evaluateImpactDeclaration({
      changedPaths: ["app/server/repository/papers.ts"],
      declaration: null,
      adapter,
    });
    expect(missing.findings.map((finding) => finding.id)).toContain(
      "architecture-impact:missing-declaration",
    );

    const declared = evaluateImpactDeclaration({
      changedPaths: ["app/server/repository/papers.ts"],
      declaration: {
        architectureImpact: "declared",
        cairVerdict: "reshape",
        decisionRoot: "architectureNeed",
        recordRef: "issue:287",
      },
      adapter,
    });
    expect(declared.findings).toEqual([]);
    expect(declared.cairVerdict).toBe("reshape");
    expect(declared.decisionRoot).toBe("architectureNeed");
  });

  it("preserves Architecture Fitness verdicts in merge advice", async () => {
    const { evaluateMergeEligibility } = await loadMergeAdvisory();
    const assessment: Assessment = {
      policySetRef: "issue-278-least-authority",
      revision: "revision",
      collectorAttestation: { status: "unverified" },
      caseAssessments: [{ caseRef: "issue-278:reviewed-paper-owner-read", verdicts: ["unknown"] }],
      coverageAssessments: [],
    };
    const result = evaluateMergeEligibility(assessment, {
      requiredCaseRefs: ["issue-278:reviewed-paper-owner-read"],
      unknownHandling: {
        "issue-278:reviewed-paper-owner-read": { mode: "requiredBeforeMerge" },
      },
      blockers: [],
      riskAcceptance: null,
    });
    expect(result.eligibility).toBe("block");
    expect(result.architectureFitnessVerdictsPreserved).toBe(true);
  });
});
