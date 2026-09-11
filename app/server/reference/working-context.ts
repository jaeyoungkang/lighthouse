/**
 * WorkingContext — 세션별 인메모리 작업 맥락.
 * 세션 수명의 중간 버퍼. 세션 종료 시 의미 있는 것은 메모리로, 나머지는 소멸.
 */

import type { WorkingContextEntry } from "@/app/domain/working-context";

const DEFAULT_ENTRY_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES_PER_SESSION = 50;

interface SessionContext {
  entries: WorkingContextEntry[];
  touchedAt: number;
}

const sessionContexts = new Map<string, SessionContext>();

function pruneExpiredSessions(now: number): void {
  for (const [sessionId, context] of sessionContexts) {
    if (now - context.touchedAt >= SESSION_TTL_MS) {
      sessionContexts.delete(sessionId);
    }
  }
}

function pruneExpiredEntries(entries: WorkingContextEntry[], now: number): WorkingContextEntry[] {
  return entries.filter((entry) => {
    const ttl = entry.ttl ?? DEFAULT_ENTRY_TTL_MS;
    return now - entry.addedAt.getTime() < ttl;
  });
}

/** 세션의 working context에 항목을 추가한다. */
export function addEntry(sessionId: string, entry: WorkingContextEntry): void {
  const now = Date.now();
  pruneExpiredSessions(now);

  const existing = sessionContexts.get(sessionId);
  const entries = pruneExpiredEntries(existing?.entries ?? [], now);
  const deduped = entries.filter((item) => !(item.id === entry.id && item.kind === entry.kind));
  deduped.push({
    ...entry,
    ttl: entry.ttl ?? DEFAULT_ENTRY_TTL_MS,
  });

  sessionContexts.set(sessionId, {
    entries: deduped.slice(-MAX_ENTRIES_PER_SESSION),
    touchedAt: now,
  });
}

/** 세션의 working context 항목을 조회한다. TTL이 지난 항목은 제외. */
export function getEntries(sessionId: string): WorkingContextEntry[] {
  const now = Date.now();
  pruneExpiredSessions(now);

  const existing = sessionContexts.get(sessionId);
  if (!existing) return [];

  const entries = pruneExpiredEntries(existing.entries, now);
  sessionContexts.set(sessionId, {
    entries,
    touchedAt: now,
  });
  return entries;
}

/** 세션의 working context를 초기화한다. */
export function clear(sessionId: string): void {
  sessionContexts.delete(sessionId);
}
