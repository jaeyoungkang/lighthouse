/** 논문 핵심 필드. 모든 논문 관련 타입의 기반. */
export interface PaperCore {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  /** Publication venue / journal / conference name when the provider supplies it. */
  venue?: string | null;
  /** Broad academic fields when the provider supplies them. */
  fieldsOfStudy?: string[] | null;
  citationCount: number;
  url: string;
  authors: { authorId?: string; name: string }[];
  openAccessPdf?: { url: string; status?: string | null } | null;
  openAccess?: {
    isOpenAccess: boolean;
    pdfUrl?: string | null;
    landingUrl?: string | null;
    source?: string | null;
    pdfUrlSource?: string | null;
    license?: string | null;
    reason?: string | null;
  } | null;
  source?: PaperSourceMetadata | null;
  /** DOI — PDF URL이 없을 때 출판사 페이지에서 PDF를 탐색하는 데 사용 */
  doi?: string | null;
  /** Semantic Scholar externalIds (ArXiv, PubMedCentral 등) — PDF fallback 소스 */
  externalIds?: Record<string, string | number | null> | null;
  /** 현재 논문이 reference로 지목한 paperId 목록 */
  referenceIds?: string[] | null;
  /** Provider가 보고한 총 reference 개수. 목록이 제한되어도 count와 availability를 분리해 표시한다. */
  referenceCount?: number | null;
  /** 현재 논문을 citation으로 지목한 paperId 목록 */
  citationIds?: string[] | null;
  referenceAvailability?: CitationListAvailability | null;
  citationAvailability?: CitationListAvailability | null;
}

export interface CitationListAvailability {
  available: boolean;
  truncated: boolean;
  total?: number | null;
  returned?: number | null;
  reason?: string | null;
}

export interface PaperSourceMetadata {
  provider?: string;
  baseCorpus?: string;
  sourceFlags?: number | string | string[] | null;
  freshnessMode?: "unknown" | "configured" | "exact";
  limits?: string[];
  /** Episteme 3 canonical provider-neutral paper identity. */
  canonicalPaperId?: string;
  generation?: string;
}
