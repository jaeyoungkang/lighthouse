import * as path from "node:path";
import {
  listArchivedLogJsonFiles,
  listLocalKnowledgeFiles,
  listSharedKnowledgeFiles,
  readText,
  relativePath,
} from "./common";
import {
  KNOWLEDGE_KINDS,
  KNOWLEDGE_PLANES,
  TEMPORAL_STATUSES,
  validateKnowledgeObjectStore,
  type KnowledgeKind,
  type KnowledgePlane,
  type TemporalStatus,
} from "./knowledge-object";

type Result = {
  file: string;
  score: number;
  title: string;
  excerpt: string;
  recordedAt?: string;
  knowledge?: SearchUnit["knowledge"];
  legacy?: SearchUnit["legacy"];
  matchedFields?: string[];
};

type SearchUnit = {
  file: string;
  content: string;
  title?: string;
  recordedAt?: string;
  knowledge?: {
    id: string;
    plane: KnowledgePlane;
    kind: KnowledgeKind;
    status: TemporalStatus;
    authorityRefs: string[];
    aliases: string[];
    answers: string[];
    grounding: string[];
    relations: string[];
  };
  legacy?: { ref: string; forwardedTo: string[] };
};

const QUERY_STOP_TERMS = new Set([
  "가",
  "그",
  "그런",
  "는",
  "달라졌는가",
  "를",
  "모습인가",
  "무엇",
  "무엇이",
  "무엇을",
  "왜",
  "에서",
  "예전에",
  "은",
  "을",
  "이",
  "이런",
  "현재",
  "지금",
  "하는가",
  "해야",
]);

