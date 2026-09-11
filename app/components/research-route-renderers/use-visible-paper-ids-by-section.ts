import { useCallback, useMemo, useState } from "react";

interface VisiblePaperIdsState {
  documentId: string;
  bySection: Record<string, readonly string[]>;
}

export function useVisiblePaperIdsBySection(documentId: string): {
  visiblePaperIds: string[];
  handleVisiblePaperIdsChange: (sectionId: string, paperIds: readonly string[]) => void;
} {
  const [visiblePaperIdsState, setVisiblePaperIdsState] = useState<VisiblePaperIdsState>(() => ({
    documentId,
    bySection: {},
  }));
  const visiblePaperIds = useMemo(
    () =>
      visiblePaperIdsState.documentId === documentId
        ? [...new Set(Object.values(visiblePaperIdsState.bySection).flat())]
        : [],
    [documentId, visiblePaperIdsState],
  );
  const handleVisiblePaperIdsChange = useCallback(
    (sectionId: string, paperIds: readonly string[]) => {
      setVisiblePaperIdsState((current) => {
        const bySection = current.documentId === documentId ? current.bySection : {};
        const currentIds = bySection[sectionId] ?? [];
        if (
          current.documentId === documentId &&
          currentIds.length === paperIds.length &&
          currentIds.every((paperId, index) => paperId === paperIds[index])
        ) {
          return current;
        }
        return { documentId, bySection: { ...bySection, [sectionId]: paperIds } };
      });
    },
    [documentId],
  );

  return { visiblePaperIds, handleVisiblePaperIdsChange };
}
