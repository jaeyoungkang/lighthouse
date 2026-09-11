import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import * as path from "node:path";
import GithubSlugger from "github-slugger";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import { parseDocument, stringify } from "yaml";

const OBJECT_MARKER = "<!-- project-knowledge-object:v1 -->";
const OBJECT_BLOCK_RE =
  /<!-- project-knowledge-object:v1 -->\r?\n```yaml\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/g;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const ID_RE = /^(product|product-making)\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const LEGACY_REVIEW_RE =
  /^review:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const KNOWLEDGE_PLANES = ["product", "product-making"] as const;
export const KNOWLEDGE_KINDS = ["concept", "model", "case"] as const;
export const TEMPORAL_STATUSES = ["current", "disputed", "historical", "superseded"] as const;
export const RELATION_TYPES = [
  "produced_by",
  "serves",
  "evidenced_by",
  "challenged_by",
  "supersedes",
] as const;

export type KnowledgePlane = (typeof KNOWLEDGE_PLANES)[number];
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];
export type TemporalStatus = (typeof TEMPORAL_STATUSES)[number];
export type RelationType = (typeof RELATION_TYPES)[number];

export type KnowledgeGrounding = {
  type: "commit";
  ref: string;
  path: string;
  note: string;
};

export type KnowledgeRelation = {
  type: RelationType;
  target: string;
};

export type KnowledgeObject = {
  id: string;
  lifecycle: "shared-consolidated";
  plane: KnowledgePlane;
  kind: KnowledgeKind;
  title: string;
  aliases: string[];
  statement: string;
  scope: string[];
  non_scope: string[];
  forces: string[];
  rejected_alternatives: Array<{ alternative: string; reason: string }>;
  authority_refs: string[];
  grounding: KnowledgeGrounding[];
  relations: KnowledgeRelation[];
  temporal_status: TemporalStatus;
  evolution: Array<{ date: string; note: string }>;
  refresh_conditions: string[];
  answers: string[];
  legacy_refs: string[];
  last_review_id?: string;
  revises_digest?: string;
};

export type ParsedKnowledgeObject = {
  object: KnowledgeObject;
  digest: string;
  block: string;
};

export type KnowledgeValidationOptions = {
  authorityRoot?: string;
  verifyGrounding?: boolean;
  verifyAuthorityAnchors?: boolean;
  allowUnknownRelationTargets?: boolean;
};

export type KnowledgeValidation = {
  valid: boolean;
  reasons: string[];
  records: ParsedKnowledgeObject[];
};

type StructuredCandidateMetadata = {
  consolidation: "structured";
  extractionOutcome: "create" | "revise" | "split" | "enrich" | "legacy-forward";
  reviewSummary: string;
};

const REQUIRED_REVIEW_CHECKS = [
  "command_free",
  "one_pr_falsification",
  "verdict_free",
  "second_situation",
  "single_subject",
  "deletion",
] as const;

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function stringList(value: unknown, field: string, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${field} must be ${allowEmpty ? "an" : "a non-empty"} array`);
  }
  return value.map((item, index) => stringValue(item, `${field}[${String(index)}]`));
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${field} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function validDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateRepoFile(fileRef: string, root: string): boolean {
  if (path.isAbsolute(fileRef)) return false;
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, fileRef);
  const relative = path.relative(resolvedRoot, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return false;
  }
  try {
    const stat = lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const realRelative = path.relative(realpathSync(resolvedRoot), realpathSync(target));
    return (
      realRelative !== ".." &&
      !realRelative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(realRelative)
    );
  } catch {
    return false;
  }
}

function markdownAnchors(filePath: string): Set<string> {
  const tree = fromMarkdown(readFileSync(filePath, "utf8"));
  const slugger = new GithubSlugger();
  const anchors = new Set<string>();

  visit(tree);
  return anchors;

  function visit(node: { type: string; children?: readonly unknown[] }): void {
    if (node.type === "heading") {
      anchors.add(slugger.slug(toString(node, { includeHtml: false })));
    }
    for (const child of node.children ?? []) {
      visit(child as { type: string; children?: readonly unknown[] });
    }
  }
}

