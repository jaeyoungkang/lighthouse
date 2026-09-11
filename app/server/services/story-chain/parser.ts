// Phase 1 parser for the Intent Weaving story-chain model — Promise + Aspect
// surfaces. Strict YAML Evidence Ledger parsing and graph resolution live in
// `./evidence-ledger-record.ts` and `./evidence-ledger-resolver.ts`, so the
// EvidenceLedger ≠ Promise authority boundary is also a file boundary.
//
// Authority guarantees this parser enforces:
//   - Promise parent ownership comes from the explicit `moment:` frontmatter
//     ref. Experience ownership is derived from that Moment; a Promise-level
//     `experience:` field is rejected as duplicate authority.
//   - `lane` comes from the explicit `lane:` frontmatter field. Older `US-*`
//     prefix shaping cannot reach this parser.
//   - Slugs are opaque. The parser does not split the slug or read tokens
//     from it.
//   - `canonical refs` is accepted but never used to resolve parent, lane, or
//     grouping; it is preserved as metadata only.
//   - Missing parent ref / missing aspect ref / unknown ref kind throws
//     `StoryChainParseError`.
//   - IntentCheck and AcceptanceCheck are parsed into separate, non-mergeable
//     types: an `intent-check:` block must not appear inside the AcceptanceCheck
//     section, and vice versa.

import {
  type AcceptanceCheck,
  type AcceptanceCheckRef,
  type Aspect,
  type AspectRef,
  type Experience,
  type ExperienceScope,
  type IntentCheck,
  type IntentCheckRef,
  type Moment,
  type PromiseDeclaration,
  type PromiseRef,
  type ServicePolicyCoverageStatus,
  isAcceptanceCheckRef,
  isAspectRef,
  isExperienceRef,
  isIntentCheckRef,
  isMomentRef,
  isPromiseRef,
  traceabilityNodePrefix,
} from "@/app/domain/story-chain";

import {
  StoryChainParseError,
  ensureLane,
  ensurePromiseStatus,
  ensureRef,
  ensureVerdict,
  readBulletFields,
  readList,
  readOptionalScalar,
  readScalar,
  splitFrontmatter,
  splitH2Sections,
  splitH3Blocks,
} from "./parser-shared";

export { StoryChainParseError } from "./parser-shared";
export { type ResolveContext, resolvePromiseParents, resolveEvidenceLedger } from "./resolver";

function parseIntentCheck(headingRef: string, body: string, file: string): IntentCheck {
  if (!isIntentCheckRef(headingRef)) {
    throw new StoryChainParseError(
      `${file}: intent check heading "${headingRef}" must use "intent-check:" prefix`,
    );
  }
  const fields = readBulletFields(body);
  const question = fields.get("question");
  const evidence = fields.get("evidence");
  const whyLiveJudge = fields.get("why live judge");
  const linkedRaw = fields.get("linked acceptance checks");
  const answerCriteria = fields.get("answer criteria");
  if (typeof question !== "string" || !question) {
    throw new StoryChainParseError(`${file}: ${headingRef}: missing "question"`);
  }
  if (typeof evidence !== "string" || !evidence) {
    throw new StoryChainParseError(`${file}: ${headingRef}: missing "evidence"`);
  }
  if (typeof whyLiveJudge !== "string" || !whyLiveJudge) {
    throw new StoryChainParseError(
      `${file}: ${headingRef}: missing "why live judge" — every IntentCheck must justify why it cannot be a deterministic AcceptanceCheck`,
    );
  }
  if (typeof answerCriteria !== "string" || !answerCriteria) {
    throw new StoryChainParseError(
      `${file}: ${headingRef}: missing "answer criteria" — live judges require an explicit rubric`,
    );
  }
  const linkedList = Array.isArray(linkedRaw) ? linkedRaw : [];
  const linkedAcceptanceChecks: AcceptanceCheckRef[] = linkedList.map((raw) =>
    ensureRef(raw, isAcceptanceCheckRef, "acceptance-check", file, `${headingRef}.linked`),
  );
  return {
    id: headingRef,
    question,
    evidence,
    whyLiveJudge,
    linkedAcceptanceChecks,
    answerCriteria,
  };
}

