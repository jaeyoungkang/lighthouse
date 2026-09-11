import type { AuthContext } from "@/app/server/auth/identity";
import {
  isInternalEmail,
  isValidExternalAccessEmail,
  normalizeAccessEmail,
} from "@/app/server/auth/access-policy";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import {
  type AccessAllowlistPageDirection,
  deleteAccessAllowlistEntryUnchecked,
  getAccessAllowlistEntryUnchecked,
  listAccessAllowlistEntriesUnchecked,
  upsertAccessAllowlistEntryUnchecked,
} from "@/app/server/repository/access-allowlist";

export type ProductAccessDecision = "allowed" | "denied" | "unavailable";

export interface InvitedAccessEntry {
  cursor: string;
  email: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface InvitedAccessPage {
  entries: InvitedAccessEntry[];
  previousCursor: string | null;
  nextCursor: string | null;
}

export async function resolveProductAccessForEmail(
  db: RepositoryDbHandle,
  email: string,
): Promise<ProductAccessDecision> {
  const normalizedEmail = normalizeAccessEmail(email);
  if (isInternalEmail(normalizedEmail)) return "allowed";

  try {
    const persisted = await getAccessAllowlistEntryUnchecked(db, normalizedEmail);
    return persisted ? "allowed" : "denied";
  } catch {
    return "unavailable";
  }
}

export async function listInvitedAccessForAdmin(
  auth: AuthContext,
  params: {
    cursor?: string;
    direction?: AccessAllowlistPageDirection;
  } = {},
): Promise<InvitedAccessPage> {
  assertInternalAdmin(auth);
  const persisted = await listAccessAllowlistEntriesUnchecked(auth.db, params);
  return {
    entries: persisted.entries.map((entry) => ({
      cursor: entry.cursor_id,
      email: entry.email,
      updatedAt: entry.updated_at,
      updatedBy: entry.updated_by,
    })),
    previousCursor: persisted.previousCursor,
    nextCursor: persisted.nextCursor,
  };
}

export async function updateInvitedAccessMembershipForAdmin(
  auth: AuthContext,
  input: {
    email: string;
    operation: "add" | "remove";
  },
): Promise<string> {
  assertInternalAdmin(auth);
  const email = normalizeAccessEmail(input.email);
  if (!isValidExternalAccessEmail(email)) {
    throw new TypeError("Invalid external invited-access email");
  }

  if (input.operation === "add") {
    await upsertAccessAllowlistEntryUnchecked(auth.db, {
      email,
      updatedBy: normalizeAccessEmail(auth.user.email),
    });
  } else {
    await deleteAccessAllowlistEntryUnchecked(auth.db, email);
  }
  return email;
}

function assertInternalAdmin(auth: AuthContext): void {
  if (!isInternalEmail(auth.user.email)) {
    throw new TypeError("Internal admin context required");
  }
}
