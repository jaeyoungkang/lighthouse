// @promise promise:researcher-prose-promises-page
// @aspect aspect:user-facing-language-governance
// @check acceptance-check:researcher-prose-promises-page-ai-comment-type-explainer
import type { Metadata } from "next";
import { AboutMechanismPage } from "@/app/about/about-mechanism-page";
import { t } from "@/app/i18n/message-access";

export const metadata: Metadata = {
  title: t("commitment.aiComments.title"),
  description: t("commitment.aiComments.description"),
};

const AI_COMMENT_SECTIONS = [
  {
    id: "search",
    titleKey: "commitment.aiComments.search.title",
    bodyKey: "commitment.aiComments.search.body",
  },
  {
    id: "citation",
    titleKey: "commitment.aiComments.citation.title",
    bodyKey: "commitment.aiComments.citation.body",
  },
  {
    id: "similar",
    titleKey: "commitment.aiComments.similar.title",
    bodyKey: "commitment.aiComments.similar.body",
  },
  {
    id: "gap",
    titleKey: "commitment.aiComments.gap.title",
    bodyKey: "commitment.aiComments.gap.body",
  },
  {
    id: "inline",
    titleKey: "commitment.aiComments.inline.title",
    bodyKey: "commitment.aiComments.inline.body",
  },
] as const;

export default function AiCommentsPage() {
  return (
    <AboutMechanismPage
      current="ai-comments"
      pageTestId="commitment-ai-comments-page"
      summaryTestId="commitment-ai-comments-summary"
      sectionTestIdPrefix="commitment-ai-comments"
      kickerKey="commitment.aiComments.kicker"
      titleKey="commitment.aiComments.title"
      ledeKey="commitment.aiComments.lede"
      summaryTitleKey="commitment.aiComments.summary.title"
      summaryBodyKey="commitment.aiComments.summary.body"
      sections={AI_COMMENT_SECTIONS}
    />
  );
}
