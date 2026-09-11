import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AgentPanel } from "@/app/components/research/AgentPanel";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

type AgentPanelTestHarnessOptions = {
  attachToDocument?: boolean;
};

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function resetAgentPanelStores() {
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useReactionActionStore.getState().unregisterSendMessage();
  useBackgroundTaskStore.setState({
    inlineAnalysisTasks: {},
  });
}

export function createAgentPanelTestHarness({
  attachToDocument = false,
}: AgentPanelTestHarnessOptions = {}) {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let previousActEnvironment: boolean | undefined;

  function setup() {
    previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    resetAgentPanelStores();
  }

  function renderAgentPanel(
    documentId: string,
    isLoading = false,
    inlineBodyAppendSlot?: ReactNode,
  ) {
    if (container === null) {
      container = document.createElement("div");
      if (attachToDocument) document.body.appendChild(container);
      root = createRoot(container);
    }

    act(() => {
      root?.render(
        <AgentPanel
          documentId={documentId}
          isLoading={isLoading}
          inlineBodyAppendSlot={inlineBodyAppendSlot}
        />,
      );
    });

    return container;
  }

  function cleanup() {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
    resetAgentPanelStores();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }

  return {
    cleanup,
    renderAgentPanel,
    setup,
  };
}
