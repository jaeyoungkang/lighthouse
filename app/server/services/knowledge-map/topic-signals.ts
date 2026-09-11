import type { SearchQueryClause } from "@/app/domain/search-query";
import type { ResearchTermQualityContext } from "./research-term-quality";
import { isResearchLandscapeTerm } from "./research-term-quality";

const STOPWORDS = new Set([
  "about",
  "across",
  "after",
  "agentic",
  "among",
  "analysis",
  "approach",
  "approaches",
  "based",
  "between",
  "beyond",
  "for",
  "and",
  "the",
  "that",
  "this",
  "those",
  "data",
  "from",
  "into",
  "methodology",
  "paper",
  "papers",
  "results",
  "study",
  "studies",
  "system",
  "systems",
  "their",
  "these",
  "using",
  "with",
  "through",
  "towards",
  "end",
  "ended",
  "open",
  "level",
  "tasks",
  "task",
  "measure",
  "measures",
  "test",
  "tests",
  "help",
  "helps",
  "share",
  "shares",
  "via",
  "연구", // i18n-ignore — stopword
  "기반", // i18n-ignore — stopword
  "기반으로", // i18n-ignore — stopword
  "사용", // i18n-ignore — stopword
  "사용된", // i18n-ignore — stopword
  "활용", // i18n-ignore — stopword
  "활용한", // i18n-ignore — stopword
  "통해", // i18n-ignore — stopword
  "하는", // i18n-ignore — stopword
  "위한", // i18n-ignore — stopword
  "에서", // i18n-ignore — stopword
  "및", // i18n-ignore — stopword
  "대한", // i18n-ignore — stopword
  "했다", // i18n-ignore — stopword
  "했다", // i18n-ignore — stopword
]);

const CANONICAL_TOKEN_MAP = new Map([
  ["agents", "agents"],
  ["agent", "agents"],
  ["agentic", "agents"],
  ["benchmarks", "benchmarks"],
  ["benchmark", "benchmarks"],
  ["benchmarking", "benchmarks"],
  ["evaluating", "evaluation"],
  ["evaluated", "evaluation"],
  ["evaluate", "evaluation"],
  ["evaluation", "evaluation"],
  ["verifying", "verification"],
  ["verified", "verification"],
  ["verify", "verification"],
  ["verification", "verification"],
  ["methods", "methods"],
  ["method", "methods"],
  ["pipelines", "pipeline"],
  ["models", "models"],
  ["model", "models"],
  ["scientists", "scientists"],
  ["scientist", "scientists"],
  ["llm", "large language models"],
  ["llms", "large language models"],
  ["ai", "artificial intelligence"],
]);

const METHOD_KEYWORDS = new Set([
  "benchmarks",
  "evaluation",
  "verification",
  "methods",
  "pipeline",
  "workflow memory",
  "retrieval",
  "rag",
]);

const GENERIC_LABEL_PENALTIES = new Map<string, number>([
  ["artificial intelligence", 9],
  ["scientists", 8],
  ["agents", 6],
  ["models", 2.5],
  ["scientific", 5],
  ["discovery", 4.5],
  ["power", 6],
]);

const STABLE_LABEL_CANDIDATES = new Set([
  "artificial intelligence",
  "research",
  "automation",
  "research automation",
  "scientific discovery",
  "hypothesis generation",
  "large language models",
  "evaluation",
  "benchmarks",
  "verification",
  "workflow memory",
  "drug discovery",
  "materials",
  "retrieval",
  "multi-agent",
]);

