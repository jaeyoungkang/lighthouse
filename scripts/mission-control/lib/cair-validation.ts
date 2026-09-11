import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { traceabilityNodePattern, traceabilityNodePrefix } from "@/app/domain/story-chain";

const ASPECT_PREFIX = traceabilityNodePrefix("aspect");
const ASPECT_REF_SOURCE = traceabilityNodePattern("aspect", "[a-z0-9-]+");
const ASPECT_REF_PATTERN = new RegExp(`\\b${ASPECT_REF_SOURCE}\\b`, "g");
const ASPECT_ID_PATTERN = new RegExp(`^id:\\s*(${ASPECT_REF_SOURCE})\\s*$`, "m");

export const CAIR_HEADING = "## Contract Architecture Impact Review";
export const PROPAGATION_MAP_HEADING = "## Propagation Map";
export const CONCEPT_SHIFT_HEADING = "## Concept Shift Architecture Review";

export const CAIR_VERDICTS = ["none", "constrain-existing", "reshape"] as const;
export type CairVerdict = (typeof CAIR_VERDICTS)[number];

export const CAIR_AXES = [
  "Interaction timing",
  "Domain and data shape",
  "Source of truth and authority",
  "State lifetime and recovery",
  "Execution semantics",
  "Runtime, external, or AI boundary",
  "Security and privacy",
  "Resource and capacity",
  "Observability and audit",
  "Compatibility and retirement",
  "Cross-surface invariant ownership",
] as const;

const NON_SEMANTIC_AXIS_MARKER = "none (non-semantic edit)";

export const RECORD_POLICY_FILES = new Set([
  "docs/agent-skills.md",
  "docs/mission-control.md",
  "shared-skills/mission-control/references/contract-architecture-impact-review.md",
]);

const NONE_FIELDS = [
  "Contract delta",
  "Verdict",
  "Affected axes",
  "Existing-boundary evidence",
  "Human decision required",
] as const;

const STRUCTURAL_FIELDS = [
  "Contract delta",
  "Verdict",
  "Affected axes and current owners",
  "Decision",
  "Rejected alternative",
  "Evidence and structural defense",
  "Human decision required",
] as const;

const RECOGNIZED_FIELDS = new Set<string>([...NONE_FIELDS, ...STRUCTURAL_FIELDS]);
const LOCAL_RECORD_ANCHOR = "#contract-architecture-impact-review";
const EXTERNAL_RECORD_PATTERN =
  /^https:\/\/github\.com\/jaeyoungkang\/lighthouse\/(?:issues|pull)\/\d+(?:#\S+)?$/;
const STORY_CONTRACT_PATTERN =
  /^docs\/contracts\/story-chain\/(?:promises|aspects|experiences|moments)\/.+\.md$/;

export interface ChangedFile {
  path: string;
  source: string;
  baselineSource?: string;
  baselinePath?: string;
  deleted?: boolean;
}

export interface CairRepositoryView {
  exists(relativePath: string): boolean;
  listFiles(relativeDirectory: string): string[];
  readFile(relativePath: string): string | undefined;
}

export interface CairRecord {
  filePath: string;
  headingLine: number;
  source: string;
  fields: ReadonlyMap<string, string>;
}

export interface CairValidationResult {
  changedFileCount: number;
  contractFileCount: number;
  declarationCount: number;
  recordCount: number;
  errors: string[];
}

interface ArchitectureImpactDeclaration {
  architectureImpact?: unknown;
  cairVerdict?: unknown;
  recordRef?: unknown;
}

interface ParsedAxes {
  axes: string[];
  owners: string | null;
}

interface MarkdownFence {
  marker: "`" | "~";
  length: number;
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function createFileSystemView(repoRoot: string): CairRepositoryView {
  return {
    exists: (relativePath) => existsSync(path.join(repoRoot, relativePath)),
    listFiles: (relativeDirectory) => {
      const files: string[] = [];
      const visit = (directory: string) => {
        const absoluteDirectory = path.join(repoRoot, directory);
        if (!existsSync(absoluteDirectory)) return;
        for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
          const relativePath = normalizeRepoPath(path.join(directory, entry.name));
          if (entry.isDirectory()) {
            visit(relativePath);
          } else {
            files.push(relativePath);
          }
        }
      };
      visit(relativeDirectory);
      return files.sort();
    },
    readFile: (relativePath) => {
      const absolutePath = path.join(repoRoot, relativePath);
      return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : undefined;
    },
  };
}

function displayLocation(record: CairRecord): string {
  return `${record.filePath}:${String(record.headingLine)}`;
}

function nonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isVerdict(value: string): value is CairVerdict {
  return (CAIR_VERDICTS as readonly string[]).includes(value);
}

function advanceMarkdownFence(
  line: string,
  fence: MarkdownFence | null,
): { fence: MarkdownFence | null; delimiter: boolean } {
  if (fence) {
    const trimmed = line.trim();
    if (
      trimmed.length >= fence.length &&
      new RegExp(`^${fence.marker}{${String(fence.length)},}$`).test(trimmed)
    ) {
      return { fence: null, delimiter: true };
    }
    return { fence, delimiter: false };
  }

  const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
  if (!opening) return { fence: null, delimiter: false };
  const marker = opening[1][0];
  return {
    fence: {
      marker: marker === "`" ? "`" : "~",
      length: opening[1].length,
    },
    delimiter: true,
  };
}

function outsideFenceLines(source: string): Array<{ index: number; line: string }> {
  const outside: Array<{ index: number; line: string }> = [];
  let fence: MarkdownFence | null = null;
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const transition = advanceMarkdownFence(line, fence);
    fence = transition.fence;
    if (!transition.delimiter && !fence) outside.push({ index, line });
  }
  return outside;
}

