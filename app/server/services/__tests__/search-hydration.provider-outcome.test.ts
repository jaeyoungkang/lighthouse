import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hydrateNeighborhoodSupplementBandWithOutcome,
  lookupLibraryNeighborhoodWithEvidence,
} from "@/app/server/services/library-anchor-blend";
import { getLibraryContextForUser } from "@/app/server/services/library-context-source";
import type * as LibraryContextSourceModule from "@/app/server/services/library-context-source";
import { resolveLibraryNeighborhoodPreflight } from "@/app/server/services/search-hydration";

vi.mock("@/app/server/services/library-anchor-blend", () => ({
  blendNeighborhoodIntoPool: vi.fn(),
  hydrateNeighborhoodSupplementBandWithOutcome: vi.fn(),
  lookupLibraryNeighborhoodWithEvidence: vi.fn(),
}));

vi.mock("@/app/server/services/library-context-source", async (importOriginal) => {
  const actual: typeof LibraryContextSourceModule = await importOriginal();
  return {
    ...actual,
    getLibraryContextForUser: vi.fn(),
  };
});

const mockedGetLibraryContext = vi.mocked(getLibraryContextForUser);
const mockedLookupNeighborhood = vi.mocked(lookupLibraryNeighborhoodWithEvidence);
const mockedHydrateSupplementBand = vi.mocked(hydrateNeighborhoodSupplementBandWithOutcome);

afterEach(() => {
  vi.clearAllMocks();
});

describe("library neighborhood provider outcome", () => {
  it("marks candidate hydration failure without erasing the resolved neighborhood", async () => {
    const neighborhood = new Map([["301", 8]]);
    mockedGetLibraryContext.mockResolvedValueOnce({
      folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
      neighborhood: {},
      computedAt: "2026-07-07T00:00:00.000Z",
    });
    mockedLookupNeighborhood.mockResolvedValueOnce({
      neighborhood,
      candidates: new Map(),
      providerStatus: "ready",
    });
    mockedHydrateSupplementBand.mockResolvedValueOnce({
      papers: [],
      providerStatus: "degraded",
    });

    const preflight = await resolveLibraryNeighborhoodPreflight({
      userEmail: "reader@example.com",
      query: "graph retrieval",
      personalize: true,
    });

    expect(preflight).toMatchObject({
      neighborhood,
      hydratedCandidates: [],
      providerStatus: "degraded",
    });
  });
});
