import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MoonlightAuthBootstrap,
  resolveConfiguredLocalMoonlightOriginForLocation,
  resolveMoonlightOriginForLocation,
} from "@/app/components/MoonlightAuthBootstrap";

const navigationMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: navigationMocks.refresh,
  }),
}));

vi.mock("@/app/components/EmailGate", () => ({
  EmailGate: () => <div data-testid="fallback" />,
}));

let root: Root | null = null;
let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>
>;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

describe("MoonlightAuthBootstrap", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL", "");
    navigationMocks.refresh.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = "";
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("creates a Light House session from the Moonlight Scholar token", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ token: "moonlight-token-1" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await renderBootstrap();
    await flushEffects();

    const [firstInput, firstInit] = fetchMock.mock.calls[0];
    const [secondInput, secondInit] = fetchMock.mock.calls[1];

    expect(firstInput).toBe("http://localhost:3000/api/auth/moonlight-scholar-token");
    expect(firstInit?.method).toBe("POST");
    expect(firstInit?.credentials).toBe("include");
    expect(firstInit?.signal).toBeInstanceOf(AbortSignal);
    expect(secondInput).toBe("/api/auth/moonlight-scholar/session");
    expect(secondInit?.method).toBe("POST");
    expect(secondInit?.headers).toEqual({ "content-type": "application/json" });
    expect(secondInit?.body).toBe(JSON.stringify({ token: "moonlight-token-1" }));
    expect(secondInit?.signal).toBeInstanceOf(AbortSignal);
    expect(navigationMocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("falls back to the legacy email gate when Moonlight Scholar token bootstrap fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));

    const container = await renderBootstrap();
    await flushEffects();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [cleanupInput, cleanupInit] = fetchMock.mock.calls[1];
    expect(cleanupInput).toBe("/api/auth/moonlight-scholar/session");
    expect(cleanupInit?.method).toBe("DELETE");
    expect(cleanupInit?.signal).toBeInstanceOf(AbortSignal);
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
  });

  it("shows the Scholar allowlist notice when Moonlight Scholar token issuance is denied", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));

    const container = await renderBootstrap();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="fallback"]')).toBeNull();
    const notice = container.querySelector(
      '[data-testid="moonlight-auth-bootstrap-access-notice"]',
    );
    expect(notice?.getAttribute("role")).toBe("note");
    expect(notice?.textContent).toContain("Scholar allowlist");
  });

  it("falls back when the Moonlight Scholar token request stalls", async () => {
    vi.useFakeTimers();
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));

    const container = await renderBootstrap();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).toContain("Moonlight Search session is being verified.");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
  });

  it("falls back immediately in production when Moonlight origin is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const container = await renderBootstrap();
    await flushEffects();
    await flushEffects();

    const [cleanupInput, cleanupInit] = fetchMock.mock.calls[0];
    expect(cleanupInput).toBe("/api/auth/moonlight-scholar/session");
    expect(cleanupInit?.method).toBe("DELETE");
    expect(cleanupInit?.signal).toBeInstanceOf(AbortSignal);
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
  });

  it("cancels stale-session cleanup when the auth surface unmounts", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockReturnValueOnce(new Promise<Response>(() => {}));

    await renderBootstrap();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const cleanupSignal = fetchMock.mock.calls[1][1]?.signal;
    expect(cleanupSignal).toBeInstanceOf(AbortSignal);
    expect(cleanupSignal?.aborted).toBe(false);

    act(() => {
      root?.unmount();
    });
    root = null;

    expect(cleanupSignal?.aborted).toBe(true);
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
  });

  it("aborts stalled stale-session cleanup before showing the fallback", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockReturnValueOnce(new Promise<Response>(() => {}));

    const container = await renderBootstrap();
    await flushEffects();

    const cleanupSignal = fetchMock.mock.calls[1][1]?.signal;
    expect(cleanupSignal?.aborted).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flushEffects();

    expect(cleanupSignal?.aborted).toBe(true);
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
  });

  it("uses the current local browser host when defaulting the Moonlight origin", () => {
    expect(
      resolveMoonlightOriginForLocation({
        protocol: "http:",
        hostname: "127.0.0.1",
      }),
    ).toBe("http://127.0.0.1:3000");
    expect(
      resolveMoonlightOriginForLocation({
        protocol: "http:",
        hostname: "localhost",
      }),
    ).toBe("http://localhost:3000");
    expect(
      resolveMoonlightOriginForLocation({
        protocol: "http:",
        hostname: "[::1]",
      }),
    ).toBe("http://[::1]:3000");
    expect(
      resolveMoonlightOriginForLocation({
        protocol: "http:",
        hostname: "moonlight.local",
      }),
    ).toBeNull();
  });

  it("normalizes a configured local Moonlight origin to the current browser host", () => {
    expect(
      resolveConfiguredLocalMoonlightOriginForLocation("http://localhost:3000", {
        protocol: "http:",
        hostname: "127.0.0.1",
      }),
    ).toBe("http://127.0.0.1:3000");
    expect(
      resolveConfiguredLocalMoonlightOriginForLocation("http://127.0.0.1:4000", {
        protocol: "http:",
        hostname: "localhost",
      }),
    ).toBe("http://localhost:4000");
    expect(
      resolveConfiguredLocalMoonlightOriginForLocation("https://api.themoonlight.io", {
        protocol: "http:",
        hostname: "127.0.0.1",
      }),
    ).toBeNull();
    expect(
      resolveConfiguredLocalMoonlightOriginForLocation("http://localhost:3000", {
        protocol: "http:",
        hostname: "moonlight.local",
      }),
    ).toBeNull();
  });
});

async function renderBootstrap(
  onSessionNavigation: () => void = navigationMocks.refresh,
): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <MoonlightAuthBootstrap fallback="email-gate" onSessionNavigation={onSessionNavigation} />,
    );
    await Promise.resolve();
  });

  return container;
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}
