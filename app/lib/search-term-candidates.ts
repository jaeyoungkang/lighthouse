import type { EnglishTermCandidate } from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";

export function getEnglishTermCandidateBasisSource(params: {
  hasAbstractBasis: boolean;
  graphSupportCount: number;
}): string {
  if (params.graphSupportCount > 0) {
    return params.hasAbstractBasis
      ? t("search.label.search-term-discovery.titleAbstractGraphSource")
      : t("search.label.search-term-discovery.titleGraphSource");
  }
  return params.hasAbstractBasis
    ? t("search.label.search-term-discovery.titleAbstractSource")
    : t("search.label.search-term-discovery.titleSource");
}

export function compareEnglishTermCandidatesBySupport(
  left: EnglishTermCandidate,
  right: EnglishTermCandidate,
): number {
  if ((right.graphSupportCount ?? 0) !== (left.graphSupportCount ?? 0)) {
    return (right.graphSupportCount ?? 0) - (left.graphSupportCount ?? 0);
  }
  if ((right.methodSupportCount ?? 0) !== (left.methodSupportCount ?? 0)) {
    return (right.methodSupportCount ?? 0) - (left.methodSupportCount ?? 0);
  }
  if (right.supportCount !== left.supportCount) return right.supportCount - left.supportCount;
  return left.term.localeCompare(right.term);
}