const PHRASE_PATTERNS = [
  {
    label: "scientific discovery",
    patterns: [/\bscientific discovery\b/gi, /\bautonomous discovery\b/gi],
  },
  { label: "hypothesis generation", patterns: [/\bhypothesis generation\b/gi] },
  {
    label: "research automation",
    patterns: [
      /\bresearch automation\b/gi,
      /\bautomated research\b/gi,
      /\bautomation of (?:scientific )?research\b/gi,
      /\bend-to-end automation\b/gi,
    ],
  },
  { label: "research", patterns: [/\bresearch\b/gi, /\bscientific research\b/gi] },
  { label: "automation", patterns: [/\bautomation\b/gi, /\bautomated\b/gi] },
  { label: "workflow memory", patterns: [/\bworkflow memory\b/gi, /\blong-term memory\b/gi] },
  { label: "large language models", patterns: [/\blarge language models?\b/gi, /\bllms?\b/gi] },
  { label: "artificial intelligence", patterns: [/\bartificial intelligence\b/gi, /\bai\b/gi] },
  { label: "evaluation", patterns: [/\bevaluation\b/gi, /\bevaluat(?:e|ed|ing)\b/gi] },
  { label: "benchmarks", patterns: [/\bbenchmark(?:s|ing)?\b/gi] },
  { label: "verification", patterns: [/\bverification\b/gi, /\bverif(?:y|ied|ying)\b/gi] },
  { label: "agents", patterns: [/\bagent(?:s|ic)?\b/gi] },
  { label: "drug discovery", patterns: [/\bdrug discovery\b/gi] },
  { label: "multimodal", patterns: [/\bmultimodal\b/gi] },
  { label: "retrieval", patterns: [/\bretrieval\b/gi, /\brag\b/gi] },
  { label: "materials", patterns: [/\bmaterials?\b/gi] },
  { label: "scientists", patterns: [/\bscientist(?:s)?\b/gi, /\bco-scientist(?:s)?\b/gi] },
] as const;

export interface PaperTopicProfile {
  paperId: string;
  keywordScores: Map<string, number>;
  topKeywords: string[];
  tokenSet: Set<string>;
  methodTerms: Set<string>;
  queryMatches: Set<string>;
  referencePool: Set<string>;
}

export interface KnowledgeMapTopicPaper {
  paperId: string;
  title: string;
  abstract: string | null;
  citationCount: number;
  referenceIds?: readonly string[] | null;
  citationIds?: readonly string[] | null;
}

export interface ExternalPaperSignals {
  paperId: string;
  claim?: string;
  topics: readonly string[];
  methods: readonly string[];
  finding?: string;
}

interface RawPaperTopicProfile {
  keywordScores: Map<string, number>;
  tokenSet: Set<string>;
  methodTerms: Set<string>;
  referencePool: Set<string>;
}

function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits));
}

function canonicalizeToken(token: string): string {
  const normalized = token.toLowerCase().trim();
  if (!normalized) return normalized;
  return CANONICAL_TOKEN_MAP.get(normalized) ?? normalized;
}

function tokenize(text: string | null | undefined): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9가-힣-]+/g)
    .map((token) => canonicalizeToken(token))
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function addScore(target: Map<string, number>, key: string, weight: number) {
  target.set(key, round((target.get(key) ?? 0) + weight));
}

function addExternalSignalKeywords(
  keywordScores: Map<string, number>,
  tokenSet: Set<string>,
  methodTerms: Set<string>,
  signals: ExternalPaperSignals | undefined,
) {
  if (!signals) return;

  const weightedPhrases = [
    ...signals.topics.map((topic) => [topic, 3.8] as const),
    ...signals.methods.map((method) => [method, 4.6] as const),
    ...(signals.claim ? [[signals.claim, 0.7] as const] : []),
    ...(signals.finding ? [[signals.finding, 0.6] as const] : []),
  ];

  for (const [rawPhrase, weight] of weightedPhrases) {
    const phrase = rawPhrase.trim().toLowerCase();
    if (!phrase) continue;

    addScore(keywordScores, phrase, weight);
    for (const token of tokenize(phrase)) {
      tokenSet.add(token);
      addScore(keywordScores, token, weight * 0.65);
      if (METHOD_KEYWORDS.has(token)) {
        methodTerms.add(token);
      }
    }

    if (signals.methods.some((method) => method.trim().toLowerCase() === phrase)) {
      methodTerms.add(phrase);
      for (const token of tokenize(phrase)) {
        methodTerms.add(token);
      }
    }
  }
}

