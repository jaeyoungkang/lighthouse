"use client";

// @promise promise:search-results-fast-window
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @aspect aspect:paper-card-presentation-consistency
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:search-results-fast-window-card-triage-metadata

import { useState, type MouseEvent } from "react";
import type { PaperCore } from "@/app/domain/paper";
import { t } from "@/app/i18n/message-access";
import { type SearchTermFollowupHandler } from "./search-view.helpers";

const INITIAL_AUTHOR_COUNT = 3;

export function SearchResultAuthorRow({
  authors,
  onSearchTerm,
}: {
  authors: PaperCore["authors"];
  onSearchTerm?: SearchTermFollowupHandler;
}) {
  const [expanded, setExpanded] = useState(false);
  const availableAuthors = authors.filter((author) => author.name.trim().length > 0);

  if (availableAuthors.length === 0) {
    return (
      <div
        className="lh-type-metadata lh-tone-tertiary mt-1 min-h-6"
        data-testid="search-result-authors"
      >
        {t("search.label.search-result-item.authorsUnavailable")}
      </div>
    );
  }

  const visibleAuthors = expanded
    ? availableAuthors
    : availableAuthors.slice(0, INITIAL_AUTHOR_COUNT);
  const hiddenCount = Math.max(availableAuthors.length - INITIAL_AUTHOR_COUNT, 0);

  const searchAuthor = (authorName: string, event: MouseEvent<HTMLButtonElement>) => {
    onSearchTerm?.(authorName, undefined, event);
  };

  return (
    <div
      className="lh-type-metadata lh-tone-secondary mt-1 flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-1"
      data-testid="search-result-authors"
    >
      {visibleAuthors.map((author, index) => (
        <span
          key={`${author.authorId ?? author.name}:${String(index)}`}
          className="inline-flex items-center"
        >
          {onSearchTerm ? (
            <button
              type="button"
              className="lh-type-compact-control lh-tone-control hover:text-accent underline-offset-4 hover:underline"
              title={t("search.label.search-result-item.searchAuthor", { name: author.name })}
              onClick={(event) => {
                searchAuthor(author.name, event);
              }}
              onAuxClick={(event) => {
                if (event.button !== 1) return;
                searchAuthor(author.name, event);
              }}
            >
              {author.name}
            </button>
          ) : (
            <span>{author.name}</span>
          )}
          {index < visibleAuthors.length - 1 ? <span aria-hidden="true">,</span> : null}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="lh-type-compact-control lh-tone-control hover:text-accent underline-offset-4 transition-colors hover:underline"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded((current) => !current);
          }}
        >
          {expanded
            ? t("search.label.search-result-item.collapseAuthors")
            : t("search.label.search-result-item.expandAuthors", { count: hiddenCount })}
        </button>
      ) : null}
    </div>
  );
}
