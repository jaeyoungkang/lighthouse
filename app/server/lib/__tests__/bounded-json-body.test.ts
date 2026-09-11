import { describe, expect, it, vi } from "vitest";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "@/app/server/lib/bounded-json-body";

describe("readBoundedJsonBody", () => {
  it("parses a body exactly at the character limit", async () => {
    await expect(
      readBoundedJsonBody(new Request("https://example.com", { method: "POST", body: "12345" }), 5),
    ).resolves.toBe(12345);
  });

  it("allows a UTF-8 body across chunk boundaries when its characters fit", async () => {
    const encodedBody = new TextEncoder().encode('"한"');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encodedBody.slice(0, 2));
        controller.enqueue(encodedBody.slice(2));
        controller.close();
      },
    });
    const request = new Request("https://example.com", {
      method: "POST",
      body,
      duplex: "half",
      headers: { "content-length": "5" },
    } as RequestInit & { duplex: "half" });

    await expect(readBoundedJsonBody(request, 3)).resolves.toBe("한");
  });

  it("enforces an exact UTF-8 byte budget when the caller selects byte mode", async () => {
    const body = '"한"';

    await expect(
      readBoundedJsonBody(new Request("https://example.com", { method: "POST", body }), {
        maxBytes: 5,
      }),
    ).resolves.toBe("한");
    await expect(
      readBoundedJsonBody(new Request("https://example.com", { method: "POST", body }), {
        maxBytes: 4,
      }),
    ).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("rejects a declared body above the conservative byte limit before reading it", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: "{}",
      headers: { "content-length": "21" },
    });
    const textSpy = vi.spyOn(request, "text");

    await expect(readBoundedJsonBody(request, 5)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(request.bodyUsed).toBe(false);
    expect(textSpy).not.toHaveBeenCalled();
  });

  it("cancels a streamed body as soon as the character limit is exceeded", async () => {
    const encoder = new TextEncoder();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("123456"));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://example.com", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const textSpy = vi.spyOn(request, "text");

    await expect(readBoundedJsonBody(request, 5)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    await vi.waitFor(() => {
      expect(cancelled).toBe(true);
    });
    expect(textSpy).not.toHaveBeenCalled();
  });

  it("returns null for malformed JSON", async () => {
    await expect(
      readBoundedJsonBody(
        new Request("https://example.com", { method: "POST", body: "not-json" }),
        20,
      ),
    ).resolves.toBeNull();
  });
});