function extractBlock(source: string, headingIndex: number): string[] {
  const lines = source.split(/\r?\n/);
  let end = lines.length;
  let fence: MarkdownFence | null = null;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const transition = advanceMarkdownFence(line, fence);
    fence = transition.fence;
    if (transition.delimiter || fence) continue;
    if (/^#{1,6}\s+/.test(line)) {
      end = index;
      break;
    }
  }
  return lines.slice(headingIndex + 1, end);
}

function parseFields(lines: string[]): Map<string, string> {
  const fields = new Map<string, string>();
  let activeField: string | null = null;
  let fence: MarkdownFence | null = null;

  for (const line of lines) {
    const transition = advanceMarkdownFence(line, fence);
    fence = transition.fence;
    if (transition.delimiter) {
      activeField = null;
      continue;
    }
    if (fence) continue;

    const match = /^(?:-\s+)?([A-Za-z][A-Za-z -]+):\s*(.*)$/.exec(line);
    if (match && RECOGNIZED_FIELDS.has(match[1])) {
      activeField = match[1];
      const value = match[2].trim();
      fields.set(activeField, value);
      continue;
    }

    if (line.trim().length === 0) {
      activeField = null;
      continue;
    }
    if (activeField && line.trim().length > 0) {
      const current = fields.get(activeField) ?? "";
      fields.set(activeField, `${current} ${line.trim()}`.trim());
    }
  }

  return fields;
}

export function parseCairRecords(filePath: string, source: string): CairRecord[] {
  const normalizedPath = normalizeRepoPath(filePath);
  if (RECORD_POLICY_FILES.has(normalizedPath)) return [];

  const records: CairRecord[] = [];
  for (const { index, line } of outsideFenceLines(source)) {
    if (line.trimEnd() !== CAIR_HEADING) continue;
    const blockLines = extractBlock(source, index);
    records.push({
      filePath: normalizedPath,
      headingLine: index + 1,
      source: blockLines.join("\n"),
      fields: parseFields(blockLines),
    });
  }
  return records;
}

function parseAxes(record: CairRecord, verdict: CairVerdict, errors: string[]): ParsedAxes {
  const fieldName = verdict === "none" ? "Affected axes" : "Affected axes and current owners";
  const rawValue = record.fields.get(fieldName)?.trim() ?? "";
  const separators = rawValue.split(" — ");
  const separatorIndex = rawValue.indexOf(" — ");
  const axesText = separatorIndex < 0 ? rawValue : rawValue.slice(0, separatorIndex);
  const isNonSemanticEdit = verdict === "none" && axesText === NON_SEMANTIC_AXIS_MARKER;
  const owners =
    verdict === "none" || separatorIndex < 0
      ? null
      : rawValue.slice(separatorIndex + " — ".length).trim();
  const axes = isNonSemanticEdit
    ? []
    : axesText
        .split(";")
        .map((axis) => axis.trim())
        .filter(Boolean);

  if (axes.length === 0 && !isNonSemanticEdit) {
    errors.push(`${displayLocation(record)}: ${fieldName} must name at least one axis`);
  }
  for (const axis of axes) {
    if (!(CAIR_AXES as readonly string[]).includes(axis)) {
      errors.push(
        `${displayLocation(record)}: unknown affected axis "${axis}"; use the canonical 11-axis vocabulary`,
      );
    }
  }
  if (verdict !== "none" && separatorIndex < 0) {
    errors.push(
      `${displayLocation(record)}: ${fieldName} must use "<Axis>; <Axis> — <current owners>"`,
    );
  }
  if (verdict !== "none" && separatorIndex >= 0 && separators.length !== 2) {
    errors.push(
      `${displayLocation(record)}: ${fieldName} must contain exactly one " — " owner separator`,
    );
  }
  if (verdict !== "none" && separatorIndex >= 0 && !owners) {
    errors.push(`${displayLocation(record)}: ${fieldName} must name the current owners`);
  }
  if (verdict === "none" && separatorIndex >= 0) {
    errors.push(`${displayLocation(record)}: ${fieldName} must not include an owner clause`);
  }

  return { axes, owners };
}

function extractInlineCode(value: string): string[] {
  return [...value.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);
}

function extractMarkdownTargets(value: string): string[] {
  return [...value.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)].map((match) => match[1]);
}

function extractReferenceValue(value: string): string {
  const markdownTarget = extractMarkdownTargets(value)[0];
  if (markdownTarget) return markdownTarget;
  const inlineCode = extractInlineCode(value)[0];
  if (inlineCode) return inlineCode;
  return value.trim().split(/\s+/)[0] ?? "";
}

function stripFragment(value: string): string {
  return value.split("#", 1)[0] ?? value;
}

function resolveRepoTarget(
  repoRoot: string,
  ownerFile: string,
  rawTarget: string,
): { relativePath: string; absolutePath: string } | null {
  const withoutFragment = stripFragment(rawTarget).replace(/:(?:\d+)(?::\d+)?$/, "");
  if (!withoutFragment || /^(?:https?:|issue:|pull:)/.test(withoutFragment)) return null;

  const normalizedOwner = normalizeRepoPath(ownerFile);
  const relativePath =
    withoutFragment.startsWith("./") || withoutFragment.startsWith("../")
      ? normalizeRepoPath(path.join(path.dirname(normalizedOwner), withoutFragment))
      : normalizeRepoPath(withoutFragment);
  const absolutePath = path.resolve(repoRoot, relativePath);
  const normalizedRoot = `${path.resolve(repoRoot)}${path.sep}`;
  if (absolutePath !== path.resolve(repoRoot) && !absolutePath.startsWith(normalizedRoot)) {
    return null;
  }
  return { relativePath, absolutePath };
}

