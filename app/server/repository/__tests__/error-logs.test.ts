import { describe, expect, it, vi } from "vitest";
import { utf8ByteLength } from "@/app/lib/utf8";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import {
  ERROR_LOG_METADATA_LIMITS,
  ERROR_LOG_METADATA_TRUNCATED_KEY,
} from "@/app/server/lib/error-log-metadata";
import { logError } from "@/app/server/repository/error-logs";

describe("error logs repository", () => {
  it("bounds metadata for direct callers before inserting the durable row", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const db = createRepositoryDbHandle({ from } as never);

    await logError(db, {
      source: "server",
      category: "api_error",
      message: "provider\u0000failed",
      metadata: {
        keep: "diagnostic",
        first: "한".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength),
        second: "한".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength),
        third: "한".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength),
        fourth: "한".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength),
      },
    });

    expect(from).toHaveBeenCalledWith("error_logs");
    const inserted = insert.mock.calls[0]?.[0] as {
      message: string;
      metadata: Record<string, unknown>;
    };
    expect(inserted.message).toBe("providerfailed");
    expect(inserted.metadata.keep).toBe("diagnostic");
    expect(inserted.metadata).toHaveProperty("__lighthouseTruncated", true);
    expect(utf8ByteLength(JSON.stringify(inserted.metadata))).toBeLessThanOrEqual(
      ERROR_LOG_METADATA_LIMITS.maxJsonBytes,
    );
  });

  it("persists prototype-shaped JSON keys without changing object inheritance", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const db = createRepositoryDbHandle({ from } as never);
    const metadata = JSON.parse('{"__proto__":{"polluted":true},"safe":"x"}') as Record<
      string,
      unknown
    >;

    await logError(db, {
      source: "server",
      category: "api_error",
      message: "provider failed",
      metadata,
    });

    const inserted = insert.mock.calls[0]?.[0] as { metadata: Record<string, unknown> };
    expect(Object.hasOwn(inserted.metadata, "__proto__")).toBe(true);
    expect(inserted.metadata.__proto__).toEqual({ polluted: true });
    expect(Object.getPrototypeOf(inserted.metadata)).toBe(Object.prototype);
  });

  it("normalizes the reserved truncation marker for direct callers", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const db = createRepositoryDbHandle({ from } as never);

    await logError(db, {
      source: "server",
      category: "api_error",
      message: "provider failed",
      metadata: { [ERROR_LOG_METADATA_TRUNCATED_KEY]: "client-supplied", safe: "x" },
    });

    const inserted = insert.mock.calls[0]?.[0] as { metadata: Record<string, unknown> };
    expect(inserted.metadata).toEqual({ safe: "x", [ERROR_LOG_METADATA_TRUNCATED_KEY]: true });
  });
});
