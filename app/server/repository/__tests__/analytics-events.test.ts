import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createLocalJsonlAnalyticsEventStore,
  resolveLocalAnalyticsEventProvenance,
  resolveLocalJsonlAnalyticsEventPath,
} from "@/app/server/repository/analytics-events";

const tempStorePath = path.join(
  tmpdir(),
  "lighthouse-analytics-events-test",
  "analytics-events.jsonl",
);

afterEach(async () => {
  await rm(path.dirname(tempStorePath), { recursive: true, force: true });
});

describe("analytics event local JSONL store", () => {
  it("uses the repo .local store outside serverless runtime", () => {
    expect(resolveLocalJsonlAnalyticsEventPath({}, "/repo")).toBe(
      path.join("/repo", ".local/analytics-events.jsonl"),
    );
  });

  it("uses a writable temp path on Vercel serverless runtime", () => {
    expect(resolveLocalJsonlAnalyticsEventPath({ VERCEL: "1" }, "/var/task")).toBe(
      path.join(tmpdir(), "lighthouse", "analytics-events.jsonl"),
    );
  });

  it("uses a writable temp path when the runtime cwd is the serverless bundle", () => {
    expect(resolveLocalJsonlAnalyticsEventPath({}, "/var/task")).toBe(
      path.join(tmpdir(), "lighthouse", "analytics-events.jsonl"),
    );
  });

  it("allows an explicit relative store path override", () => {
    expect(
      resolveLocalJsonlAnalyticsEventPath(
        { LOCAL_ANALYTICS_EVENT_STORE_PATH: ".cache/events.jsonl" },
        "/repo",
      ),
    ).toBe(path.join("/repo", ".cache/events.jsonl"));
  });

  it("derives bounded local provenance without copying arbitrary environment values", () => {
    expect(
      resolveLocalAnalyticsEventProvenance({
        NODE_ENV: "test",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_SHA: "revision-123",
        UNRELATED_SECRET: "must-not-leak",
      }),
    ).toEqual({
      schemaVersion: 1,
      environment: "preview",
      buildRevision: "revision-123",
      runSource: "test",
    });
  });

  it("supports an explicit manual run source and preserves unknown revisions", () => {
    expect(
      resolveLocalAnalyticsEventProvenance({
        NODE_ENV: "development",
        LOCAL_ANALYTICS_EVENT_RUN_SOURCE: "manual",
      }),
    ).toEqual({
      schemaVersion: 1,
      environment: "development",
      buildRevision: null,
      runSource: "manual",
    });
  });

  it("normalizes unrecognized environment and unsafe revision values", () => {
    expect(
      resolveLocalAnalyticsEventProvenance({
        VERCEL_ENV: "private-stage-name",
        VERCEL_GIT_COMMIT_SHA: "secret/value",
        LOCAL_ANALYTICS_EVENT_RUN_SOURCE: "unrecognized",
      }),
    ).toEqual({
      schemaVersion: 1,
      environment: "unknown",
      buildRevision: null,
      runSource: "runtime",
    });
  });

  it("creates parent directories before appending JSONL events", async () => {
    const store = createLocalJsonlAnalyticsEventStore(tempStorePath, {
      NODE_ENV: "test",
      GIT_COMMIT_SHA: "test-revision",
      UNRELATED_SECRET: "must-not-leak",
    });

    await store.insert({
      name: "product.search_submitted",
      version: 1,
      occurredAt: "2026-06-09T00:00:00.000Z",
      actor: { type: "user", id: "pilot@example.com" },
      surface: "research-route",
      storyRefs: {
        experienceRef: "experience:research-and-discovery",
        momentRef: "moment:search-results-first-review",
        promiseRef: "promise:search-results-fast-window",
        aspectRefs: [],
        acceptanceCheckRefs: [],
        scenarioRefs: [],
      },
      trigger: { source: "client", phase: "requested", timing: "test" },
      subject: { ownerPrincipalId: "principal-1" },
      properties: { ownerPrincipalId: "principal-1" },
      privacy: { level: "behavior_metadata", allowExternalSinks: false },
    });

    const stored: unknown = JSON.parse(await readFile(tempStorePath, "utf8"));
    expect(stored).toMatchObject({
      name: "product.search_submitted",
      localProvenance: {
        schemaVersion: 1,
        environment: "test",
        buildRevision: "test-revision",
        runSource: "test",
      },
    });
    expect(JSON.stringify(stored)).not.toContain("UNRELATED_SECRET");
  });
});
