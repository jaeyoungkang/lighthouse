import { t } from "@/app/i18n/message-access";

export const KNOWLEDGE_MAP_LENS_IDS = ["E2"] as const;

export type KnowledgeMapLensId = (typeof KNOWLEDGE_MAP_LENS_IDS)[number];

export function getKnowledgeMapDisplayName(lensId: KnowledgeMapLensId): string {
  void lensId;
  return t("document.label.rendering.31");
}

export function getKnowledgeMapLensTitle(lensId: KnowledgeMapLensId): string {
  return getKnowledgeMapDisplayName(lensId);
}

export function getKnowledgeMapLensChipLabel(lensId: KnowledgeMapLensId): string {
  return getKnowledgeMapDisplayName(lensId);
}

export function buildKnowledgeMapPendingTitle(lensId: KnowledgeMapLensId): string {
  return t("knowledgeMap.label.knowledge-map-lens", {
    displayName: getKnowledgeMapDisplayName(lensId),
  });
}

export function buildKnowledgeMapFailedTitle(lensId: KnowledgeMapLensId): string {
  return t("knowledgeMap.error.knowledge-map-lens", {
    displayName: getKnowledgeMapDisplayName(lensId),
  });
}

export function buildKnowledgeMapTitle(
  lensId: KnowledgeMapLensId,
  query: string,
  options?: { domainLabel?: string },
): string {
  // E2 lens가 단일 lens지만 향후 lens 추가에 대비해 분기 형태 유지 — domainLabel은
  // E2 lens일 때만 의미를 가지므로 lens 분기 분리.
  void lensId;
  if (options?.domainLabel) {
    return `${getKnowledgeMapLensTitle("E2")}: ${options.domainLabel}`;
  }
  return `${getKnowledgeMapLensTitle("E2")}: ${query}`;
}
