import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthSessionTouch,
  __resetAuthSessionTouchForTests,
} from "@/app/components/AuthSessionTouch";
import { API_ROUTES } from "@/app/lib/api-routes";

let root: Root | null = null;
let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>
>;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

describe("AuthSessionTouch", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    __resetAuthSessionTouchForTests();
    fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(1_770_000_000_000);
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = "";
    window.localStorage.clear();
    __resetAuthSessionTouchForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("touches the authenticated session once when no recent touch exists", async () => {
    await renderTouch();

    expect(fetchMock).toHaveBeenCalledWith(API_ROUTES.AUTH_SESSION_TOUCH, {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    });
    expect(window.localStorage.getItem("lighthouse-auth-session-touch-at")).toBe("1770000000000");
  });

  it("skips the touch route when a recent browser touch exists", async () => {
    window.localStorage.setItem("lighthouse-auth-session-touch-at", "1769999999000");

    await renderTouch();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("touches again at the exact fifteen-minute boundary", async () => {
    window.localStorage.setItem("lighthouse-auth-session-touch-at", "1769999100000");

    await renderTouch();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not let malformed browser storage suppress a required touch", async () => {
    window.localStorage.setItem("lighthouse-auth-session-touch-at", "not-a-timestamp");

    await renderTouch();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the same-tab interval when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    await renderTouch();
    unmountTouch();
    await renderTouch();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

async function renderTouch(): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<AuthSessionTouch />);
    await Promise.resolve();
  });
}

function unmountTouch(): void {
  act(() => {
    root?.unmount();
  });
  root = null;
}
