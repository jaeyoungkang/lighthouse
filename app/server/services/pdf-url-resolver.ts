/**
 * PDF URL 해석 — literature metadata의 여러 필드에서 PDF URL을 추출한다.
 *
 * 동기 해석 우선순위 (resolvePdfUrl):
 *  1. openAccessPdf.url  (직접 제공된 URL)
 *  2. externalIds.ArXiv   → https://arxiv.org/pdf/{id}
 *  3. externalIds.ACL     → https://aclanthology.org/{id}.pdf
 *  4. disclaimer 내 ArXiv abs URL → PDF URL 변환
 */

type OpenAccessPdf =
  | { url: string; disclaimer?: string | null; status?: string | null }
  | null
  | undefined;

type ExternalIds = Record<string, string | number | null> | null | undefined;

/**
 * Literature metadata에서 PDF URL을 동기적으로 해석한다.
 * 검색·inspect 경로 모두에서 사용.
 */
export function resolvePdfUrl(
  openAccessPdf: OpenAccessPdf,
  externalIds: ExternalIds,
): string | null {
  // 1. 직접 제공된 URL (비어있지 않은 경우)
  if (openAccessPdf?.url) return openAccessPdf.url;

  // 2. externalIds.ArXiv → PDF URL
  const arxivId = externalIds?.ArXiv;
  if (arxivId) return `https://arxiv.org/pdf/${String(arxivId)}`;

  // 3. externalIds.ACL → ACL Anthology PDF URL
  const aclId = externalIds?.ACL;
  if (aclId) {
    const normalizedAclId = normalizeAclAnthologyId(String(aclId));
    if (normalizedAclId) return `https://aclanthology.org/${normalizedAclId}.pdf`;
  }

  // 4. disclaimer 내 ArXiv abs URL → PDF URL
  if (openAccessPdf?.disclaimer) {
    const m = openAccessPdf.disclaimer.match(/arxiv\.org\/abs\/([\d.]+)/i);
    if (m) return `https://arxiv.org/pdf/${m[1]}`;
  }

  return null;
}

function normalizeAclAnthologyId(value: string): string | null {
  const trimmed = value.trim().replace(/\.pdf$/i, "");
  if (!trimmed || /[:/]/.test(trimmed)) return null;
  if (!/^[A-Za-z0-9.-]+$/.test(trimmed)) return null;
  return trimmed;
}