function parseAcceptanceCheck(
  headingRef: string,
  body: string,
  file: string,
  promiseSlug: string,
  acRulesEnforced: boolean,
): AcceptanceCheck {
  if (!isAcceptanceCheckRef(headingRef)) {
    throw new StoryChainParseError(
      `${file}: acceptance check heading "${headingRef}" must use "acceptance-check:" prefix`,
    );
  }
  const fields = readBulletFields(body);
  // Reject rubric fields here — they belong on IntentCheck only. This keeps
  // the two types from sliding into one another at the source-document level.
  if (fields.has("why live judge") || fields.has("answer criteria")) {
    throw new StoryChainParseError(
      `${file}: ${headingRef}: AcceptanceCheck must not carry "why live judge" or "answer criteria" — those belong to IntentCheck`,
    );
  }
  const description = fields.get("description");
  const evidence = fields.get("evidence");
  const runRaw = fields.get("run");
  const revisionRaw = fields.get("revision");
  if (typeof description !== "string" || !description) {
    throw new StoryChainParseError(`${file}: ${headingRef}: missing "description"`);
  }
  if (typeof evidence !== "string" || !evidence) {
    throw new StoryChainParseError(`${file}: ${headingRef}: missing "evidence"`);
  }
  let revision: number | undefined;
  if (typeof revisionRaw === "string") {
    if (!/^\d+$/.test(revisionRaw)) {
      throw new StoryChainParseError(
        `${file}: ${headingRef}: "revision" must be a positive integer (got "${revisionRaw}")`,
      );
    }
    const parsed = Number(revisionRaw);
    if (parsed < 1) {
      throw new StoryChainParseError(
        `${file}: ${headingRef}: "revision" must be ≥ 1 (got ${String(parsed)})`,
      );
    }
    revision = parsed;
  }
  // When the promise has acRulesEnforced: true, every AC must declare a
  // revision and satisfy the slug rules. Without the flag, ACs are
  // grandfathered. The promise-level flag is the explicit
  // boundary requested by `promise:alignment-coherence-gate#acceptance-check:alignment-coherence-gate-ac-slug-rule`.
  if (acRulesEnforced) {
    if (typeof revision !== "number") {
      throw new StoryChainParseError(
        `${file}: ${headingRef}: this promise sets acRulesEnforced: true, so every AC must declare a "revision" field`,
      );
    }
    enforceAcSlugRule(headingRef, promiseSlug, file);
  } else if (typeof revision === "number") {
    // The promise has not opted into the new rules but a single AC declared
    // revision anyway. Honor the slug rule for that AC only — the flag opt-in
    // covers the whole promise, but a per-AC opt-in still validates the slug.
    enforceAcSlugRule(headingRef, promiseSlug, file);
  }
  return {
    id: headingRef,
    description,
    evidence,
    runCommand: typeof runRaw === "string" ? runRaw : undefined,
    revision,
  };
}

