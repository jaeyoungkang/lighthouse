import { ForbiddenError } from "./auth-errors";
import { requireOwnerPrincipalAuth, type AuthContext, type CurrentUser } from "./identity";
import { isInternalEmail } from "@/app/server/auth/access-policy";

export function isInternalAdminEmail(email: string): boolean {
  return isInternalEmail(email);
}

export async function requireInternalAdminAuth(): Promise<AuthContext> {
  const auth = await requireOwnerPrincipalAuth();

  if (!isInternalAdminEmail(auth.user.email)) {
    throw new ForbiddenError();
  }

  return auth;
}

export async function requireInternalAdminUser(): Promise<CurrentUser> {
  return (await requireInternalAdminAuth()).user;
}
