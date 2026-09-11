import { vi } from "vitest";

const AI_CONTENT_FEEDBACK_EVENT_NAME = "product.ai_content_feedback.submitted";

type FetchMock = ReturnType<typeof vi.fn>;

function isAiContentFeedbackBody(
  body: unknown,
): body is { name: typeof AI_CONTENT_FEEDBACK_EVENT_NAME } {
  return (
    typeof body === "object" &&
    body !== null &&
    "name" in body &&
    body.name === AI_CONTENT_FEEDBACK_EVENT_NAME
  );
}

export function stubAiContentFeedbackTransport(): FetchMock {
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "");
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: vi.fn(() => false),
  });
  return fetchMock;
}

export function readAiContentFeedbackBodies(fetchMock: FetchMock): unknown[] {
  return fetchMock.mock.calls
    .map(([, init]) => {
      const body = (init as RequestInit | undefined)?.body;
      return typeof body === "string" ? (JSON.parse(body) as unknown) : null;
    })
    .filter(isAiContentFeedbackBody);
}

export function readFirstAiContentFeedbackBody(fetchMock: FetchMock): unknown {
  const [body] = readAiContentFeedbackBodies(fetchMock);
  if (!body) {
    throw new Error("expected an AI content feedback request body");
  }
  return body;
}
