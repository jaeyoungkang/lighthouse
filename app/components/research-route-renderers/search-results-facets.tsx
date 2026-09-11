// @promise promise:search-results-fast-window
// @aspect aspect:library-grounded-research
// @aspect aspect:user-facing-language-governance
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:search-results-fast-window-result-basis-visible
// @check acceptance-check:search-results-fast-window-loaded-result-facet-filters
// @check acceptance-check:search-results-fast-window-representative-filter

import { useCallback, useEffect, useRef, useState } from "react";
import { DisclosureChevron } from "@/app/components/DisclosureChevron";
import { t } from "@/app/i18n/message-access";

export interface FacetOption {
  value: string;
  count: number;
}

export function FacetDropdownChevron() {
  return (
    <DisclosureChevron className="text-text-subtle h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
  );
}

export function SearchFacetDropdown({
  dropdownKey,
  label,
  options,
  selected,
  disabled,
  onToggle,
  openKey,
  onOpenChange,
  triggerRef,
}: {
  dropdownKey: string;
  label: string;
  options: FacetOption[];
  selected: readonly string[];
  disabled: boolean;
  onToggle: (value: string) => void;
  openKey: string | null;
  onOpenChange: (key: string | null) => void;
  triggerRef?: (node: HTMLElement | null) => void;
}) {
  const selectedCount = selected.length;
  const isOpen = openKey === dropdownKey;
  return (
    <details className="group relative" open={isOpen} data-testid={`search-facet-${dropdownKey}`}>
      <summary
        ref={triggerRef}
        aria-disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          if (disabled) return;
          onOpenChange(isOpen ? null : dropdownKey);
        }}
        className="lh-control lh-type-control-label rounded-lh-sm border-border-subtle bg-surface-panel text-foreground group-open:border-accent flex cursor-pointer list-none items-center gap-1.5 border px-2.5 py-1.5 aria-disabled:opacity-50"
      >
        <span>{label}</span>
        {selectedCount > 0 ? (
          <span className="text-accent font-medium">{selectedCount}</span>
        ) : null}
        <FacetDropdownChevron />
      </summary>
      {isOpen ? (
        <div className="border-border-subtle bg-surface-panel absolute top-full left-0 z-20 mt-1 w-72 border p-3 shadow-lg">
          <p className="lh-type-metadata lh-tone-secondary mb-2 font-medium">{label}</p>
          <div className="max-h-72 space-y-2 overflow-auto">
            {options.length === 0 ? (
              <p className="lh-type-metadata lh-tone-tertiary">
                {t("search.label.search-view-content.facets.empty")}
              </p>
            ) : (
              options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="lh-type-control-label lh-tone-control flex min-w-0 items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => {
                        onToggle(option.value);
                      }}
                      className="accent-accent h-3.5 w-3.5 shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate">{option.value}</span>
                    <span className="lh-type-metadata lh-tone-tertiary shrink-0">
                      {option.count}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </details>
  );
}

export function useSingleOpenFacet() {
  const [openFacet, setOpenFacet] = useState<string | null>(null);
  const facetGroupRef = useRef<HTMLDivElement>(null);
  const openFacetRef = useRef<string | null>(null);
  const triggerRefs = useRef<Record<string, HTMLElement | null>>({});
  const registerFacetTrigger = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      triggerRefs.current[key] = node;
    },
    [],
  );
  const updateOpenFacet = useCallback((key: string | null) => {
    openFacetRef.current = key;
    setOpenFacet(key);
  }, []);
  const closeOpenFacet = useCallback((restoreFocus: boolean) => {
    const closingFacet = openFacetRef.current;
    openFacetRef.current = null;
    setOpenFacet(null);
    if (restoreFocus && closingFacet) {
      triggerRefs.current[closingFacet]?.focus();
    }
  }, []);

  useEffect(() => {
    if (openFacet === null) return;
    const closeOnOutside = (event: Event) => {
      if (!facetGroupRef.current?.contains(event.target as Node)) {
        closeOpenFacet(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeOpenFacet(true);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeOpenFacet, openFacet]);

  return { openFacet, setOpenFacet: updateOpenFacet, facetGroupRef, registerFacetTrigger };
}
