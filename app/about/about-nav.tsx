import Link from "next/link";
import { t } from "@/app/i18n/message-access";

const ABOUT_NAV_ITEMS = [
  {
    href: "/about",
    labelKey: "commitment.about.nav.overview",
    current: "overview",
  },
  {
    href: "/about/search",
    labelKey: "commitment.about.nav.search",
    current: "search",
  },
  {
    href: "/about/gap-network",
    labelKey: "commitment.about.nav.gapNetwork",
    current: "gap-network",
  },
  {
    href: "/about/graph/sample",
    labelKey: "commitment.about.nav.graph",
    current: "graph",
  },
  {
    href: "/about/ai-comments",
    labelKey: "commitment.about.nav.aiComments",
    current: "ai-comments",
  },
  {
    href: "/about/promises",
    labelKey: "commitment.about.nav.promises",
    current: "promises",
  },
] as const;

type AboutNavCurrent = (typeof ABOUT_NAV_ITEMS)[number]["current"];

export function AboutNav({ current }: { current: AboutNavCurrent }) {
  return (
    <nav
      aria-label={t("commitment.about.nav.label")}
      className="border-border-subtle mb-10 flex flex-wrap gap-2 border-b pb-4"
      data-testid="commitment-about-nav"
    >
      {ABOUT_NAV_ITEMS.map((item) => {
        const isCurrent = item.current === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            className={`rounded-lh-sm border px-3 py-2 text-sm font-medium transition-colors ${
              isCurrent
                ? "border-accent bg-accent-soft text-accent"
                : "border-border-subtle text-text-muted hover:border-border-strong hover:text-foreground"
            }`}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
