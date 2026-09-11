// @promise promise:researcher-prose-promises-page
// @aspect aspect:user-facing-language-governance
// @aspect aspect:common-page-footer
import type { Metadata } from "next";
import { AboutNav } from "@/app/about/about-nav";
import { SiteFooter } from "@/app/components/SiteFooter";
import { t } from "@/app/i18n/message-access";
import { PROMISE_PARAGRAPHS } from "./promise-paragraphs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: t("commitment.promises.title"),
  description: t("commitment.promises.description"),
};

export default function PromisesPage() {
  return (
    <main
      className="text-foreground h-full flex-1 overflow-y-auto"
      data-testid="commitment-promises-page"
    >
      <div className="mx-auto max-w-2xl px-6 py-16">
        <header className="mb-10">
          <h1 className="text-foreground font-display text-3xl font-semibold tracking-tight">
            {t("commitment.promises.title")}
          </h1>
          <p className="text-text-muted mt-4 text-base leading-relaxed">
            {t("commitment.promises.identity")}
          </p>
        </header>
        <AboutNav current="promises" />
        <div className="space-y-8">
          {PROMISE_PARAGRAPHS.map((paragraph, index) => (
            <section
              key={paragraph.id}
              data-testid={`commitment-promise-${paragraph.id}`}
              data-value-facets={paragraph.valueFacetIds.join(" ")}
              className="border-border-subtle border-l-2 pl-5"
            >
              <h2 className="text-foreground text-lg font-semibold">
                {t(paragraph.titleKey)}
                <sup className="text-text-muted ml-1 text-xs font-medium">{index + 1}</sup>
              </h2>
              <p className="text-text-muted mt-2 text-base leading-relaxed">
                {t(paragraph.bodyKey)}
              </p>
            </section>
          ))}
        </div>
        <aside
          className="border-border-subtle mt-12 border-t pt-6"
          aria-label={t("commitment.promises.footnotes.heading")}
        >
          <h2 className="text-foreground text-sm font-semibold">
            {t("commitment.promises.footnotes.heading")}
          </h2>
          <ol className="text-text-muted mt-3 space-y-2 text-sm leading-relaxed">
            {PROMISE_PARAGRAPHS.map((paragraph, index) => (
              <li key={paragraph.id} data-promise-ref={paragraph.footnoteRef}>
                {index + 1}. {paragraph.footnoteRef.replace(/,/g, ", ")}
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <SiteFooter className="mt-8" testId="commitment-promises-footer" />
    </main>
  );
}
