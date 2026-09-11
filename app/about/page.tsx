// @promise promise:researcher-prose-promises-page
// @aspect aspect:user-facing-language-governance
// @aspect aspect:common-page-footer
import type { Metadata } from "next";
import { AboutCard } from "@/app/about/about-card";
import { AboutNav } from "@/app/about/about-nav";
import { SiteFooter } from "@/app/components/SiteFooter";
import { t } from "@/app/i18n/message-access";

export const metadata: Metadata = {
  title: t("commitment.about.title"),
};

export default function AboutPage() {
  return (
    <main
      className="text-foreground h-full flex-1 overflow-y-auto"
      data-testid="commitment-about-page"
    >
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-10">
          <h1 className="text-foreground font-display text-3xl font-semibold tracking-tight">
            {t("commitment.about.title")}
          </h1>
          <p className="text-text-muted mt-3 text-base leading-relaxed">
            {t("commitment.about.lede")}
          </p>
        </header>
        <AboutNav current="overview" />
        <div className="grid gap-4">
          <AboutCard
            href="/about/search"
            testId="commitment-about-card-search"
            title={t("commitment.about.card.search.title")}
            body={t("commitment.about.card.search.body")}
            cta={t("commitment.about.card.search.cta")}
          />
          <AboutCard
            href="/about/gap-network"
            testId="commitment-about-card-gap-network"
            title={t("commitment.about.card.gapNetwork.title")}
            body={t("commitment.about.card.gapNetwork.body")}
            cta={t("commitment.about.card.gapNetwork.cta")}
          />
          <AboutCard
            href="/about/graph/sample"
            testId="commitment-about-card-graph"
            title={t("commitment.about.card.graph.title")}
            body={t("commitment.about.card.graph.body")}
            cta={t("commitment.about.card.graph.cta")}
          />
          <AboutCard
            href="/about/ai-comments"
            testId="commitment-about-card-ai-comments"
            title={t("commitment.about.card.aiComments.title")}
            body={t("commitment.about.card.aiComments.body")}
            cta={t("commitment.about.card.aiComments.cta")}
          />
          <AboutCard
            href="/about/promises"
            testId="commitment-about-card-promises"
            title={t("commitment.about.card.promises.title")}
            body={t("commitment.about.card.promises.body")}
            cta={t("commitment.about.card.promises.cta")}
            analyticsTarget="promises"
          />
        </div>
      </div>
      <SiteFooter className="mt-8" testId="commitment-about-footer" />
    </main>
  );
}
