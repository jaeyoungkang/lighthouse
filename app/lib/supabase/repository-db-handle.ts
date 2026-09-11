import type { SupabaseClient } from "@supabase/supabase-js";

declare const repositoryDbHandleBrand: unique symbol;

/**
 * Opaque authority token passed across auth/domain boundaries. The raw client
 * is retained only in this registry and never appears on the handle object.
 */
export type RepositoryDbHandle = Readonly<{
  [repositoryDbHandleBrand]: "repository-db-handle";
}>;

const repositoryDbClients = new WeakMap<object, SupabaseClient>();

export function createRepositoryDbHandle(db: SupabaseClient): RepositoryDbHandle {
  const handle = Object.freeze({}) as RepositoryDbHandle;
  repositoryDbClients.set(handle, db);
  return handle;
}

export function unwrapRepositoryDbHandle(handle: RepositoryDbHandle): SupabaseClient {
  const db = repositoryDbClients.get(handle);
  if (!db) {
    throw new TypeError("Unknown repository DB handle");
  }
  return db;
}