function validateNpmScriptReferences(
  record: CairRecord,
  npmScripts: readonly string[],
  errors: string[],
  repositoryView: CairRepositoryView,
): number {
  if (npmScripts.length === 0) return 0;
  let packageScripts: Record<string, unknown>;
  try {
    const packageSource = repositoryView.readFile("package.json");
    if (!packageSource) throw new Error("package.json is missing");
    const packageJson = JSON.parse(packageSource) as {
      scripts?: Record<string, unknown>;
    };
    packageScripts = packageJson.scripts ?? {};
  } catch {
    errors.push(`${displayLocation(record)}: package.json could not be read`);
    return 0;
  }

  let resolvedCount = 0;
  for (const script of npmScripts) {
    if (!Object.hasOwn(packageScripts, script)) {
      errors.push(
        `${displayLocation(record)}: structural defense cites missing npm script "${script}"`,
      );
    } else {
      resolvedCount += 1;
    }
  }
  return resolvedCount;
}

function validateAspectReferences(
  record: CairRecord,
  aspectRefs: readonly string[],
  errors: string[],
  repositoryView: CairRepositoryView,
): number {
  if (aspectRefs.length === 0) return 0;
  const aspectIds = new Set(
    repositoryView
      .listFiles("docs/contracts/story-chain/aspects")
      .filter((name) => name.endsWith(".md"))
      .flatMap((name) => {
        const source = repositoryView.readFile(name);
        if (!source?.startsWith("---")) return [];
        const frontmatterEnd = source.indexOf("\n---", 3);
        if (frontmatterEnd < 0) return [];
        const frontmatter = source.slice(3, frontmatterEnd);
        const match = ASPECT_ID_PATTERN.exec(frontmatter);
        return match ? [match[1]] : [];
      }),
  );

  let resolvedCount = 0;
  for (const aspectRef of aspectRefs) {
    if (!aspectIds.has(aspectRef)) {
      errors.push(
        `${displayLocation(record)}: structural defense cites missing Aspect "${aspectRef}"`,
      );
    } else {
      resolvedCount += 1;
    }
  }
  return resolvedCount;
}

function isLikelyRepoPath(candidate: string): boolean {
  const withoutFragment = stripFragment(candidate);
  return (
    candidate === "package.json" ||
    /^(?:\.{1,2}\/|\.github\/|app\/|docs\/|packages\/|scripts\/|shared-skills\/|supabase\/)/.test(
      candidate,
    ) ||
    /\.(?:ts|tsx|js|mjs|md|json|ya?ml)$/.test(withoutFragment)
  );
}

function validateStructuralDefense(
  repoRoot: string,
  record: CairRecord,
  value: string,
  errors: string[],
  repositoryView: CairRepositoryView,
): void {
  const candidates = new Set<string>([
    ...extractInlineCode(value),
    ...extractMarkdownTargets(value),
  ]);
  const npmScripts = [...value.matchAll(/\bnpm run\s+([a-zA-Z0-9:_-]+)/g)]
    .map((match) => match[1].replace(/[:_-]+$/, ""))
    .filter(Boolean);
  const aspectRefs = [...value.matchAll(ASPECT_REF_PATTERN)].map((match) => match[0]);
  let resolvedCount =
    validateNpmScriptReferences(record, npmScripts, errors, repositoryView) +
    validateAspectReferences(record, aspectRefs, errors, repositoryView);

  for (const candidate of candidates) {
    if (
      /^(?:https?|mailto):/.test(candidate) ||
      /\s/.test(candidate) ||
      candidate.startsWith("npm run ") ||
      candidate.startsWith(ASPECT_PREFIX)
    ) {
      continue;
    }
    const resolved = resolveRepoTarget(repoRoot, record.filePath, candidate);
    if (resolved && repositoryView.exists(resolved.relativePath)) {
      resolvedCount += 1;
    } else if (isLikelyRepoPath(candidate)) {
      errors.push(
        `${displayLocation(record)}: structural defense target "${candidate}" does not resolve`,
      );
    }
  }

  if (resolvedCount === 0) {
    errors.push(
      `${displayLocation(record)}: Evidence and structural defense must cite at least one existing path, npm script, or Aspect ref`,
    );
  }
}

function packageScriptNames(source: string | undefined): Set<string> {
  if (!source) return new Set();
  try {
    const parsed = JSON.parse(source) as { scripts?: Record<string, unknown> };
    return new Set(Object.keys(parsed.scripts ?? {}));
  } catch {
    return new Set();
  }
}

function aspectId(source: string | undefined): string | null {
  if (!source?.startsWith("---")) return null;
  const frontmatterEnd = source.indexOf("\n---", 3);
  if (frontmatterEnd < 0) return null;
  return ASPECT_ID_PATTERN.exec(source.slice(3, frontmatterEnd))?.[1] ?? null;
}

function recordPathReferences(record: CairRecord, ownerSource: string): string[] {
  const defense = record.fields.get("Evidence and structural defense") ?? "";
  const segment = recordDocumentSegment(ownerSource, record);
  const followUps = [
    followUpReferenceValue(segment, "Propagation Map"),
    followUpReferenceValue(segment, "Concept Shift Architecture Review"),
  ]
    .filter((value): value is string => value !== null)
    .map(extractReferenceValue);
  return [...extractInlineCode(defense), ...extractMarkdownTargets(defense), ...followUps];
}

