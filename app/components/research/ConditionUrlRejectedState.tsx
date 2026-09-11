// @aspect aspect:search-first-url-model

import { t } from "@/app/i18n/message-access";

export function ConditionUrlRejectedState() {
  return (
    <section
      className="mx-auto flex min-h-[50vh] w-full max-w-3xl flex-col justify-center px-5 py-12"
      data-testid="condition-url-rejected-state"
    >
      <div className="border-border-subtle bg-surface-panel rounded-lh-lg border p-6">
        <h1 className="text-text-primary text-lh-xl font-semibold">
          {t("search.label.conditionUrl.rejected.title")}
        </h1>
        <p className="text-text-secondary mt-2 leading-7">
          {t("search.label.conditionUrl.rejected.body")}
        </p>
      </div>
    </section>
  );
}
