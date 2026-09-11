"use client";

// @promise promise:search-results-fast-window
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:search-results-fast-window-publication-year-range-filter

import { t } from "@/app/i18n/message-access";

export interface SearchYearRangeFilterValue {
  from: string;
  to: string;
}

interface SearchYearRangeFilterProps {
  value: SearchYearRangeFilterValue;
  isSearching: boolean;
  onChange: (next: SearchYearRangeFilterValue) => void;
  onSubmit?: () => void;
}

export function SearchYearRangeFilter({
  value,
  isSearching,
  onChange,
  onSubmit,
}: SearchYearRangeFilterProps) {
  const handleClear = () => {
    onChange({ from: "", to: "" });
  };

  const handleEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onSubmit?.();
  };

  const inputClassName = "lh-input lh-type-control-label rounded-lh-sm w-16 px-2 py-1.5";

  return (
    <div
      className="lh-type-metadata flex items-center gap-1"
      data-testid="search-year-range-filter"
    >
      <span className="lh-tone-secondary">
        {t("search.label.search-view-content.yearRange.label")}
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value.from}
        disabled={isSearching}
        placeholder={t("search.label.search-view-content.yearRange.fromPlaceholder")}
        aria-label={t("search.label.search-view-content.yearRange.from")}
        onChange={(event) => {
          onChange({ ...value, from: event.target.value });
        }}
        onKeyDown={handleEnter}
        className={inputClassName}
      />
      <span className="lh-tone-secondary" aria-hidden="true">
        {t("search.label.search-view-content.yearRange.separator")}
      </span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value.to}
        disabled={isSearching}
        placeholder={t("search.label.search-view-content.yearRange.toPlaceholder")}
        aria-label={t("search.label.search-view-content.yearRange.to")}
        onChange={(event) => {
          onChange({ ...value, to: event.target.value });
        }}
        onKeyDown={handleEnter}
        className={inputClassName}
      />
      {(value.from || value.to) && (
        <button
          type="button"
          disabled={isSearching}
          onClick={handleClear}
          aria-label={t("search.label.search-view-content.yearRange.clearLabel")}
          className="lh-type-control-label lh-tone-control hover:text-foreground hover:underline disabled:opacity-50"
        >
          {t("search.label.search-view-content.yearRange.clear")}
        </button>
      )}
    </div>
  );
}