function validateAuthorityRef(
  authorityRef: string,
  root: string,
  anchorsByFile: Map<string, Set<string>>,
  verifyAnchor: boolean,
): boolean {
  const parts = authorityRef.split("#");
  if (parts.length > 2) return false;
  const [fileRef, anchor] = parts;
  if (!fileRef || !validateRepoFile(fileRef, root)) return false;
  if (parts.length === 1) return true;
  if (!anchor) return false;
  if (!verifyAnchor) return true;

  let anchors = anchorsByFile.get(fileRef);
  if (!anchors) {
    try {
      anchors = markdownAnchors(path.resolve(root, fileRef));
      anchorsByFile.set(fileRef, anchors);
    } catch {
      return false;
    }
  }
  return anchors.has(anchor);
}

function commitContainsPath(ref: string, filePath: string, root: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${ref}:${filePath}`], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function parseKnowledgeObject(value: unknown): KnowledgeObject {
  if (!isRecord(value)) throw new Error("knowledge object must be a mapping");
  const id = stringValue(value.id, "id");
  if (!ID_RE.test(id)) throw new Error(`id has invalid stable-id syntax: ${id}`);
  if (value.lifecycle !== "shared-consolidated") {
    throw new Error("lifecycle must be shared-consolidated");
  }
  const plane = enumValue(value.plane, KNOWLEDGE_PLANES, "plane");
  if (!id.startsWith(`${plane}.`)) throw new Error(`id ${id} must start with plane ${plane}`);
  const kind = enumValue(value.kind, KNOWLEDGE_KINDS, "kind");
  const temporalStatus = enumValue(value.temporal_status, TEMPORAL_STATUSES, "temporal_status");

  if (!Array.isArray(value.rejected_alternatives) || value.rejected_alternatives.length === 0) {
    throw new Error("rejected_alternatives must be a non-empty array");
  }
  const rejectedAlternatives = value.rejected_alternatives.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`rejected_alternatives[${String(index)}] must be a mapping`);
    }
    return {
      alternative: stringValue(
        item.alternative,
        `rejected_alternatives[${String(index)}].alternative`,
      ),
      reason: stringValue(item.reason, `rejected_alternatives[${String(index)}].reason`),
    };
  });

  if (!Array.isArray(value.grounding) || value.grounding.length === 0) {
    throw new Error("grounding must be a non-empty array");
  }
  const grounding = value.grounding.map((item, index): KnowledgeGrounding => {
    if (!isRecord(item) || item.type !== "commit") {
      throw new Error(`grounding[${String(index)}].type must be commit`);
    }
    const ref = stringValue(item.ref, `grounding[${String(index)}].ref`);
    if (!COMMIT_RE.test(ref))
      throw new Error(`grounding[${String(index)}].ref must be a full 40-character commit SHA`);
    return {
      type: "commit",
      ref,
      path: stringValue(item.path, `grounding[${String(index)}].path`),
      note: stringValue(item.note, `grounding[${String(index)}].note`),
    };
  });

  const relations = (Array.isArray(value.relations) ? value.relations : []).map(
    (item, index): KnowledgeRelation => {
      if (!isRecord(item)) throw new Error(`relations[${String(index)}] must be a mapping`);
      return {
        type: enumValue(item.type, RELATION_TYPES, `relations[${String(index)}].type`),
        target: stringValue(item.target, `relations[${String(index)}].target`),
      };
    },
  );

  if (!Array.isArray(value.evolution) || value.evolution.length === 0) {
    throw new Error("evolution must be a non-empty array");
  }
  const evolution = value.evolution.map((item, index) => {
    if (!isRecord(item)) throw new Error(`evolution[${String(index)}] must be a mapping`);
    const date = stringValue(item.date, `evolution[${String(index)}].date`);
    if (!validDate(date)) throw new Error(`evolution[${String(index)}].date must be YYYY-MM-DD`);
    return { date, note: stringValue(item.note, `evolution[${String(index)}].note`) };
  });

  const legacyRefs = stringList(value.legacy_refs ?? [], "legacy_refs", true);
  for (const legacyRef of legacyRefs) {
    if (!LEGACY_REVIEW_RE.test(legacyRef) && !legacyRef.startsWith("title:")) {
      throw new Error(`legacy_refs must use review:<uuid> or title:<exact title>: ${legacyRef}`);
    }
  }

  const revisesDigest =
    value.revises_digest === undefined
      ? undefined
      : stringValue(value.revises_digest, "revises_digest");
  if (revisesDigest && !/^[0-9a-f]{64}$/.test(revisesDigest)) {
    throw new Error("revises_digest must be a SHA-256 digest");
  }
  const lastReviewId =
    value.last_review_id === undefined
      ? undefined
      : stringValue(value.last_review_id, "last_review_id");
  if (lastReviewId && !LEGACY_REVIEW_RE.test(`review:${lastReviewId}`)) {
    throw new Error("last_review_id must be a UUID v4");
  }

  return {
    id,
    lifecycle: "shared-consolidated",
    plane,
    kind,
    title: stringValue(value.title, "title"),
    aliases: stringList(value.aliases, "aliases"),
    statement: stringValue(value.statement, "statement"),
    scope: stringList(value.scope, "scope"),
    non_scope: stringList(value.non_scope, "non_scope"),
    forces: stringList(value.forces, "forces"),
    rejected_alternatives: rejectedAlternatives,
    authority_refs: stringList(value.authority_refs, "authority_refs"),
    grounding,
    relations,
    temporal_status: temporalStatus,
    evolution,
    refresh_conditions: stringList(value.refresh_conditions, "refresh_conditions"),
    answers: stringList(value.answers, "answers"),
    legacy_refs: legacyRefs,
    ...(lastReviewId ? { last_review_id: lastReviewId } : {}),
    ...(revisesDigest ? { revises_digest: revisesDigest } : {}),
  };
}

export function renderKnowledgeObjectBlock(
  object: KnowledgeObject,
  options: { includeRevision?: boolean } = {},
): string {
  const stored = { ...object };
  if (!options.includeRevision) delete stored.revises_digest;
  const yaml = stringify(stored, { lineWidth: 100 }).trimEnd();
  return `${OBJECT_MARKER}\n\`\`\`yaml\n${yaml}\n\`\`\`\n`;
}

