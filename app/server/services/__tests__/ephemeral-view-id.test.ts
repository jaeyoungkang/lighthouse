import { describe, expect, it } from "vitest";
import {
  buildEphemeralCitationLineageViewId,
  buildEphemeralGraphNeighborsViewId,
  buildEphemeralSearchViewId,
} from "@/app/server/services/ephemeral-view-id";

function viewIdForSnapshot(snapshot: {
  canonicalKey: string;
  updatedAt: string;
  paperIds: string[];
}): string {
  return buildEphemeralSearchViewId(snapshot.canonicalKey);
}

function relationshipViewIdsForSnapshot(snapshot: {
  canonicalKey: string;
  updatedAt: string;
  paperIds: string[];
}): { citation: string; graphNeighbors: string } {
  return {
    citation: buildEphemeralCitationLineageViewId(snapshot.canonicalKey),
    graphNeighbors: buildEphemeralGraphNeighborsViewId(snapshot.canonicalKey),
  };
}

describe("ephemeral view canonical identity", () => {
  it("ignores result snapshot changes while preserving the canonical condition", () => {
    const canonicalKey = "q=graph+retrieval&sort=year";

    expect(
      viewIdForSnapshot({
        canonicalKey,
        updatedAt: "2026-07-14T00:00:00.000Z",
        paperIds: ["paper-1"],
      }),
    ).toBe(
      viewIdForSnapshot({
        canonicalKey,
        updatedAt: "2026-07-14T00:00:05.000Z",
        paperIds: ["paper-2", "paper-3"],
      }),
    );
  });

  it("changes identity when the canonical execution condition changes", () => {
    expect(buildEphemeralSearchViewId("q=graph+retrieval")).not.toBe(
      buildEphemeralSearchViewId("q=graph+retrieval&sort=year"),
    );
  });

  it("does not alias the previous 32-bit collision pair", () => {
    expect(buildEphemeralSearchViewId("q=bex9j8+q6d1kt")).not.toBe(
      buildEphemeralSearchViewId("q=w9awp+1l9jjoz"),
    );
  });

  it("keeps relationship identities stable when only the result snapshot changes", () => {
    const canonicalKey = "seedPaperId=100&seedPaperTitle=Seed&seedPaperCitations=5";
    const first = relationshipViewIdsForSnapshot({
      canonicalKey,
      updatedAt: "2026-07-16T00:00:00.000Z",
      paperIds: ["101"],
    });
    const second = relationshipViewIdsForSnapshot({
      canonicalKey,
      updatedAt: "2026-07-16T00:00:05.000Z",
      paperIds: ["102", "103"],
    });

    expect(first).toEqual(second);
  });

  it("changes relationship identities with the canonical seed and separates route kinds", () => {
    const first = "seedPaperId=100&seedPaperTitle=Seed&seedPaperCitations=5";
    const second = "seedPaperId=200&seedPaperTitle=Other&seedPaperCitations=1";

    expect(buildEphemeralCitationLineageViewId(first)).not.toBe(
      buildEphemeralCitationLineageViewId(second),
    );
    expect(buildEphemeralGraphNeighborsViewId(first)).not.toBe(
      buildEphemeralGraphNeighborsViewId(second),
    );
    expect(buildEphemeralCitationLineageViewId(first)).not.toBe(
      buildEphemeralGraphNeighborsViewId(first),
    );
  });
});