function queryTerms(query: string): string[] {
  return query
    .replace(/([a-z0-9_-])([\p{Script=Hangul}])/giu, "$1 $2")
    .replace(/([\p{Script=Hangul}])([a-z0-9_-])/giu, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .filter((term) => term.length > 0 && !QUERY_STOP_TERMS.has(term));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function scoreContent(content: string, file: string, terms: string[]): number {
  const haystack = `${file}\n${content}`.toLowerCase();
  const baseScore = terms.reduce((score, term) => {
    const matches = haystack.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
    return score + (matches?.length ?? 0);
  }, 0);
  const keywordScore = content
    .split("\n")
    .filter(Boolean)
    .reduce((score, line) => {
      try {
        const parsed = JSON.parse(line) as {
          context_hint?: unknown;
          domain_tags?: unknown;
          entities?: unknown;
          goal_links?: unknown;
          role?: unknown;
        };
        const recallKeys = [
          parsed.context_hint,
          parsed.role,
          ...stringArray(parsed.domain_tags),
          ...stringArray(parsed.entities),
          ...stringArray(parsed.goal_links),
        ]
          .filter(Boolean)
          .map(String)
          .map((key) => key.toLowerCase());
        return (
          score +
          terms.reduce(
            (termScore, term) =>
              termScore + recallKeys.filter((key) => key.includes(term)).length * 5,
            0,
          )
        );
      } catch {
        return score;
      }
    }, 0);
  return baseScore + keywordScore;
}

function recencyBoost(recordedAt: string | undefined): number {
  if (!recordedAt) return 0;
  const ts = Date.parse(recordedAt);
  if (Number.isNaN(ts)) return 0;
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return 3;
  if (ageDays <= 30) return 2;
  if (ageDays <= 90) return 1;
  return 0;
}

function excerptFor(content: string, terms: string[]): string {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const matched = lines.find((line) => terms.some((term) => line.toLowerCase().includes(term)));
  return matched ?? lines.slice(0, 2).join(" ");
}

function titleFor(content: string, file: string): string {
  return content.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(file);
}

function matchedKnowledgeFields(unit: SearchUnit, terms: string[]): string[] {
  if (!unit.knowledge) return [];
  const groups: Array<[string, string[]]> = [
    ["alias", unit.knowledge.aliases],
    ["answer", unit.knowledge.answers],
    ["grounding", unit.knowledge.grounding],
    ["authority", unit.knowledge.authorityRefs],
  ];
  return groups
    .filter(([, values]) =>
      values.some((value) => terms.some((term) => value.toLowerCase().includes(term))),
    )
    .map(([name]) => name);
}

function knowledgeFacetHitCount(unit: SearchUnit, terms: string[]): number {
  if (!unit.knowledge) return 0;
  const semanticValues = [...unit.knowledge.aliases, ...unit.knowledge.answers].map((value) =>
    value.toLowerCase(),
  );
  const provenanceValues = [...unit.knowledge.grounding, ...unit.knowledge.authorityRefs].map(
    (value) => value.toLowerCase(),
  );
  return terms.reduce((count, term) => {
    const semanticHits = semanticValues.filter((value) => value.includes(term)).length;
    const provenanceHit = provenanceValues.some((value) => value.includes(term)) ? 1 : 0;
    return count + semanticHits + provenanceHit;
  }, 0);
}

function structuredKnowledgeUnits(file: string): SearchUnit[] {
  const validation = validateKnowledgeObjectStore(readText(file), {
    verifyGrounding: false,
    verifyAuthorityAnchors: false,
  });
  if (!validation.valid) {
    throw new Error(`Invalid structured Project Knowledge: ${validation.reasons.join(", ")}`);
  }
  return validation.records.map(({ object }) => ({
    file,
    title: object.title,
    content: JSON.stringify({
      title: object.title,
      aliases: object.aliases,
      statement: object.statement,
      scope: object.scope,
      non_scope: object.non_scope,
      forces: object.forces,
      rejected_alternatives: object.rejected_alternatives,
      evolution: object.evolution,
      refresh_conditions: object.refresh_conditions,
      answers: object.answers,
    }),
    knowledge: {
      id: object.id,
      plane: object.plane,
      kind: object.kind,
      status: object.temporal_status,
      authorityRefs: object.authority_refs,
      aliases: object.aliases,
      answers: object.answers,
      grounding: object.grounding.map(
        (grounding) => `${grounding.ref}:${grounding.path}:${grounding.note}`,
      ),
      relations: object.relations.map((relation) => `${relation.type}->${relation.target}`),
    },
  }));
}

function legacySharedMemoryUnits(file: string): SearchUnit[] {
  const content = readText(file);
  const structuredPath = path.join(path.dirname(file), "knowledge-objects.md");
  const structured = validateKnowledgeObjectStore(readText(structuredPath), {
    verifyGrounding: false,
    verifyAuthorityAnchors: false,
  });
  if (!structured.valid) {
    throw new Error(`Invalid structured Project Knowledge: ${structured.reasons.join(", ")}`);
  }
  const forwards = new Map<string, string[]>();
  for (const { object } of structured.records) {
    for (const legacyRef of object.legacy_refs) {
      forwards.set(legacyRef, [...(forwards.get(legacyRef) ?? []), object.id]);
    }
  }
  const headings = [...content.matchAll(/^# Narrative:\s*(.+)$/gm)];
  return headings.map((heading, index) => {
    const start = heading.index;
    const end = headings.at(index + 1)?.index ?? content.length;
    const title = heading[1].trim();
    const before = content.slice(0, start);
    const frameStart = before.lastIndexOf("<!-- project-knowledge-entry:v1 id=");
    const frameEnd = before.lastIndexOf("<!-- /project-knowledge-entry:v1 id=");
    const reviewId =
      frameStart > frameEnd
        ? /id=([0-9a-f-]{36})/.exec(content.slice(frameStart, start))?.[1]
        : undefined;
    const titleRef = `title:${title}`;
    const reviewRef = reviewId ? `review:${reviewId}` : undefined;
    const forwardedTo = [
      ...(forwards.get(titleRef) ?? []),
      ...(reviewRef ? (forwards.get(reviewRef) ?? []) : []),
    ];
    return {
      file,
      title,
      content: content.slice(start, end),
      legacy: { ref: reviewRef ?? titleRef, forwardedTo: [...new Set(forwardedTo)] },
    };
  });
}

function searchUnitsFor(file: string, since?: string): SearchUnit[] {
  const content = readText(file);
  if (path.basename(file) === "knowledge-objects.md") return structuredKnowledgeUnits(file);
  if (path.basename(file) === "shared-memory.md") return legacySharedMemoryUnits(file);
  if (!file.endsWith(".jsonl")) {
    return [{ file, content }];
  }

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<SearchUnit | undefined>((line, index) => {
      try {
        const parsed = JSON.parse(line) as {
          id?: unknown;
          title?: unknown;
          context_hint?: unknown;
          date?: unknown;
          source_refs?: { recordedAt?: unknown };
        };
        const recordedAt =
          typeof parsed.source_refs?.recordedAt === "string"
            ? parsed.source_refs.recordedAt
            : typeof parsed.date === "string"
              ? parsed.date
              : undefined;
        if (since && recordedAt && recordedAt < since) {
          return undefined;
        }
        const id = typeof parsed.id === "string" ? parsed.id : `line-${String(index + 1)}`;
        const title =
          typeof parsed.context_hint === "string"
            ? `${path.basename(file)}#${id} (${parsed.context_hint})`
            : `${path.basename(file)}#${id}`;
        return { file, content: line, title, recordedAt };
      } catch {
        return {
          file,
          content: line,
          title: `${path.basename(file)}#line-${String(index + 1)}`,
        };
      }
    })
    .filter((unit): unit is SearchUnit => unit !== undefined);
}

function extractFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function extractValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) return undefined;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

function defaultSince(): string {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

function matchesKnowledgeFilters(
  unit: SearchUnit,
  plane: KnowledgePlane | undefined,
  kind: KnowledgeKind | undefined,
  status: TemporalStatus | undefined,
): boolean {
  if (plane && unit.knowledge?.plane !== plane) return false;
  if (kind && unit.knowledge?.kind !== kind) return false;
  if (status && unit.knowledge?.status !== status) return false;
  return true;
}

function temporalStatusBoost(
  knowledge: SearchUnit["knowledge"],
  historicalQuery: boolean,
  supersededQuery: boolean,
): number {
  if (!knowledge) return 0;
  if (supersededQuery && knowledge.status === "superseded") return 12;
  if (historicalQuery && knowledge.status === "historical") return 12;
  if (!historicalQuery && !supersededQuery && knowledge.status === "current") return 8;
  return 0;
}

function printFileInventory(files: string[], all: boolean, since: string | undefined): void {
  console.log("Project Knowledge files:");
  for (const file of files) console.log(`- ${relativePath(file)}`);
  if (all) return;
  console.log("");
  console.log(
    `기본 검색 범위: 최근 30일 (${since ?? "all"}). 더 보려면 --all 또는 --since YYYY-MM-DD.`,
  );
}

function printRecallResult(result: Result): void {
  console.log("");
  console.log(`- ${relativePath(result.file)} (${String(result.score)})`);
  console.log(`  ${result.title}`);
  if (result.knowledge) {
    console.log(
      `  object: ${result.knowledge.id} | plane=${result.knowledge.plane} | kind=${result.knowledge.kind} | status=${result.knowledge.status}`,
    );
    console.log(`  matched: ${result.matchedFields?.join(", ") || "statement/title"}`);
    console.log(`  authority: ${result.knowledge.authorityRefs.join(", ")}`);
    if (result.knowledge.relations.length > 0) {
      console.log(`  relations: ${result.knowledge.relations.join(", ")}`);
    }
  }
  if (result.legacy) {
    console.log(
      result.legacy.forwardedTo.length > 0
        ? `  legacy forward: ${result.legacy.ref} -> ${result.legacy.forwardedTo.join(", ")}`
        : `  legacy migration candidate: ${result.legacy.ref} (재검증 전에는 현재 지식으로 승격하지 않음)`,
    );
  }
  console.log(`  ${result.excerpt}`);
}

function printRecallResults(
  query: string,
  results: Result[],
  all: boolean,
  since: string | undefined,
): void {
  if (results.length === 0) {
    console.log(`No Project Knowledge matches for: ${query}`);
    if (!all) console.log("archive 포함 검색은 --all, 시간 범위 확장은 --since YYYY-MM-DD.");
    return;
  }
  console.log(`Project Knowledge recall: ${query}`);
  if (/현재|지금|해야|명령|절차|상태|verdict|release/i.test(query)) {
    console.log(
      "현재 행동 질의: Project Knowledge는 설명을 제공하며, 실제 지시와 현재값은 아래 authority_refs에서 다시 확인한다.",
    );
  }
  if (!all) console.log(`(검색 범위: since ${since ?? "all"}; --all 로 archive 포함)`);
  for (const result of results) printRecallResult(result);
}

function main(): void {
  const rawArgs = process.argv.slice(2);
  const all = extractFlag(rawArgs, "--all");
  const explicitSince = extractValue(rawArgs, "--since");
  const plane = extractValue(rawArgs, "--plane") as KnowledgePlane | undefined;
  const kind = extractValue(rawArgs, "--kind") as KnowledgeKind | undefined;
  const status = extractValue(rawArgs, "--status") as TemporalStatus | undefined;
  if (plane && !KNOWLEDGE_PLANES.includes(plane)) throw new Error(`Unknown plane: ${plane}`);
  if (kind && !KNOWLEDGE_KINDS.includes(kind)) throw new Error(`Unknown kind: ${kind}`);
  if (status && !TEMPORAL_STATUSES.includes(status)) throw new Error(`Unknown status: ${status}`);
  const query = rawArgs.join(" ").trim();
  const explanationQuery = /왜|이유|배경|형성|explain/i.test(query);
  const historicalQuery = /과거|예전|이전|사례|시도|남았/i.test(query);
  const supersededQuery = /대체|폐기|퇴역|supersed/i.test(query);

  const since = all ? undefined : (explicitSince ?? defaultSince());
  const archiveFiles = all ? listArchivedLogJsonFiles() : [];
  const files = [...listLocalKnowledgeFiles(), ...archiveFiles, ...listSharedKnowledgeFiles()];

  if (!query) {
    printFileInventory(files, all, since);
    return;
  }

  const terms = queryTerms(query);

  const results: Result[] = files
    .flatMap((file) => searchUnitsFor(file, since))
    .filter((unit) => matchesKnowledgeFilters(unit, plane, kind, status))
    .map((unit) => {
      const baseScore = scoreContent(unit.content, unit.file, terms);
      const matchedFields = matchedKnowledgeFields(unit, terms);
      const structuredBoost = unit.knowledge ? 25 + knowledgeFacetHitCount(unit, terms) * 5 : 0;
      const temporalBoost = temporalStatusBoost(unit.knowledge, historicalQuery, supersededQuery);
      return {
        file: unit.file,
        score:
          baseScore > 0
            ? baseScore + structuredBoost + temporalBoost + recencyBoost(unit.recordedAt)
            : 0,
        title: unit.title ?? titleFor(unit.content, unit.file),
        excerpt: excerptFor(unit.content, terms),
        recordedAt: unit.recordedAt,
        knowledge: unit.knowledge,
        legacy: unit.legacy,
        matchedFields,
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      if (explanationQuery && Boolean(a.knowledge) !== Boolean(b.knowledge)) {
        return a.knowledge ? -1 : 1;
      }
      if (b.score !== a.score) return b.score - a.score;
      return (b.recordedAt ?? "").localeCompare(a.recordedAt ?? "");
    })
    .slice(0, 8);

  printRecallResults(query, results, all, since);
}

main();