function collectRawProfile(
  paper: KnowledgeMapTopicPaper,
  externalSignals?: ExternalPaperSignals,
): RawPaperTopicProfile {
  const keywordScores = new Map<string, number>();
  const tokenSet = new Set<string>();
  const methodTerms = new Set<string>();

  const title = paper.title;
  const abstract = paper.abstract ?? "";
  for (const [text, baseWeight] of [
    [title, 2.2],
    [abstract, 1],
  ] as const) {
    for (const phrase of PHRASE_PATTERNS) {
      const matches = text.match(phrase.patterns[0]) ?? [];
      const extraMatches = phrase.patterns.slice(1).flatMap((pattern) => text.match(pattern) ?? []);
      const totalMatches = matches.length + extraMatches.length;
      if (totalMatches > 0) {
        addScore(keywordScores, phrase.label, baseWeight * (2 + totalMatches * 0.4));
        if (METHOD_KEYWORDS.has(phrase.label)) {
          methodTerms.add(phrase.label);
        }
      }
    }

    for (const token of tokenize(text)) {
      tokenSet.add(token);
      addScore(keywordScores, token, baseWeight);
      if (METHOD_KEYWORDS.has(token)) {
        methodTerms.add(token);
      }
    }
  }

  addExternalSignalKeywords(keywordScores, tokenSet, methodTerms, externalSignals);

  const referencePool = new Set([...(paper.referenceIds ?? []), ...(paper.citationIds ?? [])]);

  return {
    keywordScores,
    tokenSet,
    methodTerms,
    referencePool,
  };
}

export function buildQueryHints(
  query: string,
  queryClauses?: Array<Pick<SearchQueryClause, "normalizedClause" | "derivedExpansions">>,
): Set<string> {
  const hints = new Set<string>(tokenize(query));

  for (const phrase of PHRASE_PATTERNS) {
    if (
      phrase.patterns.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(query);
      })
    ) {
      hints.add(phrase.label);
    }
  }

  for (const clause of queryClauses ?? []) {
    for (const token of tokenize(clause.normalizedClause)) {
      hints.add(token);
    }
    for (const expansion of clause.derivedExpansions) {
      for (const token of tokenize(expansion)) {
        hints.add(token);
      }
    }
  }

  return hints;
}

function buildKeywordDocumentFrequency(rawProfiles: RawPaperTopicProfile[]): Map<string, number> {
  const documentFrequency = new Map<string, number>();
  for (const profile of rawProfiles) {
    for (const keyword of profile.keywordScores.keys()) {
      documentFrequency.set(keyword, (documentFrequency.get(keyword) ?? 0) + 1);
    }
  }
  return documentFrequency;
}

export function buildPaperTopicProfiles(params: {
  papers: readonly KnowledgeMapTopicPaper[];
  query: string;
  queryClauses?: SearchQueryClause[];
  externalSignals?: readonly ExternalPaperSignals[];
}): Map<string, PaperTopicProfile> {
  const queryHints = buildQueryHints(params.query, params.queryClauses);
  const externalSignalsByPaperId = new Map(
    (params.externalSignals ?? []).map((signal) => [signal.paperId, signal] as const),
  );
  const rawProfiles = params.papers.map((paper) =>
    collectRawProfile(paper, externalSignalsByPaperId.get(paper.paperId)),
  );
  const documentFrequency = buildKeywordDocumentFrequency(rawProfiles);
  const documentCount = Math.max(1, params.papers.length);

  return new Map(
    params.papers.map((paper, index) => {
      const rawProfile = rawProfiles[index];
      const keywordScores = new Map<string, number>();

      for (const [keyword, rawScore] of rawProfile.keywordScores.entries()) {
        const df = documentFrequency.get(keyword) ?? 1;
        const idf = 1 + Math.log((documentCount + 1) / df);
        const queryBoost = queryHints.has(keyword) ? 1.08 : 1;
        keywordScores.set(keyword, round(rawScore * idf * queryBoost));
      }

      const topKeywords = [...keywordScores.entries()]
        .sort((left, right) => {
          if (right[1] !== left[1]) return right[1] - left[1];
          if (right[0].split(" ").length !== left[0].split(" ").length) {
            return right[0].split(" ").length - left[0].split(" ").length;
          }
          return left[0].localeCompare(right[0]);
        })
        .slice(0, 8)
        .map(([keyword]) => keyword);

      const queryMatches = new Set(
        [...topKeywords, ...rawProfile.tokenSet].filter((keyword) => queryHints.has(keyword)),
      );

      return [
        paper.paperId,
        {
          paperId: paper.paperId,
          keywordScores,
          topKeywords,
          tokenSet: rawProfile.tokenSet,
          methodTerms: rawProfile.methodTerms,
          queryMatches,
          referencePool: rawProfile.referencePool,
        } satisfies PaperTopicProfile,
      ] as const;
    }),
  );
}

