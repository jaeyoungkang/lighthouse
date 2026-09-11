import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { stringify as stringifyYaml } from "yaml";

import {
  ANALYTICS_EVENTS_PATH,
  type AnalyticsEventActor,
  type AnalyticsEventContract,
  type AnalyticsEventDefinition,
  type AnalyticsEventOwner,
  type AnalyticsEventSurface,
  type AnalyticsTriggerSource,
  loadEventContract,
} from "@/app/server/services/analytics/event-contract";
import { loadStoryChain, type StoryChain } from "@/app/server/services/story-chain/loader";
import { parseMomentFile } from "@/app/server/services/story-chain/parser";
import {
  type PromiseDeclaration,
  type PromiseRef,
  requirePromiseExperience,
  traceabilityNodePattern,
  traceabilityNodePrefix,
} from "@/app/domain/story-chain";

const repoRoot = path.resolve(__dirname, "..", "..");
const GENERATED_EVENT_COVERAGE_PATH = "docs/analytics/event-coverage.generated.md";

interface EventImpactCliDeps {
  repoRoot: string;
  stdout: Pick<typeof process.stdout, "write">;
  stderr: Pick<typeof process.stderr, "write">;
  loadEventContract: typeof loadEventContract;
  loadStoryChain: typeof loadStoryChain;
  readFile: (file: string) => string;
  writeFile: (file: string, source: string) => void;
  exists: (file: string) => boolean;
  gitChangedFiles: (args: EventImpactArgs) => string[];
}

interface EventImpactArgs {
  base?: string;
  head?: string;
  staged: boolean;
  update: boolean;
  sync: boolean;
}

interface EventCoverageRow {
  promiseRef: string;
  title: string;
  eventNames: string[];
  analyticsExempt?: string;
}

interface EventImpactReport {
  changedFiles: string[];
  impactedPromiseRefs: string[];
  uncoveredPromiseRefs: string[];
  exemptPromiseRefs: string[];
  eventsChanged: boolean;
  generatedCoverage: string;
  generatedCoverageChanged: boolean;
  coverageRows: EventCoverageRow[];
}

