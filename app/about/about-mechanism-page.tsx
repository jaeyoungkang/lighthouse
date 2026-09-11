// @promise promise:researcher-prose-promises-page
// @aspect aspect:user-facing-language-governance
// @aspect aspect:common-page-footer
import Link from "next/link";
import type { ReactNode } from "react";
import { AboutNav } from "@/app/about/about-nav";
import { SiteFooter } from "@/app/components/SiteFooter";
import { t } from "@/app/i18n/message-access";

type AboutMechanismPageCurrent = "search" | "gap-network" | "graph" | "ai-comments";

interface AboutMechanismSection {
  id: string;
  titleKey: Parameters<typeof t>[0];
  bodyKey: Parameters<typeof t>[0];
}

interface AboutMechanismPageProps {
  current: AboutMechanismPageCurrent;
  pageTestId: string;
  summaryTestId: string;
  sectionTestIdPrefix: string;
  kickerKey: Parameters<typeof t>[0];
  titleKey: Parameters<typeof t>[0];
  ledeKey: Parameters<typeof t>[0];
  summaryTitleKey: Parameters<typeof t>[0];
  summaryBodyKey: Parameters<typeof t>[0];
  sections: readonly AboutMechanismSection[];
  introVisual?: ReactNode;
  relatedLinks?: readonly {
    href: string;
    labelKey: Parameters<typeof t>[0];
    bodyKey: Parameters<typeof t>[0];
  }[];
}

export function AboutMechanismPage(props: AboutMechanismPageProps) {
  return (
    <main className="text-foreground h-full flex-1 overflow-y-auto" data-testid={props.pageTestId}>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <header className="mb-10">
          <p className="text-accent text-lh-xs font-semibold tracking-wide uppercase">
            {t(props.kickerKey)}
          </p>
          <h1 className="text-foreground font-display mt-2 text-3xl font-semibold tracking-tight">
            {t(props.titleKey)}
          </h1>
          <p className="text-text-muted mt-4 text-base leading-relaxed">{t(props.ledeKey)}</p>
        </header>
        <AboutNav current={props.current} />
        {props.introVisual}

        <section
          className="border-border-subtle bg-surface-panel rounded-lh-md mb-8 border px-5 py-5"
          data-testid={props.summaryTestId}
        >
          <h2 className="text-foreground text-lg font-semibold">{t(props.summaryTitleKey)}</h2>
          <p className="text-text-muted mt-2 text-base leading-relaxed">
            {t(props.summaryBodyKey)}
          </p>
        </section>

        <div className="space-y-4">
          {props.sections.map((section, index) => (
            <section
              key={section.id}
              className="border-border-subtle rounded-lh-md border px-5 py-5"
              data-testid={`${props.sectionTestIdPrefix}-${section.id}`}
            >
              <div className="flex items-start gap-3">
                <span className="bg-accent-soft text-accent mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {index + 1}
                </span>
                <div>
                  <h2 className="text-foreground text-lg font-semibold">{t(section.titleKey)}</h2>
                  <p className="text-text-muted mt-2 text-base leading-relaxed">
                    {t(section.bodyKey)}
                  </p>
                </div>
              </div>
            </section>
          ))}
        </div>
        {props.relatedLinks && props.relatedLinks.length > 0 ? (
          <section
            className="border-border-subtle mt-8 border-t pt-6"
            data-testid={`${props.sectionTestIdPrefix}-related-links`}
          >
            <h2 className="text-foreground text-base font-semibold">
              {t("commitment.mechanism.relatedLinks.title")}
            </h2>
            <div className="mt-3 grid gap-3">
              {props.relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="border-border-subtle hover:border-border-strong rounded-lh-md border px-4 py-3 transition-colors"
                >
                  <span className="text-foreground block text-sm font-semibold">
                    {t(link.labelKey)}
                  </span>
                  <span className="text-text-muted mt-1 block text-sm leading-relaxed">
                    {t(link.bodyKey)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <SiteFooter className="mt-8" testId={`${props.pageTestId}-footer`} />
    </main>
  );
}
