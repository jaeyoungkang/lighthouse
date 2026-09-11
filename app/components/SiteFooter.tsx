import Image from "next/image";
import { DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS } from "@/app/components/research/research-route-layout.shared";
import { t } from "@/app/i18n/message-access";

// @aspect aspect:common-page-footer
const FOOTER_LINKS = [
  { href: "/about/search", labelKey: "footerAboutSearchLink" },
  { href: "/about/graph/sample", labelKey: "footerAboutGraphLink" },
  { href: "/about/promises", labelKey: "footerAboutPromiseLink" },
] as const;

interface SiteFooterProps {
  className?: string;
  fullBleed?: boolean;
  testId?: string;
  railTestId?: string;
}

export function SiteFooter({
  className = "",
  fullBleed = false,
  testId = "site-footer",
  railTestId = "site-footer-rail",
}: SiteFooterProps) {
  return (
    <footer
      className={`bg-background ${
        fullBleed ? "relative left-1/2 w-screen -translate-x-1/2" : "w-full"
      } border-t-0 ${className}`}
      data-testid={testId}
      aria-labelledby={`${testId}-title`}
    >
      <div
        className={`mx-auto flex w-full flex-col items-center px-4 py-12 text-center sm:px-6 ${DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS}`}
        data-testid={railTestId}
      >
        <div className="flex items-center justify-center gap-2">
          <Image
            src="/brand/scholar-logo.png"
            alt="Moonlight"
            width={423}
            height={80}
            className="h-9 w-auto object-contain"
          />
          <h2 id={`${testId}-title`} className="sr-only">
            {t("search.label.search-view-content.footerAboutTitle")}
          </h2>
        </div>
        <nav
          aria-label={t("search.label.search-view-content.footerAboutNavLabel")}
          className="text-text-secondary mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium"
        >
          {FOOTER_LINKS.map((link) => (
            <a key={link.href} className="hover:text-foreground hover:underline" href={link.href}>
              {t(`search.label.search-view-content.${link.labelKey}`)}
            </a>
          ))}
        </nav>
        <p className="text-text-muted mt-7 max-w-2xl text-sm leading-6">
          <span className="text-foreground font-semibold">
            {t("search.label.search-view-content.footerAboutTitle")}
          </span>{" "}
          {t("search.label.search-view-content.footerAboutBody")}
        </p>
        <address className="text-text-secondary mt-8 leading-6 not-italic">
          <p>{t("search.label.search-view-content.footerBusinessLine1")}</p>
          <p>{t("search.label.search-view-content.footerBusinessLine2")}</p>
          <p>{t("search.label.search-view-content.footerBusinessLine3")}</p>
        </address>
        <p className="text-text-secondary mt-5">
          {t("search.label.search-view-content.footerCopyright")}
        </p>
      </div>
    </footer>
  );
}