export function renderKnowledgeObjectStore(objects: KnowledgeObject[]): string {
  const header = `# Shared Project Knowledge\n\n이 파일은 review를 거쳐 consolidation된 Light House 설명 지식의 현재 projection이다.\n현재 행동과 제품 상태는 각 객체의 \`authority_refs\`가 가리키는 정본이 소유한다.\n기존 narrative와 append-only frame은 \`shared-memory.md\`에 byte 그대로 남아 있다.\n\n`;
  return `${header}${objects.map((object) => renderKnowledgeObjectBlock(object)).join("\n")}`;
}

function parseObjectBlocks(markdown: string, reasons: string[]): ParsedKnowledgeObject[] {
  const records: ParsedKnowledgeObject[] = [];
  const matches = [...markdown.matchAll(OBJECT_BLOCK_RE)];
  const markerCount = markdown.split(OBJECT_MARKER).length - 1;
  if (markerCount !== matches.length) reasons.push("malformed-or-unclosed-object-block");

  for (const [index, match] of matches.entries()) {
    try {
      const document = parseDocument(match[1]);
      if (document.errors.length > 0) throw document.errors[0];
      const object = parseKnowledgeObject(document.toJS() as unknown);
      const block = match[0];
      records.push({ object, digest: digest(block), block });
    } catch (error) {
      reasons.push(`object-${String(index + 1)}:${(error as Error).message}`);
    }
  }
  return records;
}

function validateUniqueIds(records: ParsedKnowledgeObject[], reasons: string[]): void {
  const idCounts = new Map<string, number>();
  for (const { object } of records) idCounts.set(object.id, (idCounts.get(object.id) ?? 0) + 1);
  for (const [id, count] of idCounts) {
    if (count > 1) reasons.push(`duplicate-id:${id}:${String(count)}`);
  }
}

