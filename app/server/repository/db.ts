import type { SupabaseClient } from "@supabase/supabase-js";

import {
  unwrapRepositoryDbHandle,
  type RepositoryDbHandle,
} from "@/app/lib/supabase/repository-db-handle";

export type { RepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";

export function getRepositoryDbFor(handle: RepositoryDbHandle): SupabaseClient {
  return unwrapRepositoryDbHandle(handle);
}

export function getLighthouseDbFor(handle: RepositoryDbHandle) {
  return getRepositoryDbFor(handle).schema("lighthouse");
}

// GLOBAL_SEED_OWNER_ID는 app/lib/constants.ts로 이동했다.
// 하위 호환을 위해 re-export한다.
export { GLOBAL_SEED_OWNER_ID } from "@/app/lib/constants";