function recordReferencesInvalidatedTargets(
  repoRoot: string,
  record: CairRecord,
  ownerSource: string,
  invalidatedPaths: ReadonlySet<string>,
  changedFollowUpPaths: ReadonlySet<string>,
  removedNpmScripts: ReadonlySet<string>,
  removedAspectIds: ReadonlySet<string>,
): boolean {
  const defense = record.fields.get("Evidence and structural defense");
  const citedPaths = recordPathReferences(record, ownerSource)
    .map((candidate) => resolveRepoTarget(repoRoot, record.filePath, candidate)?.relativePath)
    .filter((candidate): candidate is string => candidate !== undefined);
  if (
    citedPaths.some(
      (candidate) => invalidatedPaths.has(candidate) || changedFollowUpPaths.has(candidate),
    )
  ) {
    return true;
  }
  if (!nonEmpty(defense)) return false;

  const citedScripts = [...defense.matchAll(/\bnpm run\s+([a-zA-Z0-9:_-]+)/g)].map((match) =>
    match[1].replace(/[:_-]+$/, ""),
  );
  if (citedScripts.some((script) => removedNpmScripts.has(script))) return true;

  const citedAspects = [...defense.matchAll(ASPECT_REF_PATTERN)].map((match) => match[0]);
  return citedAspects.some((id) => removedAspectIds.has(id));
}

interface InvalidatedDefenseTargets {
  paths: Set<string>;
  npmScripts: Set<string>;
  aspectIds: Set<string>;
  renamedRecordPaths: Set<string>;
  changedFollowUpPaths: Set<string>;
}

function collectInvalidatedPaths(
  changedFile: ChangedFile,
  targets: InvalidatedDefenseTargets,
): void {
  if (changedFile.deleted) targets.paths.add(changedFile.path);
  if (!changedFile.baselinePath || changedFile.baselinePath === changedFile.path) return;
  targets.paths.add(changedFile.baselinePath);
  if (changedFile.path.endsWith(".md")) targets.renamedRecordPaths.add(changedFile.path);
}

function collectRemovedNpmScripts(changedFile: ChangedFile, removedScripts: Set<string>): void {
  if (changedFile.path !== "package.json" || changedFile.baselineSource === undefined) return;
  const currentScripts = packageScriptNames(changedFile.source);
  for (const script of packageScriptNames(changedFile.baselineSource)) {
    if (!currentScripts.has(script)) removedScripts.add(script);
  }
}

function collectRemovedAspectId(changedFile: ChangedFile, removedIds: Set<string>): void {
  const aspectPath = changedFile.baselinePath ?? changedFile.path;
  if (!/^docs\/contracts\/story-chain\/aspects\/.+\.md$/.test(aspectPath)) return;
  const previousId = aspectId(changedFile.baselineSource);
  const currentId = changedFile.deleted ? null : aspectId(changedFile.source);
  if (previousId && previousId !== currentId) removedIds.add(previousId);
}

function collectChangedFollowUpPaths(changedFile: ChangedFile, changedPaths: Set<string>): void {
  if (!changedFile.path.endsWith(".md") || changedFile.baselineSource === undefined) return;
  const headingChanged = [PROPAGATION_MAP_HEADING, CONCEPT_SHIFT_HEADING].some(
    (heading) =>
      hasHeading(changedFile.baselineSource ?? "", heading) !==
      hasHeading(changedFile.source, heading),
  );
  if (!headingChanged) return;
  changedPaths.add(changedFile.path);
  if (changedFile.baselinePath) changedPaths.add(changedFile.baselinePath);
}

function collectInvalidatedDefenseTargets(
  changedFiles: readonly ChangedFile[],
): InvalidatedDefenseTargets {
  const targets: InvalidatedDefenseTargets = {
    paths: new Set(),
    npmScripts: new Set(),
    aspectIds: new Set(),
    renamedRecordPaths: new Set(),
    changedFollowUpPaths: new Set(),
  };
  for (const changedFile of changedFiles) {
    collectInvalidatedPaths(changedFile, targets);
    collectRemovedNpmScripts(changedFile, targets.npmScripts);
    collectRemovedAspectId(changedFile, targets.aspectIds);
    collectChangedFollowUpPaths(changedFile, targets.changedFollowUpPaths);
  }
  return targets;
}

function hasInvalidatedDefenseTargets(targets: InvalidatedDefenseTargets): boolean {
  return (
    targets.paths.size > 0 ||
    targets.npmScripts.size > 0 ||
    targets.aspectIds.size > 0 ||
    targets.renamedRecordPaths.size > 0 ||
    targets.changedFollowUpPaths.size > 0
  );
}

function recordNeedsReferenceRevalidation(
  repoRoot: string,
  record: CairRecord,
  ownerSource: string,
  targets: InvalidatedDefenseTargets,
): boolean {
  if (
    recordReferencesInvalidatedTargets(
      repoRoot,
      record,
      ownerSource,
      targets.paths,
      targets.changedFollowUpPaths,
      targets.npmScripts,
      targets.aspectIds,
    )
  ) {
    return true;
  }
  return (
    targets.renamedRecordPaths.has(record.filePath) &&
    recordPathReferences(record, ownerSource).some(
      (candidate) => candidate.startsWith("./") || candidate.startsWith("../"),
    )
  );
}

