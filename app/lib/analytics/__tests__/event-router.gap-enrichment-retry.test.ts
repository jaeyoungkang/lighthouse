import { describe, expect, it, vi } from "vitest";

import type {
  AnalyticsEventStore,
  AnalyticsSink,
  CanonicalEvent,
} from "@/app/lib/analytics/canonical-event";
import { loadEventContract } from "@/app/server/services/analytics/event-contract";
import { createAnalyticsEventRouter } from "@/app/server/services/analytics/event-router";

function createStore(): AnalyticsEventStore & { events: CanonicalEvent[] } {
  const events: CanonicalEvent[] = [];
  return {
    events,
    insert(event: CanonicalEvent) {
      events.push(event);
      return Promise.resolve();
    },
  };
}

describe("analytics event router with explicit gap enrichment retry", () => {
  it("accepts only the bounded report identity and retry ordinal for external sinks", async () => {
    const store = createStore();
    const sinkCapture = vi.fn<AnalyticsSink["capture"]>().mockResolvedValue(undefined);
    const router = createAnalyticsEventRouter({
      contract: loadEventContract(process.cwd()),
      store,
      sinks: [{ name: "amplitude", capture: sinkCapture }],
    });

    const result = await router.trackCanonicalEvent("gap_analysis_retry_clicked", {
      actor: { type: "user", id: "user-1" },
      subject: { gap_report_id: "gap-1" },
      properties: { gap_report_id: "gap-1", retry_count: 1 },
    });

    expect(result.ok).toBe(true);
    expect(store.events).toHaveLength(1);
    expect(sinkCapture).toHaveBeenCalledOnce();
    expect(sinkCapture).toHaveBeenCalledWith(
      "gap_analysis_retry_clicked",
      expect.any(Object),
      expect.objectContaining({
        event_name: "gap_analysis_retry_clicked",
        gap_report_id: "gap-1",
        retry_count: 1,
      }),
    );
    const externalPayload = sinkCapture.mock.calls[0]?.[2];
    expect(externalPayload).not.toHaveProperty("query");
    expect(externalPayload).not.toHaveProperty("prompt");
    expect(externalPayload).not.toHaveProperty("output");
  });

  it("rejects mismatched identity and content-bearing or undeclared properties", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({
      contract: loadEventContract(process.cwd()),
      store,
    });

    const mismatched = await router.trackCanonicalEvent("gap_analysis_retry_clicked", {
      actor: { type: "user" },
      subject: { gap_report_id: "gap-1" },
      properties: { gap_report_id: "gap-2", retry_count: 1 },
    });
    expect(mismatched.ok).toBe(false);

    for (const property of ["query", "prompt", "output", "extra"]) {
      const rejected = await router.trackCanonicalEvent("gap_analysis_retry_clicked", {
        actor: { type: "user" },
        subject: { gap_report_id: "gap-1" },
        properties: { gap_report_id: "gap-1", retry_count: 1, [property]: "private" },
      });
      expect(rejected.ok).toBe(false);
    }
    expect(store.events).toHaveLength(0);
  });

  it("contains sink failure without changing the accepted command event", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({
      contract: loadEventContract(process.cwd()),
      store,
      sinks: [
        {
          name: "amplitude",
          capture: vi.fn<AnalyticsSink["capture"]>().mockRejectedValue(new Error("sink failed")),
        },
      ],
    });

    const result = await router.trackCanonicalEvent("gap_analysis_retry_clicked", {
      actor: { type: "user" },
      subject: { gap_report_id: "gap-1" },
      properties: { gap_report_id: "gap-1", retry_count: 1 },
    });

    expect(result.ok).toBe(true);
    expect(result.sinkErrors).toHaveLength(1);
    expect(store.events).toHaveLength(1);
  });
});
