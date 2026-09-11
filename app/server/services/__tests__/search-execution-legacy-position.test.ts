import { describe, expect, it } from "vitest";
import {
  buildSearchExecutionFromUrlParams,
  type SearchExecutionUrlParams,
} from "@/app/server/services/search-execution";

describe("search execution legacy different-position input", () => {
  it.each(["relevance", "interest"])(
    "normalizes the retired %s basis to the unified default identity",
    (sort) => {
      const baseline = buildSearchExecutionFromUrlParams({ q: "graph retrieval", lib: "1" });
      const legacyBasis = buildSearchExecutionFromUrlParams({
        q: "graph retrieval",
        sort,
        lib: "1",
      });

      expect(legacyBasis).toMatchObject({
        canonicalKey: baseline?.canonicalKey,
        query: "graph retrieval",
        libraryContextAvailable: true,
      });
      expect(legacyBasis?.sort).toBeUndefined();
      expect(legacyBasis?.providerSort).toBeUndefined();
    },
  );

  it("ignores legacy different-position provenance when building search identity", () => {
    const base = buildSearchExecutionFromUrlParams({
      q: "autonomous research agents reliability critique",
    });
    const legacy = buildSearchExecutionFromUrlParams({
      q: "autonomous research agents reliability critique",
      positionSourceQuery: "ignored source query",
      positionPaperId: "ignored-paper",
      positionPaperTitle: "Ignored Paper",
      positionStance: "ignored stance",
      positionAxis: "ignored axis",
    } as SearchExecutionUrlParams & Record<string, string>);

    expect(legacy).toEqual(base);
    expect(legacy).not.toHaveProperty("differentPositionSeed");
  });
});
