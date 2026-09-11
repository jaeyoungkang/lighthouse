import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import { getLighthouseDbFor } from "../db";

describe("repository DB authority handle", () => {
  it("keeps raw table capabilities out of the cross-layer handle", () => {
    const lighthouseDb = { source: "lighthouse-schema" };
    const schema = vi.fn(() => lighthouseDb);
    const rawDb = {
      from: vi.fn(),
      rpc: vi.fn(),
      schema,
    } as unknown as SupabaseClient;

    const handle = createRepositoryDbHandle(rawDb);

    expect(handle).not.toBe(rawDb);
    expect(handle).not.toHaveProperty("from");
    expect(handle).not.toHaveProperty("rpc");
    expect(handle).not.toHaveProperty("schema");
    expect(getLighthouseDbFor(handle)).toBe(lighthouseDb);
    expect(schema).toHaveBeenCalledWith("lighthouse");
  });

  it("rejects an unregistered object even if it looks like a database client", () => {
    const schema = vi.fn();
    const counterfeit = { schema } as never;

    expect(() => getLighthouseDbFor(counterfeit)).toThrow("Unknown repository DB handle");
    expect(schema).not.toHaveBeenCalled();
  });
});
