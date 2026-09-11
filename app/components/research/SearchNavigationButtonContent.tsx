// @promise promise:search-query-route-transition
// @promise promise:gap-led-next-search
// @aspect aspect:immediate-navigation
// @check acceptance-check:search-query-route-transition-submit-feedback
// @check acceptance-check:gap-led-next-search-click-feedback

import type { ReactNode } from "react";

export function SearchNavigationButtonContent({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {pending ? (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-current border-t-transparent"
          data-testid="search-navigation-button-spinner"
        />
      ) : null}
      <span>{children}</span>
    </>
  );
}
