"use client";

// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-session-principal-handoff

import { useEffect } from "react";

import { API_ROUTES } from "@/app/lib/api-routes";

const TOUCH_INTERVAL_MS = 15 * 60 * 1000;
const LAST_TOUCH_STORAGE_KEY = "lighthouse-auth-session-touch-at";
let memoryLastTouchAt = 0;

function readLastTouchAt(): number {
  try {
    const value = window.localStorage.getItem(LAST_TOUCH_STORAGE_KEY);
    const parsed = value ? Number(value) : 0;
    return Math.max(memoryLastTouchAt, Number.isFinite(parsed) ? parsed : 0);
  } catch {
    return memoryLastTouchAt;
  }
}

function writeLastTouchAt(value: number): void {
  memoryLastTouchAt = value;
  try {
    window.localStorage.setItem(LAST_TOUCH_STORAGE_KEY, String(value));
  } catch {}
}

export function AuthSessionTouch() {
  useEffect(() => {
    const now = Date.now();
    if (now - readLastTouchAt() < TOUCH_INTERVAL_MS) return;

    writeLastTouchAt(now);
    void fetch(API_ROUTES.AUTH_SESSION_TOUCH, {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  return null;
}

export function __resetAuthSessionTouchForTests(): void {
  memoryLastTouchAt = 0;
}
