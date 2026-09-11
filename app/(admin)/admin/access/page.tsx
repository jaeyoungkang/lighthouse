// @promise promise:invited-user-access-management
// @aspect aspect:admin-access-control
// @aspect aspect:common-page-footer
// @check acceptance-check:invited-user-access-management-admin-surface

import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/app/components/SiteFooter";
import { t } from "@/app/i18n/message-access";
import { ForbiddenError, UnauthenticatedError } from "@/app/server/auth/auth-errors";
import { requireInternalAdminAuth } from "@/app/server/auth/internal-admin";
import {
  listInvitedAccessForAdmin,
  type InvitedAccessEntry,
} from "@/app/server/domain-access/access-allowlist-access";
import { addInvitedAccess, removeInvitedAccess } from "./actions";

type AccessPageStatus = "added" | "removed" | "invalid" | "failed";
type AccessPageDirection = "after" | "before";

const OPAQUE_CURSOR_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function accessPageHref(cursor?: string, direction: AccessPageDirection = "after"): string {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (direction === "before") params.set("direction", direction);
  const query = params.toString();
  return query ? `/admin/access?${query}` : "/admin/access";
}

function statusMessage(status: AccessPageStatus | undefined): {
  tone: "success" | "error";
  message: string;
} | null {
  if (status === "added") return { tone: "success", message: t("admin.access.status.added") };
  if (status === "removed") return { tone: "success", message: t("admin.access.status.removed") };
  if (status === "invalid") return { tone: "error", message: t("admin.access.error.invalid") };
  if (status === "failed") return { tone: "error", message: t("admin.access.error.saveFailed") };
  return null;
}

function formatUpdatedAt(entry: InvitedAccessEntry): string | null {
  if (!entry.updatedAt || !entry.updatedBy) return null;
  const date = new Date(entry.updatedAt);
  if (Number.isNaN(date.valueOf())) return entry.updatedBy;
  return t("admin.access.list.updated", {
    date: new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Seoul",
    }).format(date),
    email: entry.updatedBy,
  });
}

