import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EmailGate } from "@/app/components/EmailGate";

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

describe("EmailGate", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("keeps Moonlight source coverage visible on the auth surface", () => {
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(<EmailGate />);
    });

    expect(container.querySelector('[data-testid="email-gate-source-coverage"]')?.textContent).toBe(
      "PubMed·arXiv·IEEE·Crossref 등 주요 학술 출처의 논문 2억 편 이상을 담은 Moonlight 논문 DB에서 찾습니다.",
    );
  });
});
