/**
 * 검색 결과 패널 문서 빌더.
 * search-service에서 사용한다.
 */

import { SEARCH_RESULTS_CONTENT_PREVIEW_LIMIT } from "@/app/lib/constants";
import { t } from "@/app/i18n/message-access";

export interface SearchResultsDoc {
  documentId: string;
  title: string;
  content: string;
}

interface PaperSummary {
  paperId: string;
  title: string;
  authors: string[];
  year: number | null;
  citationCount: number;
  url: string;
}

/**
 * 검색 결과 패널에 표시할 마크다운 요약을 생성한다.
 *
 * @param papers   표시할 논문 목록
 * @param sourceLabel  문서 제목에 들어갈 출처 라벨 (예: 검색어, 논문 제목)
 * @param prefix   documentId 접두사 (예: "search", "snowball")
 */
export function buildSearchResultsView(
  papers: PaperSummary[],
  sourceLabel: string,
  prefix: string,
): SearchResultsDoc {
  const documentId = `${prefix}-${String(Date.now())}`;
  const today = new Date().toISOString().slice(0, 10);
  const title = t("search.label.search-results-view", { sourceLabel, count: papers.length });
  const papersJson = JSON.stringify(
    papers
      .slice(0, SEARCH_RESULTS_CONTENT_PREVIEW_LIMIT)
      .map(({ paperId, title, authors, year, citationCount, url }) => ({
        paperId,
        title,
        authors,
        year,
        citationCount,
        url,
      })),
    null,
    2,
  );
  const content = t("search.label.search-results-view.2", { title, today, papersJson });
  return { documentId, title, content };
}