function revalidateOwnerRecordReferences(
  repoRoot: string,
  ownerPath: string,
  ownerSource: string,
  targets: InvalidatedDefenseTargets,
  errors: string[],
  repositoryView: CairRepositoryView,
): void {
  for (const record of parseCairRecords(ownerPath, ownerSource)) {
    if (!recordNeedsReferenceRevalidation(repoRoot, record, ownerSource, targets)) continue;
    errors.push(...validateCairRecord(repoRoot, record, ownerSource, repositoryView));
  }
}

function recordOwnerPaths(repositoryView: CairRepositoryView): string[] {
  return [
    ...new Set(
      ["docs", "shared-skills", ".github"].flatMap((root) =>
        repositoryView.listFiles(root).filter((candidate) => candidate.endsWith(".md")),
      ),
    ),
  ].sort();
}

function revalidateInvalidatedStructuralDefenses(
  repoRoot: string,
  targets: InvalidatedDefenseTargets,
  errors: string[],
  repositoryView: CairRepositoryView,
): void {
  if (!hasInvalidatedDefenseTargets(targets)) return;

  for (const ownerPath of recordOwnerPaths(repositoryView)) {
    const ownerSource = repositoryView.readFile(ownerPath);
    if (ownerSource === undefined) continue;
    revalidateOwnerRecordReferences(
      repoRoot,
      ownerPath,
      ownerSource,
      targets,
      errors,
      repositoryView,
    );
  }
}

function hasHeading(source: string, heading: string): boolean {
  return outsideFenceLines(source).some(({ line }) => line.trimEnd() === heading);
}

function followUpReferenceValue(source: string, label: string): string | null {
  for (const { line } of outsideFenceLines(source)) {
    const match = new RegExp(`^(?:-\\s+)?${label}:\\s*(.+)$`).exec(line);
    if (match && nonEmpty(match[1])) return match[1].trim();
  }
  return null;
}

