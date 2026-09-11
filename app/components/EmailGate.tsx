"use client";

// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-result-basis-visible
// @check acceptance-check:search-results-fast-window-bootstrap-auth-challenge

import { useState, type SyntheticEvent } from "react";
import { tPublicClient as t } from "@/app/i18n/public-client-messages";
import { BrandLogo } from "@/app/components/BrandLogo";
import { getRequestErrorMessage, requestMagicLink } from "@/app/lib/auth/request-magic-link";
import { getLocalAuthInboxUrl } from "@/app/lib/supabase/auth-helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const LOCAL_AUTH_INBOX_URL = getLocalAuthInboxUrl(SUPABASE_URL);

export function EmailGate() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "confirm">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.includes("@")) {
      setError(t("auth.error.emailInvalid"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await requestMagicLink(normalizedEmail);
      setEmail(normalizedEmail);
      setStep("confirm");
    } catch (error) {
      setError(getRequestErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const submitForm = (event: SyntheticEvent<HTMLFormElement>) => {
    void handleSubmit(event);
  };

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="lh-panel rounded-lh-3xl w-full max-w-md px-6 py-7">
        <div className="text-center">
          <p className="lh-kicker">{t("onboarding.label.page")}</p>
          <h1 className="mt-4 flex justify-center">
            <BrandLogo placement="auth" priority testId="email-gate-brand-logo" />
          </h1>
          <p className="text-text-muted mt-3 text-sm leading-6">
            {step === "email"
              ? t("auth.label.email-gate")
              : t("auth.label.email-gate.2", { email })}
          </p>
          <p
            className="text-text-subtle mt-3 text-xs leading-5"
            data-testid="email-gate-source-coverage"
          >
            {t("auth.label.email-gate.sourceCoverage")}
          </p>
        </div>

        <form onSubmit={submitForm} className="mt-6 space-y-3">
          {step === "email" ? (
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              className="lh-input w-full rounded-2xl px-4 py-3 text-sm"
              autoFocus
              disabled={loading}
            />
          ) : (
            <div className="lh-panel-muted text-text-muted rounded-lh-2xl px-4 py-4 text-sm leading-6">
              {t("auth.label.email-gate.inboxPrompt.prefix")}
              <span className="text-foreground font-medium">
                {t("auth.label.email-gate.inboxPrompt.strong")}
              </span>
              {t("auth.label.email-gate.inboxPrompt.suffix")}
            </div>
          )}
          {error && <p className="text-error text-xs">{error}</p>}
          {LOCAL_AUTH_INBOX_URL && (
            <p className="text-text-muted text-xs leading-relaxed">
              {t("auth.label.email-gate.localHelper.prefix")}
              <a
                href={LOCAL_AUTH_INBOX_URL}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                {t("auth.label.email-gate.localHelper.link")}
              </a>
              {t("auth.label.email-gate.localHelper.suffix")}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !email}
            className="lh-control-accent w-full rounded-2xl px-4 py-3 text-sm font-medium"
          >
            {loading
              ? t("auth.label.email-gate.loading")
              : step === "email"
                ? t("auth.label.email-gate.3")
                : t("auth.label.email-gate.resend")}
          </button>
          {step === "confirm" && (
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className="lh-control text-text-muted w-full rounded-2xl px-4 py-3 text-sm font-medium"
              disabled={loading}
            >
              {t("auth.label.email-gate.reenter")}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
