import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../track";
import { trackCanonicalEvent } from "../analytics/client";

vi.mock("../analytics/client", () => ({
  trackCanonicalEvent: vi.fn(),
}));

const trackCanonicalEventMock = vi.mocked(trackCanonicalEvent);

describe("track different-position search bridge", () => {
  beforeEach(() => {
    trackCanonicalEventMock.mockClear();
  });

  it("bridges different-position search clicks without raw query text", () => {
    track({
      type: "different_position_search",
      data: {
        ownerPrincipalId: "principal-1",
        documentId: "search-1",
        paperId: "paper-1",
        queryHash: "fnv1a32:abc123",
        queryLength: 54,
      },
    });

    expect(trackCanonicalEventMock.mock.calls.map((call) => call[0])).toEqual([
      "product.different_position_search.clicked",
    ]);
    const properties = trackCanonicalEventMock.mock.calls[0]?.[1].properties;
    expect(properties).toMatchObject({
      ownerPrincipalId: "principal-1",
      documentId: "search-1",
      paperId: "paper-1",
      queryHash: "fnv1a32:abc123",
      queryLength: 54,
    });
    expect(properties).not.toHaveProperty("query");
    expect(properties).not.toHaveProperty("rawQuery");
  });
});
