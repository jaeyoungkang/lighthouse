// 이슈 #110 재현 평가 — `slide accessibility` 검색 결과에서 method/contribution
// 명사구 가족이 연구 용어 후보에 등장하는지 실제 LLM 추출로 확인한다.
//
// 단순 빈도 반복 용어가 아니라, 베타 테스터 C가 기대한 분야 핵심 아이디어
// 가족(highlighting/visualization, multi-touch interaction, non-visual access,
// temporal/structure 추출 등)이 등장하는지를 재현 가능한 합격 기준으로 잠근다.
//
// 실제 Gemini 호출이 필요하므로 unit 게이트가 아니라 gated eval이다.
// Usage: npx tsx --env-file=.env.local scripts/evals/search-term-discovery-eval.ts
//        [scripts/evals/fixtures/slide-accessibility-search-sample.json]

import fs from "node:fs";
import path from "node:path";
import { hasGeminiApiKey } from "@/app/server/ai-generation/gemini";
import { buildEnglishTermCandidatesWithLLM } from "@/app/server/services/search-term-discovery";
import type { SearchMetadata } from "@/app/domain/research-route-payload";

const DEFAULT_FIXTURE = "scripts/evals/fixtures/slide-accessibility-search-sample.json";

// 사용자가 기대한 method/contribution 아이디어 가족. 각 가족은 동의 토큰 집합이고,
// 후보 term이 한 가족의 토큰을 충분히 담으면 그 가족이 "등장"한 것으로 본다.
const EXPECTED_FAMILIES: { name: string; anyOf: string[][] }[] = [
  { name: "highlighting / visualization", anyOf: [["highlight"], ["visualization"], ["visual"]] },
  { name: "multi-touch / touch interaction", anyOf: [["touch"], ["multi", "touch"], ["gesture"]] },
  {
    name: "non-visual / blind access",
    anyOf: [["non", "visual"], ["blind"], ["screen", "reader"]],
  },
  {
    name: "structure / temporal extraction",
    anyOf: [["structure"], ["temporal"], ["caption"], ["extraction"]],
  },
];

const MIN_FAMILIES_PRESENT = 2;
const MIN_MULTI_WORD_RATIO = 0.5;

interface SearchSampleFixture {
  query: string;
  papers: { paperId: string; title: string; abstract: string; year: number | null }[];
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function familyPresent(termTokenSets: string[][], anyOf: string[][]): boolean {
  return anyOf.some((required) =>
    termTokenSets.some((tokens) => required.every((token) => tokens.includes(token))),
  );
}

async function main(): Promise<number> {
  if (!hasGeminiApiKey()) {
    process.stderr.write(
      "search-term-discovery-eval — SKIP: no Gemini API key (set GEMINI_API_KEY to run)\n",
    );
    return 0;
  }

  const fixturePath = process.argv[2] ?? DEFAULT_FIXTURE;
  const fixture = JSON.parse(
    fs.readFileSync(path.resolve(fixturePath), "utf8"),
  ) as SearchSampleFixture;

  const papers = fixture.papers.map((paper) => ({
    paperId: paper.paperId,
    title: paper.title,
    abstract: paper.abstract,
    year: paper.year ?? undefined,
    citationCount: 0,
    authors: [],
  })) as unknown as SearchMetadata["papers"];

  const extraction = await buildEnglishTermCandidatesWithLLM({
    query: fixture.query,
    papers,
  });

  const terms = extraction.candidates.map((candidate) => candidate.term);
  const termTokenSets = terms.map(tokenize);

  process.stdout.write(`query: ${fixture.query}\n`);
  process.stdout.write(`source: ${extraction.source}\n`);
  process.stdout.write(`candidates (${String(terms.length)}): ${terms.join(", ") || "(none)"}\n\n`);

  const failures: string[] = [];

  const presentFamilies = EXPECTED_FAMILIES.filter((family) =>
    familyPresent(termTokenSets, family.anyOf),
  );
  process.stdout.write(
    `expected families present (${String(presentFamilies.length)}/${String(EXPECTED_FAMILIES.length)}): ${
      presentFamilies.map((family) => family.name).join(", ") || "(none)"
    }\n`,
  );
  if (presentFamilies.length < MIN_FAMILIES_PRESENT) {
    failures.push(
      `only ${String(presentFamilies.length)} expected method/contribution families present; need >= ${String(MIN_FAMILIES_PRESENT)}`,
    );
  }

  const multiWordCount = termTokenSets.filter((tokens) => tokens.length >= 2).length;
  const multiWordRatio = terms.length > 0 ? multiWordCount / terms.length : 0;
  process.stdout.write(
    `multi-word candidate ratio: ${multiWordRatio.toFixed(2)} (${String(multiWordCount)}/${String(terms.length)})\n`,
  );
  if (terms.length > 0 && multiWordRatio < MIN_MULTI_WORD_RATIO) {
    failures.push(
      `multi-word ratio ${multiWordRatio.toFixed(2)} below ${String(MIN_MULTI_WORD_RATIO)}; candidates look like single repeated words`,
    );
  }

  if (failures.length > 0) {
    process.stderr.write(`\nsearch-term-discovery-eval — FAIL\n`);
    for (const failure of failures) {
      process.stderr.write(`  - ${failure}\n`);
    }
    return 1;
  }

  process.stdout.write(`\nsearch-term-discovery-eval — PASS\n`);
  return 0;
}

void main().then((code) => {
  process.exit(code);
});