function computeVectorNorm(vector: Map<string, number>): number {
  let sumSquares = 0;
  for (const value of vector.values()) {
    sumSquares += value ** 2;
  }
  return Math.sqrt(sumSquares);
}

export function pickSharedKeywords(
  left: PaperTopicProfile,
  right: PaperTopicProfile,
  limit = 4,
): string[] {
  return [...left.keywordScores.keys()]
    .filter((keyword) => right.keywordScores.has(keyword))
    .sort((first, second) => {
      const firstScore = Math.min(
        left.keywordScores.get(first) ?? 0,
        right.keywordScores.get(first) ?? 0,
      );
      const secondScore = Math.min(
        left.keywordScores.get(second) ?? 0,
        right.keywordScores.get(second) ?? 0,
      );
      if (secondScore !== firstScore) return secondScore - firstScore;
      return first.localeCompare(second);
    })
    .slice(0, limit);
}

export function computeProfileSimilarity(
  left: PaperTopicProfile,
  right: PaperTopicProfile,
): {
  score: number;
  sharedKeywords: string[];
  sharedMethods: string[];
  sharedReferenceCount: number;
  queryBridge: boolean;
} {
  const sharedKeywords = pickSharedKeywords(left, right);
  const sharedMethods = [...left.methodTerms].filter((term) => right.methodTerms.has(term));
  const sharedReferenceCount = [...left.referencePool].filter((ref) =>
    right.referencePool.has(ref),
  ).length;
  const queryBridge = [...left.queryMatches].some((term) => right.queryMatches.has(term));

  let dotProduct = 0;
  for (const keyword of sharedKeywords) {
    dotProduct += (left.keywordScores.get(keyword) ?? 0) * (right.keywordScores.get(keyword) ?? 0);
  }

  const leftNorm = computeVectorNorm(left.keywordScores);
  const rightNorm = computeVectorNorm(right.keywordScores);
  const keywordCosine = leftNorm > 0 && rightNorm > 0 ? dotProduct / (leftNorm * rightNorm) : 0;

  const sharedTokenCount = [...left.tokenSet].filter((token) => right.tokenSet.has(token)).length;
  const unionTokenCount = new Set([...left.tokenSet, ...right.tokenSet]).size;
  const tokenJaccard = unionTokenCount > 0 ? sharedTokenCount / unionTokenCount : 0;

  const score = round(
    Math.min(
      1,
      keywordCosine * 0.65 +
        tokenJaccard * 0.2 +
        Math.min(sharedMethods.length, 2) * 0.08 +
        Math.min(sharedReferenceCount, 2) * 0.05 +
        (queryBridge ? 0.05 : 0),
    ),
  );

  return {
    score,
    sharedKeywords,
    sharedMethods,
    sharedReferenceCount,
    queryBridge,
  };
}

function dedupeLabelKeywords(keywords: string[]): string[] {
  const selected: string[] = [];

  for (const keyword of keywords) {
    const keywordTokens = new Set(keyword.split(/\s+/g));
    const overlapsExisting = selected.some((existing) => {
      const existingTokens = new Set(existing.split(/\s+/g));
      const overlap = [...keywordTokens].filter((token) => existingTokens.has(token)).length;
      return overlap > 0 && overlap >= Math.min(keywordTokens.size, existingTokens.size);
    });
    if (!overlapsExisting) {
      selected.push(keyword);
    }
    if (selected.length === 2) break;
  }

  return selected;
}

function isStableLabelCandidate(keyword: string, supportCount: number): boolean {
  return supportCount >= 2 || keyword.includes(" ") || STABLE_LABEL_CANDIDATES.has(keyword);
}