function validateObjectReferences(
  object: KnowledgeObject,
  byId: Map<string, KnowledgeObject>,
  authorityRoot: string,
  verifyGrounding: boolean,
  verifyAuthorityAnchors: boolean,
  allowUnknownRelationTargets: boolean,
  anchorsByFile: Map<string, Set<string>>,
  reasons: string[],
): void {
  for (const authorityRef of object.authority_refs) {
    if (!validateAuthorityRef(authorityRef, authorityRoot, anchorsByFile, verifyAuthorityAnchors)) {
      reasons.push(`invalid-authority-ref:${object.id}:${authorityRef}`);
    }
  }
  for (const grounding of object.grounding) {
    if (!validateRepoFile(grounding.path, authorityRoot)) {
      reasons.push(`invalid-grounding-path:${object.id}:${grounding.path}`);
    } else if (
      verifyGrounding &&
      !commitContainsPath(grounding.ref, grounding.path, authorityRoot)
    ) {
      reasons.push(`invalid-grounding-commit:${object.id}:${grounding.ref}:${grounding.path}`);
    }
  }
  for (const relation of object.relations) {
    const target = byId.get(relation.target);
    if (!target && !allowUnknownRelationTargets) {
      reasons.push(`unknown-relation-target:${object.id}:${relation.target}`);
    }
    if (relation.target === object.id) reasons.push(`self-relation:${object.id}:${relation.type}`);
    if (target && !relationShapeIsValid(object, relation.type, target)) {
      reasons.push(`invalid-relation-shape:${object.id}:${relation.type}:${relation.target}`);
    }
  }
}

function relationShapeIsValid(
  source: KnowledgeObject,
  relationType: RelationType,
  target: KnowledgeObject,
): boolean {
  const sourceIsExplanation = source.kind === "concept" || source.kind === "model";
  const targetIsExplanation = target.kind === "concept" || target.kind === "model";
  switch (relationType) {
    case "produced_by":
      return (
        source.plane === "product" &&
        sourceIsExplanation &&
        target.plane === "product-making" &&
        target.kind === "case"
      );
    case "serves":
      return (
        source.plane === "product-making" &&
        sourceIsExplanation &&
        target.plane === "product" &&
        targetIsExplanation
      );
    case "evidenced_by":
    case "challenged_by":
      return sourceIsExplanation && target.kind === "case";
    case "supersedes":
      return (
        source.temporal_status === "current" &&
        sourceIsExplanation &&
        target.temporal_status === "superseded" &&
        source.plane === target.plane &&
        source.kind === target.kind
      );
  }
}

function validateTemporalStatus(
  object: KnowledgeObject,
  records: ParsedKnowledgeObject[],
  allowUnknownRelationTargets: boolean,
  reasons: string[],
): void {
  if (
    object.temporal_status === "disputed" &&
    !object.relations.some((relation) => relation.type === "challenged_by")
  ) {
    reasons.push(`disputed-without-challenge:${object.id}`);
  }
  if (object.temporal_status !== "superseded" || allowUnknownRelationTargets) return;
  const incoming = records.some(
    ({ object: candidate }) =>
      candidate.temporal_status === "current" &&
      candidate.relations.some(
        (relation) => relation.type === "supersedes" && relation.target === object.id,
      ),
  );
  if (!incoming) reasons.push(`superseded-without-current-successor:${object.id}`);
}

export function validateKnowledgeObjectStore(
  markdown: string,
  options: KnowledgeValidationOptions = {},
): KnowledgeValidation {
  const authorityRoot = options.authorityRoot ?? process.cwd();
  const verifyGrounding = options.verifyGrounding ?? true;
  const verifyAuthorityAnchors = options.verifyAuthorityAnchors ?? true;
  const allowUnknownRelationTargets = options.allowUnknownRelationTargets ?? false;
  const reasons: string[] = [];
  const records = parseObjectBlocks(markdown, reasons);
  validateUniqueIds(records, reasons);

  const byId = new Map(records.map((record) => [record.object.id, record.object]));
  const anchorsByFile = new Map<string, Set<string>>();
  for (const { object } of records) {
    validateObjectReferences(
      object,
      byId,
      authorityRoot,
      verifyGrounding,
      verifyAuthorityAnchors,
      allowUnknownRelationTargets,
      anchorsByFile,
      reasons,
    );
    validateTemporalStatus(object, records, allowUnknownRelationTargets, reasons);
  }

  return { valid: reasons.length === 0, reasons, records };
}

