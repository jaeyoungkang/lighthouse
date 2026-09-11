import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

type AboutPageFactory = () => ReactNode;

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

export function createAboutPageRenderHarness(pageFactory: AboutPageFactory) {
  let root: Root | null = null;
  const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

  return {
    setup: () => {
      reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    },
    renderPage: () => {
      const container = document.createElement("div");
      root = createRoot(container);
      act(() => {
        root?.render(pageFactory());
      });
      return container;
    },
    cleanup: () => {
      act(() => {
        root?.unmount();
      });
      root = null;
      reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    },
  };
}
