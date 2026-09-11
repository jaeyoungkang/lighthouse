// @aspect aspect:library-grounded-research

import { create } from "zustand";

export type LibraryPresetPaper = {
  paperId: string;
  title: string;
  folderName: string;
  url?: string | null;
  authors?: { name: string }[];
  year?: number | null;
  citationCount?: number | null;
  reviewedAt?: string;
};

interface LibraryPapersState {
  papers: LibraryPresetPaper[];
  revision: number;
  setPapers: (papers: readonly LibraryPresetPaper[]) => void;
  upsertPaper: (paper: LibraryPresetPaper) => void;
  removePaper: (paperId: string) => void;
}

function normalizePaper(paper: LibraryPresetPaper): LibraryPresetPaper {
  return {
    paperId: paper.paperId,
    title: paper.title,
    folderName: paper.folderName,
    url: paper.url ?? null,
    authors: paper.authors ?? [],
    year: paper.year ?? null,
    citationCount: paper.citationCount ?? null,
    reviewedAt: paper.reviewedAt,
  };
}

export const useLibraryPapersStore = create<LibraryPapersState>((set) => ({
  papers: [],
  revision: 0,
  setPapers: (papers) => {
    set((state) => ({
      papers: papers.map(normalizePaper),
      revision: state.revision + 1,
    }));
  },
  upsertPaper: (paper) => {
    set((state) => {
      const normalized = normalizePaper(paper);
      return {
        papers: [
          normalized,
          ...state.papers.filter((current) => current.paperId !== paper.paperId),
        ],
        revision: state.revision + 1,
      };
    });
  },
  removePaper: (paperId) => {
    set((state) => ({
      papers: state.papers.filter((paper) => paper.paperId !== paperId),
      revision: state.revision + 1,
    }));
  },
}));
