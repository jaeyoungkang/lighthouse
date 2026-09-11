// Read-only parser for the pre-v2 Markdown records stored in Git history.
// Operational Story Chain code must never import this migration-audit module.

import {
  type AcceptanceCheckKey,
  type AcceptanceCheckRef,
  type AspectRef,
  type IntentCheckRef,
  type IntentJudgmentRef,
  type PromiseRef,
  type StoryChainVerdict,
  isAcceptanceCheckRef,
  isAspectRef,
  isIntentCheckRef,
  isPromiseRef,
} from "@/app/domain/story-chain";

import {
  FRONTMATTER_PATTERN,
  StoryChainParseError,
  ensureRef,
  ensureVerdict,
  parseFrontmatter,
  readBulletList,
  splitH2Sections,
} from "@/app/server/services/story-chain/parser-shared";

export interface LegacyEvidenceLedgerIntentCheckEntry {
  id: IntentCheckRef;
  evidence: string;
  sourcePromise: PromiseRef;
}

export interface LegacyEvidenceLedgerAcceptanceCheckEntry {
  key: AcceptanceCheckKey;
  check: AcceptanceCheckRef;
  evidence: string;
  sourcePromise: PromiseRef;
  runCommand?: string;
  scope?: string;
  scenarioRefs: string[];
}

export interface LegacyEvidenceLedger {
  path: string;
  evidenceRunEnforced?: boolean;
  curated: boolean;
  intentAbsorbedIntoAcceptance: boolean;
  intentJudgmentRefs: IntentJudgmentRef[];
  sourcePromises: PromiseRef[];
  appliedAspects: AspectRef[];
  intentCheckEntries: LegacyEvidenceLedgerIntentCheckEntry[];
  acceptanceCheckEntries: LegacyEvidenceLedgerAcceptanceCheckEntry[];
  implementationContracts: string[];
  evidence: string[];
  verdict: StoryChainVerdict;
}

export interface ParseEvidenceLedgerInput {
  source: string;
  file: string;
}

interface LedgerCheckBlock {
  ref: string;
  fields: Map<string, string | string[]>;
}

const ACCEPTANCE_CHECK_TABLE_DIRECTIVE = "check:evidence-coverage";

// Historical `intentJudgmentRefs:` frontmatter list. Each list item has the
// shape `<promise-ref> -> <promise-ref>`. The current validator treats these
// as passive metadata, but the parser still rejects malformed values so older
// ledgers do not silently lose structure.
function parseIntentJudgmentRefs(
  raw: string | string[] | undefined,
  file: string,
): IntentJudgmentRef[] {
  if (raw === undefined) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((item) => {
    const parts = item.split(/\s*->\s*/);
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new StoryChainParseError(
        `${file}: intentJudgmentRefs item "${item}" must be "<promise-ref> -> <promise-ref>"`,
      );
    }
    const [promiseRaw, anchor] = parts;
    if (!isPromiseRef(promiseRaw)) {
      throw new StoryChainParseError(
        `${file}: intentJudgmentRefs item "${item}" — first half must be a promise: ref`,
      );
    }
    if (!isPromiseRef(anchor.trim())) {
      throw new StoryChainParseError(
        `${file}: intentJudgmentRefs item "${item}" — second half must be a promise: ref`,
      );
    }
    return { promise: promiseRaw, anchor: anchor.trim() as PromiseRef };
  });
}

