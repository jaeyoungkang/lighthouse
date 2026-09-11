import { describe, expect, it } from "vitest";
import { parseDocumentResponse } from "@/app/components/research-route-renderers/search-view-controller.helpers";
import {
  buildCitationLineageSystemEventMessage,
  buildGraphNeighborsSystemEventMessage,
} from "@/app/components/research-route-renderers/search-view-messages.helpers";

describe("search-view system-message helpers", () => {
  it("fails closed when a route response is not valid JSON", async () => {
    const response = new Response("not-json", {
      headers: { "content-type": "application/json" },
    });

    await expect(parseDocumentResponse(response)).resolves.toBeNull();
  });

  it("returns a schema-valid route document instead of failing closed", async () => {
    const document = {
      status: "ready",
      version: 0,
      reactionVersion: 0,
      id: "search-1",
      type: "search",
      title: "검색: agent memory",
      content: "",
      createdBy: "user",
      metadata: { type: "search", query: "agent memory", papers: [], total: 0 },
      reaction: null,
      refs: [],
      ownerPrincipalId: "principal-1",
      createdAt: "2026-08-04T00:00:00.000Z",
      updatedAt: "2026-08-04T00:00:00.000Z",
    };
    const response = Response.json(document);

    await expect(parseDocumentResponse(response)).resolves.toEqual(document);
  });

  it.each([
    ["opened", '"Attention" 인용 계보를 열었다'],
    ["request_failed", '"Attention" 인용 계보를 열지 못했다'],
  ] as const)("formats citation-lineage %s events", (kind, expected) => {
    expect(buildCitationLineageSystemEventMessage({ title: "Attention", kind })).toContain(
      expected,
    );
  });

  it.each([
    ["opened", '"Attention" 비슷한 논문을 열었다'],
    ["request_failed", '"Attention" 비슷한 논문을 열지 못했다'],
  ] as const)("formats graph-neighbor %s events", (kind, expected) => {
    expect(buildGraphNeighborsSystemEventMessage({ title: "Attention", kind })).toContain(expected);
  });
});