// Enforced only when the AC declares `revision:`. ACs without revision
// auto-grandfather to the older `acN` shape and skip these rules. See
// promise:alignment-coherence-gate#acceptance-check:alignment-coherence-gate-ac-slug-rule.
function enforceAcSlugRule(headingRef: string, promiseSlug: string, file: string): void {
  const acceptanceCheckPrefix = traceabilityNodePrefix("acceptance-check");
  const slugBody = headingRef.slice(acceptanceCheckPrefix.length);
  const expectedPrefix = `${promiseSlug}-`;
  if (!slugBody.startsWith(expectedPrefix)) {
    throw new StoryChainParseError(
      `${file}: ${headingRef}: AcceptanceCheck id must start with "acceptance-check:${promiseSlug}-"`,
    );
  }
  const suffix = slugBody.slice(expectedPrefix.length);
  if (/^ac\d+$/.test(suffix)) {
    throw new StoryChainParseError(
      `${file}: ${headingRef}: AcceptanceCheck declaring "revision" rejects ^ac\\d+$ slug ("${suffix}") — use a meaning slug or remove the revision field`,
    );
  }
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(suffix)) {
    throw new StoryChainParseError(
      `${file}: ${headingRef}: AcceptanceCheck slug suffix "${suffix}" must be kebab-case ([a-z0-9-]+, lowercase, no leading/trailing hyphen)`,
    );
  }
  if (suffix.length > 30) {
    throw new StoryChainParseError(
      `${file}: ${headingRef}: AcceptanceCheck slug suffix "${suffix}" is ${String(suffix.length)} chars (limit 30)`,
    );
  }
  const wordCount = suffix.split("-").length;
  if (wordCount > 4) {
    throw new StoryChainParseError(
      `${file}: ${headingRef}: AcceptanceCheck slug suffix "${suffix}" has ${String(wordCount)} words (limit 4)`,
    );
  }
}

function validateBlockSectionsAreCorrectKind(
  intentCheckBlocks: ReadonlyArray<{ heading: string; body: string }>,
  acceptanceCheckBlocks: ReadonlyArray<{ heading: string; body: string }>,
  file: string,
): void {
  for (const block of intentCheckBlocks) {
    if (!isIntentCheckRef(block.heading)) {
      throw new StoryChainParseError(
        `${file}: "## Intent Checks" contains non-intent-check block "${block.heading}"`,
      );
    }
  }
  for (const block of acceptanceCheckBlocks) {
    if (!isAcceptanceCheckRef(block.heading)) {
      throw new StoryChainParseError(
        `${file}: "## Acceptance Checks" contains non-acceptance-check block "${block.heading}"`,
      );
    }
  }
}

function validateFrontmatterRefsMatchBlocks(
  intentCheckRefs: ReadonlyArray<IntentCheckRef>,
  acceptanceCheckRefs: ReadonlyArray<AcceptanceCheckRef>,
  intentChecks: ReadonlyArray<IntentCheck>,
  acceptanceChecks: ReadonlyArray<AcceptanceCheck>,
  file: string,
): void {
  const declaredIcIds = new Set(intentChecks.map((c) => c.id));
  for (const ref of intentCheckRefs) {
    if (!declaredIcIds.has(ref)) {
      throw new StoryChainParseError(
        `${file}: intentChecks ref "${ref}" has no matching "### ${ref}" block`,
      );
    }
  }
  const declaredAcIds = new Set(acceptanceChecks.map((c) => c.id));
  for (const ref of acceptanceCheckRefs) {
    if (!declaredAcIds.has(ref)) {
      throw new StoryChainParseError(
        `${file}: acceptanceChecks ref "${ref}" has no matching "### ${ref}" block`,
      );
    }
  }
  // Linked acceptance checks on each IntentCheck must resolve to checks on
  // the same promise. Cross-promise linkage is not allowed — IntentCheck /
  // AcceptanceCheck pairing is local.
  for (const ic of intentChecks) {
    for (const linked of ic.linkedAcceptanceChecks) {
      if (!declaredAcIds.has(linked)) {
        throw new StoryChainParseError(
          `${file}: ${ic.id} links unknown acceptance-check "${linked}" — it is not declared on this promise`,
        );
      }
    }
  }
}

export interface ParsePromiseInput {
  source: string;
  file: string;
}

