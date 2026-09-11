import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRelationshipSeedFromUrlParams,
  executeCitationLineageFromUrl,
} from "@/app/server/services/relationship-execution";
import {
  lookupCitationLineageForPaper,
  lookupGraphNeighborsForPaper,
} from "@/app/server/services/search-service";
import type * as SearchServiceModule from "@/app/server/services/search-service";

vi.mock("@/app/server/services/search-service", async (importOriginal) => {
  const actual = await importOriginal<typeof SearchServiceModule>();
  return {
    ...actual,
    lookupCitationLineageForPaper: vi.fn(),
    lookupGraphNeighborsForPaper: vi.fn(),
  };
});

describe("relationship citation execution evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs the citation ResearchRoutePayload from batch-hydrated relation papers", async () => {
    vi.mocked(lookupCitationLineageForPaper).mockResolvedValue({
      seedPaper: {
        paperId: "123",
        title: "Hydrated Seed",
        abstract: "Hydrated seed abstract for grounded lineage synthesis.",
        year: 2024,
        citationCount: 0,
        url: "https://example.com/seed",
        authors: [{ name: "Seed Author" }],
      },
      papers: [
        {
          paperId: "201",
          title: "Hydrated Reference",
          abstract: "Hydrated reference abstract for inline analysis.",
          year: 2020,
          venue: "ACL",
          fieldsOfStudy: ["Computer Science"],
          citationCount: 3,
          referenceCount: 10,
          url: "https://doi.org/10.1000/ref",
          authors: ["Reference Author"],
          openAccessPdf: { url: "https://example.com/ref.pdf" },
          openAccess: {
            isOpenAccess: true,
            pdfUrl: "https://example.com/ref.pdf",
          },
          source: { provider: "episteme2" },
          doi: "10.1000/ref",
          externalIds: { DOI: "10.1000/ref" },
          referenceIds: null,
          citationIds: null,
          referenceAvailability: null,
          citationAvailability: null,
        },
      ],
      referenceIds: ["201"],
      citationIds: [],
      referenceAvailability: {
        available: true,
        truncated: false,
        total: 1,
        returned: 1,
        reason: null,
      },
      citationAvailability: {
        available: true,
        truncated: false,
        total: 0,
        returned: 0,
        reason: null,
      },
    });
    const input = buildRelationshipSeedFromUrlParams("citation", {
      seedPaperId: "123",
      seedPaperTitle: "Seed",
      seedPaperCitations: "0",
    });
    expect(input).not.toBeNull();
    if (!input) throw new Error("relationship seed fixture must be valid");

    const result = await executeCitationLineageFromUrl({
      ownerPrincipalId: "principal-1",
      input,
    });

    expect(result).toMatchObject({ executed: true, failed: false });
    expect(lookupGraphNeighborsForPaper).not.toHaveBeenCalled();
    expect(result.view).toMatchObject({
      type: "citation_lineage",
      ownerPrincipalId: "principal-1",
      status: "ready",
      metadata: {
        type: "citation_lineage",
        seedPaper: {
          paperId: "123",
          title: "Hydrated Seed",
          abstract: "Hydrated seed abstract for grounded lineage synthesis.",
        },
        referenceIds: ["201"],
        citationIds: [],
        papers: [
          {
            paperId: "201",
            title: "Hydrated Reference",
            abstract: "Hydrated reference abstract for inline analysis.",
            venue: "ACL",
            fieldsOfStudy: ["Computer Science"],
            openAccessPdf: { url: "https://example.com/ref.pdf" },
            doi: "10.1000/ref",
            source: { provider: "episteme2" },
          },
        ],
      },
    });
  });
});
