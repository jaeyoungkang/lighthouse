import { after } from "next/server";

import { createAdminClient } from "@/app/server/auth/supabase";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import {
  backfillOwnerPrincipalForEmail,
  upsertAppUserSnapshot,
} from "@/app/server/repository/app-users";

export type AppUserSnapshotInput = {
  principal: string;
  email: string;
  backfill?: boolean;
};

/**
 * Display/operational app_users snapshot only. Auth resolvers must stay write-free;
 * callers own choosing a low-frequency boundary such as session creation/touch.
 */
export function scheduleAppUserSnapshot(input: AppUserSnapshotInput): void {
  const run = async () => {
    const adminDb = createRepositoryDbHandle(createAdminClient());
    try {
      await upsertAppUserSnapshot(adminDb, { email: input.email });
    } catch {}
    if (input.backfill) {
      try {
        await backfillOwnerPrincipalForEmail(adminDb, {
          principal: input.principal,
          email: input.email,
        });
      } catch {}
    }
  };

  try {
    after(run);
  } catch {
    void run();
  }
}
