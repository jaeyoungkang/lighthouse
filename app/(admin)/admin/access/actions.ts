"use server";

// @promise promise:invited-user-access-management
// @aspect aspect:admin-access-control
// @check acceptance-check:invited-user-access-management-failure-preserves-state

import { redirect } from "next/navigation";
import { isValidExternalAccessEmail, normalizeAccessEmail } from "@/app/server/auth/access-policy";
import { updateInvitedAccessMembershipForAdmin } from "@/app/server/domain-access/access-allowlist-access";
import { trackAdminInvitedAccessMembershipSynced } from "@/app/server/domain-access/server-analytics";
import { requireInternalAdminAuth } from "@/app/server/auth/internal-admin";

const ADMIN_ACCESS_PATH = "/admin/access";

export async function addInvitedAccess(formData: FormData): Promise<never> {
  await updateInvitedAccess(formData, "add");
  redirect(`${ADMIN_ACCESS_PATH}?status=added`);
}

export async function removeInvitedAccess(formData: FormData): Promise<never> {
  await updateInvitedAccess(formData, "remove");
  redirect(`${ADMIN_ACCESS_PATH}?status=removed`);
}

async function updateInvitedAccess(formData: FormData, operation: "add" | "remove"): Promise<void> {
  const auth = await requireInternalAdminAuth();
  const rawEmail = formData.get("email");
  const email = normalizeAccessEmail(typeof rawEmail === "string" ? rawEmail : "");
  if (!isValidExternalAccessEmail(email)) {
    redirect(`${ADMIN_ACCESS_PATH}?status=invalid`);
  }

  try {
    await updateInvitedAccessMembershipForAdmin(auth, {
      email,
      operation,
    });
  } catch {
    redirect(`${ADMIN_ACCESS_PATH}?status=failed`);
  }
  await trackAdminInvitedAccessMembershipSynced(auth.user.id, operation);
}
