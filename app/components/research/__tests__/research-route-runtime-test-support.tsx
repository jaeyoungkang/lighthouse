import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";
import { ResearchRouteRuntime } from "@/app/components/research/ResearchRouteRuntime";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

type InitialView = ComponentProps<typeof ResearchRouteRuntime>["initialView"];

function resetRuntimeStores() {
  useReactionActionStore.getState().unregisterSendMessage();
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
}

export function createResearchRouteRuntimeTestHarness() {
  let root: Root | null = null;

  function render(initialView: InitialView, runtimeId: string) {
    root?.render(
      <ResearchRouteRuntime
        renderViewBody={() => null}
        runtimeId={runtimeId}
        initialView={initialView}
      />,
    );
  }

  function setup() {
    vi.useFakeTimers();
    resetRuntimeStores();
  }

  function mount(initialView: InitialView, runtimeId = "principal-1") {
    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      render(initialView, runtimeId);
    });
  }

  async function mountAndFlush(initialView: InitialView, runtimeId = "principal-1") {
    const container = document.createElement("div");
    root = createRoot(container);
    await act(async () => {
      render(initialView, runtimeId);
      await Promise.resolve();
    });
  }

  function rerender(initialView: InitialView, runtimeId = "principal-1") {
    if (root === null) throw new Error("ResearchRouteRuntime test harness is not mounted");
    act(() => {
      render(initialView, runtimeId);
    });
  }

  function cleanup() {
    act(() => {
      root?.unmount();
    });
    root = null;
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetRuntimeStores();
  }

  return {
    cleanup,
    mount,
    mountAndFlush,
    rerender,
    setup,
  };
}
