import type { GraphPaperSnapshot } from "@/app/domain/research-route-payload";
import type { SearchQueryClause } from "@/app/domain/search-query";
import {
  buildPaperTopicProfiles,
  type ExternalPaperSignals,
} from "@/app/server/services/knowledge-map/topic-signals";

const MAX_SEMANTIC_EDGES = 300;
const MIN_TOPIC_OVERLAP = 2;
const METHOD_TERMS = new Set([
  "active learning",
  "agentic",
  "bayesian",
  "benchmarks",
  "closed-loop",
  "code generation",
  "diffusion model",
  "drug repurposing",
  "evolution",
  "evaluation",
  "fine-tuning",
  "hypothesis generation",
  "knowledge graph",
  "materials science",
  "meta-learning",
  "monte carlo",
  "molecular",
  "multi-agent",
  "neuro-symbolic",
  "pipeline",
  "prompting",
  "rag",
  "reinforcement learning",
  "retrieval",
  "robotics",
  "self-improving",
  "symbolic",
  "theorem proving",
  "tree search",
  "verification",
  "workflow memory",
]);

export const SPARSE_DEGREE_DENSITY_THRESHOLD = 0.01;

export interface CitationEdgeInput {
  source: string;
  target: string;
  weight: number;
}

export interface DegreeDistributionSemanticEdgeInput {
  source: string;
  target: string;
  weight: number;
  origin: "semantic" | "method";
}

export interface DegreeDistributionEnrichInput {
  query: string;
  queryClauses?: SearchQueryClause[];
  papers: GraphPaperSnapshot[];
  citationEdges: CitationEdgeInput[];
  externalSignals?: readonly ExternalPaperSignals[];
}

function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits));
}

export function computeGraphDensity(nodeCount: number, edgeCount: number): number {
  if (nodeCount <= 1) return 0;
  return (2 * edgeCount) / (nodeCount * (nodeCount - 1));
}

export function shouldEnrichDegreeDistribution(params: {
  paperCount: number;
  edgeCount: number;
}): boolean {
  return computeGraphDensity(params.paperCount, params.edgeCount) < SPARSE_DEGREE_DENSITY_THRESHOLD;
}

function inferSemanticOrigin(terms: string[]): "semantic" | "method" {
  return terms.some((term) => METHOD_TERMS.has(term.toLowerCase())) ? "method" : "semantic";
}

function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTopic(value: string): string {
  const normalized = normalizePhrase(value);
  if (!normalized) return normalized;

  for (const suffix of ["ing", "tion", "ment", "s"]) {
    if (normalized.length > suffix.length + 3 && normalized.endsWith(suffix)) {
      return normalized.slice(0, -suffix.length);
    }
  }

  return normalized;
}

function countTopicOverlap(topicsA: readonly string[], topicsB: readonly string[]): number {
  const normalizedA = new Set(topicsA.map(normalizeTopic).filter((topic) => topic.length > 0));
  const normalizedB = new Set(topicsB.map(normalizeTopic).filter((topic) => topic.length > 0));

  let exactMatches = 0;
  for (const topic of normalizedA) {
    if (normalizedB.has(topic)) {
      exactMatches += 1;
    }
  }

  if (exactMatches >= MIN_TOPIC_OVERLAP) {
    return exactMatches;
  }

  let substringMatches = 0;
  for (const topicA of normalizedA) {
    for (const topicB of normalizedB) {
      if (topicA === topicB) continue;
      if (topicA.includes(topicB) || topicB.includes(topicA)) {
        substringMatches += 1;
        break;
      }
    }
  }

  return substringMatches;
}

function collectMethodTerms(methods: readonly string[]): string[] {
  const normalizedMethods = methods.map(normalizePhrase).filter((method) => method.length > 0);
  const matchedTerms = new Set<string>();

  for (const method of normalizedMethods) {
    for (const term of METHOD_TERMS) {
      if (method.includes(term)) {
        matchedTerms.add(term);
      }
    }
  }

  return [...matchedTerms].sort();
}

function computeMethodMatch(methodsA: readonly string[], methodsB: readonly string[]): string[] {
  const termsA = new Set(collectMethodTerms(methodsA));
  const termsB = new Set(collectMethodTerms(methodsB));
  return [...termsA].filter((term) => termsB.has(term)).sort();
}

