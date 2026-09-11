"use client";

import { useEffect, useRef } from "react";
import { API_ROUTES } from "../lib/api-routes";

const DEDUP_WINDOW_MS = 5000;

export function ErrorReporter() {
  const sentAtRef = useRef(new Map<string, number>());

  useEffect(() => {
    function shouldReport(message: string): boolean {
      const now = Date.now();
      const lastSentAt = sentAtRef.current.get(message);
      if (lastSentAt && now - lastSentAt < DEDUP_WINDOW_MS) return false;

      sentAtRef.current.set(message, now);
      for (const [key, timestamp] of sentAtRef.current.entries()) {
        if (now - timestamp >= DEDUP_WINDOW_MS) {
          sentAtRef.current.delete(key);
        }
      }
      return true;
    }

    function report(message: string, metadata?: Record<string, unknown>) {
      if (!message || !shouldReport(message)) return;

      void fetch(API_ROUTES.ERRORS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          metadata: {
            href: window.location.href,
            userAgent: navigator.userAgent,
            ...metadata,
          },
        }),
      }).catch(() => {});
    }

    function handleWindowError(event: ErrorEvent) {
      report(event.message || "Unknown window error", {
        source: "window.error",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason: unknown = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";

      report(message, {
        source: "window.unhandledrejection",
        reason: reason instanceof Error ? { name: reason.name, stack: reason.stack } : reason,
      });
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
