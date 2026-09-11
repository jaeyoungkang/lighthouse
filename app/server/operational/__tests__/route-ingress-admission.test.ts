import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRouteIngressAdmissionForTests,
  consumeRouteIngressAdmission,
  resolveRequestSourceKey,
} from "@/app/server/operational/route-ingress-admission";
import { getFixedRouteAdmissionPolicy } from "@/app/server/operational/route-ingress-policy";

const spellingPolicy = getFixedRouteAdmissionPolicy("spelling-correction-principal");

describe("route ingress admission", () => {
  beforeEach(() => {
    __resetRouteIngressAdmissionForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies the spelling cost ceiling per principal and resets after its window", () => {
    for (let index = 0; index < spellingPolicy.maxRequests; index += 1) {
      expect(consumeRouteIngressAdmission("spelling-correction-principal", "principal-1")).toEqual({
        allowed: true,
        remaining: spellingPolicy.maxRequests - index - 1,
      });
    }

    expect(
      consumeRouteIngressAdmission("spelling-correction-principal", "principal-1"),
    ).toMatchObject({
      allowed: false,
      reason: "rate-limit",
      retryAfterSeconds: Math.ceil(spellingPolicy.windowMs / 1_000),
    });
    expect(
      consumeRouteIngressAdmission("spelling-correction-principal", "principal-2").allowed,
    ).toBe(true);

    vi.advanceTimersByTime(500);
    expect(consumeRouteIngressAdmission("spelling-correction-principal", "principal-1")).toEqual({
      allowed: false,
      reason: "rate-limit",
      retryAfterSeconds: Math.ceil((spellingPolicy.windowMs - 500) / 1_000),
    });

    vi.advanceTimersByTime(spellingPolicy.windowMs / 2 - 500);
    expect(consumeRouteIngressAdmission("spelling-correction-principal", "principal-1")).toEqual({
      allowed: false,
      reason: "rate-limit",
      retryAfterSeconds: Math.ceil(spellingPolicy.windowMs / 2 / 1_000),
    });

    vi.advanceTimersByTime(spellingPolicy.windowMs / 2);
    expect(consumeRouteIngressAdmission("spelling-correction-principal", "principal-1")).toEqual({
      allowed: true,
      remaining: spellingPolicy.maxRequests - 1,
    });
  });

  it("keeps policy ceilings independent and reclaims stale keys", () => {
    for (let index = 0; index < spellingPolicy.maxKeys; index += 1) {
      expect(
        consumeRouteIngressAdmission("spelling-correction-principal", `principal-${String(index)}`)
          .allowed,
      ).toBe(true);
    }

    expect(
      consumeRouteIngressAdmission("spelling-correction-principal", "principal-overflow"),
    ).toEqual({
      allowed: false,
      reason: "key-table-full",
      retryAfterSeconds: Math.ceil(spellingPolicy.windowMs / 1_000),
    });
    expect(consumeRouteIngressAdmission("magic-link-source", "198.51.100.7").allowed).toBe(true);

    vi.advanceTimersByTime(spellingPolicy.windowMs);
    expect(
      consumeRouteIngressAdmission("spelling-correction-principal", "principal-after-expiry"),
    ).toEqual({ allowed: true, remaining: spellingPolicy.maxRequests - 1 });
  });

  it("uses the bounded first available source identity", () => {
    const requestFor = (headers: HeadersInit = {}) =>
      new Request("https://lighthouse.example.com/api/auth/magic-link", { headers });

    expect(
      resolveRequestSourceKey(requestFor({ "x-forwarded-for": " 198.51.100.7 , 203.0.113.9" })),
    ).toBe("198.51.100.7");
    expect(
      resolveRequestSourceKey(
        requestFor({ "x-forwarded-for": "   ", "x-real-ip": "198.51.100.8" }),
      ),
    ).toBe("198.51.100.8");
    expect(resolveRequestSourceKey(requestFor({ "x-real-ip": " 198.51.100.8 " }))).toBe(
      "198.51.100.8",
    );
    expect(resolveRequestSourceKey(requestFor({ "cf-connecting-ip": " 198.51.100.9 " }))).toBe(
      "198.51.100.9",
    );
    expect(resolveRequestSourceKey(requestFor())).toBe("unknown");
    expect(resolveRequestSourceKey(requestFor({ "x-real-ip": "x".repeat(160) }))).toBe(
      "x".repeat(128),
    );
  });
});