export function parsePromiseFile(input: ParsePromiseInput): PromiseDeclaration {
  const { source, file } = input;
  const { frontmatter, body } = splitFrontmatter(source, file);

  const id = ensureRef(readScalar(frontmatter, "id", file), isPromiseRef, "promise", file, "id");
  const slug = readScalar(frontmatter, "slug", file);
  const title = readScalar(frontmatter, "title", file);

  if (frontmatter.has("experience")) {
    throw new StoryChainParseError(
      `${file}: Promise frontmatter must not declare "experience"; derive it from the referenced Moment`,
    );
  }

  // Moment is the Promise's single parent ref. Missing it throws.
  const moment = ensureRef(
    readScalar(frontmatter, "moment", file),
    isMomentRef,
    "moment",
    file,
    "moment",
  );

  const lane = ensureLane(readScalar(frontmatter, "lane", file), file);
  const status = ensurePromiseStatus(readScalar(frontmatter, "status", file), file);
  const verdict = ensureVerdict(readScalar(frontmatter, "verdict", file), file);

  const aspects: AspectRef[] = readList(frontmatter, "aspects").map((raw) =>
    ensureRef(raw, isAspectRef, "aspect", file, "aspects"),
  );
  const intentCheckRefs: IntentCheckRef[] = readList(frontmatter, "intentChecks").map((raw) =>
    ensureRef(raw, isIntentCheckRef, "intent-check", file, "intentChecks"),
  );
  const acceptanceCheckRefs: AcceptanceCheckRef[] = readList(frontmatter, "acceptanceChecks").map(
    (raw) => ensureRef(raw, isAcceptanceCheckRef, "acceptance-check", file, "acceptanceChecks"),
  );
  const coveringLedgers = readList(frontmatter, "coveringLedgers");
  const requiredEvents = readList(frontmatter, "requiredEvents");
  const analyticsExempt = readOptionalScalar(frontmatter, "analyticsExempt");

  const sections = splitH2Sections(body);

  const promiseSection = sections.get("promise");
  if (!promiseSection) {
    throw new StoryChainParseError(`${file}: missing "## Promise" section`);
  }
  const promiseStatement = promiseSection.trim();

  const intentCheckSection = sections.get("intent checks") ?? "";
  const acceptanceCheckSection = sections.get("acceptance checks") ?? "";

  const intentCheckBlocks = splitH3Blocks(intentCheckSection);
  const acceptanceCheckBlocks = splitH3Blocks(acceptanceCheckSection);

  validateBlockSectionsAreCorrectKind(intentCheckBlocks, acceptanceCheckBlocks, file);

  const intentChecks: IntentCheck[] = intentCheckBlocks.map((b) =>
    parseIntentCheck(b.heading, b.body, file),
  );
  const acRulesEnforcedRaw = frontmatter.get("acRulesEnforced");
  const acRulesEnforced = acRulesEnforcedRaw === "true";
  const acceptanceChecks: AcceptanceCheck[] = acceptanceCheckBlocks.map((b) =>
    parseAcceptanceCheck(b.heading, b.body, file, slug, acRulesEnforced),
  );
  const seenAcIds = new Set<string>();
  for (const ac of acceptanceChecks) {
    if (seenAcIds.has(ac.id)) {
      throw new StoryChainParseError(
        `${file}: AcceptanceCheck "${ac.id}" is declared more than once — slug must be unique within the promise`,
      );
    }
    seenAcIds.add(ac.id);
  }

  validateFrontmatterRefsMatchBlocks(
    intentCheckRefs,
    acceptanceCheckRefs,
    intentChecks,
    acceptanceChecks,
    file,
  );

  return {
    id,
    slug,
    title,
    moment,
    lane,
    status,
    aspects,
    intentChecks,
    acceptanceChecks,
    coveringLedgers,
    requiredEvents,
    analyticsExempt,
    verdict,
    promiseStatement,
  };
}

export interface ParseAspectInput {
  source: string;
  file: string;
}

