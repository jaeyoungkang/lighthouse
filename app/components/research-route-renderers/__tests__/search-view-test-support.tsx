import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SearchView } from "@/app/components/research-route-renderers/SearchView";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";

type SearchPaper = SearchMetadata["papers"][number];

export function createPaper(overrides: Partial<SearchPaper> = {}): SearchPaper {
  return {
    paperId: "paper-1",
    title: "Attention Is All You Need",
    abstract: "abstract",
    year: 2017,
    citationCount: 1000,
    url: "https://example.com/paper-1",
    authors: [{ name: "Vaswani" }],
    referenceIds: ["ref-1"],
    citationIds: ["cit-1"],
    ...overrides,
  };
}

export function createSearchMetadata(overrides: Partial<SearchMetadata> = {}): SearchMetadata {
  return {
    type: "search",
    query: "transformer",
    total: 1,
    papers: [createPaper()],
    spellingCorrection: {
      originalQuery: "transformer",
      correctedQuery: "transformer",
    },
    ...overrides,
  };
}

export function createSearchView(params?: {
  id?: string;
  title?: string;
  metadata?: SearchMetadata;
  paper?: SearchPaper;
  timestamp?: string;
}): ResearchRoutePayload {
  const timestamp = params?.timestamp ?? "2026-04-17T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: params?.id ?? "search-1",
    type: "search",
    title: params?.title ?? "검색: transformer",
    content: "# 검색 결과",
    createdBy: "user",
    metadata:
      params?.metadata ??
      createSearchMetadata(params?.paper ? { papers: [params.paper] } : undefined),
    reaction: null,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createSearchViewRenderHarness() {
  let root: Root | null = null;
  let previousActEnvironment: boolean | undefined;
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  return {
    setup: () => {
      previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
      reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    },
    cleanup: () => {
      act(() => {
        root?.unmount();
      });
      root = null;
      reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    },
    render: (searchDocument: ResearchRoutePayload) => {
      const container = globalThis.document.createElement("div");
      root = createRoot(container);

      act(() => {
        root?.render(<SearchView document={searchDocument} />);
      });

      return container;
    },
    rerender: (searchDocument: ResearchRoutePayload) => {
      if (!root) {
        throw new Error("SearchView must be rendered before it can be rerendered");
      }
      act(() => {
        root?.render(<SearchView document={searchDocument} />);
      });
    },
  };
}
