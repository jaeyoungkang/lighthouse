// ============================================================
// Reference — 참조 데이터 인터페이스.
// 작업 맥락과 관측 이벤트가 참조하는 외부 데이터의 출처 추적.
// ============================================================

/** 출처 추적 — 어떤 데이터의 어느 부분을 보고 판단했는가 */
export interface ReferenceRef {
  source: string; // "lighthouse" | "moonlight"
  kind: string; // "paper" | "document" | "collection"
  id: string; // 원본 레코드 ID
  locator?: string; // 세부 위치 (page, section, chunk 등)
  accessedAt: Date; // 참조 시점
}

/** 참조 데이터 후보. 현재 참조 후보는 출처 추적 데이터만 보관하고 embedding은 갖지 않는다. */
export interface ReferenceDatum {
  id: string;
  source: string; // "lighthouse" | "moonlight"
  kind: string; // "paper" | "document" | "collection" | "behavior" | ...
  title: string;
  summary: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/** 참조 데이터 후보를 좁힐 때 쓰는 비벡터 필터. */
export interface ReferenceFilter {
  kinds?: string[];
  since?: Date;
  limit?: number;
}
