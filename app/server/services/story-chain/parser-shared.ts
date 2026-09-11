// Internal helpers for Markdown Story Chain declarations and review/history
// parsing. Strict YAML Evidence Ledger parsing has a separate owner in
// `evidence-ledger-record.ts`.

import {
  type PromiseStatus,
  type StoryChainLane,
  type StoryChainVerdict,
} from "@/app/domain/story-chain";

export class StoryChainParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryChainParseError";
  }
}

export const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;

const VALID_LANES: ReadonlySet<StoryChainLane> = new Set([
  "search",
  "pdf",
  "research-route",
  "admin",
  "other",
]);
const VALID_PROMISE_STATUS: ReadonlySet<PromiseStatus> = new Set([
  "draft",
  "declared",
  "propagated",
  "verified",
  "retired",
]);
const VALID_VERDICT: ReadonlySet<StoryChainVerdict> = new Set(["met", "not-met", "unknown"]);

export type FrontmatterValue = string | string[];
export type Frontmatter = Map<string, FrontmatterValue>;

export function parseFrontmatter(raw: string): Frontmatter {
  const map: Frontmatter = new Map();
  const lines = raw.split(/\r?\n/);
  let activeListKey: string | null = null;
  let activeList: string[] = [];
  for (const line of lines) {
    if (activeListKey) {
      const itemMatch = line.match(/^\s+-\s+(.+)$/);
      if (itemMatch) {
        activeList.push(itemMatch[1].trim());
        continue;
      }
      map.set(activeListKey, activeList);
      activeListKey = null;
      activeList = [];
    }
    if (!line.trim()) continue;
    const listHeader = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*$/);
    if (listHeader) {
      activeListKey = listHeader[1];
      activeList = [];
      continue;
    }
    const scalar = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.+)$/);
    if (scalar) {
      map.set(scalar[1], scalar[2].trim());
    }
  }
  if (activeListKey) map.set(activeListKey, activeList);
  return map;
}

export function readScalar(map: Frontmatter, key: string, file: string): string {
  const value = map.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new StoryChainParseError(`${file}: missing required scalar "${key}"`);
  }
  return value;
}

export function readOptionalScalar(map: Frontmatter, key: string): string | undefined {
  const value = map.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readList(map: Frontmatter, key: string): string[] {
  const value = map.get(key);
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

export function ensureRef<T extends string>(
  raw: string,
  guard: (s: string) => s is T,
  expectedKind: string,
  file: string,
  field: string,
): T {
  if (!guard(raw)) {
    throw new StoryChainParseError(
      `${file}: field "${field}" expected ${expectedKind} ref, got "${raw}"`,
    );
  }
  return raw;
}

export function ensureLane(raw: string, file: string): StoryChainLane {
  if (!VALID_LANES.has(raw as StoryChainLane)) {
    throw new StoryChainParseError(
      `${file}: lane "${raw}" is not one of ${[...VALID_LANES].join(", ")}`,
    );
  }
  return raw as StoryChainLane;
}

export function ensurePromiseStatus(raw: string, file: string): PromiseStatus {
  if (!VALID_PROMISE_STATUS.has(raw as PromiseStatus)) {
    throw new StoryChainParseError(`${file}: status "${raw}" is not a valid PromiseStatus`);
  }
  return raw as PromiseStatus;
}

export function ensureVerdict(raw: string, file: string): StoryChainVerdict {
  if (!VALID_VERDICT.has(raw as StoryChainVerdict)) {
    throw new StoryChainParseError(`${file}: verdict "${raw}" must be met / not-met / unknown`);
  }
  return raw as StoryChainVerdict;
}

export interface SplitFile {
  frontmatter: Frontmatter;
  body: string;
}

export function splitFrontmatter(source: string, file: string): SplitFile {
  const match = source.match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new StoryChainParseError(`${file}: missing frontmatter block`);
  }
  return {
    frontmatter: parseFrontmatter(match[1]),
    body: source.slice(match[0].length),
  };
}

// Body section reader: split by `^##\s+` headings into a map of `heading text`
// (lowercased, normalized) -> raw body of that section.
export function splitH2Sections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const parts = body.split(/^##\s+(.+)$/m);
  // parts: [pre, heading1, body1, heading2, body2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].trim().toLowerCase();
    const sectionBody = parts[i + 1] ?? "";
    sections.set(heading, sectionBody);
  }
  return sections;
}

// Body sub-section reader for `### kind:slug` blocks within an H2 section.
export function splitH3Blocks(sectionBody: string): Array<{ heading: string; body: string }> {
  const blocks: Array<{ heading: string; body: string }> = [];
  const parts = sectionBody.split(/^###\s+(.+)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    blocks.push({ heading: parts[i].trim(), body: parts[i + 1] ?? "" });
  }
  return blocks;
}

// Inside a check block, fields are bullet lines `- field: value` (single line)
// or `- field:` followed by indented `  - item` list items.
export function readBulletFields(body: string): Map<string, string | string[]> {
  const map = new Map<string, string | string[]>();
  const lines = body.split(/\r?\n/);
  let activeListKey: string | null = null;
  let activeList: string[] = [];
  for (const line of lines) {
    if (activeListKey) {
      const item = line.match(/^\s{2,}-\s+(.+)$/);
      if (item) {
        activeList.push(item[1].trim());
        continue;
      }
      if (!line.trim()) continue;
      map.set(activeListKey, activeList);
      activeListKey = null;
      activeList = [];
    }
    const listHead = line.match(/^-\s+([a-z][a-z0-9 _-]*?)\s*:\s*$/i);
    if (listHead) {
      activeListKey = listHead[1].trim().toLowerCase();
      activeList = [];
      continue;
    }
    const scalar = line.match(/^-\s+([a-z][a-z0-9 _-]*?)\s*:\s*(.+)$/i);
    if (scalar) {
      map.set(scalar[1].trim().toLowerCase(), scalar[2].trim());
    }
  }
  if (activeListKey) map.set(activeListKey, activeList);
  return map;
}

export function readBulletList(sectionBody: string): string[] {
  const items: string[] = [];
  for (const line of sectionBody.split(/\r?\n/)) {
    const m = line.match(/^-\s+(.+)$/);
    if (m) items.push(m[1].trim());
  }
  return items;
}
