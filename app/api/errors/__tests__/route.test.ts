import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServer from "next/server";
import { utf8ByteLength } from "@/app/lib/utf8";
import {
  ERROR_LOG_METADATA_LIMITS,
  ERROR_LOG_METADATA_TRUNCATED_KEY,
} from "@/app/server/lib/error-log-metadata";
import { __resetPublicTelemetryIngressForTests } from "@/app/server/operational/public-telemetry-ingress";

const { recordClientErrorReport, fetchMock, afterMock, scheduledDrains } = vi.hoisted(() => ({
  recordClientErrorReport: vi.fn(),
  fetchMock: vi.fn<typeof fetch>(),
  afterMock: vi.fn((cb: () => Promise<void>) => {
    scheduledDrains.push(cb);
  }),
  scheduledDrains: [] as Array<() => Promise<void>>,
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof NextServer>();
  return { ...actual, after: afterMock };
});

vi.mock("@/app/server/domain-access/error-access", () => ({
  recordClientErrorReport,
}));

function request(body: unknown, source = "203.0.113.7"): Request {
  return new Request("https://lighthouse.example.com/api/errors", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": source },
    method: "POST",
  });
}

async function runScheduledDrains(): Promise<void> {
  const drains = scheduledDrains.splice(0);
  for (const drain of drains) {
    await drain();
  }
}

describe("errors route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    __resetPublicTelemetryIngressForTests();
    scheduledDrains.length = 0;
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NODE_ENV", "test");
    fetchMock.mockReset();
  });

  it("records valid client error reports", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      request({ message: "client exploded", metadata: { source: "test" } }),
    );

    expect(response.status).toBe(204);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(recordClientErrorReport).not.toHaveBeenCalled();

    await runScheduledDrains();

    expect(recordClientErrorReport).toHaveBeenCalledWith({
      message: "client exploded",
      metadata: { source: "test" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds nested metadata before scheduling the durable client error write", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      request({
        message: "client exploded",
        metadata: {
          keep: "diagnostic",
          first: "한".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength),
          second: "한".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength),
          third: "한".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength),
          fourth: "한".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength),
        },
      }),
    );

    expect(response.status).toBe(204);
    await runScheduledDrains();

    const recordedInput = recordClientErrorReport.mock.calls[0]?.[0] as {
      metadata: Record<string, unknown>;
    };
    const metadata = recordedInput.metadata;
    expect(metadata.keep).toBe("diagnostic");
    expect(metadata).toHaveProperty("__lighthouseTruncated", true);
    expect(utf8ByteLength(JSON.stringify(metadata))).toBeLessThanOrEqual(
      ERROR_LOG_METADATA_LIMITS.maxJsonBytes,
    );
  });

  it("keeps malformed client error reports fire-and-forget", async () => {
    const { POST } = await import("../route");

    const response = await POST(request({ message: "" }));

    expect(response.status).toBe(204);
    expect(recordClientErrorReport).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects the server-owned truncation marker from public metadata", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      request({
        message: "client exploded",
        metadata: { [ERROR_LOG_METADATA_TRUNCATED_KEY]: "client-supplied", safe: "x" },
      }),
    );

    expect(response.status).toBe(204);
    expect(recordClientErrorReport).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("drops oversized reports as 204 before scheduling durable work", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("https://lighthouse.example.com/api/errors", {
        method: "POST",
        body: "{}",
        headers: {
          "content-length": "32769",
          "x-forwarded-for": "203.0.113.7",
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(recordClientErrorReport).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("drops repeated public error ingress over the source budget before recording", async () => {
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_MAX_REQUESTS", "1");
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_WINDOW_MS", "60000");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { POST } = await import("../route");

    const first = await POST(request({ message: "client exploded" }, "198.51.100.9"));
    const second = await POST(request({ message: "client exploded again" }, "198.51.100.9"));

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(afterMock).toHaveBeenCalledTimes(1);
    await runScheduledDrains();

    expect(recordClientErrorReport).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledWith(
      "[errors] public telemetry ingress dropped:",
      "rate-limit",
    );
    consoleWarn.mockRestore();
  });

  it("runs the drain immediately when after scheduling is unavailable", async () => {
    afterMock.mockImplementationOnce(() => {
      throw new Error("after unavailable");
    });
    const { POST } = await import("../route");

    const response = await POST(request({ message: "client exploded" }));
    await vi.waitFor(() => {
      expect(recordClientErrorReport).toHaveBeenCalledWith({
        message: "client exploded",
        metadata: undefined,
      });
    });

    expect(response.status).toBe(204);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(scheduledDrains).toHaveLength(0);
  });

  it("keeps scheduled drain failures fire-and-forget", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("durable sink unavailable");
    recordClientErrorReport.mockRejectedValueOnce(error);
    const { POST } = await import("../route");

    const response = await POST(request({ message: "client exploded" }));

    expect(response.status).toBe(204);
    await expect(runScheduledDrains()).resolves.toBeUndefined();
    expect(recordClientErrorReport).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "[public-telemetry-ingress] drain task failed:",
      error,
    );
    consoleError.mockRestore();
  });
});
