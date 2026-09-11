import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiContentFeedback } from "@/app/components/ai-content-feedback";

let root: Root | null = null;

const target = {
  documentId: "search-1",
  documentType: "search",
  surfaceId: "reaction-feedback-1",
  surfaceKind: "reaction_card",
  promiseRef: "promise:search-reaction-summarizes-terrain",
  outputSnapshot: {
    title: "검색 요약",
    body: "결과 묶음의 지형을 정리했다.",
    timestamp: "2026-04-09T00:00:00.000Z",
  },
};

function renderFeedback() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<AiContentFeedback target={target} />);
  });

  return container;
}

describe("AiContentFeedback", () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.innerHTML = "";
    window.localStorage.clear();
    root = null;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("makes the submitted value visible and visually selected", () => {
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => false),
    });
    const container = renderFeedback();
    const helpful = container.querySelector<HTMLButtonElement>(
      '[data-testid="ai-content-feedback-helpful"]',
    );

    expect(helpful).not.toBeNull();

    act(() => {
      helpful?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const helpfulIcon = container.querySelector('[data-testid="ai-content-feedback-helpful-icon"]');

    expect(helpful?.getAttribute("aria-pressed")).toBe("true");
    expect(helpful?.className).not.toContain("bg-accent");
    expect(helpful?.className).toContain("border-accent-strong");
    expect(helpfulIcon?.getAttribute("fill")).toBe("currentColor");
    expect(container.textContent).toContain("도움 됨으로 저장됨");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("restores the selected value when the same output surface remounts", () => {
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => false),
    });
    const container = renderFeedback();
    const notHelpful = container.querySelector<HTMLButtonElement>(
      '[data-testid="ai-content-feedback-not-helpful"]',
    );

    act(() => {
      notHelpful?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    act(() => {
      root?.unmount();
    });
    container.remove();
    root = null;

    const remountedContainer = renderFeedback();
    const restoredNotHelpful = remountedContainer.querySelector<HTMLButtonElement>(
      '[data-testid="ai-content-feedback-not-helpful"]',
    );
    const restoredNotHelpfulIcon = remountedContainer.querySelector(
      '[data-testid="ai-content-feedback-not-helpful-icon"]',
    );

    expect(restoredNotHelpful?.getAttribute("aria-pressed")).toBe("true");
    expect(restoredNotHelpful?.className).not.toContain("bg-accent");
    expect(restoredNotHelpfulIcon?.getAttribute("fill")).toBe("currentColor");
    expect(remountedContainer.textContent).toContain("도움 안 됨으로 저장됨");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
