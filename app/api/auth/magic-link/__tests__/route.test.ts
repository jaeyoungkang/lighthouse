import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRouteIngressAdmissionForTests } from "@/app/server/operational/route-ingress-admission";

const createClientMock = vi.fn();
const signInWithOtp = vi.fn();
const resolveCurrentProductAccessForEmailMock = vi.fn();

vi.mock("@/app/server/auth/supabase", () => ({
  createClient: createClientMock,
}));

vi.mock("@/app/server/auth/identity", () => ({
  resolveCurrentProductAccessForEmail: resolveCurrentProductAccessForEmailMock,
}));

describe("auth magic-link route", () => {
  beforeEach(() => {
    __resetRouteIngressAdmissionForTests();
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        signInWithOtp,
      },
    });
    signInWithOtp.mockResolvedValue({ error: null });
    resolveCurrentProductAccessForEmailMock.mockResolvedValue("allowed");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  });

  it("sends magic links for @corca.ai internal users", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://lighthouse.example.com/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: " Admin@Corca.AI " }),
        headers: { origin: "https://lighthouse.example.com" },
      }),
    );

    expect(response.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "admin@corca.ai",
      options: {
        emailRedirectTo: "https://lighthouse.example.com/auth/confirm",
      },
    });
    expect(resolveCurrentProductAccessForEmailMock).not.toHaveBeenCalled();
  });

  it("sends magic links for exact external allowlist entries", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://lighthouse.example.com/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "pilot@example.com" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "pilot@example.com",
      }),
    );
  });

  it("uses the request host for local dev callback URLs", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";

    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("http://0.0.0.0:3002/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "dev@example.com" }),
        headers: { host: "localhost:3002" },
      }),
    );

    expect(response.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "dev@example.com",
      options: {
        emailRedirectTo: "http://localhost:3002/auth/confirm",
      },
    });
  });

  it("uses forwarded proto with the request host for callback URLs", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("http://internal:3000/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "pilot@example.com" }),
        headers: {
          host: "internal:3000",
          "x-forwarded-host": "lighthouse.example.com",
          "x-forwarded-proto": "https",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "pilot@example.com",
      options: {
        emailRedirectTo: "https://lighthouse.example.com/auth/confirm",
      },
    });
  });

  it("keeps the current production host as the PKCE callback origin", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("http://internal:3000/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "pilot@example.com" }),
        headers: {
          host: "internal:3000",
          "x-forwarded-host": "search.themoonlight.io",
          "x-forwarded-proto": "https",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "pilot@example.com",
      options: {
        emailRedirectTo: "https://search.themoonlight.io/auth/confirm",
      },
    });
  });

  it("rejects non-allowed production emails before calling Supabase", async () => {
    resolveCurrentProductAccessForEmailMock.mockResolvedValue("denied");
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://lighthouse.example.com/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "outsider@example.com" }),
      }),
    );

    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("초대된 이메일");
    expect(response.status).toBe(403);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("returns a retryable failure when the current access decision is unavailable", async () => {
    resolveCurrentProductAccessForEmailMock.mockResolvedValue("unavailable");
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://lighthouse.example.com/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "pilot@example.com" }),
      }),
    );

    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("접속 권한");
    expect(response.status).toBe(503);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("returns a retryable failure when access resolution rejects unexpectedly", async () => {
    resolveCurrentProductAccessForEmailMock.mockRejectedValue(
      new Error("service role unavailable"),
    );
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://lighthouse.example.com/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "pilot@example.com" }),
      }),
    );

    expect(response.status).toBe(503);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("allows any email against local Supabase", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";

    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("http://127.0.0.1:3000/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "dev@example.com" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(resolveCurrentProductAccessForEmailMock).not.toHaveBeenCalled();
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "dev@example.com",
      }),
    );
  });
});

describe("auth magic-link route ingress limits", () => {
  beforeEach(() => {
    __resetRouteIngressAdmissionForTests();
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({
      auth: {
        signInWithOtp,
      },
    });
    signInWithOtp.mockResolvedValue({ error: null });
    resolveCurrentProductAccessForEmailMock.mockResolvedValue("allowed");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  });

  it("rejects oversized bodies as 413 before access or provider work", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://lighthouse.example.com/api/auth/magic-link", {
        method: "POST",
        body: "{}",
        headers: { "content-length": "4097" },
      }),
    );

    expect(response.status).toBe(413);
    expect(resolveCurrentProductAccessForEmailMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 429 before body read or provider work after the source budget is spent", async () => {
    const { POST } = await import("../route");
    for (let index = 0; index < 10; index += 1) {
      const response = await POST(
        new NextRequest("https://lighthouse.example.com/api/auth/magic-link", {
          method: "POST",
          body: JSON.stringify({ email: `pilot-${String(index)}@corca.ai` }),
          headers: { "x-forwarded-for": "198.51.100.7" },
        }),
      );
      expect(response.status).toBe(200);
    }
    let bodyRead = false;
    const request = {
      url: "https://lighthouse.example.com/api/auth/magic-link",
      headers: new Headers({ "x-forwarded-for": "198.51.100.7" }),
      get body() {
        bodyRead = true;
        throw new Error("body should not be read");
      },
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(bodyRead).toBe(false);
    expect(createClientMock).toHaveBeenCalledTimes(10);
  });

  it("limits repeated delivery to one normalized email across distinct sources", async () => {
    const { POST } = await import("../route");
    for (let index = 0; index < 3; index += 1) {
      const response = await POST(
        new NextRequest("https://lighthouse.example.com/api/auth/magic-link", {
          method: "POST",
          body: JSON.stringify({ email: " Pilot@Corca.AI " }),
          headers: { "x-forwarded-for": `198.51.100.${String(index + 1)}` },
        }),
      );
      expect(response.status).toBe(200);
    }

    const response = await POST(
      new NextRequest("https://lighthouse.example.com/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "pilot@corca.ai" }),
        headers: { "x-forwarded-for": "198.51.100.99" },
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(createClientMock).toHaveBeenCalledTimes(3);
  });
});