function readLedgerCheckBlocks(sectionBody: string): LedgerCheckBlock[] {
  const blocks: LedgerCheckBlock[] = [];
  const lines = sectionBody.split(/\r?\n/);
  let current: LedgerCheckBlock | null = null;
  for (const line of lines) {
    const head = line.match(
      /^-\s+([a-z-]+:[A-Za-z0-9_-]+(?:#acceptance-check:[A-Za-z0-9_-]+)?)\s*$/,
    );
    if (head) {
      if (current) blocks.push(current);
      current = { ref: head[1], fields: new Map() };
      continue;
    }
    if (!current) continue;
    const subScalar = line.match(/^\s{2,}-\s+([a-z][a-z0-9 _-]*?)\s*:\s*(.+)$/i);
    if (subScalar) {
      current.fields.set(subScalar[1].trim().toLowerCase(), subScalar[2].trim());
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function parseLedgerEvidenceAndSourcePromise(
  block: LedgerCheckBlock,
  file: string,
  sourcePromises: PromiseRef[],
): { evidence: string; sourcePromise: PromiseRef } {
  const evidence = block.fields.get("evidence");
  const sourcePromiseRaw = block.fields.get("source promise");
  if (typeof evidence !== "string" || !evidence) {
    throw new StoryChainParseError(`${file}: ledger ${block.ref}: missing "evidence"`);
  }
  if (typeof sourcePromiseRaw !== "string" || !sourcePromiseRaw) {
    throw new StoryChainParseError(`${file}: ledger ${block.ref}: missing "source promise"`);
  }
  const sourcePromise = ensureRef(
    sourcePromiseRaw,
    isPromiseRef,
    "promise",
    file,
    `${block.ref}.source promise`,
  );
  if (!sourcePromises.includes(sourcePromise)) {
    throw new StoryChainParseError(
      `${file}: ledger ${block.ref} cites source promise "${sourcePromise}" not listed in "## Source Promises"`,
    );
  }
  return { evidence, sourcePromise };
}

function parseLedgerIntentCheckEntry(
  block: LedgerCheckBlock,
  file: string,
  sourcePromises: PromiseRef[],
): LegacyEvidenceLedgerIntentCheckEntry {
  if (!isIntentCheckRef(block.ref)) {
    throw new StoryChainParseError(
      `${file}: "## Intent Checks" entry "${block.ref}" must use "intent-check:" prefix`,
    );
  }
  const { evidence, sourcePromise } = parseLedgerEvidenceAndSourcePromise(
    block,
    file,
    sourcePromises,
  );
  return { id: block.ref, evidence, sourcePromise };
}

function parseTableLedgerAcceptanceCheckEntry(
  fields: Map<string, string>,
  file: string,
  sourcePromises: PromiseRef[],
  evidenceRunEnforced: boolean,
): LegacyEvidenceLedgerAcceptanceCheckEntry {
  const promiseRaw = fields.get("promise");
  const checkRaw = fields.get("check");
  const evidence = fields.get("evidence");
  if (!promiseRaw) {
    throw new StoryChainParseError(`${file}: ledger Acceptance Check entry missing "promise"`);
  }
  if (!checkRaw) {
    throw new StoryChainParseError(`${file}: ledger Acceptance Check entry missing "check"`);
  }
  if (!evidence) {
    throw new StoryChainParseError(`${file}: ledger Acceptance Check entry missing "evidence"`);
  }
  const runCommand = fields.get("run")?.trim();
  if (evidenceRunEnforced && !runCommand) {
    throw new StoryChainParseError(
      `${file}: ledger Acceptance Check entry missing "run" while evidenceRunEnforced is true`,
    );
  }
  const sourcePromise = ensureRef(promiseRaw, isPromiseRef, "promise", file, "Acceptance Checks");
  if (!sourcePromises.includes(sourcePromise)) {
    throw new StoryChainParseError(
      `${file}: ledger Acceptance Check cites source promise "${sourcePromise}" not listed in "## Source Promises"`,
    );
  }
  const check = ensureRef(checkRaw, isAcceptanceCheckRef, "acceptance-check", file, "check");
  const scenarioRaw = fields.get("scenarios") ?? fields.get("scenario refs") ?? "";
  const scenarioRefs = scenarioRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return {
    key: `${sourcePromise}#${check}`,
    check,
    evidence,
    sourcePromise,
    runCommand: runCommand || undefined,
    scope: fields.get("scope"),
    scenarioRefs,
  };
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  const content = trimmed.startsWith("|")
    ? trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined)
    : trimmed;
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const char of content) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isMarkdownSeparatorRow(cells: readonly string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function normalizeAcceptanceCheckTableLine(line: string): string {
  return line.trim().replace(/^>\s?/, "");
}

function parseAcceptanceCheckTable(
  sectionBody: string,
  file: string,
  sourcePromises: PromiseRef[],
  evidenceRunEnforced: boolean,
): LegacyEvidenceLedgerAcceptanceCheckEntry[] {
  const lines = sectionBody.split(/\r?\n/);
  const directiveIndexes = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => line === `> ${ACCEPTANCE_CHECK_TABLE_DIRECTIVE}`);
  if (directiveIndexes.length !== 1) {
    throw new StoryChainParseError(
      `${file}: "## Acceptance Checks" must contain exactly one "> ${ACCEPTANCE_CHECK_TABLE_DIRECTIVE}" check table`,
    );
  }

  const tableLines = lines
    .slice(directiveIndexes[0].index + 1)
    .map(normalizeAcceptanceCheckTableLine)
    .filter((line) => line.startsWith("|"));
  if (tableLines.length < 3) {
    throw new StoryChainParseError(
      `${file}: "> ${ACCEPTANCE_CHECK_TABLE_DIRECTIVE}" table must include header, separator, and at least one row`,
    );
  }

  const headers = splitMarkdownTableRow(tableLines[0]).map((header) => header.toLowerCase());
  const separator = splitMarkdownTableRow(tableLines[1]);
  if (!isMarkdownSeparatorRow(separator)) {
    throw new StoryChainParseError(
      `${file}: "> ${ACCEPTANCE_CHECK_TABLE_DIRECTIVE}" table must use a markdown separator row`,
    );
  }
  for (const required of ["promise", "check", "evidence"]) {
    if (!headers.includes(required)) {
      throw new StoryChainParseError(
        `${file}: "> ${ACCEPTANCE_CHECK_TABLE_DIRECTIVE}" table missing required "${required}" column`,
      );
    }
  }

  return tableLines.slice(2).map((line, rowIndex) => {
    const cells = splitMarkdownTableRow(line);
    const fields = new Map<string, string>();
    for (const [index, header] of headers.entries()) {
      fields.set(header, cells[index] ?? "");
    }
    try {
      return parseTableLedgerAcceptanceCheckEntry(
        fields,
        file,
        sourcePromises,
        evidenceRunEnforced,
      );
    } catch (error) {
      if (error instanceof StoryChainParseError) {
        throw new StoryChainParseError(
          `${file}: ${ACCEPTANCE_CHECK_TABLE_DIRECTIVE} row ${String(rowIndex + 1)}: ${error.message}`,
        );
      }
      throw error;
    }
  });
}

// Phase 8 Batch 2 — `foundational: true` frontmatter flag. Files with this
// flag are foundational/cross-cutting ledgers (e.g. `index.ledger.md`,
// `intent-traceability.ledger.md`, `runtime-contract.ledger.md`,
// `product-boundary.ledger.md`) that do NOT declare Source Promises and so
// are not Evidence Ledgers in the Phase 1 type sense. The loader still picks
// them up so they live alongside ledger sidecars in the same evidence-ledger
// source dir, but the parser short-circuits before requiring `## Source
// Promises` etc. Returns null when a file is foundational; callers then
// drop it from `chain.evidenceLedgers`.
export function isFoundationalLedger(source: string): boolean {
  const fmMatch = source.match(FRONTMATTER_PATTERN);
  if (!fmMatch) return false;
  const frontmatter = parseFrontmatter(fmMatch[1]);
  const value = frontmatter.get("foundational");
  return typeof value === "string" && value.toLowerCase() === "true";
}

export function parseEvidenceLedgerFile(input: ParseEvidenceLedgerInput): LegacyEvidenceLedger {
  const { source, file } = input;
  // EvidenceLedger frontmatter is optional. Four flags are read:
  //   - `curated:` — when `true`, the validator enforces non-empty Intent
  //     Check / Acceptance Check entries so a curated ledger cannot regress
  //     to a placeholder skeleton.
  //   - `intentAbsorbedIntoAcceptance:` — second curated subtype declared
  //     in Phase 3C-6. When true (only meaningful with `curated: true`),
  //     the ledger is allowed to carry zero Intent Check entries provided
  //     every source promise itself declares zero IntentChecks and has
  //     Acceptance Check coverage on the same ledger. See the EvidenceLedger
  //     type comment for the full rule set.
  //   - `evidenceRunEnforced:` — when true, every Acceptance Check table row
  //     must carry a non-empty run command. The evidence runner separately
  //     verifies that row evidence/run artifacts belong to the ledger's fenced
  //     run:shell execution set.
  //   - `foundational:` — Phase 8 Batch 2. Caller (loader) checks this
  //     ahead of time via `isFoundationalLedger` and skips the parser for
  //     foundational files; this parser is only invoked for ledger
  //     candidates.
  const fmMatch = source.match(FRONTMATTER_PATTERN);
  const body = fmMatch ? source.slice(fmMatch[0].length) : source;
  const frontmatter = fmMatch ? parseFrontmatter(fmMatch[1]) : undefined;
  const curatedRaw = frontmatter?.get("curated");
  const curated = typeof curatedRaw === "string" && curatedRaw.toLowerCase() === "true";
  const absorbedRaw = frontmatter?.get("intentAbsorbedIntoAcceptance");
  const intentAbsorbedIntoAcceptance =
    typeof absorbedRaw === "string" && absorbedRaw.toLowerCase() === "true";
  const evidenceRunEnforcedRaw = frontmatter?.get("evidenceRunEnforced");
  const evidenceRunEnforced =
    typeof evidenceRunEnforcedRaw === "string" && evidenceRunEnforcedRaw.toLowerCase() === "true";
  const intentJudgmentRefs = parseIntentJudgmentRefs(frontmatter?.get("intentJudgmentRefs"), file);

  const sections = splitH2Sections(body);
  const sourcePromisesSection = sections.get("source promises");
  if (!sourcePromisesSection) {
    throw new StoryChainParseError(`${file}: missing "## Source Promises" section`);
  }
  const appliedAspectsSection = sections.get("applied aspects");
  if (!appliedAspectsSection) {
    throw new StoryChainParseError(`${file}: missing "## Applied Aspects" section`);
  }
  const intentChecksSection = sections.get("intent checks") ?? "";
  const acceptanceChecksSection = sections.get("acceptance checks") ?? "";
  const implementationContractsSection = sections.get("implementation contracts") ?? "";
  const evidenceSection = sections.get("evidence") ?? "";
  const verdictSection = sections.get("verdict");
  if (!verdictSection) {
    throw new StoryChainParseError(`${file}: missing "## Verdict" section`);
  }

  const sourcePromises: PromiseRef[] = readBulletList(sourcePromisesSection).map((raw) =>
    ensureRef(raw, isPromiseRef, "promise", file, "Source Promises"),
  );
  if (sourcePromises.length === 0) {
    throw new StoryChainParseError(
      `${file}: "## Source Promises" must list at least one promise: ref`,
    );
  }
  const appliedAspects: AspectRef[] = readBulletList(appliedAspectsSection).map((raw) =>
    ensureRef(raw, isAspectRef, "aspect", file, "Applied Aspects"),
  );

  const intentCheckEntries = readLedgerCheckBlocks(intentChecksSection).map((block) =>
    parseLedgerIntentCheckEntry(block, file, sourcePromises),
  );
  const acceptanceCheckEntries = parseAcceptanceCheckTable(
    acceptanceChecksSection,
    file,
    sourcePromises,
    evidenceRunEnforced,
  );

  const implementationContracts = readBulletList(implementationContractsSection);
  const evidence = readBulletList(evidenceSection);
  const verdict = ensureVerdict(verdictSection.trim(), file);

  return {
    path: input.file,
    evidenceRunEnforced,
    curated,
    intentAbsorbedIntoAcceptance,
    intentJudgmentRefs,
    sourcePromises,
    appliedAspects,
    intentCheckEntries,
    acceptanceCheckEntries,
    implementationContracts,
    evidence,
    verdict,
  };
}
