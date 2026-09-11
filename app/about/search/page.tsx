// @promise promise:researcher-prose-promises-page
// @aspect aspect:user-facing-language-governance
// @check acceptance-check:researcher-prose-promises-page-search-mechanism-explainer
import type { Metadata } from "next";
import { AboutMechanismPage } from "@/app/about/about-mechanism-page";
import { SearchGraphSurfaceExplainers } from "@/app/about/graph/graph-surface-explainers";
import { t } from "@/app/i18n/message-access";

export const metadata: Metadata = {
  title: t("commitment.searchMechanism.title"),
  description: t("commitment.searchMechanism.description"),
};

export default function SearchMechanismPage() {
  return (
    <AboutMechanismPage
      current="search"
      pageTestId="commitment-search-mechanism-page"
      summaryTestId="commitment-search-mechanism-summary"
      sectionTestIdPrefix="commitment-search-mechanism"
      kickerKey="commitment.searchMechanism.kicker"
      titleKey="commitment.searchMechanism.title"
      ledeKey="commitment.searchMechanism.lede"
      summaryTitleKey="commitment.searchMechanism.summary.title"
      summaryBodyKey="commitment.searchMechanism.summary.body"
      sections={[]}
      introVisual={<SearchGraphSurfaceExplainers />}
    />
  );
}
