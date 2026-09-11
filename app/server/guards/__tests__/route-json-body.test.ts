import { describe, expect, it } from "vitest";
import { readRouteJsonBody } from "@/app/server/guards/route-json-body";

describe("readRouteJsonBody", () => {
  it("returns a parsed JSON body inside the byte budget", async () => {
    const result = await readRouteJsonBody(
      new Request("https://lighthouse.example.com/api/example", {
        method: "POST",
        body: JSON.stringify({ query: "bounded" }),
      }),
      { maxBytes: 1024 },
    );

    expect(result).toEqual({ ok: true, body: { query: "bounded" } });
  });

  it("distinguishes malformed JSON as 400", async () => {
    const result = await readRouteJsonBody(
      new Request("https://lighthouse.example.com/api/example", {
        method: "POST",
        body: "{",
      }),
      { maxBytes: 1024 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({
      error: "invalid JSON body",
      code: "API_INVALID_JSON",
      action: "correct-request",
      retryable: false,
    });
  });

  it("rejects an oversized declared body as 413 before reading its stream", async () => {
    let bodyRead = false;
    const request = {
      headers: new Headers({ "content-length": "2048" }),
      get body() {
        bodyRead = true;
        throw new Error("body should not be read");
      },
    } as unknown as Request;

    const result = await readRouteJsonBody(request, { maxBytes: 1024 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(413);
    await expect(result.response.json()).resolves.toMatchObject({
      error: "request body is too large",
      code: "API_REQUEST_BODY_TOO_LARGE",
      action: "reduce-request",
      retryable: false,
    });
    expect(bodyRead).toBe(false);
  });

  it("propagates an unexpected body stream failure", async () => {
    const streamFailure = new Error("stream failed");
    const request = {
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: () => Promise.reject(streamFailure),
          releaseLock: () => undefined,
        }),
      },
    } as unknown as Request;

    await expect(readRouteJsonBody(request, { maxBytes: 1024 })).rejects.toBe(streamFailure);
  });
});
