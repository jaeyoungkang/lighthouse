import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FollowupPendingView } from "@/app/components/research-route-renderers/followup-pending-view";

let root: Root | null = null;

describe("FollowupPendingView", () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
  });

  it("renders the pending AI comment frame while the relationship ResearchRoutePayload is being created", () => {
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(
        <FollowupPendingView
          seedTitle="Seed paper"
          failed={false}
          onRetry={vi.fn()}
          loadingLabel="인용 관계를 준비하고 있습니다."
          retryLabel="다시 시도"
          reactionSlot={
            <div data-testid="research-route-inline-reaction">
              <div data-testid="agent-panel-inline-pending" role="status" data-state="loading" />
            </div>
          }
        />,
      );
    });

    expect(
      container.querySelector('[data-testid="relationship-view-ai-comment-frame"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="agent-panel-inline-pending"]')).not.toBeNull();
    expect(container.querySelector('[role="status"][data-state="loading"]')).not.toBeNull();
  });
});