function buildFallbackSignals(params: {
  papers: GraphPaperSnapshot[];
  query: string;
  queryClauses?: SearchQueryClause[];
  externalSignals?: readonly ExternalPaperSignals[];
}): Map<string, ExternalPaperSignals> {
  const signalMap = new Map<string, ExternalPaperSignals>();

  for (const signal of params.externalSignals ?? []) {
    signalMap.set(signal.paperId, {
      paperId: signal.paperId,
      claim: signal.claim?.trim() ?? "",
      topics: signal.topics.map(normalizePhrase).filter((topic) => topic.length > 0),
      methods: signal.methods.map(normalizePhrase).filter((method) => method.length > 0),
      finding: signal.finding?.trim() ?? "",
    });
  }

  const profiles = buildPaperTopicProfiles({
    papers: params.papers,
    query: params.query,
    queryClauses: params.queryClauses,
    externalSignals: params.externalSignals,
  });

  for (const paper of params.papers) {
    if (signalMap.has(paper.paperId)) continue;
    const profile = profiles.get(paper.paperId);
    if (!profile) continue;

    signalMap.set(paper.paperId, {
      paperId: paper.paperId,
      topics: profile.topKeywords
        .slice(0, 5)
        .map(normalizePhrase)
        .filter((topic) => topic.length > 0),
      methods: [...profile.methodTerms]
        .map(normalizePhrase)
        .filter((method) => method.length > 0)
        .toSorted((left, right) => right.length - left.length)
        .slice(0, 3),
      claim: "",
      finding: "",
    });
  }

  return signalMap;
}

export function enrichDegreeDistributionNetwork(
  input: DegreeDistributionEnrichInput,
): Promise<DegreeDistributionSemanticEdgeInput[]> {
  if (
    input.papers.length < 2 ||
    !shouldEnrichDegreeDistribution({
      paperCount: input.papers.length,
      edgeCount: input.citationEdges.length,
    })
  ) {
    return Promise.resolve([]);
  }

  const signalMap = buildFallbackSignals({
    papers: input.papers,
    query: input.query,
    queryClauses: input.queryClauses,
    externalSignals: input.externalSignals,
  });
  const existingPairs = new Set(
    input.citationEdges.map((edge) => [edge.source, edge.target].sort().join("::")),
  );
  const inferredEdges: DegreeDistributionSemanticEdgeInput[] = [];

  for (let sourceIndex = 0; sourceIndex < input.papers.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < input.papers.length; targetIndex += 1) {
      const sourcePaper = input.papers[sourceIndex];
      const targetPaper = input.papers[targetIndex];

      const pairKey = [sourcePaper.paperId, targetPaper.paperId].sort().join("::");
      if (existingPairs.has(pairKey)) {
        continue;
      }

      const sourceSignal = signalMap.get(sourcePaper.paperId);
      const targetSignal = signalMap.get(targetPaper.paperId);
      if (!sourceSignal || !targetSignal) {
        continue;
      }

      const topicOverlap = countTopicOverlap(sourceSignal.topics, targetSignal.topics);
      if (topicOverlap >= MIN_TOPIC_OVERLAP) {
        inferredEdges.push({
          source: sourcePaper.paperId,
          target: targetPaper.paperId,
          weight: round(Math.min(0.82, 0.5 + (topicOverlap - MIN_TOPIC_OVERLAP) * 0.08)),
          origin: "semantic",
        });
        continue;
      }

      const sharedMethodTerms = computeMethodMatch(sourceSignal.methods, targetSignal.methods);
      if (sharedMethodTerms.length > 0) {
        inferredEdges.push({
          source: sourcePaper.paperId,
          target: targetPaper.paperId,
          weight: round(Math.min(0.56, 0.34 + (sharedMethodTerms.length - 1) * 0.06)),
          origin: inferSemanticOrigin(sharedMethodTerms),
        });
      }
    }
  }

  return Promise.resolve(
    inferredEdges
      .sort((left, right) => {
        if (right.weight !== left.weight) {
          return right.weight - left.weight;
        }
        return [left.source, left.target]
          .join("::")
          .localeCompare([right.source, right.target].join("::"));
      })
      .slice(0, MAX_SEMANTIC_EDGES),
  );
}
