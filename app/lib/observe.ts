import type { NextRequest, NextResponse } from "next/server";
import { emitStructuredObservation } from "@/app/lib/runtime-log";

// ---------------------------------------------------------------------------
// Types — 플랫 모델
// ---------------------------------------------------------------------------

export interface ObservationEntry {
  timestamp: string;
  category: "ai-call" | "api" | "orchestration" | "workflow" | "business";
  action: string;
  status: "start" | "success" | "fail" | "skip";
  duration?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 단일 출구 — console.log 전용 (인메모리 버퍼 제거됨, DB 영속화로 이관)
// ---------------------------------------------------------------------------

const isServer = typeof window === "undefined";
const isEvidenceLedgerRun = typeof process !== "undefined" && process.env.EVIDENCE_LEDGER === "1";

export function observe(entry: ObservationEntry): void {
  if (isServer) {
    if (isEvidenceLedgerRun) return;
    if (entry.category === "orchestration") return;
    try {
      emitStructuredObservation(entry);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// AI 호출 래퍼 (duration 자동 측정, 성공/실패 자동 기록)
// ---------------------------------------------------------------------------

export async function withAIObservation<T>(
  action: string,
  metadata: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  observe({
    timestamp: new Date().toISOString(),
    category: "ai-call",
    action,
    status: "start",
    metadata,
  });

  try {
    const result = await fn();
    observe({
      timestamp: new Date().toISOString(),
      category: "ai-call",
      action,
      status: "success",
      duration: Date.now() - start,
      metadata,
    });
    return result;
  } catch (error) {
    observe({
      timestamp: new Date().toISOString(),
      category: "ai-call",
      action,
      status: "fail",
      duration: Date.now() - start,
      metadata: { ...metadata, error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// API 라우트 래퍼
// ---------------------------------------------------------------------------

type NextHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse>;

export function withAPIObservation(route: string, handler: NextHandler): NextHandler {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse> => {
    const start = Date.now();
    observe({
      timestamp: new Date().toISOString(),
      category: "api",
      action: route,
      status: "start",
      metadata: { method: req.method },
    });

    try {
      const response = await handler(req, ctx);
      observe({
        timestamp: new Date().toISOString(),
        category: "api",
        action: route,
        status: "success",
        duration: Date.now() - start,
        metadata: { method: req.method, statusCode: response.status },
      });
      return response;
    } catch (error) {
      observe({
        timestamp: new Date().toISOString(),
        category: "api",
        action: route,
        status: "fail",
        duration: Date.now() - start,
        metadata: {
          method: req.method,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  };
}
