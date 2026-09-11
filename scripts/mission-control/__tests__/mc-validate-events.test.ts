import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ANALYTICS_EVENTS_PATH,
  AnalyticsEventContractError,
  loadEventContract,
  parseEventContract,
  validateEventContract,
  validateEventContractOrThrow,
} from "@/app/server/services/analytics/event-contract";
import { loadStoryChain } from "@/app/server/services/story-chain/loader";
import type { StoryChain } from "@/app/server/services/story-chain/loader";
import { runValidateEventsCli, shouldRunValidateEventsCli } from "../mc-validate-events";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const validSource = readFileSync(path.join(repoRoot, ANALYTICS_EVENTS_PATH), "utf8");
const chain = loadStoryChain(repoRoot);
const chainWithoutRequiredEvents: StoryChain = {
  ...chain,
  promises: chain.promises.map((promise) => ({ ...promise, requiredEvents: [] })),
};

function validate(source: string, storyChain: StoryChain = chainWithoutRequiredEvents) {
  return validateEventContract(parseEventContract(source), storyChain, repoRoot, {
    runtimeSourceCheck: false,
  });
}

function firstEventSource(overrides: string): string {
  return `propertySchemas:
  owner_principal_id:
    description: test owner identity
    type: string
    examples: [principal-1]
    sensitivity: behavior_metadata
    contextGroup: journey
    lifetime: journey
    sourceOwner: test fixture
events:
  - name: search_submitted
    version: 1
    owner: product
    actor: user
    surface: research-route
    storyRefs:
      experienceRef: experience:research-and-discovery
      momentRef: moment:search-results-first-review
      promiseRef: promise:search-reaction-summarizes-terrain
      aspectRefs: []
      acceptanceCheckRefs: []
      scenarioRefs: []
    observability:
      realitySignal: true
      signalMeaning: user search input triggered the search reaction flow
      severity: info
      requiredForPromiseCoverage: false
    trigger:
      source: client
      phase: requested
      timing: test trigger
    measurement:
      purpose: test measurement purpose
      decisionUse: test decision use
      propertyPurposes:
        owner_principal_id: test route-owned research route payload purpose
    subject:
      allowed:
        - owner_principal_id
    properties:
      required:
        - owner_principal_id
      optional: []
      forbidden:
        - token
    privacy:
      level: behavior_metadata
      allowExternalSinks: true
    emission:
      boundary: command_handler
      cardinality: every_action
      identityKeys:
        - subject.owner_principal_id
      emitter: trackSearchSubmitted
    sinks:
      amplitude: search_submitted
${overrides}`;
}