function titleCaseKeyword(keyword: string): string {
  return keyword
    .split(" ")
    .map((part) => {
      if (part === "ai") return "AI";
      if (part === "llm" || part === "llms") return "LLMs";
      if (part === "rag") return "RAG";
      if (part === "and") return "and";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function compareKeywordLengthThenLabel(leftKeyword: string, rightKeyword: string): number {
  const leftWordCount = leftKeyword.split(" ").length;
  const rightWordCount = rightKeyword.split(" ").length;
  if (rightWordCount !== leftWordCount) {
    return rightWordCount - leftWordCount;
  }
  return leftKeyword.localeCompare(rightKeyword);
}

export function buildTopicLabel(params: {
  paperIds: string[];
  papersById: Map<string, KnowledgeMapTopicPaper>;
  profiles: Map<string, PaperTopicProfile>;
  fallbackLabel: string;
  termQualityContext?: ResearchTermQualityContext;
}): string {
  const aggregateScores = new Map<string, number>();
  const keywordSupportCounts = new Map<string, number>();

  for (const paperId of params.paperIds) {
    const profile = params.profiles.get(paperId);
    const paper = params.papersById.get(paperId);
    if (!profile || !paper) continue;
    const citationWeight = 1 + Math.log10(paper.citationCount + 10);
    const seenKeywords = new Set<string>();

    for (const [keyword, score] of profile.keywordScores.entries()) {
      addScore(aggregateScores, keyword, score * citationWeight);
      if (!seenKeywords.has(keyword)) {
        keywordSupportCounts.set(keyword, (keywordSupportCounts.get(keyword) ?? 0) + 1);
        seenKeywords.add(keyword);
      }
    }
  }

  const rankedKeywords = [...aggregateScores.entries()]
    .filter(([keyword]) => {
      if (!isStableLabelCandidate(keyword, keywordSupportCounts.get(keyword) ?? 0)) {
        return false;
      }
      return params.termQualityContext
        ? isResearchLandscapeTerm(keyword, params.termQualityContext)
        : true;
    })
    .sort((left, right) => {
      const leftSupport = keywordSupportCounts.get(left[0]) ?? 0;
      const rightSupport = keywordSupportCounts.get(right[0]) ?? 0;
      const leftEffectiveScore =
        left[1] +
        leftSupport * 3 +
        (left[0].split(" ").length - 1) * 1.8 -
        (GENERIC_LABEL_PENALTIES.get(left[0]) ?? 0);
      const rightEffectiveScore =
        right[1] +
        rightSupport * 3 +
        (right[0].split(" ").length - 1) * 1.8 -
        (GENERIC_LABEL_PENALTIES.get(right[0]) ?? 0);
      if (rightEffectiveScore !== leftEffectiveScore) {
        return rightEffectiveScore - leftEffectiveScore;
      }
      if (rightSupport !== leftSupport) {
        return rightSupport - leftSupport;
      }
      return compareKeywordLengthThenLabel(left[0], right[0]);
    })
    .map(([keyword]) => keyword);

  const fallbackRankedKeywords = [...aggregateScores.entries()]
    .filter(([keyword]) =>
      params.termQualityContext
        ? isResearchLandscapeTerm(keyword, params.termQualityContext)
        : true,
    )
    .sort((left, right) => {
      const leftEffectiveScore =
        left[1] +
        (left[0].split(" ").length - 1) * 1.5 -
        (GENERIC_LABEL_PENALTIES.get(left[0]) ?? 0);
      const rightEffectiveScore =
        right[1] +
        (right[0].split(" ").length - 1) * 1.5 -
        (GENERIC_LABEL_PENALTIES.get(right[0]) ?? 0);
      if (rightEffectiveScore !== leftEffectiveScore) {
        return rightEffectiveScore - leftEffectiveScore;
      }
      return compareKeywordLengthThenLabel(left[0], right[0]);
    })
    .map(([keyword]) => keyword);

  const topKeywords = dedupeLabelKeywords(
    rankedKeywords.length > 0 ? rankedKeywords : fallbackRankedKeywords,
  );

  if (topKeywords.length === 0) {
    return params.fallbackLabel;
  }

  return topKeywords.map((keyword) => titleCaseKeyword(keyword)).join(" & ");
}
