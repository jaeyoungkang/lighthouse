import { afterEach, describe, expect, it, vi } from "vitest";

import checkedConfig from "../config.json";

import {
  buildGeneratedBlock,
  calendarDateKst,
  checkpointDateKst,
  loadConfig,
  markerFor,
  replaceGeneratedBlock,
  syncLane,
  checkExitCode,
  validateActivePeriod,
  validateConfig,
} from "../checkpoint.mjs";

describe("project status checkpoint", () => {
  it("validates the checked-in active tracker configuration", () => {
    expect(validateConfig(loadConfig())).toEqual([]);
  });

  it("replaces exactly one lane-owned generated block", () => {
    const body = [
      "before",
      markerFor("process", "start"),
      "old",
      markerFor("process", "end"),
      "after",
    ].join("\n");
    const block = [markerFor("process", "start"), "new", markerFor("process", "end")].join("\n");

    expect(replaceGeneratedBlock(body, "process", block)).toBe(
      ["before", block, "after"].join("\n"),
    );
  });

  it("rejects a tracker body without its lane markers", () => {
    expect(() => replaceGeneratedBlock("no marker", "search", "replacement")).toThrow(
      "must contain one ordered search marker pair",
    );
  });

  it("renders only mechanical issue state in the generated block", () => {
    const block = buildGeneratedBlock({
      lane: "search",
      checkpointDate: "2026-08-25",
      headSha: "a".repeat(40),
      issueInventory: { open: 1, operations: 1, unassigned: 1, noMilestone: 1 },
      linkedIssues: [
        {
          number: 281,
          state: "open",
          updatedAt: "2026-08-25T00:00:00Z",
          title: "Runtime | evidence",
        },
      ],
    });

    expect(block).toContain("#281");
    expect(block).toContain("Runtime \\| evidence");
    expect(block).not.toContain("healthy");
    expect(block).not.toContain("ready");
  });

  it("uses Tuesday as the KST checkpoint week boundary", () => {
    expect(checkpointDateKst(new Date("2026-08-24T16:00:00Z"))).toBe("2026-08-25");
    expect(checkpointDateKst(new Date("2026-08-31T14:59:59Z"))).toBe("2026-08-25");
  });

  it("fails closed after the active tracker period", () => {
    const config = { period: { start: "2026-08-25", end: "2026-09-22" } };

    expect(calendarDateKst(new Date("2026-09-22T14:59:59Z"))).toBe("2026-09-22");
    expect(validateActivePeriod(config, new Date("2026-09-22T14:59:59Z"))).toEqual([]);
    expect(validateActivePeriod(config, new Date("2026-09-22T15:00:00Z"))).toEqual([
      "active tracker period ended: 2026-09-22; rollover or retire it before sync",
    ]);
  });
});