export function parseAspectFile(input: ParseAspectInput): Aspect {
  const { source, file } = input;
  const { frontmatter, body } = splitFrontmatter(source, file);
  const id = ensureRef(readScalar(frontmatter, "id", file), isAspectRef, "aspect", file, "id");
  const slug = readScalar(frontmatter, "slug", file);
  const title = readScalar(frontmatter, "title", file);
  const appliesTo: PromiseRef[] = readList(frontmatter, "appliesTo").map((raw) =>
    ensureRef(raw, isPromiseRef, "promise", file, "appliesTo"),
  );
  const coveringLedger = readOptionalScalar(frontmatter, "coveringLedger") ?? null;
  const verdictRaw = readOptionalScalar(frontmatter, "verdict") ?? "unverified";
  const verdict = verdictRaw === "unverified" ? "unverified" : ensureVerdict(verdictRaw, file);

  const sections = splitH2Sections(body);
  const why = sections.get("why") ?? sections.get("1. why") ?? "";
  const whyDeclaration = why.trim();

  return {
    id,
    slug,
    title,
    whyDeclaration,
    appliesTo,
    coveringLedger,
    verdict,
  };
}

export interface ParseExperienceInput {
  source: string;
  file: string;
}

const EXPERIENCE_SCOPES: readonly ExperienceScope[] = [
  "core-product",
  "support-layer",
  "governance",
];
const SERVICE_POLICY_COVERAGE_STATUSES: readonly ServicePolicyCoverageStatus[] = [
  "complete",
  "unresolved",
];

function ensureExperienceScope(value: string, file: string): ExperienceScope {
  if ((EXPERIENCE_SCOPES as readonly string[]).includes(value)) {
    return value as ExperienceScope;
  }
  throw new StoryChainParseError(
    `${file}: experience scope "${value}" must be one of ${EXPERIENCE_SCOPES.join(", ")}`,
  );
}

function ensureServicePolicyCoverageStatus(
  value: string,
  file: string,
): ServicePolicyCoverageStatus {
  if ((SERVICE_POLICY_COVERAGE_STATUSES as readonly string[]).includes(value)) {
    return value as ServicePolicyCoverageStatus;
  }
  throw new StoryChainParseError(
    `${file}: servicePolicyCoverage "${value}" must be one of ${SERVICE_POLICY_COVERAGE_STATUSES.join(", ")}`,
  );
}

export function parseExperienceFile(input: ParseExperienceInput): Experience {
  const { source, file } = input;
  const { frontmatter } = splitFrontmatter(source, file);
  const id = ensureRef(
    readScalar(frontmatter, "id", file),
    isExperienceRef,
    "experience",
    file,
    "id",
  );
  const slug = readScalar(frontmatter, "slug", file);
  const title = readScalar(frontmatter, "title", file);
  const scope = ensureExperienceScope(readScalar(frontmatter, "scope", file), file);
  const servicePolicyCoverageRaw = readOptionalScalar(frontmatter, "servicePolicyCoverage");
  const servicePolicyCoverage = servicePolicyCoverageRaw
    ? ensureServicePolicyCoverageStatus(servicePolicyCoverageRaw, file)
    : undefined;
  const servicePolicyCoverageReview = readOptionalScalar(
    frontmatter,
    "servicePolicyCoverageReview",
  );
  return {
    id,
    slug,
    title,
    scope,
    servicePolicyCoverage,
    servicePolicyCoverageReview,
  };
}

export interface ParseMomentInput {
  source: string;
  file: string;
}

export function parseMomentFile(input: ParseMomentInput): Moment {
  const { source, file } = input;
  const { frontmatter } = splitFrontmatter(source, file);
  const id = ensureRef(readScalar(frontmatter, "id", file), isMomentRef, "moment", file, "id");
  const slug = readScalar(frontmatter, "slug", file);
  const title = readScalar(frontmatter, "title", file);
  const experience = ensureRef(
    readScalar(frontmatter, "experience", file),
    isExperienceRef,
    "experience",
    file,
    "experience",
  );
  return { id, slug, title, experience };
}