function parseFrontmatter(markdown: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match?.[1]) throw new Error("structured candidate requires YAML frontmatter");
  const document = parseDocument(match[1]);
  if (document.errors.length > 0) throw document.errors[0];
  const parsed: unknown = document.toJS();
  if (!isRecord(parsed)) throw new Error("structured candidate frontmatter must be a mapping");
  return parsed;
}

export function isStructuredKnowledgeCandidate(markdown: string): boolean {
  try {
    return parseFrontmatter(markdown).consolidation === "structured";
  } catch {
    return false;
  }
}

export function validateStructuredKnowledgeCandidate(
  markdown: string,
  options: KnowledgeValidationOptions = {},
): { metadata: StructuredCandidateMetadata; records: ParsedKnowledgeObject[] } {
  const frontmatter = parseFrontmatter(markdown);
  if (frontmatter.consolidation !== "structured") {
    throw new Error("consolidation must be structured");
  }
  const extractionOutcome = enumValue(
    frontmatter.extraction_outcome,
    ["create", "revise", "split", "enrich", "legacy-forward"] as const,
    "extraction_outcome",
  );
  const checks = frontmatter.review_checks;
  if (!isRecord(checks)) throw new Error("review_checks must be a mapping");
  for (const check of REQUIRED_REVIEW_CHECKS) {
    if (checks[check] !== "pass") throw new Error(`review_checks.${check} must be pass`);
  }
  const validation = validateKnowledgeObjectStore(markdown, {
    ...options,
    allowUnknownRelationTargets: true,
  });
  if (!validation.valid) {
    throw new Error(`invalid structured objects: ${validation.reasons.join(", ")}`);
  }
  if (validation.records.length === 0) {
    throw new Error(
      "structured approval requires at least one knowledge object; use local-only for 0",
    );
  }
  return {
    metadata: {
      consolidation: "structured",
      extractionOutcome,
      reviewSummary: stringValue(frontmatter.review_summary, "review_summary"),
    },
    records: validation.records,
  };
}

export function mergeKnowledgeObjects(
  currentMarkdown: string,
  candidateRecords: ParsedKnowledgeObject[],
  options: KnowledgeValidationOptions = {},
  reviewId?: string,
): string {
  const current = validateKnowledgeObjectStore(currentMarkdown, options);
  if (!current.valid)
    throw new Error(`current knowledge store is invalid: ${current.reasons.join(", ")}`);
  const merged = new Map(current.records.map((record) => [record.object.id, record]));
  const candidateIds = new Set<string>();
  for (const candidate of candidateRecords) {
    if (candidateIds.has(candidate.object.id))
      throw new Error(`duplicate candidate id: ${candidate.object.id}`);
    candidateIds.add(candidate.object.id);
    const previous = merged.get(candidate.object.id);
    if (previous) {
      if (candidate.object.revises_digest !== previous.digest) {
        throw new Error(`revision digest mismatch for ${candidate.object.id}`);
      }
    } else if (candidate.object.revises_digest) {
      throw new Error(`new object must not declare revises_digest: ${candidate.object.id}`);
    }
    const storedObject = { ...candidate.object };
    delete storedObject.revises_digest;
    if (reviewId) storedObject.last_review_id = reviewId;
    merged.set(candidate.object.id, {
      object: storedObject,
      digest: "",
      block: "",
    });
  }
  const rendered = renderKnowledgeObjectStore([...merged.values()].map((record) => record.object));
  const validation = validateKnowledgeObjectStore(rendered, options);
  if (!validation.valid)
    throw new Error(`merged knowledge store is invalid: ${validation.reasons.join(", ")}`);
  return rendered;
}

export function knowledgeObjectFileExists(root: string): boolean {
  return existsSync(path.join(root, "docs", "project-knowledge", "knowledge-objects.md"));
}