describe("tracker body synchronization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function mockGithub(lane: "process" | "search", current = false) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T03:00:00Z"));
    const output = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const config = structuredClone(checkedConfig);
    const trackerConfig = config.trackers[lane];
    // Keep the fixture small while retaining the actual lane and metadata rules.
    trackerConfig.linkedIssues = [762];
    const generated = buildGeneratedBlock({
      lane,
      checkpointDate: "2026-09-01",
      headSha: "a".repeat(40),
      issueInventory: { open: 0, operations: 0, unassigned: 0, noMilestone: 0 },
      linkedIssues: [{ number: 762, state: "closed", title: "Completed", updatedAt: "2026-09-07" }],
    });
    const oldBlock = [markerFor(lane, "start"), "old checkpoint", markerFor(lane, "end")].join(
      "\n",
    );
    const initialBody = `Owner decision\n${current ? generated : oldBlock}\nNext action`;
    const state = { body: initialBody, reads: 0, latestBody: initialBody, patchStatus: 200 };
    const requests: Array<{ path: string; method: string; body?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, options: RequestInit) => {
        await Promise.resolve();
        const path = url.replace(`https://api.github.com/repos/${config.repository}`, "");
        const method = options.method ?? "GET";
        requests.push({ path, method, body: options.body as string | undefined });
        if (path === `/issues/${String(trackerConfig.issueNumber)}`) {
          if (method === "PATCH") {
            if (state.patchStatus !== 200)
              return new Response("write failed", { status: state.patchStatus });
            state.body = (JSON.parse(options.body as string) as { body: string }).body;
            return Response.json({});
          }
          state.reads += 1;
          return Response.json({
            number: trackerConfig.issueNumber,
            state: "open",
            body: state.reads === 1 ? initialBody : state.latestBody,
            labels: [{ name: config.label }],
            assignees: [{ login: "owner" }],
            milestone: { title: config.milestone },
          });
        }
        if (path === "") return Response.json({ default_branch: "main" });
        if (path === "/git/ref/heads/main")
          return Response.json({ object: { sha: "a".repeat(40) } });
        if (path === "/issues?state=open&per_page=100&page=1") return Response.json([]);
        if (path === "/issues/762")
          return Response.json({
            number: 762,
            state: "closed",
            title: "Completed",
            updated_at: "2026-09-07",
          });
        throw new Error(`Unexpected GitHub request: ${method} ${path}`);
      }),
    );
    return { config, state, requests, generated, output };
  }

  it.each(["process", "search"] as const)(
    "updates only the %s body and preserves a concurrent owner edit",
    async (lane) => {
      const { config, state, requests, generated } = mockGithub(lane);
      state.latestBody = state.body.replace("Owner decision", "Updated owner decision");
      await syncLane(config, lane, "test-token", false);
      expect(state.body).toBe(`Updated owner decision\n${generated}\nNext action`);
      expect(requests.filter((request) => request.method !== "GET")).toEqual([
        {
          path: `/issues/${String(config.trackers[lane].issueNumber)}`,
          method: "PATCH",
          body: JSON.stringify({ body: state.body }),
        },
      ]);
      expect(requests.some((request) => request.path.includes("/comments"))).toBe(false);
    },
  );

  it("does not write when the checkpoint is already current", async () => {
    const { config, requests } = mockGithub("process", true);
    await syncLane(config, "process", "test-token", false);
    expect(requests.every((request) => request.method === "GET")).toBe(true);
    expect(requests.some((request) => request.path.includes("/comments"))).toBe(false);
  });

  it("previews a changed checkpoint without writing or reading comments", async () => {
    const { config, requests, generated, output } = mockGithub("process");
    await syncLane(config, "process", "test-token", true);
    expect(requests.every((request) => request.method === "GET")).toBe(true);
    expect(requests.some((request) => request.path.includes("/comments"))).toBe(false);
    expect(output).toHaveBeenCalledWith(expect.stringContaining(generated));
  });

  it("does not repeat a write completed by another sync", async () => {
    const { config, state, requests, generated } = mockGithub("process");
    state.latestBody = `Updated owner decision\n${generated}\nNext action`;
    await syncLane(config, "process", "test-token", false);
    expect(state.reads).toBe(2);
    expect(requests.every((request) => request.method === "GET")).toBe(true);
  });

  it("surfaces a failed body update instead of reporting success", async () => {
    const { config, state, output } = mockGithub("process");
    state.patchStatus = 403;
    await expect(syncLane(config, "process", "test-token", false)).rejects.toThrow(
      "GitHub PATCH /issues/2 failed: 403",
    );
    expect(output).not.toHaveBeenCalled();
  });
});

describe("checkExitCode", () => {
  it("returns 0 inside the period, 2 outside it, and 1 for config errors", () => {
    expect(checkExitCode(loadConfig(), new Date("2026-09-01T03:00:00Z"))).toBe(0);
    expect(checkExitCode(loadConfig(), new Date("2026-10-01T03:00:00Z"))).toBe(2);
    const broken = { period: { start: "2026-08-25", end: "2026-09-22", reviewWeekday: "Monday" } };
    expect(checkExitCode(broken, new Date("2026-10-01T03:00:00Z"))).toBe(1);
  });
});
