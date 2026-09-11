// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-card-inspection
// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-citation-source-quality-parity

import { describe, expect, it } from "vitest";

import type { PaperCore } from "@/app/domain/paper";
import {
  paperCoreSchema,
  researchRoutePayloadMetadataSchema,
  searchPaperSchema,
} from "@/app/domain/research-route-payload-schema";
import { mapEpistemePaper } from "@/app/server/services/episteme-literature";
import { metadataPaperToMapped } from "@/app/server/services/search-hydration";
import {
  buildCitationLineageViewPayload,
  buildDocumentPaper,
  buildGraphNeighborsViewPayload,
  buildSearchViewPayload,
} from "@/app/server/services/search-service";

const PROVIDER_PAPER = {
  paper_uid: "pap_01900000-0000-7000-8000-000000000001",
  projection: "rich" as const,
  omitted_fields: [],
  relevance: 0.98,
  title: "The AI Scientist",
  abstract: "An automated research system.",
  publication_year: 2024,
  venue: { name: "arXiv" },
  publication_venue: "arXiv",
  fields_of_study: ["Computer Science", "Artificial Intelligence"],
  citation_count: 7,
  reference_count: 3,
  authors: [{ person_uid: "per_1", name: "Sakana AI", identifiers: [] }],
  identifiers: [
    { namespace: "s2_corpus_id", value: "271854887" },
    { namespace: "doi", value: "10.48550/arXiv.2408.06292" },
    { namespace: "arxiv", value: "2408.06292" },
  ],
  source_memberships: ["s2", "arxiv"],
  has_pdf: true,
  has_open_access_location: true,
  access_url: "https://arxiv.org/abs/2408.06292",
  best_open_pdf: "https://arxiv.org/pdf/2408.06292",
  best_landing_page: "https://arxiv.org/abs/2408.06292",
  currency: { generation: 4, state: "current" as const },
};

const PAPER_CORE_FIXTURE = {
  paperId: "271854887",
  title: "The AI Scientist",
  abstract: "An automated research system.",
  year: 2024,
  venue: "arXiv",
  fieldsOfStudy: ["Computer Science", "Artificial Intelligence"],
  citationCount: 7,
  url: "https://arxiv.org/abs/2408.06292",
  authors: [{ name: "Sakana AI" }],
  openAccessPdf: { url: "https://arxiv.org/pdf/2408.06292" },
  openAccess: {
    isOpenAccess: true,
    pdfUrl: "https://arxiv.org/pdf/2408.06292",
    landingUrl: "https://arxiv.org/abs/2408.06292",
    source: "episteme3",
  },
  source: {
    provider: "episteme3",
    baseCorpus: "multi_provider",
    sourceFlags: ["s2", "arxiv"],
    freshnessMode: "exact" as const,
    limits: [],
    canonicalPaperId: "pap_01900000-0000-7000-8000-000000000001",
    generation: "4",
  },
  doi: "10.48550/arXiv.2408.06292",
  externalIds: {
    DOI: "10.48550/arXiv.2408.06292",
    ArXiv: "2408.06292",
    CorpusId: "271854887",
  },
  referenceIds: null,
  referenceCount: 3,
  citationIds: null,
  referenceAvailability: {
    available: false,
    truncated: true,
    total: 3,
    returned: 0,
    reason: "lazy_fetch_required",
  },
  citationAvailability: {
    available: false,
    truncated: true,
    total: 7,
    returned: 0,
    reason: "lazy_fetch_required",
  },
} satisfies PaperCore & Record<keyof PaperCore, unknown>;

const INTENTIONAL_LOSS_ALLOWLIST = [
  {
    sourcePath: "relevance",
    destinationPath: "relevance",
    reason: "Search-window ranking evidence belongs to the result window, not PaperCore.",
    owner: "Search result ordering",
    reviewTrigger: "Per-paper ranking evidence is persisted or rendered.",
  },
  {
    sourcePath: "authors.0.person_uid",
    destinationPath: "authors.0.authorId",
    reason: "MappedPaper intentionally keeps provider-neutral author names only.",
    owner: "MappedPaper author projection",
    reviewTrigger: "Author identity is added to MappedPaper or a provider-neutral author contract.",
  },
] as const;

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce((current: unknown, segment) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

describe("PaperCore cross-layer parity", () => {
  it("keeps the runtime schema exhaustive with the canonical TypeScript contract", () => {
    expect(Object.keys(paperCoreSchema.shape).sort()).toEqual(
      Object.keys(PAPER_CORE_FIXTURE).sort(),
    );
  });

  it("passes one logical paper through provider, search, hydration, and wire adapters", () => {
    const mapped = mapEpistemePaper(PROVIDER_PAPER);
    const projected = buildDocumentPaper(mapped);
    const persisted = searchPaperSchema.parse(projected);
    const core = paperCoreSchema.parse(persisted);
    const reconstructed = metadataPaperToMapped(persisted);

    expect(core).toEqual(PAPER_CORE_FIXTURE);
    expect(reconstructed).toEqual(mapped);

    const search = buildSearchViewPayload("principal-1", "automated science", [mapped], 1, "user");
    const citation = buildCitationLineageViewPayload(
      "principal-1",
      core,
      [mapped],
      undefined,
      [],
      [],
    );
    const graph = buildGraphNeighborsViewPayload("principal-1", core, [mapped], undefined, {
      coCited: [{ paper: mapped, shared: 2 }],
      coupled: [{ paper: mapped, shared: 3 }],
    });

    for (const payload of [search, citation, graph]) {
      const metadata = researchRoutePayloadMetadataSchema.parse(payload.metadata);
      expect(metadata.papers[0]).toEqual(projected);
      expect(metadata.papers[0]?.paperId).toBe(core.paperId);
    }
    expect(graph.metadata.type).toBe("graph_neighbors");
    expect(graph.metadata.coCited[0]?.paper).toEqual(projected);
    expect(graph.metadata.coupled[0]?.paper).toEqual(projected);
  });

  it("keeps intentional provider and lightweight losses explicit and non-stale", () => {
    const mapped = mapEpistemePaper(PROVIDER_PAPER);

    for (const loss of INTENTIONAL_LOSS_ALLOWLIST) {
      expect(loss.reason.length).toBeGreaterThan(0);
      expect(loss.owner.length).toBeGreaterThan(0);
      expect(loss.reviewTrigger.length).toBeGreaterThan(0);
      expect(readPath(PROVIDER_PAPER, loss.sourcePath)).not.toBeUndefined();
      expect(readPath(mapped, loss.destinationPath)).toBeUndefined();
    }
  });
});
