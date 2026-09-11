// ============================================================
// WorkingContext — 세션 수명의 작업 맥락.
// 장기 기억도 아니고 영구 참조도 아닌 중간 버퍼.
// 실시간 행동 인지와 기억화의 중간층.
// ============================================================

import type { ReferenceRef } from "./reference";

/** working context 개별 항목 */
export interface WorkingContextEntry {
  id: string;
  kind: string; // "search_result" | "inspection" | "behavior_summary" | ...
  title: string;
  summary: string;
  referenceRefs: ReferenceRef[];
  addedAt: Date;
  ttl?: number; // 세션 내 유효 기간 (ms)
}

/** 세션의 working context 전체 */
export interface WorkingContext {
  sessionId: string;
  entries: WorkingContextEntry[];
}