async function requireAdminAuthOrNotFound() {
  try {
    return await requireInternalAdminAuth();
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthenticatedError) {
      notFound();
    }
    throw error;
  }
}

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string | string[];
    cursor?: string | string[];
    direction?: string | string[];
  }>;
}) {
  const auth = await requireAdminAuthOrNotFound();
  const resolvedSearchParams = await searchParams;
  const rawStatus = resolvedSearchParams?.status;
  const status =
    typeof rawStatus === "string" && ["added", "removed", "invalid", "failed"].includes(rawStatus)
      ? (rawStatus as AccessPageStatus)
      : undefined;
  const notice = statusMessage(status);
  const rawCursor = resolvedSearchParams?.cursor;
  const hasValidCursor = typeof rawCursor === "string" && OPAQUE_CURSOR_RE.test(rawCursor);
  const cursor = hasValidCursor ? rawCursor : undefined;
  const direction: AccessPageDirection =
    rawCursor !== undefined && !hasValidCursor
      ? "after"
      : resolvedSearchParams?.direction === "before"
        ? "before"
        : "after";

  let entries: InvitedAccessEntry[] = [];
  let previousCursor: string | null = null;
  let nextCursor: string | null = null;
  let loadFailed = false;
  try {
    const page = await listInvitedAccessForAdmin(auth, { cursor, direction });
    entries = page.entries;
    previousCursor = page.previousCursor;
    nextCursor = page.nextCursor;
  } catch {
    loadFailed = true;
  }

  return (
    <main className="text-foreground h-full flex-1 overflow-y-auto" data-testid="admin-access-page">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="border-border-subtle mb-12 border-b pb-8">
          <p className="text-text-muted mb-3 font-mono text-xs tracking-[0.12em] uppercase">
            {t("admin.access.eyebrow")} · {auth.user.email}
          </p>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="font-display text-4xl font-semibold tracking-tight">
                {t("admin.access.title")}
              </h1>
              <p className="text-text-secondary mt-4 max-w-2xl text-base leading-7">
                {t("admin.access.description")}
              </p>
            </div>
            <nav
              aria-label={t("admin.access.nav.label")}
              className="flex gap-4 font-mono text-xs font-semibold uppercase"
            >
              <Link className="text-foreground border-b border-current pb-1" href="/admin/access">
                {t("admin.access.nav.access")}
              </Link>
              <Link className="text-text-muted hover:text-foreground pb-1" href="/admin/analytics">
                {t("admin.access.nav.analytics")}
              </Link>
            </nav>
          </div>
        </header>

        {notice ? (
          <p
            role="status"
            className={`mb-8 border px-4 py-3 text-sm ${
              notice.tone === "error"
                ? "border-red-400/40 bg-red-500/5 text-red-700 dark:text-red-300"
                : "border-emerald-400/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            {notice.message}
          </p>
        ) : null}

        <section className="mb-14 grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(17rem,0.7fr)]">
          <div>
            <h2 className="font-display text-xl font-semibold">{t("admin.access.add.heading")}</h2>
            <p className="text-text-secondary mt-2 max-w-xl text-sm leading-6">
              {t("admin.access.add.description")}
            </p>
          </div>
          <form action={addInvitedAccess} className="space-y-3">
            <label htmlFor="invited-access-email" className="block text-sm font-semibold">
              {t("admin.access.add.label")}
            </label>
            <input
              id="invited-access-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              spellCheck={false}
              placeholder={t("admin.access.add.placeholder")}
              className="border-border-subtle bg-background focus:border-foreground h-11 w-full border px-3 text-sm outline-none"
            />
            <button
              type="submit"
              className="border-foreground bg-foreground text-background inline-flex min-h-10 items-center justify-center border px-4 py-2 text-sm font-semibold transition hover:opacity-85"
            >
              {t("admin.access.add.submit")}
            </button>
          </form>
        </section>

        <section aria-labelledby="invited-access-list-heading">
          <div className="border-border-subtle flex items-baseline justify-between border-b pb-3">
            <h2 id="invited-access-list-heading" className="font-display text-xl font-semibold">
              {t("admin.access.list.heading")}
            </h2>
            {loadFailed ? null : (
              <span className="text-text-muted font-mono text-xs">
                {t("admin.access.list.pageCount", { count: entries.length })}
              </span>
            )}
          </div>

          {loadFailed ? (
            <p role="alert" className="border-border-subtle border-b py-6 text-sm text-red-700">
              {t("admin.access.error.loadFailed")}
            </p>
          ) : entries.length === 0 ? (
            <p className="text-text-muted border-border-subtle border-b py-8 text-sm">
              {t(
                previousCursor || nextCursor
                  ? "admin.access.list.pageEmpty"
                  : "admin.access.list.empty",
              )}
            </p>
          ) : (
            <ul className="divide-border-subtle divide-y border-b">
              {entries.map((entry) => {
                const updatedAt = formatUpdatedAt(entry);
                return (
                  <li
                    key={entry.email}
                    className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold break-all">{entry.email}</p>
                      <p className="text-text-muted mt-1 text-xs">
                        {t("admin.access.list.source.admin")}
                        {updatedAt ? ` · ${updatedAt}` : ""}
                      </p>
                    </div>
                    <form action={removeInvitedAccess}>
                      <input type="hidden" name="email" value={entry.email} />
                      <button
                        type="submit"
                        className="border-border-subtle text-text-secondary hover:border-foreground hover:text-foreground inline-flex min-h-10 items-center justify-center border px-4 py-2 text-sm font-semibold transition"
                      >
                        {t("admin.access.remove.submit")}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          {loadFailed ||
          (entries.length === 0 && previousCursor === null && nextCursor === null) ? null : (
            <nav
              aria-label={t("admin.access.pagination.label")}
              className="mt-6 flex flex-wrap items-center justify-between gap-3 font-mono text-xs font-semibold uppercase"
            >
              <div className="flex gap-3">
                <Link className="hover:text-foreground text-text-muted" href="/admin/access">
                  {t("admin.access.pagination.first")}
                </Link>
                {previousCursor ? (
                  <Link
                    className="hover:text-foreground text-text-muted"
                    href={accessPageHref(previousCursor, "before")}
                  >
                    {t("admin.access.pagination.previous")}
                  </Link>
                ) : null}
              </div>
              <div className="flex gap-3">
                {nextCursor ? (
                  <Link
                    className="hover:text-foreground text-text-muted"
                    href={accessPageHref(nextCursor)}
                  >
                    {t("admin.access.pagination.next")}
                  </Link>
                ) : null}
                <Link
                  className="hover:text-foreground text-text-muted"
                  href={accessPageHref(undefined, "before")}
                >
                  {t("admin.access.pagination.last")}
                </Link>
              </div>
            </nav>
          )}
        </section>
      </div>
      <SiteFooter testId="admin-access-footer" />
    </main>
  );
}