function createEmitterFixture(sourceFiles: Record<string, string>): string {
  const tempRoot = path.join(
    tmpdir(),
    `lighthouse-emitter-binding-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(path.join(tempRoot, "app/lib"), { recursive: true });
  mkdirSync(path.join(tempRoot, "docs/contracts/story-chain"), { recursive: true });
  writeFileSync(
    path.join(tempRoot, "docs/contracts/story-chain/scenario-catalog.md"),
    "# Scenario Catalog\n",
  );
  for (const [relativePath, source] of Object.entries(sourceFiles)) {
    const filePath = path.join(tempRoot, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, source);
  }
  return tempRoot;
}

describe("mc:validate-events", () => {
  it("accepts the canonical event contract", () => {
    const result = validateEventContract(parseEventContract(validSource), chain, repoRoot);

    expect(result.errors).toEqual([]);
  });

  it("enforces snake_case canonical, Amplitude, and property names for active product events", () => {
    expect(
      validate(firstEventSource("").replace("name: search_submitted", "name: search.submitted"))
        .errors,
    ).toContain(
      "search.submitted: active product event name must use <object>_<past_tense_action>",
    );

    expect(
      validate(
        firstEventSource("").replace("amplitude: search_submitted", "amplitude: Search Submitted"),
      ).errors,
    ).toContain("search_submitted: Amplitude sink name must match the canonical snake_case name");

    expect(
      validate(firstEventSource("").replace("  owner_principal_id:", "  ownerPrincipalId:")).errors,
    ).toContain("ownerPrincipalId: analytics property name must use snake_case");

    const camelCaseSubject = parseEventContract(firstEventSource(""));
    camelCaseSubject.events[0]?.subject.allowed.push("paperId");
    expect(
      validateEventContract(camelCaseSubject, chainWithoutRequiredEvents, repoRoot, {
        runtimeSourceCheck: false,
      }).errors,
    ).toContain('search_submitted: analytics subject/property "paperId" must use snake_case');
  });

  it("does not let a newly added product dotted name inherit the legacy exception", () => {
    const result = validate(
      validSource.replace("name: search_submitted", "name: product.new_search.submitted"),
    );

    expect(result.errors).toContain(
      "product.new_search.submitted: active product event name must use <object>_<past_tense_action>",
    );
  });

  it("rejects non-snake-case analytics enum tokens", () => {
    const result = validate(
      validSource.replace("enum:\n      - route_bar", "enum:\n      - route-bar"),
    );

    expect(result.errors).toContain(
      'entry_source: string enum value "route-bar" must use lowercase snake_case',
    );
  });

  it("rejects circular property-purpose prose", () => {
    const result = validate(
      validSource.replace(
        "Join the event to its opaque search journey root without collecting query content.",
        "Collect journey_context_id only for the declared journey measurement.",
      ),
    );

    expect(result.errors).toContain(
      "search_submitted: measurement.propertyPurposes.journey_context_id must name a concrete analytic use",
    );
  });

  it("rejects an existing Experience ref that does not match the Promise Moment parent", () => {
    const eventContract = parseEventContract(validSource);
    const searchEvent = eventContract.events.find((event) => event.name === "search_submitted");
    const otherExperience = chain.experiences.find(
      (experience) => experience.id !== searchEvent?.storyRefs.experienceRef,
    );
    expect(searchEvent).toBeDefined();
    expect(otherExperience).toBeDefined();
    if (!searchEvent || !otherExperience) throw new Error("event parent fixture missing");
    const expectedMoment = searchEvent.storyRefs.momentRef;
    if (!expectedMoment) throw new Error("event Moment fixture missing");
    searchEvent.storyRefs.experienceRef = otherExperience.id;

    const result = validateEventContract(eventContract, chain, repoRoot, {
      runtimeSourceCheck: false,
    });

    expect(result.errors).toContain(
      `search_submitted: experienceRef "${otherExperience.id}" must match ${expectedMoment} parent "experience:research-and-discovery"`,
    );
  });

  it("rejects an existing Moment ref that does not match the Promise parent", () => {
    const eventContract = parseEventContract(validSource);
    const searchEvent = eventContract.events.find((event) => event.name === "search_submitted");
    const otherMoment = chain.moments.find(
      (moment) => moment.id !== searchEvent?.storyRefs.momentRef,
    );
    expect(searchEvent).toBeDefined();
    expect(otherMoment).toBeDefined();
    if (!searchEvent || !otherMoment) throw new Error("event parent fixture missing");
    const expectedMoment = searchEvent.storyRefs.momentRef;
    if (!expectedMoment) throw new Error("event Moment fixture missing");
    searchEvent.storyRefs.momentRef = otherMoment.id;

    const result = validateEventContract(eventContract, chain, repoRoot, {
      runtimeSourceCheck: false,
    });

    expect(result.errors).toContain(
      `search_submitted: momentRef "${otherMoment.id}" must match promise:search-query-route-transition parent "${expectedMoment}"`,
    );
  });

  it("rejects canonical runtime events that are emitted without events.yaml declarations", () => {
    const sourceWithoutPdfClicked = validSource.replace(
      /\n  - name: pdf_opened[\s\S]*?(?=\n  - name: product\.ai_comment_card\.viewed)/,
      "",
    );

    const result = validateEventContract(
      parseEventContract(sourceWithoutPdfClicked),
      chainWithoutRequiredEvents,
      repoRoot,
    );

    expect(result.errors).toContain(
      "pdf_opened: runtime emits undeclared canonical event from app/lib/track.ts",
    );
  });

  it("rejects a declared emitter without a production implementation", () => {
    const tempRoot = createEmitterFixture({
      "app/lib/commented-emitter.ts": [
        "// export function trackSearchSubmitted(): void {",
        "//   trackCanonicalEvent('search_submitted', {});",
        "// }",
      ].join("\n"),
    });

    const result = validateEventContract(
      parseEventContract(firstEventSource("")),
      chainWithoutRequiredEvents,
      tempRoot,
    );

    expect(result.errors).toContain(
      'search_submitted: emission emitter "trackSearchSubmitted" must resolve to exactly one exported production function; found 0',
    );
  });

  it("rejects a declared emitter without a production caller", () => {
    const tempRoot = createEmitterFixture({
      "app/lib/emitter.ts": [
        "import { trackCanonicalEvent } from './analytics/client';",
        "export function trackSearchSubmitted(): void {",
        "  trackCanonicalEvent('search_submitted', { actor: { type: 'user' }, properties: {} });",
        "}",
        "// trackSearchSubmitted();",
        'const example = "trackSearchSubmitted()";',
        "// trackCanonicalEvent('search_submitted', {});",
      ].join("\n"),
    });

    const result = validateEventContract(
      parseEventContract(firstEventSource("")),
      chainWithoutRequiredEvents,
      tempRoot,
    );

    expect(result.errors).toContain(
      'search_submitted: emission emitter "trackSearchSubmitted" has no production caller',
    );
    expect(result.errors).not.toContain(
      'search_submitted: production emit path bypasses declared emitter "trackSearchSubmitted" from app/lib/emitter.ts',
    );
  });

  it("rejects production paths that bypass the declared emitter", () => {
    const tempRoot = createEmitterFixture({
      "app/lib/emitter.ts": [
        "import { trackCanonicalEvent } from './analytics/client';",
        "export function trackSearchSubmitted(): void {",
        "  trackCanonicalEvent('search_submitted', { actor: { type: 'user' }, properties: {} });",
        "}",
        "export function submitSearch(): void {",
        "  trackSearchSubmitted();",
        "  trackCanonicalEvent('search_submitted', { actor: { type: 'user' }, properties: {} });",
        "}",
      ].join("\n"),
    });

    const result = validateEventContract(
      parseEventContract(firstEventSource("")),
      chainWithoutRequiredEvents,
      tempRoot,
    );

    expect(result.errors).toContain(
      'search_submitted: production emit path bypasses declared emitter "trackSearchSubmitted" from app/lib/emitter.ts',
    );
  });

  it("rejects canonical events emitted through one-shot runtime helpers without declarations", () => {
    const sourceWithoutBudgetEvent = validSource.replace(
      /\n  - name: search_results_viewed[\s\S]*?(?=\n  - name: paper_saved)/,
      "",
    );

    const result = validateEventContract(
      parseEventContract(sourceWithoutBudgetEvent),
      chainWithoutRequiredEvents,
      repoRoot,
    );

    expect(result.errors).toContain(
      "search_results_viewed: runtime emits undeclared canonical event from app/lib/track.ts",
    );
  });

  it("rejects direct runtime canonical calls that do not use literal event names", () => {
    const tempRoot = path.join(tmpdir(), `lighthouse-dynamic-event-contract-${String(Date.now())}`);
    mkdirSync(path.join(tempRoot, "app/lib"), { recursive: true });
    mkdirSync(path.join(tempRoot, "docs/contracts/story-chain"), { recursive: true });
    writeFileSync(
      path.join(tempRoot, "docs/contracts/story-chain/scenario-catalog.md"),
      "# Scenario Catalog\n",
    );
    writeFileSync(
      path.join(tempRoot, "app/lib/dynamic-event.ts"),
      [
        "import { trackCanonicalEvent } from './analytics/client';",
        "const eventName = 'search_submitted';",
        "trackCanonicalEvent(eventName, { actor: { type: 'user' }, properties: {} });",
      ].join("\n"),
    );

    const result = validateEventContract(
      parseEventContract(firstEventSource("")),
      chainWithoutRequiredEvents,
      tempRoot,
    );

    expect(result.errors).toContain(
      "app/lib/dynamic-event.ts: trackCanonicalEvent must use a literal canonical event name",
    );
  });

  it("rejects canonical client import aliases that bypass runtime event scanning", () => {
    const tempRoot = path.join(tmpdir(), `lighthouse-aliased-event-contract-${String(Date.now())}`);
    mkdirSync(path.join(tempRoot, "app/lib"), { recursive: true });
    mkdirSync(path.join(tempRoot, "docs/contracts/story-chain"), { recursive: true });
    writeFileSync(
      path.join(tempRoot, "docs/contracts/story-chain/scenario-catalog.md"),
      "# Scenario Catalog\n",
    );
    writeFileSync(
      path.join(tempRoot, "app/lib/aliased-event.ts"),
      [
        "import { trackCanonicalEvent as send } from './analytics/client';",
        "send('undeclared_event', { actor: { type: 'user' }, properties: {} });",
      ].join("\n"),
    );

    const result = validateEventContract(
      parseEventContract(validSource),
      chainWithoutRequiredEvents,
      tempRoot,
    );

    expect(result.errors).toContain(
      "app/lib/aliased-event.ts: trackCanonicalEvent import aliases are not allowed because event names must remain statically scannable",
    );
  });

  it("rejects non-literal member calls outside the declared router boundaries", () => {
    const tempRoot = path.join(tmpdir(), `lighthouse-member-event-contract-${String(Date.now())}`);
    mkdirSync(path.join(tempRoot, "app/lib"), { recursive: true });
    mkdirSync(path.join(tempRoot, "docs/contracts/story-chain"), { recursive: true });
    writeFileSync(
      path.join(tempRoot, "docs/contracts/story-chain/scenario-catalog.md"),
      "# Scenario Catalog\n",
    );
    writeFileSync(
      path.join(tempRoot, "app/lib/member-event.ts"),
      [
        "const eventName = 'search_submitted';",
        "router.trackCanonicalEvent(eventName, { actor: { type: 'user' }, properties: {} });",
      ].join("\n"),
    );

    const result = validateEventContract(
      parseEventContract(firstEventSource("")),
      chainWithoutRequiredEvents,
      tempRoot,
    );

    expect(result.errors).toContain(
      "app/lib/member-event.ts: trackCanonicalEvent must use a literal canonical event name",
    );
  });

  it("parses event definitions with optional refs, subjects, properties, privacy, and sinks intact", () => {
    const contract = parseEventContract(firstEventSource(""));
    const event = contract.events[0];

    expect(event).toEqual({
      name: "search_submitted",
      version: 1,
      owner: "product",
      actor: "user",
      surface: "research-route",
      storyRefs: {
        experienceRef: "experience:research-and-discovery",
        momentRef: "moment:search-results-first-review",
        promiseRef: "promise:search-reaction-summarizes-terrain",
        relatedPromiseRefs: [],
        aspectRefs: [],
        acceptanceCheckRefs: [],
        scenarioRefs: [],
      },
      observability: {
        realitySignal: true,
        signalMeaning: "user search input triggered the search reaction flow",
        severity: "info",
        requiredForPromiseCoverage: false,
      },
      trigger: {
        source: "client",
        phase: "requested",
        timing: "test trigger",
      },
      measurement: {
        purpose: "test measurement purpose",
        decisionUse: "test decision use",
        propertyPurposes: {
          owner_principal_id: "test route-owned research route payload purpose",
        },
      },
      subject: {
        allowed: ["owner_principal_id"],
      },
      properties: {
        required: ["owner_principal_id"],
        optional: [],
        forbidden: ["token"],
      },
      privacy: {
        level: "behavior_metadata",
        allowExternalSinks: true,
      },
      emission: {
        boundary: "command_handler",
        cardinality: "every_action",
        identityKeys: ["subject.owner_principal_id"],
        emitter: "trackSearchSubmitted",
      },
      sinks: {
        amplitude: "search_submitted",
      },
    });
  });

  it("rejects missing or unsupported emission contracts", () => {
    const missingEmission = firstEventSource("").replace(
      "    emission:\n      boundary: command_handler\n      cardinality: every_action\n      identityKeys:\n        - subject.owner_principal_id\n      emitter: trackSearchSubmitted\n",
      "",
    );
    expect(validate(missingEmission).errors).toContain(
      "search_submitted: emission contract is required",
    );

    const invalidIdentityKey = firstEventSource("").replace(
      "        - subject.owner_principal_id",
      "        - properties.missingKey",
    );
    expect(validate(invalidIdentityKey).errors).toContain(
      'search_submitted: emission identity key "properties.missingKey" is not a declared property',
    );

    const invalidEmitter = firstEventSource("").replace(
      "      emitter: trackSearchSubmitted",
      "      emitter: missingEmitter",
    );
    expect(validate(invalidEmitter).errors).toContain(
      'search_submitted: emission emitter "missingEmitter" is not registered',
    );
  });

  it("rejects product events without measurement purpose or property purposes", () => {
    const missingMeasurement = firstEventSource("").replace(
      "    measurement:\n      purpose: test measurement purpose\n      decisionUse: test decision use\n      propertyPurposes:\n        owner_principal_id: test route-owned research route payload purpose\n",
      "",
    );
    expect(validate(missingMeasurement).errors).toContain(
      "search_submitted: product events must declare measurement purpose",
    );

    const missingPropertyPurpose = firstEventSource("").replace(
      "        owner_principal_id: test route-owned research route payload purpose",
      "        otherKey: test purpose",
    );
    expect(validate(missingPropertyPurpose).errors).toContain(
      'search_submitted: measurement.propertyPurposes missing "owner_principal_id"',
    );
  });

  it("rejects required Promise events that are missing or point at another Promise", () => {
    const requiredPromise = chain.promises.find(
      (promise) => promise.id === "promise:inline-analysis-auto-run",
    );
    expect(requiredPromise?.requiredEvents).toContain("search_result_inspected");

    const missingRequiredEvent = validSource.replace(
      /  - name: search_result_inspected[\s\S]*?(?=\n  - name: product\.search_term_candidate\.clicked)/,
      "",
    );
    expect(validate(missingRequiredEvent, chain).errors).toContain(
      'promise:inline-analysis-auto-run: required event "search_result_inspected" is not declared',
    );

    const wrongPromiseRef = validSource.replace(
      "promiseRef: promise:inline-analysis-auto-run",
      "promiseRef: promise:search-results-fast-window",
    );
    expect(validate(wrongPromiseRef, chain).errors).toContain(
      'promise:inline-analysis-auto-run: required event "search_result_inspected" does not use the Promise as its primary promiseRef',
    );

    const relatedOnly = parseEventContract(validSource);
    const relatedOnlyEvent = relatedOnly.events.find(
      (event) => event.name === "search_result_inspected",
    );
    if (!relatedOnlyEvent) throw new Error("search_result_inspected fixture missing");
    relatedOnlyEvent.storyRefs.promiseRef = "promise:search-results-fast-window";
    relatedOnlyEvent.storyRefs.relatedPromiseRefs = ["promise:inline-analysis-auto-run"];
    expect(
      validateEventContract(relatedOnly, chain, repoRoot, { runtimeSourceCheck: false }).errors,
    ).toContain(
      'promise:inline-analysis-auto-run: required event "search_result_inspected" does not use the Promise as its primary promiseRef',
    );
  });

  it("parses related Promise refs and rejects undeclared or primary-duplicate refs", () => {
    const sourceWithRelated = firstEventSource("").replace(
      "      promiseRef: promise:search-reaction-summarizes-terrain\n      aspectRefs:",
      "      promiseRef: promise:search-reaction-summarizes-terrain\n      relatedPromiseRefs:\n        - promise:search-results-fast-window\n      aspectRefs:",
    );
    expect(parseEventContract(sourceWithRelated).events[0]?.storyRefs.relatedPromiseRefs).toEqual([
      "promise:search-results-fast-window",
    ]);

    const duplicate = parseEventContract(sourceWithRelated);
    duplicate.events[0].storyRefs.relatedPromiseRefs = [
      "promise:search-reaction-summarizes-terrain",
    ];
    expect(
      validateEventContract(duplicate, chainWithoutRequiredEvents, repoRoot, {
        runtimeSourceCheck: false,
      }).errors,
    ).toContain(
      'search_submitted: relatedPromiseRefs repeats primary promiseRef "promise:search-reaction-summarizes-terrain"',
    );

    const undeclared = parseEventContract(sourceWithRelated);
    undeclared.events[0].storyRefs.relatedPromiseRefs = ["promise:missing-related"];
    expect(
      validateEventContract(undeclared, chainWithoutRequiredEvents, repoRoot, {
        runtimeSourceCheck: false,
      }).errors,
    ).toContain('search_submitted: relatedPromiseRef "promise:missing-related" is not declared');
  });

  it("rejects owner_principal_id as a required property or identity key for result-card detail clicks", () => {
    const requiredOwnerPrincipalId = parseEventContract(validSource);
    const requiredEvent = requiredOwnerPrincipalId.events.find(
      (event) => event.name === "search_result_inspected",
    );
    if (!requiredEvent) throw new Error("search_result_inspected fixture missing");
    requiredEvent.properties.required.push("owner_principal_id");
    expect(
      validateEventContract(requiredOwnerPrincipalId, chainWithoutRequiredEvents, repoRoot, {
        runtimeSourceCheck: false,
      }).errors,
    ).toContain(
      "search_result_inspected: owner_principal_id is not allowed as a required property or identity key",
    );

    const identityOwnerPrincipalId = parseEventContract(validSource);
    const identityEvent = identityOwnerPrincipalId.events.find(
      (event) => event.name === "search_result_inspected",
    );
    if (!identityEvent?.emission) throw new Error("search_result_inspected emission missing");
    identityEvent.emission.identityKeys.push("properties.owner_principal_id");
    expect(
      validateEventContract(identityOwnerPrincipalId, chainWithoutRequiredEvents, repoRoot, {
        runtimeSourceCheck: false,
      }).errors,
    ).toContain(
      "search_result_inspected: owner_principal_id is not allowed as a required property or identity key",
    );
  });

  it("rejects a missing Promise ref", () => {
    const result = validate(
      validSource.replace(
        "promiseRef: promise:search-query-route-transition",
        "promiseRef: promise:missing-search-promise",
      ),
    );

    expect(result.errors).toContain(
      'search_submitted: promiseRef "promise:missing-search-promise" is not declared',
    );
  });

  it("rejects malformed Story Chain ref prefixes", () => {
    expect(() =>
      parseEventContract(
        validSource.replace(
          "promiseRef: promise:search-query-route-transition",
          "promiseRef: promose:search-query-route-transition",
        ),
      ),
    ).toThrow(
      'search_submitted.storyRefs.promiseRef must be a canonical Story Chain ref starting with "promise:"',
    );
  });

  it("rejects a missing Aspect ref", () => {
    const result = validate(
      validSource.replace(
        "      aspectRefs: []",
        "      aspectRefs:\n        - aspect:missing-routing-aspect",
      ),
    );

    expect(result.errors).toContain(
      'search_submitted: aspectRef "aspect:missing-routing-aspect" is not declared',
    );
  });

  it("rejects required properties that are also forbidden", () => {
    const result = validate(
      validSource.replace(
        "        - query_length\n        - sort",
        "        - query_length\n        - sort\n        - token",
      ),
    );

    expect(result.errors).toContain(
      'search_submitted: forbidden property "token" is also required/optional',
    );
  });

  it("rejects duplicate event names", () => {
    const result = validate(
      validSource.replace("  - name: search_results_viewed", "  - name: search_submitted"),
    );

    expect(result.errors).toContain('events: duplicate "search_submitted"');
  });

  it("rejects invalid primitive and enum event fields with precise labels", () => {
    expect(() =>
      parseEventContract(
        firstEventSource("")
          .replace("version: 1", "version: 0")
          .replace("owner: product", "owner: invalid_owner"),
      ),
    ).toThrow("search_submitted.version must be a positive integer");

    expect(() =>
      parseEventContract(firstEventSource("").replace("owner: product", "owner: invalid_owner")),
    ).toThrow('search_submitted.owner has unsupported value "invalid_owner"');

    expect(() =>
      parseEventContract(
        firstEventSource("").replace(
          "requiredForPromiseCoverage: false",
          "requiredForPromiseCoverage: maybe",
        ),
      ),
    ).toThrow("search_submitted.observability.requiredForPromiseCoverage must be a boolean");
  });

  it("rejects malformed arrays and sink records while defaulting omitted sinks", () => {
    expect(() =>
      parseEventContract(
        firstEventSource("").replace(
          "      allowed:\n        - owner_principal_id",
          "      allowed:\n        - owner_principal_id\n        - 42",
        ),
      ),
    ).toThrow("search_submitted.subject.allowed must be a string array");

    expect(() =>
      parseEventContract(
        firstEventSource("").replace("amplitude: search_submitted", "amplitude: 42"),
      ),
    ).toThrow("search_submitted.sinks.amplitude must be a non-empty string");

    const withoutSinks = parseEventContract(
      firstEventSource("").replace("    sinks:\n      amplitude: search_submitted", ""),
    );
    expect(withoutSinks.events[0]?.sinks).toEqual({});
  });

  it.each([
    ["root object", "[]", "events.yaml must be an object"],
    ["null root object", "null", "events.yaml must be an object"],
    ["events array", "events: {}", "events.yaml events must be an array"],
    ["event object", "events:\n  - []", "events[0] must be an object"],
    [
      "non-empty name",
      validSource.replace("name: search_submitted", "name: ''"),
      "events[0].name must be a non-empty string",
    ],
    [
      "positive version",
      validSource.replace(
        "name: search_submitted\n    version: 3",
        "name: search_submitted\n    version: 0",
      ),
      "search_submitted.version must be a positive integer",
    ],
    [
      "integer version",
      validSource.replace(
        "name: search_submitted\n    version: 3",
        "name: search_submitted\n    version: 1.5",
      ),
      "search_submitted.version must be a positive integer",
    ],
    [
      "numeric version",
      validSource.replace(
        "name: search_submitted\n    version: 3",
        "name: search_submitted\n    version: one",
      ),
      "search_submitted.version must be a positive integer",
    ],
    [
      "supported owner",
      validSource.replace("owner: product", "owner: marketing"),
      'search_submitted.owner has unsupported value "marketing"',
    ],
    [
      "supported actor",
      validSource.replace("actor: user", "actor: customer"),
      'search_submitted.actor has unsupported value "customer"',
    ],
    [
      "supported surface",
      validSource.replace("surface: research-route", "surface: terminal"),
      'search_submitted.surface has unsupported value "terminal"',
    ],
    [
      "string arrays",
      validSource.replace("aspectRefs: []", "aspectRefs: [123]"),
      "search_submitted.storyRefs.aspectRefs must be a string array",
    ],
    [
      "string subject arrays",
      firstEventSource("").replace(
        "allowed:\n        - owner_principal_id",
        "allowed: [owner_principal_id, 123]",
      ),
      "search_submitted.subject.allowed must be a string array",
    ],
    [
      "non-empty trigger timing",
      firstEventSource("").replace("timing: test trigger", "timing: ''"),
      "search_submitted.trigger.timing must be a non-empty string",
    ],
    [
      "boolean observability",
      validSource.replace("realitySignal: true", "realitySignal: maybe"),
      "search_submitted.observability.realitySignal must be a boolean",
    ],
    [
      "supported severity",
      validSource.replace("severity: info", "severity: notice"),
      'search_submitted.observability.severity has unsupported value "notice"',
    ],
    [
      "string sink names",
      validSource.replace("amplitude: search_submitted", "amplitude: 123"),
      "search_submitted.sinks.amplitude must be a non-empty string",
    ],
  ])("rejects malformed analytics contract shape: %s", (_label, source, message) => {
    expect(() => parseEventContract(source)).toThrow(message);
  });

  it("rejects malformed optional Story Chain refs before validation", () => {
    expect(() =>
      parseEventContract(
        firstEventSource("").replace(
          "momentRef: moment:search-results-first-review",
          "momentRef: momento:not-canonical",
        ),
      ),
    ).toThrow(
      'search_submitted.storyRefs.momentRef must be a canonical Story Chain ref starting with "moment:"',
    );

    expect(() =>
      parseEventContract(
        firstEventSource("").replace("      aspectRefs: []", "      aspectRefs:\n        - asp:x"),
      ),
    ).toThrow(
      'search_submitted.storyRefs.aspectRefs[0] must be a canonical Story Chain ref starting with "aspect:"',
    );

    expect(() =>
      parseEventContract(
        firstEventSource("").replace(
          "      acceptanceCheckRefs: []",
          "      acceptanceCheckRefs:\n        - check:x",
        ),
      ),
    ).toThrow(
      'search_submitted.storyRefs.acceptanceCheckRefs[0] must be a canonical Story Chain ref starting with "acceptance-check:"',
    );
  });

  it("rejects duplicate sink event names per sink", () => {
    const result = validate(
      validSource
        .replace("amplitude: search_submitted", "amplitude: duplicate_sink")
        .replace("amplitude: search_results_viewed", "amplitude: duplicate_sink"),
    );

    expect(result.errors).toContain('sink amplitude: duplicate "duplicate_sink"');
  });

  it("reports warning-only event shape issues without failing validation", () => {
    const result = validate(
      firstEventSource(`  - name: product.BadName
    version: 1
    owner: governance
    actor: system
    surface: cli
    storyRefs:
      aspectRefs: []
      acceptanceCheckRefs: []
      scenarioRefs: []
    observability:
      realitySignal: true
      signalMeaning: no promise reference
      severity: warning
      requiredForPromiseCoverage: false
    trigger:
      source: cli
      phase: completed
      timing: warning test trigger
    subject:
      allowed: []
    properties:
      required: []
      optional: []
      forbidden: []
    privacy:
      level: public_contract
      allowExternalSinks: false
    emission:
      boundary: state_transition
      cardinality: once_per_identity
      identityKeys:
        - actor.id
      emitter: trackSearchSubmitted
    sinks: {}
`),
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "product.BadName: legacy event name should use a dotted namespace",
        "product.BadName: governance event should not use product namespace",
        "product.BadName: reality signal events should name a promiseRef",
      ]),
    );
  });

  it("reports product cli/ci surface warnings and governance product-name warnings independently", () => {
    const result = validate(
      firstEventSource(`  - name: product.cli_event
    version: 1
    owner: product
    actor: operator
    surface: ci
    storyRefs:
      aspectRefs: []
      acceptanceCheckRefs: []
      scenarioRefs: []
    observability:
      realitySignal: false
      signalMeaning: product event on ci surface
      severity: info
      requiredForPromiseCoverage: false
    trigger:
      source: cli
      phase: completed
      timing: ci warning trigger
    measurement:
      purpose: ci warning purpose
      decisionUse: ci warning decision use
      propertyPurposes: {}
    subject:
      allowed: []
    properties:
      required: []
      optional: []
      forbidden: []
    privacy:
      level: public_contract
      allowExternalSinks: false
    emission:
      boundary: command_handler
      cardinality: every_action
      identityKeys:
        - actor.id
      emitter: trackSearchSubmitted
    sinks: {}
`),
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "product.cli_event: active product event name must use <object>_<past_tense_action>",
        "product.cli_event: active product event name must end with an approved past-tense action",
      ]),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining(["product.cli_event: product event should not use ci surface"]),
    );
  });

  it("reports owner-specific verb warnings without warning for canonical product actions", () => {
    const result = validate(
      firstEventSource(`  - name: product.search.completed
    version: 1
    owner: product
    actor: user
    surface: research-route
    storyRefs:
      aspectRefs: []
      acceptanceCheckRefs: []
      scenarioRefs: []
    observability:
      realitySignal: false
      signalMeaning: product event with system-style verb
      severity: info
      requiredForPromiseCoverage: false
    trigger:
      source: client
      phase: completed
      timing: product verb warning trigger
    measurement:
      purpose: product verb warning purpose
      decisionUse: product verb warning decision use
      propertyPurposes: {}
    subject:
      allowed: []
    properties:
      required: []
      optional: []
      forbidden: []
    privacy:
      level: behavior_metadata
      allowExternalSinks: false
    emission:
      boundary: command_handler
      cardinality: every_action
      identityKeys: []
      emitter: trackSearchSubmitted
    sinks: {}
  - name: governance.audit.completed
    version: 1
    owner: governance
    actor: operator
    surface: cli
    storyRefs:
      aspectRefs: []
      acceptanceCheckRefs: []
      scenarioRefs: []
    observability:
      realitySignal: false
      signalMeaning: governance event with product-style verb
      severity: info
      requiredForPromiseCoverage: false
    trigger:
      source: cli
      phase: completed
      timing: governance verb warning trigger
    subject:
      allowed: []
    properties:
      required: []
      optional: []
      forbidden: []
    privacy:
      level: public_contract
      allowExternalSinks: false
    emission:
      boundary: command_handler
      cardinality: every_action
      identityKeys: []
      emitter: trackSearchSubmitted
    sinks: {}
`),
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "product.search.completed: active product event name must use <object>_<past_tense_action>",
        "product.search.completed: active product event name must end with an approved past-tense action",
      ]),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "governance.audit.completed: governance event name should end with synced or failed",
      ]),
    );
    expect(result.warnings).not.toContain(
      "search_submitted: product event name should end with a user-action verb such as clicked, viewed, submitted, queued, or failed",
    );
  });

  it("reports name-pattern warnings for missing anchors and invalid characters", () => {
    const result = validate(
      firstEventSource(`  - name: product.search.
    version: 1
    owner: runtime
    actor: agent
    surface: agent_runtime
    storyRefs:
      aspectRefs: []
      acceptanceCheckRefs: []
      scenarioRefs: []
    observability:
      realitySignal: false
      signalMeaning: invalid dotted suffix
      severity: info
      requiredForPromiseCoverage: false
    trigger:
      source: runtime
      phase: failed
      timing: warning test trigger
    subject:
      allowed: []
    properties:
      required: []
      optional: []
      forbidden: []
    privacy:
      level: behavior_metadata
      allowExternalSinks: false
    sinks: {}
  - name: product.search.bad-char
    version: 1
    owner: runtime
    actor: agent
    surface: agent_runtime
    storyRefs:
      aspectRefs: []
      acceptanceCheckRefs: []
      scenarioRefs: []
    observability:
      realitySignal: false
      signalMeaning: invalid character
      severity: info
      requiredForPromiseCoverage: false
    trigger:
      source: runtime
      phase: failed
      timing: warning test trigger
    subject:
      allowed: []
    properties:
      required: []
      optional: []
      forbidden: []
    privacy:
      level: behavior_metadata
      allowExternalSinks: false
    sinks: {}
`),
    );

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "product.search.: legacy event name should use a dotted namespace",
        "product.search.bad-char: legacy event name should use a dotted namespace",
      ]),
    );
  });

  it("rejects restricted external sinks and missing parent or scenario refs", () => {
    const result = validate(
      firstEventSource(`  - name: product.restricted
    version: 1
    owner: product
    actor: user
    surface: research-route
    storyRefs:
      experienceRef: experience:missing
      momentRef: moment:missing
      promiseRef: promise:search-reaction-summarizes-terrain
      aspectRefs: []
      acceptanceCheckRefs: []
      scenarioRefs:
        - scenario:missing
    observability:
      realitySignal: true
      signalMeaning: invalid refs
      severity: info
      requiredForPromiseCoverage: false
    trigger:
      source: client
      phase: requested
      timing: restricted test trigger
    subject:
      allowed: []
    properties:
      required: []
      optional: []
      forbidden: []
    privacy:
      level: restricted
      allowExternalSinks: true
    sinks: {}
`),
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "product.restricted: restricted events cannot allow external sinks",
        'product.restricted: experienceRef "experience:missing" is not declared',
        'product.restricted: momentRef "moment:missing" is not declared',
        'product.restricted: scenarioRef "scenario:missing" is not declared',
      ]),
    );
  });

  it("parses declared scenario ids only from canonical scenario headings", () => {
    const tempRoot = path.join(tmpdir(), `lighthouse-scenario-contract-${String(Date.now())}`);
    mkdirSync(path.join(tempRoot, "docs/contracts/story-chain"), { recursive: true });
    writeFileSync(
      path.join(tempRoot, "docs/contracts/story-chain/scenario-catalog.md"),
      [
        "# Scenario Catalog",
        "### Search success scenario:search-reaction",
        "### Missing boundary scenario:missing",
        "### Not canonical scenario:BadCase",
        "#### Too deep scenario:deeply-nested",
      ].join("\n"),
    );

    const source = firstEventSource("").replace(
      "scenarioRefs: []",
      "scenarioRefs:\n        - scenario:search-reaction\n        - scenario:deeply-nested",
    );
    const result = validateEventContract(parseEventContract(source), chain, tempRoot);

    expect(result.errors).toContain(
      'search_submitted: scenarioRef "scenario:deeply-nested" is not declared',
    );
    expect(result.errors).not.toContain(
      'search_submitted: scenarioRef "scenario:search-reaction" is not declared',
    );
  });

  it("rejects unsupported emission identity keys while accepting actor and device identity", () => {
    const validIdentity = firstEventSource("").replace(
      "      identityKeys:\n        - subject.owner_principal_id",
      "      identityKeys:\n        - actor.id\n        - deviceId",
    );
    expect(validate(validIdentity).errors).toEqual([]);

    const unsupportedIdentity = firstEventSource("").replace(
      "        - subject.owner_principal_id",
      "        - sessionId",
    );
    expect(validate(unsupportedIdentity).errors).toContain(
      'search_submitted: emission identity key "sessionId" is not supported',
    );
  });

  it("rejects an aspect that exists but does not apply to the referenced promise", () => {
    const result = validate(
      validSource.replace(
        "      aspectRefs: []",
        "      aspectRefs:\n        - aspect:admin-access-control",
      ),
    );

    expect(result.errors).toContain(
      'search_submitted: aspectRef "aspect:admin-access-control" does not apply to promise:search-query-route-transition',
    );
  });

  it("rejects an undeclared Acceptance Check ref", () => {
    const result = validate(
      validSource.replace(
        "      acceptanceCheckRefs: []",
        "      acceptanceCheckRefs:\n        - acceptance-check:missing-ac",
      ),
    );

    expect(result.errors).toContain(
      'search_submitted: acceptanceCheckRef "acceptance-check:missing-ac" is not declared',
    );
  });

  it("rejects Acceptance Check refs that belong to a different promise", () => {
    const result = validate(
      validSource.replace(
        "      acceptanceCheckRefs: []",
        "      acceptanceCheckRefs:\n        - acceptance-check:citation-lineage-entry-point-counts-visible",
      ),
    );

    expect(result.errors).toContain(
      'search_submitted: acceptanceCheckRef "acceptance-check:citation-lineage-entry-point-counts-visible" does not belong to promise:search-query-route-transition',
    );
  });

  it("throws joined validation errors from the strict validation helper and loads contracts from disk", () => {
    const result = validateEventContractOrThrow(parseEventContract(validSource), chain, repoRoot);
    expect(result.errors).toEqual([]);
    expect(loadEventContract(repoRoot).events.length).toBeGreaterThan(0);

    const invalid = parseEventContract(
      validSource
        .replace(
          "promiseRef: promise:search-query-route-transition",
          "promiseRef: promise:missing-one",
        )
        .replace("amplitude: search_submitted", "amplitude: duplicate_sink")
        .replace("amplitude: search_results_viewed", "amplitude: duplicate_sink"),
    );
    expect(() => validateEventContractOrThrow(invalid, chain, repoRoot)).toThrow(
      AnalyticsEventContractError,
    );
    expect(() => validateEventContractOrThrow(invalid, chain, repoRoot)).toThrow(
      /sink amplitude: duplicate "duplicate_sink"[\s\S]*promiseRef "promise:missing-one" is not declared/,
    );
  });
});

describe("mc:validate-events CLI wrapper", () => {
  it("runs from the script entrypoint even when NODE_ENV is test", () => {
    expect(
      shouldRunValidateEventsCli(["node", "/repo/scripts/mission-control/mc-validate-events.ts"]),
    ).toBe(true);
    expect(
      shouldRunValidateEventsCli([
        "node",
        "C:\\repo\\scripts\\mission-control\\mc-validate-events.ts",
      ]),
    ).toBe(true);
    expect(shouldRunValidateEventsCli(["node", "/repo/node_modules/vitest/vitest.mjs"])).toBe(
      false,
    );
  });

  it("prints success and warning counts when the contract validates", async () => {
    const stdoutWrites: string[] = [];
    const stderrWrites: string[] = [];

    const exitCode = await runValidateEventsCli({
      repoRoot: "/repo",
      stdout: {
        write: (chunk: string) => {
          stdoutWrites.push(chunk);
          return true;
        },
      },
      stderr: {
        write: (chunk: string) => {
          stderrWrites.push(chunk);
          return true;
        },
      },
      loadEventContract: () =>
        ({
          events: [{ name: "product.pdf.opened" }, { name: "search_submitted" }],
        }) as never,
      loadStoryChain: () => ({}) as never,
      validateEventContractOrThrow: () => ({ errors: [], warnings: ["warning one"] }),
    });

    expect(exitCode).toBe(0);
    expect(stderrWrites).toEqual([]);
    expect(stdoutWrites.join("")).toContain("mc:validate-events — event contract green");
    expect(stdoutWrites.join("")).toContain("events      2");
    expect(stdoutWrites.join("")).toContain("warnings    1");
    expect(stdoutWrites.join("")).toContain("- warning one");
  });

  it("prints validation failures and returns exit code 1", async () => {
    const stderrWrites: string[] = [];

    const exitCode = await runValidateEventsCli({
      repoRoot: "/repo",
      stdout: { write: () => true },
      stderr: {
        write: (chunk: string) => {
          stderrWrites.push(chunk);
          return true;
        },
      },
      loadEventContract: () => ({ events: [] }) as never,
      loadStoryChain: () => ({}) as never,
      validateEventContractOrThrow: () => {
        throw new Error("contract failed");
      },
    });

    expect(exitCode).toBe(1);
    expect(stderrWrites.join("")).toContain("mc:validate-events — FAIL");
    expect(stderrWrites.join("")).toContain("contract failed");
  });
});
