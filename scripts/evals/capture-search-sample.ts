// 연구 용어 추출 재현 평가용 검색 표본 캡처.
// 실제 Episteme literature API로 검색을 한 번 돌려 loaded result 표본을
// fixture JSON으로 저장한다. 평가 자체는 search-term-discovery-eval.ts가 수행한다.
//
// Usage: npx tsx scripts/evals/capture-search-sample.ts "slide accessibility" \
//          scripts/evals/fixtures/slide-accessibility-search-sample.json

import fs from "node:fs";
import path from "node:path";
import { fetchEpistemeSearchWindow } from "@/app/server/services/episteme-literature";

const SAMPLE_LIMIT = 40;

async function main(): Promise<number> {
  const query = process.argv[2];
  const outPath = process.argv[3];
  if (!query || !outPath) {
    process.stderr.write(
      'usage: tsx scripts/evals/capture-search-sample.ts "<query>" <fixture-path>\n',
    );
    return 1;
  }

  const window = await fetchEpistemeSearchWindow({ query, limit: SAMPLE_LIMIT });
  if (window.papers.length === 0) {
    process.stderr.write(`no results for query: ${query}\n`);
    return 1;
  }

  const fixture = {
    query,
    capturedAt: new Date().toISOString(),
    provider: "episteme-literature",
    papers: window.papers.map((paper) => ({
      paperId: paper.paperId,
      title: paper.title,
      abstract: paper.abstract ?? "",
      year: paper.year ?? null,
      citationCount: paper.citationCount,
    })),
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`);
  process.stdout.write(`captured ${String(fixture.papers.length)} papers → ${outPath}\n`);
  return 0;
}

void main().then((code) => {
  process.exit(code);
});
