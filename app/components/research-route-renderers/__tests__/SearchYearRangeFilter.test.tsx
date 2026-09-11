import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchYearRangeFilter } from "@/app/components/research-route-renderers/SearchYearRangeFilter";

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  const setter = descriptor?.set?.bind(input);
  if (!setter) {
    throw new Error("react input value setter is unavailable");
  }
  setter(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SearchYearRangeFilter", () => {
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

  it("invokes onChange while user types and only fires onSubmit on Enter", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(
        <SearchYearRangeFilter
          value={{ from: "", to: "" }}
          isSearching={false}
          onChange={onChange}
          onSubmit={onSubmit}
        />,
      );
    });

    const fromInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="출판연도 시작"]',
    );
    const toInput = container.querySelector<HTMLInputElement>('input[aria-label="출판연도 끝"]');
    if (!fromInput || !toInput) {
      throw new Error("expected from/to inputs");
    }

    act(() => {
      setInputValue(fromInput, "1990");
    });
    expect(onChange).toHaveBeenLastCalledWith({ from: "1990", to: "" });
    expect(onSubmit).not.toHaveBeenCalled();

    act(() => {
      toInput.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables the inputs while a search is in flight", () => {
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(
        <SearchYearRangeFilter
          value={{ from: "", to: "" }}
          isSearching
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
    });

    const fromInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="출판연도 시작"]',
    );
    const toInput = container.querySelector<HTMLInputElement>('input[aria-label="출판연도 끝"]');
    expect(fromInput?.disabled).toBe(true);
    expect(toInput?.disabled).toBe(true);
  });
});
