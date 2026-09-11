import { getLighthouseDbFor, type RepositoryDbHandle } from "./db";

export interface AccessAllowlistEntryRow {
  email: string;
  updated_by: string;
  updated_at: string;
}

export interface AccessAllowlistPageEntryRow extends AccessAllowlistEntryRow {
  cursor_id: string;
}

export interface AccessAllowlistPageRow {
  entries: AccessAllowlistPageEntryRow[];
  previousCursor: string | null;
  nextCursor: string | null;
}

export type AccessAllowlistPageDirection = "after" | "before";

const ACCESS_ALLOWLIST_PAGE_SIZE = 50;

const ENTRY_COLUMNS = "email,updated_by,updated_at";
const PAGE_ENTRY_COLUMNS = "cursor_id,email,updated_by,updated_at";

export async function getAccessAllowlistEntryUnchecked(
  db: RepositoryDbHandle,
  email: string,
): Promise<AccessAllowlistEntryRow | null> {
  const { data, error } = await getLighthouseDbFor(db)
    .from("access_allowlist_entries")
    .select(ENTRY_COLUMNS)
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return (data as AccessAllowlistEntryRow | null) ?? null;
}

export async function listAccessAllowlistEntriesUnchecked(
  db: RepositoryDbHandle,
  params: {
    cursor?: string;
    direction?: AccessAllowlistPageDirection;
  } = {},
): Promise<AccessAllowlistPageRow> {
  const lighthouseDb = getLighthouseDbFor(db);
  const cursorBoundary = params.cursor
    ? await findAccessAllowlistCursorBoundary(lighthouseDb, params.cursor)
    : null;
  const direction = cursorBoundary
    ? (params.direction ?? "after")
    : params.cursor
      ? "after"
      : (params.direction ?? "after");

  let query = lighthouseDb.from("access_allowlist_entries").select(PAGE_ENTRY_COLUMNS);
  if (cursorBoundary) {
    query =
      direction === "before"
        ? query.lt("email", cursorBoundary.email)
        : query.gt("email", cursorBoundary.email);
  }

  const { data, error } = await query
    .order("email", { ascending: direction === "after" })
    .limit(ACCESS_ALLOWLIST_PAGE_SIZE + 1);

  if (error) throw error;
  const pageRows = data as AccessAllowlistPageEntryRow[];
  const rows = pageRows.slice(0, ACCESS_ALLOWLIST_PAGE_SIZE);
  const entries = direction === "before" ? rows.toReversed() : rows;
  const firstCursor = entries.length > 0 ? entries[0].cursor_id : null;
  const lastCursor = entries.length > 0 ? entries[entries.length - 1].cursor_id : null;
  const hasOverflow = pageRows.length > ACCESS_ALLOWLIST_PAGE_SIZE;

  return {
    entries,
    previousCursor:
      direction === "before"
        ? hasOverflow
          ? firstCursor
          : null
        : cursorBoundary
          ? (firstCursor ?? params.cursor ?? null)
          : null,
    nextCursor:
      direction === "after"
        ? hasOverflow
          ? lastCursor
          : null
        : cursorBoundary
          ? (lastCursor ?? params.cursor ?? null)
          : null,
  };
}

async function findAccessAllowlistCursorBoundary(
  lighthouseDb: ReturnType<typeof getLighthouseDbFor>,
  cursor: string,
): Promise<Pick<AccessAllowlistPageEntryRow, "email"> | null> {
  const { data, error } = await lighthouseDb
    .from("access_allowlist_entries")
    .select("email")
    .eq("cursor_id", cursor)
    .maybeSingle();

  if (error) throw error;
  return (data as Pick<AccessAllowlistPageEntryRow, "email"> | null) ?? null;
}

export async function upsertAccessAllowlistEntryUnchecked(
  db: RepositoryDbHandle,
  params: {
    email: string;
    updatedBy: string;
  },
): Promise<void> {
  const { error } = await getLighthouseDbFor(db)
    .from("access_allowlist_entries")
    .upsert(
      [
        {
          email: params.email,
          updated_by: params.updatedBy,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "email", defaultToNull: false },
    );

  if (error) throw error;
}

export async function deleteAccessAllowlistEntryUnchecked(
  db: RepositoryDbHandle,
  email: string,
): Promise<void> {
  const { error } = await getLighthouseDbFor(db)
    .from("access_allowlist_entries")
    .delete()
    .eq("email", email);

  if (error) throw error;
}
