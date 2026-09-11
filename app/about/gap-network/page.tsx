// @promise promise:researcher-prose-promises-page
// @aspect aspect:user-facing-language-governance
// @check acceptance-check:researcher-prose-promises-page-gap-network-explainer
import type { Metadata } from "next";
import { AboutMechanismPage } from "@/app/about/about-mechanism-page";
import { GraphSurfaceExplainer } from "@/app/about/graph/graph-surface-explainers";
import { t } from "@/app/i18n/message-access";

export const metadata: Metadata = {
  title: t("commitment.gapNetworkMechanism.title"),
  description: t("commitment.gapNetworkMechanism.description"),
};

export default function GapNetworkMechanismPage() {
  return (
    <AboutMechanismPage
      current="gap-network"
      pageTestId="commitment-gap-network-mechanism-page"
      summaryTestId="commitment-gap-network-mechanism-summary"
      sectionTestIdPrefix="commitment-gap-network-mechanism"
      kickerKey="commitment.gapNetworkMechanism.kicker"
      titleKey="commitment.gapNetworkMechanism.title"
      ledeKey="commitment.gapNetworkMechanism.lede"
      summaryTitleKey="commitment.gapNetworkMechanism.summary.title"
      summaryBodyKey="commitment.gapNetworkMechanism.summary.body"
      sections={[]}
      introVisual={
        <div className="mb-8">
          <GraphSurfaceExplainer variant="gap" />
        </div>
      }
    />
  );
}
