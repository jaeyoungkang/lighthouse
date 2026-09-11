import { describe, expect, it } from "vitest";

import type { AnalyticsEventStore, CanonicalEvent } from "@/app/lib/analytics/canonical-event";
import { createAnalyticsEventRouter } from "@/app/server/services/analytics/event-router";
import { loadEventContract } from "@/app/server/services/analytics/event-contract";

function createStore(): AnalyticsEventStore & { events: CanonicalEvent[] } {
  const events: CanonicalEvent[] = [];
  return {
    events,
    insert(event) {
      events.push(event);
      return Promise.resolve();
    },
  };
}

describe("AI comment expansion event contract", () => {
  it("accepts route and generated-comment identity without generated prose", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({
      contract: loadEventContract(process.cwd()),
      store,
    });

    const result = await router.trackCanonicalEvent("product.ai_comment_card_expand.clicked", {
      actor: { type: "user", id: "researcher@example.com" },
      subject: {
        ownerPrincipalId: "principal-1",
        documentId: "search-1",
      },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "search-1",
        reactionKey: "search-1:block-1:2026-07-16",
      },
    });

    expect(result.ok).toBe(true);
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      name: "product.ai_comment_card_expand.clicked",
      storyRefs: {
        promiseRef: "promise:route-view-ai-comment-inline-surface",
        aspectRefs: ["aspect:progressive-content-spatial-stability"],
      },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "search-1",
        reactionKey: "search-1:block-1:2026-07-16",
      },
    });
  });

  it("rejects generated AI comment prose", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({
      contract: loadEventContract(process.cwd()),
      store,
    });

    const result = await router.trackCanonicalEvent("product.ai_comment_card_expand.clicked", {
      actor: { type: "user", id: "researcher@example.com" },
      subject: {
        ownerPrincipalId: "principal-1",
        documentId: "search-1",
      },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "search-1",
        reactionKey: "search-1:block-1:2026-07-16",
        body: "raw generated comment",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe(
      'product.ai_comment_card_expand.clicked: property "body" is not declared in contract',
    );
    expect(store.events).toHaveLength(0);
  });
});