function parseArgs(argv: string[]): EventImpactArgs {
  const args: EventImpactArgs = { staged: false, update: false, sync: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--staged") {
      args.staged = true;
    } else if (arg === "--update") {
      args.update = true;
    } else if (arg === "--sync") {
      args.sync = true;
    } else if (arg === "--base") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--base requires a value");
      }
      args.base = value;
      index += 1;
    } else if (arg === "--head") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--head requires a value");
      }
      args.head = value;
      index += 1;
    } else if (arg.startsWith("--base=")) {
      args.base = arg.slice("--base=".length);
    } else if (arg.startsWith("--head=")) {
      args.head = arg.slice("--head=".length);
    } else if (arg) {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

function gitChangedFiles(args: EventImpactArgs): string[] {
  const gitArgs = args.staged
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMRT"]
    : [
        "diff",
        "--name-only",
        "--diff-filter=ACMRT",
        `${args.base ?? "main"}...${args.head ?? "HEAD"}`,
      ];
  try {
    const committedFiles = execFileSync("git", gitArgs, { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const worktreeFiles = args.staged
      ? []
      : execFileSync("git", ["diff", "--name-only", "--diff-filter=ACMRT"], {
          cwd: repoRoot,
          encoding: "utf8",
        })
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
    return [...new Set([...committedFiles, ...worktreeFiles])].sort();
  } catch {
    return [];
  }
}

function shouldRunEventImpactCli(argv: string[] = process.argv): boolean {
  return path.basename((argv[1] ?? "").replace(/\\/g, "/")) === "mc-event-impact.ts";
}

function collectTaggedPromiseRefs(source: string): string[] {
  const pattern = new RegExp(
    `@promise\\s+(${traceabilityNodePattern("promise", "[a-z0-9-]+")})`,
    "g",
  );
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function promiseRefFromStoryPath(file: string): string | null {
  const match = file.match(/^docs\/contracts\/story-chain\/promises\/([a-z0-9-]+)\.md$/);
  return match ? `${traceabilityNodePrefix("promise")}${match[1]}` : null;
}

function momentRefFromStoryPath(file: string): string | null {
  const match = file.match(/^docs\/contracts\/story-chain\/moments\/([a-z0-9-]+)\.md$/);
  return match ? `${traceabilityNodePrefix("moment")}${match[1]}` : null;
}

function collectImpactedPromiseRefs(params: {
  changedFiles: readonly string[];
  chain: StoryChain;
  repoRoot: string;
  readFile: (file: string) => string;
  exists: (file: string) => boolean;
}): string[] {
  const refs = new Set<string>();
  for (const file of params.changedFiles) {
    const pathRef = promiseRefFromStoryPath(file);
    if (pathRef) refs.add(pathRef);
    const absolute = path.join(params.repoRoot, file);
    const exists = params.exists(absolute);
    const canReadSource = exists && /\.(md|ts|tsx)$/.test(file);
    const source = canReadSource ? params.readFile(absolute) : null;
    const momentPathRef = momentRefFromStoryPath(file);
    const momentRef =
      momentPathRef && source !== null ? parseMomentFile({ source, file }).id : momentPathRef;
    if (momentRef) {
      for (const promise of params.chain.promises) {
        if (promise.moment === momentRef) refs.add(promise.id);
      }
    }

    if (source === null) continue;
    for (const tagRef of collectTaggedPromiseRefs(source)) {
      refs.add(tagRef);
    }
  }
  return [...refs].sort();
}

function groupEventsByPromise(
  contract: AnalyticsEventContract,
): Map<string, AnalyticsEventDefinition[]> {
  const eventsByPromise = new Map<string, AnalyticsEventDefinition[]>();
  for (const event of contract.events) {
    const promiseRefs = [
      ...(event.storyRefs.promiseRef ? [event.storyRefs.promiseRef] : []),
      ...(event.storyRefs.relatedPromiseRefs ?? []),
    ];
    for (const promiseRef of promiseRefs) {
      const events = eventsByPromise.get(promiseRef) ?? [];
      events.push(event);
      eventsByPromise.set(promiseRef, events);
    }
  }
  return eventsByPromise;
}

function buildCoverageRows(
  chain: StoryChain,
  contract: AnalyticsEventContract,
): EventCoverageRow[] {
  const eventsByPromise = groupEventsByPromise(contract);
  return chain.promises
    .map((promise) => ({
      promiseRef: promise.id,
      title: promise.title,
      analyticsExempt: promise.analyticsExempt,
      eventNames: (eventsByPromise.get(promise.id) ?? [])
        .map((event) => (isDraftEvent(event) ? `${event.name} (draft)` : event.name))
        .sort(),
    }))
    .sort((a, b) => a.promiseRef.localeCompare(b.promiseRef));
}

// A draft event is a scaffold from `mc:event-impact --sync` that has no sinks
// wired yet — no instrumentation call site exists. Marking it `(draft)` in the
// generated coverage avoids a false-positive "covered" signal in the table
// while still letting the impact gate accept the promise as acknowledged.
function isDraftEvent(event: AnalyticsEventDefinition): boolean {
  return Object.keys(event.sinks).length === 0;
}

function buildGeneratedCoverage(rows: readonly EventCoverageRow[]): string {
  const body = rows
    .map((row) => {
      const events =
        row.eventNames.length > 0
          ? row.eventNames.join("<br>")
          : row.analyticsExempt
            ? "_analytics-exempt_"
            : "_none_";
      return `| ${row.promiseRef} | ${row.title.replaceAll("|", "\\|")} | ${events} |`;
    })
    .join("\n");
  return [
    "# Analytics Event Coverage",
    "",
    "<!-- Generated by `npm run mc:event-impact -- --update`. Do not edit by hand. -->",
    "",
    "| Promise | Title | Canonical events |",
    "| --- | --- | --- |",
    body,
    "",
  ].join("\n");
}

function buildEventsYaml(contract: AnalyticsEventContract): string {
  return stringifyYaml(
    { events: contract.events },
    {
      aliasDuplicateObjects: false,
      lineWidth: 0,
    },
  );
}

function buildImpactReport(params: {
  repoRoot: string;
  changedFiles: string[];
  contract: AnalyticsEventContract;
  chain: StoryChain;
  readFile: (file: string) => string;
  exists: (file: string) => boolean;
}): EventImpactReport {
  const coverageRows = buildCoverageRows(params.chain, params.contract);
  const generatedCoverage = buildGeneratedCoverage(coverageRows);
  const generatedPath = path.join(params.repoRoot, GENERATED_EVENT_COVERAGE_PATH);
  const currentGenerated = params.exists(generatedPath) ? params.readFile(generatedPath) : "";
  const impactedPromiseRefs = collectImpactedPromiseRefs({
    changedFiles: params.changedFiles,
    chain: params.chain,
    repoRoot: params.repoRoot,
    readFile: params.readFile,
    exists: params.exists,
  });
  const eventsByPromise = new Map(coverageRows.map((row) => [row.promiseRef, row.eventNames]));
  const exemptPromiseRefs = new Set(
    params.chain.promises
      .filter((promise) => Boolean(promise.analyticsExempt))
      .map((promise) => promise.id),
  );
  const currentPromiseRefs = new Set(params.chain.promises.map((promise) => promise.id));
  const uncoveredPromiseRefs = impactedPromiseRefs.filter((promiseRef) => {
    // A deleted Promise path is still present in the git diff, but it no longer
    // owns a runtime event contract. Story Chain validation closes the
    // retirement; event-impact must only require coverage from live Promises.
    if (!currentPromiseRefs.has(promiseRef as PromiseRef)) return false;
    if (exemptPromiseRefs.has(promiseRef as PromiseRef)) return false;
    return (eventsByPromise.get(promiseRef) ?? []).length === 0;
  });

  return {
    changedFiles: params.changedFiles,
    impactedPromiseRefs,
    uncoveredPromiseRefs,
    exemptPromiseRefs: [...exemptPromiseRefs].sort(),
    eventsChanged: params.changedFiles.includes(ANALYTICS_EVENTS_PATH),
    generatedCoverage,
    generatedCoverageChanged: currentGenerated !== generatedCoverage,
    coverageRows,
  };
}

function describeImpact(report: EventImpactReport): string {
  const lines = [
    "mc:event-impact — analytics impact checked",
    `  changed files       ${String(report.changedFiles.length).padStart(3)}`,
    `  impacted promises   ${String(report.impactedPromiseRefs.length).padStart(3)}`,
    `  uncovered impacts   ${String(report.uncoveredPromiseRefs.length).padStart(3)}`,
  ];
  for (const promiseRef of report.impactedPromiseRefs) {
    const row = report.coverageRows.find((candidate) => candidate.promiseRef === promiseRef);
    const events = row?.eventNames.length
      ? row.eventNames.join(", ")
      : report.exemptPromiseRefs.includes(promiseRef)
        ? `analytics-exempt: ${row?.analyticsExempt ?? "declared"}`
        : "no canonical event";
    lines.push(`  - ${promiseRef}: ${events}`);
  }
  return `${lines.join("\n")}\n`;
}

function uniqueEventName(baseName: string, existingNames: ReadonlySet<string>): string {
  if (!existingNames.has(baseName)) return baseName;
  for (let index = 2; ; index += 1) {
    const candidate = `${baseName}_${String(index)}`;
    if (!existingNames.has(candidate)) return candidate;
  }
}

const DRAFT_EVENT_HINTS: Partial<
  Record<
    string,
    {
      object: string;
      action: string;
      phase: "completed" | "failed";
      signalMeaning: string;
      timing: string;
      optional?: string[];
    }
  >
> = {
  "promise:delegate-deep-read-to-moonlight": {
    object: "moonlight_deep_read",
    action: "clicked",
    phase: "completed",
    signalMeaning: "user clicked the Moonlight deep-read handoff from a document context",
    timing: "Moonlight deep-read handoff control is clicked from a paper or PDF context.",
  },
  "promise:route-view-ai-comment-inline-surface": {
    object: "ai_comment_card",
    action: "viewed",
    phase: "completed",
    signalMeaning: "user viewed a document AI reaction in the main content column",
    timing: "Route-view AI reaction becomes visible inside the owning research panel.",
  },
  "promise:inline-analysis-auto-run": {
    object: "inline_analysis",
    action: "queued",
    phase: "completed",
    signalMeaning: "inline paper analysis was queued for visible search results",
    timing: "inline analysis is queued automatically for visible search-result papers.",
    optional: ["documentId", "paperId", "visibleIndex"],
  },
  "promise:search-query-route-transition": {
    object: "search_query_transition",
    action: "submitted",
    phase: "completed",
    signalMeaning: "user submitted a new route query from an existing search result context",
    timing: "query transition is submitted from an existing search result context.",
    optional: ["documentId", "queryHash", "queryLength"],
  },
  "promise:search-results-display-budget": {
    object: "search_results_budget",
    action: "viewed",
    phase: "completed",
    signalMeaning: "user viewed first search results inside the display budget window",
    timing: "first visible search results are rendered within the display budget window.",
    optional: ["documentId", "elapsedMs", "resultCount"],
  },
  "promise:search-spelling-correction": {
    object: "spelling_correction",
    action: "clicked",
    phase: "completed",
    signalMeaning: "user clicked or accepted a spelling correction suggestion",
    timing: "spelling correction suggestion is clicked or accepted for a follow-up search.",
    optional: ["documentId", "queryHash", "correctedQueryHash"],
  },
  "promise:story-chain-event-contract": {
    object: "event_contract",
    action: "synced",
    phase: "completed",
    signalMeaning: "operator synced or updated the analytics event contract",
    timing: "operator runs event-impact sync or updates the analytics event contract.",
    optional: ["changedPromiseCount", "addedEventCount", "removedEventCount", "updatedEventCount"],
  },
  "promise:researcher-prose-promises-page": {
    object: "researcher_prose_promises_page",
    action: "clicked",
    phase: "completed",
    signalMeaning: "user clicked the public researcher promises page link",
    timing: "Researcher promises card link is clicked from the public about page.",
  },
};

function resolveDraftEventHint(promise: PromiseDeclaration): {
  object: string;
  action: string;
  phase: "completed" | "failed";
  signalMeaning: string;
  timing: string;
  optional: string[];
} {
  const hint = DRAFT_EVENT_HINTS[promise.id];
  if (hint) {
    return {
      ...hint,
      optional: hint.optional ?? ["documentId"],
    };
  }
  return {
    object: promise.slug.replaceAll("-", "_"),
    action: promise.lane === "admin" ? "synced" : "clicked",
    phase: "completed",
    signalMeaning: `${promise.title} behavior occurred and needs concrete instrumentation review`,
    timing: `Choose the concrete user behavior trigger for ${promise.id}.`,
    optional: ["documentId"],
  };
}

function resolveDraftEventShell(promise: PromiseDeclaration): {
  owner: AnalyticsEventOwner;
  actor: AnalyticsEventActor;
  surface: AnalyticsEventSurface;
  triggerSource: AnalyticsTriggerSource;
  namePrefix: string;
} {
  if (promise.lane === "admin") {
    return {
      owner: "governance",
      actor: "operator",
      surface: "admin",
      triggerSource: "client",
      namePrefix: "governance",
    };
  }
  return {
    owner: "product",
    actor: "user",
    surface: "research-route",
    triggerSource: "client",
    namePrefix: "product",
  };
}

function buildDraftEventDefinition(
  promise: PromiseDeclaration,
  moments: StoryChain["moments"],
  experiences: StoryChain["experiences"],
  existingNames: ReadonlySet<string>,
): AnalyticsEventDefinition {
  const shell = resolveDraftEventShell(promise);
  const hint = resolveDraftEventHint(promise);
  const name = uniqueEventName(`${shell.namePrefix}.${hint.object}.${hint.action}`, existingNames);
  return {
    name,
    version: 1,
    owner: shell.owner,
    actor: shell.actor,
    surface: shell.surface,
    storyRefs: {
      experienceRef: requirePromiseExperience(promise, moments, experiences).id,
      momentRef: promise.moment,
      promiseRef: promise.id,
      aspectRefs: [],
      acceptanceCheckRefs: [],
      scenarioRefs: [],
    },
    observability: {
      realitySignal: true,
      signalMeaning: hint.signalMeaning,
      severity: "info",
      requiredForPromiseCoverage: false,
    },
    trigger: {
      source: shell.triggerSource,
      phase: hint.phase,
      timing: hint.timing,
    },
    subject: {
      allowed:
        shell.surface === "research-route"
          ? ["ownerPrincipalId", "documentId"]
          : ["ownerPrincipalId"],
    },
    properties: {
      required: ["ownerPrincipalId"],
      optional: hint.optional,
      forbidden: ["token"],
    },
    privacy: {
      level: "behavior_metadata",
      allowExternalSinks: false,
    },
    sinks: {},
  };
}

function pruneAcceptanceCheckRefs(
  event: AnalyticsEventDefinition,
  promise: PromiseDeclaration,
): AnalyticsEventDefinition {
  const validRefs = new Set(promise.acceptanceChecks.map((check) => check.id));
  return {
    ...event,
    storyRefs: {
      ...event.storyRefs,
      acceptanceCheckRefs: event.storyRefs.acceptanceCheckRefs.filter((ref) => validRefs.has(ref)),
    },
  };
}

function updateEventStoryParentRefs(
  event: AnalyticsEventDefinition,
  promiseById: ReadonlyMap<string, PromiseDeclaration>,
  moments: StoryChain["moments"],
  experiences: StoryChain["experiences"],
): AnalyticsEventDefinition | null {
  const promiseRef = event.storyRefs.promiseRef;
  if (!promiseRef) return event;
  const promise = promiseById.get(promiseRef);
  if (!promise) return null;
  return pruneAcceptanceCheckRefs(
    {
      ...event,
      storyRefs: {
        ...event.storyRefs,
        experienceRef: requirePromiseExperience(promise, moments, experiences).id,
        momentRef: promise.moment,
      },
    },
    promise,
  );
}

function syncEventContract(params: {
  contract: AnalyticsEventContract;
  chain: StoryChain;
  impactedPromiseRefs: readonly string[];
}): { contract: AnalyticsEventContract; added: string[]; removed: string[]; updated: string[] } {
  const promiseById = new Map(params.chain.promises.map((promise) => [promise.id, promise]));
  const exemptPromiseRefs = new Set(
    params.chain.promises
      .filter((promise) => Boolean(promise.analyticsExempt))
      .map((promise) => promise.id),
  );
  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];
  const nextEvents: AnalyticsEventDefinition[] = [];

  for (const event of params.contract.events) {
    const promiseRef = event.storyRefs.promiseRef;
    if (promiseRef && exemptPromiseRefs.has(promiseRef)) {
      removed.push(event.name);
      continue;
    }
    const nextEvent = updateEventStoryParentRefs(
      event,
      promiseById,
      params.chain.moments,
      params.chain.experiences,
    );
    if (!nextEvent) {
      removed.push(event.name);
      continue;
    }
    if (JSON.stringify(nextEvent.storyRefs) !== JSON.stringify(event.storyRefs)) {
      updated.push(event.name);
    }
    nextEvents.push(nextEvent);
  }

  const eventNames = new Set(nextEvents.map((event) => event.name));
  const coveredPromiseRefs = new Set<string>(
    nextEvents
      .map((event) => event.storyRefs.promiseRef)
      .filter((ref): ref is NonNullable<typeof ref> => !!ref),
  );
  for (const promiseRef of params.impactedPromiseRefs) {
    if (exemptPromiseRefs.has(promiseRef as PromiseRef)) continue;
    if (coveredPromiseRefs.has(promiseRef)) continue;
    const promise = promiseById.get(promiseRef as PromiseRef);
    if (!promise) continue;
    const draftEvent = buildDraftEventDefinition(
      promise,
      params.chain.moments,
      params.chain.experiences,
      eventNames,
    );
    eventNames.add(draftEvent.name);
    coveredPromiseRefs.add(promiseRef);
    added.push(draftEvent.name);
    nextEvents.push(draftEvent);
  }

  return {
    contract: { events: nextEvents },
    added,
    removed,
    updated,
  };
}

export async function runEventImpactCli(
  argv: string[] = process.argv,
  deps: EventImpactCliDeps = {
    repoRoot,
    stdout: process.stdout,
    stderr: process.stderr,
    loadEventContract,
    loadStoryChain,
    readFile: (file) => readFileSync(file, "utf8"),
    writeFile: (file, source) => {
      writeFileSync(file, source);
    },
    exists: existsSync,
    gitChangedFiles,
  },
): Promise<number> {
  await Promise.resolve();
  try {
    const args = parseArgs(argv);
    const contract = deps.loadEventContract(deps.repoRoot);
    const chain = deps.loadStoryChain(deps.repoRoot);
    const report = buildImpactReport({
      repoRoot: deps.repoRoot,
      changedFiles: deps.gitChangedFiles(args),
      contract,
      chain,
      readFile: deps.readFile,
      exists: deps.exists,
    });

    if (args.sync) {
      const syncResult = syncEventContract({
        contract,
        chain,
        impactedPromiseRefs: report.impactedPromiseRefs,
      });
      const syncedRows = buildCoverageRows(chain, syncResult.contract);
      deps.writeFile(
        path.join(deps.repoRoot, ANALYTICS_EVENTS_PATH),
        buildEventsYaml(syncResult.contract),
      );
      deps.writeFile(
        path.join(deps.repoRoot, GENERATED_EVENT_COVERAGE_PATH),
        buildGeneratedCoverage(syncedRows),
      );
      deps.stdout.write("mc:event-impact — synced analytics events\n");
      deps.stdout.write(`  added    ${String(syncResult.added.length).padStart(3)}\n`);
      deps.stdout.write(`  removed  ${String(syncResult.removed.length).padStart(3)}\n`);
      deps.stdout.write(`  updated  ${String(syncResult.updated.length).padStart(3)}\n`);
      return 0;
    }

    if (args.update) {
      deps.writeFile(
        path.join(deps.repoRoot, GENERATED_EVENT_COVERAGE_PATH),
        report.generatedCoverage,
      );
      deps.stdout.write(`mc:event-impact — updated ${GENERATED_EVENT_COVERAGE_PATH}\n`);
      return 0;
    }

    deps.stdout.write(describeImpact(report));
    if (report.generatedCoverageChanged) {
      deps.stderr.write(
        `mc:event-impact — FAIL\n${GENERATED_EVENT_COVERAGE_PATH} is stale. Run npm run mc:event-impact -- --update.\n`,
      );
      return 1;
    }
    if (report.uncoveredPromiseRefs.length > 0 && !report.eventsChanged) {
      deps.stderr.write(
        [
          "mc:event-impact — FAIL",
          "Changed Story Chain surfaces include promises without canonical event coverage.",
          "Update docs/analytics/events.yaml or intentionally add coverage before closing the change.",
          ...report.uncoveredPromiseRefs.map((promiseRef) => `- ${promiseRef}`),
          "",
        ].join("\n"),
      );
      return 1;
    }
    return 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    deps.stderr.write(`mc:event-impact — FAIL\n${message}\n`);
    return 1;
  }
}

export {
  GENERATED_EVENT_COVERAGE_PATH,
  buildGeneratedCoverage,
  buildImpactReport,
  syncEventContract,
  shouldRunEventImpactCli,
};

if (shouldRunEventImpactCli()) {
  void runEventImpactCli().then((exitCode) => {
    process.exit(exitCode);
  });
}