function recordDocumentSegment(ownerDocumentSource: string, record: CairRecord): string {
  const lines = ownerDocumentSource.split(/\r?\n/);
  const start = record.headingLine - 1;
  let end = lines.length;
  let insideFollowUp = false;
  let fence: MarkdownFence | null = null;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const transition = advanceMarkdownFence(line, fence);
    fence = transition.fence;
    if (transition.delimiter || fence) continue;
    if (!/^#{1,6}\s+/.test(line)) continue;
    const heading = line.trimEnd();
    if (heading === PROPAGATION_MAP_HEADING || heading === CONCEPT_SHIFT_HEADING) {
      insideFollowUp = true;
      continue;
    }
    if (insideFollowUp && /^#{3,6}\s+/.test(line)) continue;
    end = index;
    break;
  }
  return lines.slice(start, end).join("\n");
}

function hasResolvableFollowUp(
  repoRoot: string,
  record: CairRecord,
  segment: string,
  label: string,
  heading: string,
  repositoryView: CairRepositoryView,
): boolean {
  if (hasHeading(segment, heading)) return true;
  const rawReference = followUpReferenceValue(segment, label);
  if (!rawReference) return false;
  const recordRef = extractReferenceValue(rawReference);
  if (EXTERNAL_RECORD_PATTERN.test(recordRef)) return true;
  const resolved = resolveRepoTarget(repoRoot, record.filePath, recordRef);
  if (!resolved) return false;
  const targetSource = repositoryView.readFile(resolved.relativePath);
  return targetSource !== undefined && hasHeading(targetSource, heading);
}

export function validateCairRecord(
  repoRoot: string,
  record: CairRecord,
  ownerDocumentSource: string,
  repositoryView: CairRepositoryView = createFileSystemView(repoRoot),
): string[] {
  const errors: string[] = [];
  const verdictValue = record.fields.get("Verdict")?.trim() ?? "";
  if (!isVerdict(verdictValue)) {
    errors.push(`${displayLocation(record)}: Verdict must be one of ${CAIR_VERDICTS.join(", ")}`);
    return errors;
  }

  const requiredFields = verdictValue === "none" ? NONE_FIELDS : STRUCTURAL_FIELDS;
  for (const field of requiredFields) {
    if (!nonEmpty(record.fields.get(field))) {
      errors.push(`${displayLocation(record)}: missing or empty required field "${field}"`);
    }
  }

  const { axes } = parseAxes(record, verdictValue, errors);
  const humanDecision = record.fields.get("Human decision required")?.trim() ?? "";
  if (nonEmpty(humanDecision) && humanDecision !== "no" && !humanDecision.endsWith("?")) {
    errors.push(
      `${displayLocation(record)}: Human decision required must be "no" or a question ending in "?"`,
    );
  }

  if (verdictValue !== "none") {
    const defense = record.fields.get("Evidence and structural defense") ?? "";
    if (nonEmpty(defense)) {
      validateStructuralDefense(repoRoot, record, defense, errors, repositoryView);
    }
  }

  const recordSegment = recordDocumentSegment(ownerDocumentSource, record);
  if (verdictValue === "reshape") {
    if (
      !hasResolvableFollowUp(
        repoRoot,
        record,
        recordSegment,
        "Propagation Map",
        PROPAGATION_MAP_HEADING,
        repositoryView,
      )
    ) {
      errors.push(
        `${displayLocation(record)}: reshape requires an exact "## Propagation Map" heading or "Propagation Map:" durable reference`,
      );
    }
    if (
      axes.includes("Compatibility and retirement") &&
      !hasResolvableFollowUp(
        repoRoot,
        record,
        recordSegment,
        "Concept Shift Architecture Review",
        CONCEPT_SHIFT_HEADING,
        repositoryView,
      )
    ) {
      errors.push(
        `${displayLocation(record)}: reshape affecting Compatibility and retirement requires a Concept Shift Architecture Review heading or durable reference`,
      );
    }
  }

  return errors;
}

function parseCairRecordRef(source: string): string | null {
  for (const { line } of outsideFenceLines(source)) {
    const match = /^(?:-\s+)?CAIR record:\s*(.+)$/.exec(line);
    if (match && nonEmpty(match[1])) return extractReferenceValue(match[1]);
  }
  return null;
}

function loadLocalRecord(
  repoRoot: string,
  ownerFile: string,
  recordRef: string,
  repositoryView: CairRepositoryView,
): { records: CairRecord[]; source: string; relativePath: string } | null {
  if (!recordRef.endsWith(LOCAL_RECORD_ANCHOR)) return null;
  const resolved = resolveRepoTarget(repoRoot, ownerFile, recordRef);
  if (!resolved) return null;
  const source = repositoryView.readFile(resolved.relativePath);
  if (source === undefined) return null;
  return {
    records: parseCairRecords(resolved.relativePath, source),
    source,
    relativePath: resolved.relativePath,
  };
}

function validateContractRecordLink(
  repoRoot: string,
  changedFile: ChangedFile,
  errors: string[],
  repositoryView: CairRepositoryView,
): void {
  const embeddedRecords = parseCairRecords(changedFile.path, changedFile.source);
  if (embeddedRecords.length > 0) return;

  const recordRef = parseCairRecordRef(changedFile.source);
  if (!recordRef) {
    errors.push(
      `${changedFile.path}: changed Story Chain contract file requires an embedded CAIR record or a "CAIR record:" durable reference`,
    );
    return;
  }
  if (EXTERNAL_RECORD_PATTERN.test(recordRef)) return;

  const target = loadLocalRecord(repoRoot, changedFile.path, recordRef, repositoryView);
  const targetRecord = target?.records[0];
  if (!target || target.records.length !== 1 || !targetRecord) {
    errors.push(
      `${changedFile.path}: CAIR record ref "${recordRef}" must resolve to one exact CAIR record`,
    );
    return;
  }
  const baselineRecordRef =
    changedFile.baselineSource === undefined
      ? null
      : parseCairRecordRef(changedFile.baselineSource);
  const linkChanged = baselineRecordRef !== recordRef;
  if (linkChanged) {
    errors.push(...validateCairRecord(repoRoot, targetRecord, target.source, repositoryView));
  }
}

function listArchitectureDeclarations(repositoryView: CairRepositoryView): string[] {
  return repositoryView
    .listFiles("docs/architecture-fitness")
    .filter((name) => name.endsWith(".change.json"));
}

function parseDeclaration(
  repositoryView: CairRepositoryView,
  relativePath: string,
  sourceOverride?: string,
): { value: ArchitectureImpactDeclaration | null; error: string | null } {
  try {
    const source = sourceOverride ?? repositoryView.readFile(relativePath);
    if (source === undefined) throw new Error("file is missing");
    return {
      value: JSON.parse(source) as ArchitectureImpactDeclaration,
      error: null,
    };
  } catch (error: unknown) {
    return {
      value: null,
      error: `${relativePath}: invalid architecture impact declaration JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function normalizedLocalRef(repoRoot: string, ownerFile: string, recordRef: string): string | null {
  const resolved = resolveRepoTarget(repoRoot, ownerFile, recordRef);
  return resolved?.relativePath ?? null;
}

function validateDeclaration(
  repoRoot: string,
  declarationPath: string,
  declaration: ArchitectureImpactDeclaration,
  errors: string[],
  repositoryView: CairRepositoryView,
): void {
  if (declaration.architectureImpact === "none") {
    if (declaration.cairVerdict !== "none") {
      errors.push(`${declarationPath}: architectureImpact "none" requires cairVerdict "none"`);
    }
    if (nonEmpty(declaration.recordRef as string | undefined)) {
      errors.push(`${declarationPath}: architectureImpact "none" must not set recordRef`);
    }
    return;
  }

  if (declaration.architectureImpact !== "declared") {
    errors.push(`${declarationPath}: architectureImpact must be "none" or "declared"`);
    return;
  }
  if (typeof declaration.cairVerdict !== "string" || !isVerdict(declaration.cairVerdict)) {
    errors.push(
      `${declarationPath}: declared architecture impact requires a canonical cairVerdict`,
    );
    return;
  }
  if (!nonEmpty(declaration.recordRef as string | undefined)) {
    errors.push(`${declarationPath}: declared architecture impact requires recordRef`);
    return;
  }

  const target = loadLocalRecord(
    repoRoot,
    declarationPath,
    declaration.recordRef as string,
    repositoryView,
  );
  const targetRecord = target?.records[0];
  if (!target || target.records.length !== 1 || !targetRecord) {
    errors.push(
      `${declarationPath}: recordRef "${String(declaration.recordRef)}" must resolve to one exact CAIR record`,
    );
    return;
  }
  const targetVerdict = linkedRecordVerdict(targetRecord);
  if (!targetVerdict) {
    errors.push(`${declarationPath}: linked CAIR record verdict could not be determined`);
    return;
  }
  if (targetVerdict !== declaration.cairVerdict) {
    errors.push(
      `${declarationPath}: cairVerdict "${declaration.cairVerdict}" does not match linked record verdict "${targetVerdict}"`,
    );
  }
}

function linkedRecordVerdict(record: CairRecord): CairVerdict | null {
  const directValue = record.fields.get("Verdict")?.trim() ?? "";
  const directMatch = /^`?(none|constrain-existing|reshape)`?[.]?$/.exec(directValue);
  if (directMatch && isVerdict(directMatch[1])) return directMatch[1];

  const legacyMatch =
    /(?:이번|current)\s+CAIR verdict(?:는| is|:)\s*`?(none|constrain-existing|reshape)`?/i.exec(
      record.source,
    );
  return legacyMatch && isVerdict(legacyMatch[1]) ? legacyMatch[1] : null;
}

function followUpSignature(ownerDocumentSource: string, record: CairRecord): string {
  const segment = recordDocumentSegment(ownerDocumentSource, record);
  return JSON.stringify({
    conceptShift: hasHeading(segment, CONCEPT_SHIFT_HEADING)
      ? "heading"
      : followUpReferenceValue(segment, "Concept Shift Architecture Review"),
    propagationMap: hasHeading(segment, PROPAGATION_MAP_HEADING)
      ? "heading"
      : followUpReferenceValue(segment, "Propagation Map"),
  });
}

function addedNearMissHeadingErrors(changedFile: ChangedFile): string[] {
  if (RECORD_POLICY_FILES.has(normalizeRepoPath(changedFile.path))) return [];
  const baselineHeadings = new Map<string, number>();
  for (const { line } of outsideFenceLines(changedFile.baselineSource ?? "")) {
    const heading = line.trimEnd();
    if (!/^#{1,6}\s+Contract Architecture Impact Review\b/.test(heading)) continue;
    if (heading === CAIR_HEADING) continue;
    baselineHeadings.set(heading, (baselineHeadings.get(heading) ?? 0) + 1);
  }

  const errors: string[] = [];
  for (const { index, line } of outsideFenceLines(changedFile.source)) {
    const heading = line.trimEnd();
    if (!/^#{1,6}\s+Contract Architecture Impact Review\b/.test(heading)) continue;
    if (heading === CAIR_HEADING) continue;
    const baselineCount = baselineHeadings.get(heading) ?? 0;
    if (baselineCount > 0) {
      baselineHeadings.set(heading, baselineCount - 1);
      continue;
    }
    errors.push(
      `${changedFile.path}:${String(index + 1)}: CAIR heading must be exactly "${CAIR_HEADING}"`,
    );
  }
  return errors;
}

function changedRecordsForFile(changedFile: ChangedFile): {
  records: CairRecord[];
  recordSetChanged: boolean;
} {
  const records = parseCairRecords(changedFile.path, changedFile.source);
  if (changedFile.baselineSource === undefined) {
    return { records, recordSetChanged: records.length > 0 };
  }

  const baselineRecords = parseCairRecords(changedFile.path, changedFile.baselineSource);
  const remainingBaseline = [...baselineRecords];
  const changedRecords = records.filter((record) => {
    const baselineIndex = remainingBaseline.findIndex(
      (baselineRecord) => baselineRecord.source === record.source,
    );
    if (baselineIndex < 0) return true;
    const [baselineRecord] = remainingBaseline.splice(baselineIndex, 1);
    return (
      record.fields.get("Verdict")?.trim() === "reshape" &&
      followUpSignature(changedFile.source, record) !==
        followUpSignature(changedFile.baselineSource ?? "", baselineRecord)
    );
  });
  return {
    records: changedRecords,
    recordSetChanged: changedRecords.length > 0 || remainingBaseline.length > 0,
  };
}

function changedFilesHaveDurableCairRecord(
  repoRoot: string,
  changedFiles: readonly ChangedFile[],
  repositoryView: CairRepositoryView,
): boolean {
  for (const changedFile of changedFiles) {
    if (changedFile.deleted) continue;
    if (changedRecordsForFile(changedFile).records.length > 0) return true;
    const recordRef = parseCairRecordRef(changedFile.source);
    if (!recordRef) continue;
    const baselineRecordRef =
      changedFile.baselineSource === undefined
        ? null
        : parseCairRecordRef(changedFile.baselineSource);
    if (recordRef === baselineRecordRef) continue;
    if (EXTERNAL_RECORD_PATTERN.test(recordRef)) return true;
    const target = loadLocalRecord(repoRoot, changedFile.path, recordRef, repositoryView);
    if (target?.records.length === 1) return true;
  }
  return false;
}

function validateChangedDocuments(
  repoRoot: string,
  changedFiles: readonly ChangedFile[],
  errors: string[],
  repositoryView: CairRepositoryView,
): {
  contractFileCount: number;
  recordCount: number;
  changedRecordPaths: Set<string>;
} {
  let recordCount = 0;
  let contractFileCount = 0;
  const changedRecordPaths = new Set<string>();

  for (const changedFile of changedFiles) {
    if (!changedFile.path.endsWith(".md")) continue;
    errors.push(...addedNearMissHeadingErrors(changedFile));
    const changedRecordResult = changedRecordsForFile(changedFile);
    if (changedRecordResult.recordSetChanged) changedRecordPaths.add(changedFile.path);
    if (changedFile.baselinePath && changedFile.baselinePath !== changedFile.path) {
      changedRecordPaths.add(changedFile.baselinePath);
      changedRecordPaths.add(changedFile.path);
    }
    recordCount += changedRecordResult.records.length;
    for (const record of changedRecordResult.records) {
      errors.push(...validateCairRecord(repoRoot, record, changedFile.source, repositoryView));
    }
  }

  for (const changedFile of changedFiles) {
    if (!STORY_CONTRACT_PATTERN.test(changedFile.path)) continue;
    contractFileCount += 1;
    if (changedFile.deleted) continue;
    validateContractRecordLink(repoRoot, changedFile, errors, repositoryView);
  }

  const deletedContracts = changedFiles.filter(
    (changedFile) => STORY_CONTRACT_PATTERN.test(changedFile.path) && changedFile.deleted,
  );
  if (
    deletedContracts.length > 0 &&
    !changedFilesHaveDurableCairRecord(repoRoot, changedFiles, repositoryView)
  ) {
    for (const changedFile of deletedContracts) {
      errors.push(
        `${changedFile.path}: deleted Story Chain contract file requires a durable CAIR record in the same change`,
      );
    }
  }

  return { contractFileCount, recordCount, changedRecordPaths };
}

function revalidateContractsReferencingChangedRecords(
  repoRoot: string,
  changedByPath: ReadonlyMap<string, ChangedFile>,
  changedRecordPaths: ReadonlySet<string>,
  errors: string[],
  repositoryView: CairRepositoryView,
): void {
  for (const contractPath of repositoryView
    .listFiles("docs/contracts/story-chain")
    .filter((candidate) => STORY_CONTRACT_PATTERN.test(candidate))) {
    if (changedByPath.has(contractPath)) continue;
    const source = repositoryView.readFile(contractPath);
    if (source === undefined) continue;
    const recordRef = parseCairRecordRef(source);
    if (!recordRef || EXTERNAL_RECORD_PATTERN.test(recordRef)) continue;
    const resolved = resolveRepoTarget(repoRoot, contractPath, recordRef);
    if (!resolved || !changedRecordPaths.has(resolved.relativePath)) continue;
    validateContractRecordLink(
      repoRoot,
      { path: contractPath, source, baselineSource: source },
      errors,
      repositoryView,
    );
  }
}

function parseArchitectureDeclarations(
  changedByPath: ReadonlyMap<string, ChangedFile>,
  repositoryView: CairRepositoryView,
): Map<string, { value: ArchitectureImpactDeclaration | null; error: string | null }> {
  const declarationPaths = listArchitectureDeclarations(repositoryView);
  const parsedDeclarations = new Map<
    string,
    { value: ArchitectureImpactDeclaration | null; error: string | null }
  >();
  for (const declarationPath of declarationPaths) {
    const parsed = parseDeclaration(
      repositoryView,
      declarationPath,
      changedByPath.get(declarationPath)?.source,
    );
    parsedDeclarations.set(declarationPath, parsed);
  }
  return parsedDeclarations;
}

function validateTrackedDeclarations(
  repoRoot: string,
  changedByPath: ReadonlyMap<string, ChangedFile>,
  changedRecordPaths: ReadonlySet<string>,
  parsedDeclarations: ReadonlyMap<
    string,
    { value: ArchitectureImpactDeclaration | null; error: string | null }
  >,
  errors: string[],
  repositoryView: CairRepositoryView,
): number {
  let declarationCount = 0;
  for (const [declarationPath, parsed] of parsedDeclarations) {
    const declarationChanged = changedByPath.has(declarationPath);
    const recordRef =
      parsed.value && typeof parsed.value.recordRef === "string"
        ? normalizedLocalRef(repoRoot, declarationPath, parsed.value.recordRef)
        : null;
    const linkedRecordChanged = recordRef ? changedRecordPaths.has(recordRef) : false;
    if (!declarationChanged && !linkedRecordChanged) continue;

    declarationCount += 1;
    if (parsed.error) {
      errors.push(parsed.error);
      continue;
    }
    if (parsed.value) {
      validateDeclaration(repoRoot, declarationPath, parsed.value, errors, repositoryView);
    }
  }
  return declarationCount;
}

export function validateCairChanges(
  repoRoot: string,
  changedFiles: readonly ChangedFile[],
  repositoryView: CairRepositoryView = createFileSystemView(repoRoot),
): CairValidationResult {
  const normalizedChangedFiles = changedFiles.map((file) => ({
    path: normalizeRepoPath(file.path),
    source: file.source,
    baselineSource: file.baselineSource,
    baselinePath: file.baselinePath ? normalizeRepoPath(file.baselinePath) : undefined,
    deleted: file.deleted,
  }));
  const changedByPath = new Map(normalizedChangedFiles.map((file) => [file.path, file]));
  const errors: string[] = [];
  const documentResult = validateChangedDocuments(
    repoRoot,
    normalizedChangedFiles,
    errors,
    repositoryView,
  );
  const invalidatedTargets = collectInvalidatedDefenseTargets(normalizedChangedFiles);
  const linkedRecordPaths = new Set([
    ...documentResult.changedRecordPaths,
    ...invalidatedTargets.paths,
  ]);
  revalidateContractsReferencingChangedRecords(
    repoRoot,
    changedByPath,
    linkedRecordPaths,
    errors,
    repositoryView,
  );
  revalidateInvalidatedStructuralDefenses(repoRoot, invalidatedTargets, errors, repositoryView);
  const parsedDeclarations = parseArchitectureDeclarations(changedByPath, repositoryView);
  const declarationCount = validateTrackedDeclarations(
    repoRoot,
    changedByPath,
    linkedRecordPaths,
    parsedDeclarations,
    errors,
    repositoryView,
  );

  return {
    changedFileCount: normalizedChangedFiles.length,
    contractFileCount: documentResult.contractFileCount,
    declarationCount,
    recordCount: documentResult.recordCount,
    errors: [...new Set(errors)],
  };
}
