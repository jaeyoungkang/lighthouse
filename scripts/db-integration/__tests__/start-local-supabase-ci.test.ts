import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  isRetriableSupabasePortCollision,
  startLocalSupabaseWithRecovery,
} from "../start-local-supabase-ci";

const success = { status: 0, stdout: "started", stderr: "" };
const portCollision = {
  status: 1,
  stdout: "",
  stderr: "failed to bind host port for 0.0.0.0:54322:172.18.0.2:5432/tcp: address already in use",
};

describe("CI Supabase startup recovery", () => {
  it("recognizes only the Docker host-port collision signature", () => {
    expect(isRetriableSupabasePortCollision(portCollision.stderr)).toBe(true);
    expect(isRetriableSupabasePortCollision("address already in use")).toBe(false);
    expect(isRetriableSupabasePortCollision("failed to bind host port: permission denied")).toBe(
      false,
    );
  });

  it("does not add cleanup or retry work to a successful start", async () => {
    const run = vi.fn().mockReturnValue(success);

    await startLocalSupabaseWithRecovery({ run, write: vi.fn() });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0]).toEqual(expect.arrayContaining(["supabase", "start"]));
  });

  it("cleans only the lighthouse stack and retries once after a port collision", async () => {
    const run = vi
      .fn()
      .mockReturnValueOnce(portCollision)
      .mockReturnValueOnce(success)
      .mockReturnValueOnce(success);
    const wait = vi.fn().mockResolvedValue(undefined);

    await startLocalSupabaseWithRecovery({ run, wait, write: vi.fn() });

    expect(run).toHaveBeenCalledTimes(3);
    expect(run.mock.calls[1]?.[0]).toEqual([
      "supabase",
      "stop",
      "--no-backup",
      "--project-id",
      "lighthouse",
      "--yes",
    ]);
    expect(run.mock.calls[2]?.[0]).toEqual(run.mock.calls[0]?.[0]);
    expect(wait).toHaveBeenCalledOnce();
  });

  it("fails immediately for unrelated startup errors", async () => {
    const run = vi.fn().mockReturnValue({ status: 1, stdout: "", stderr: "invalid config" });

    await expect(
      startLocalSupabaseWithRecovery({ run, wait: vi.fn(), write: vi.fn() }),
    ).rejects.toThrow("without a retriable port collision");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("fails after the single bounded recovery attempt", async () => {
    const run = vi
      .fn()
      .mockReturnValueOnce(portCollision)
      .mockReturnValueOnce(success)
      .mockReturnValueOnce(portCollision);

    await expect(
      startLocalSupabaseWithRecovery({ run, wait: vi.fn(), write: vi.fn() }),
    ).rejects.toThrow("single port-collision recovery attempt");
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("keeps the bounded wrapper and unconditional cleanup for full-scope execution", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/quality.yml"), "utf8");

    expect(workflow).toContain("run: npm run db:start:ci");
    expect(workflow).toMatch(
      /- name: Stop local Supabase integration services\n\s+if: always\(\) && steps\.scope\.outputs\.docs_only != 'true'\n\s+run: npm run db:stop:ci/,
    );
  });
});
