import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const HTTP_GUARD_PATH = path.resolve(__dirname, "..", "check-external-http-gateway.mjs");
const AI_GUARD_PATH = path.resolve(__dirname, "..", "check-ai-generation-gateway.mjs");

async function loadAiGuard(): Promise<{
  findAiGenerationGatewayViolations: (
    file: string,
    contents: string,
  ) => Array<{ file: string; line: number; text: string }>;
}> {
  return (await import(pathToFileURL(AI_GUARD_PATH).href)) as never;
}

async function loadHttpGuard(): Promise<{
  EXPLICIT_OUTBOUND_OWNER_FILES: ReadonlySet<string>;
  findExternalHttpGatewayViolations: (
    file: string,
    contents: string,
  ) => Array<{ file: string; line: number; text: string }>;
}> {
  return (await import(pathToFileURL(HTTP_GUARD_PATH).href)) as never;
}

describe("effect owner guards", () => {
  it("rejects OpenAI provider acquisition from a production caller outside the AI gateway", async () => {
    const { findAiGenerationGatewayViolations } = await loadAiGuard();

    const violations = findAiGenerationGatewayViolations(
      "app/server/services/openai-bypass.ts",
      'import { createOpenAI } from "@ai-sdk/openai";\nexport const provider = createOpenAI();\n',
    );

    expect(violations).toEqual([
      expect.objectContaining({
        file: "app/server/services/openai-bypass.ts",
        line: 1,
        text: 'import { createOpenAI } from "@ai-sdk/openai"',
      }),
    ]);
  });

  it("allows the retired Gemini owner only for an exclusive historical layout", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ai-generation-owner-"));
    try {
      const relativePath = "app/lib/gemini.ts";
      const target = path.join(root, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(
        target,
        'import { GoogleGenAI } from "@google/genai";\nexport const client = new GoogleGenAI({});\n',
      );

      const blocking = spawnSync(process.execPath, [AI_GUARD_PATH], {
        cwd: root,
        encoding: "utf8",
      });
      const historical = spawnSync(
        process.execPath,
        [AI_GUARD_PATH, "--allow-historical-gemini-owner"],
        { cwd: root, encoding: "utf8" },
      );

      expect(blocking.status).toBe(1);
      expect(blocking.stderr).toContain(`${relativePath}:1`);
      expect(historical.status).toBe(0);

      const currentOwner = path.join(root, "app/server/ai-generation/gemini.ts");
      await mkdir(path.dirname(currentOwner), { recursive: true });
      await writeFile(currentOwner, "export const currentOwner = true;\n");
      const duplicate = spawnSync(
        process.execPath,
        [AI_GUARD_PATH, "--allow-historical-gemini-owner"],
        { cwd: root, encoding: "utf8" },
      );

      expect(duplicate.status).toBe(1);
      expect(duplicate.stderr).toContain(`${relativePath}:1`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps Amplitude and Supabase as explicit outbound owners and rejects sibling bypasses", async () => {
    const { EXPLICIT_OUTBOUND_OWNER_FILES, findExternalHttpGatewayViolations } =
      await loadHttpGuard();
    const source = 'export const request = () => fetch("https://example.com");\n';

    expect(EXPLICIT_OUTBOUND_OWNER_FILES).toEqual(
      new Set(["app/server/services/analytics/amplitude-sink.ts", "app/server/auth/supabase.ts"]),
    );
    expect(
      findExternalHttpGatewayViolations("app/server/services/analytics/amplitude-sink.ts", source),
    ).toEqual([]);
    expect(findExternalHttpGatewayViolations("app/server/auth/supabase.ts", source)).toEqual([]);
    expect(
      findExternalHttpGatewayViolations("app/server/services/analytics/rogue.ts", source),
    ).toEqual([
      expect.objectContaining({ file: "app/server/services/analytics/rogue.ts", line: 1 }),
    ]);
    expect(findExternalHttpGatewayViolations("app/server/auth/rogue.ts", source)).toEqual([
      expect.objectContaining({ file: "app/server/auth/rogue.ts", line: 1 }),
    ]);
    expect(findExternalHttpGatewayViolations("app/lib/analytics/sinks/rogue.ts", source)).toEqual([
      expect.objectContaining({ file: "app/lib/analytics/sinks/rogue.ts", line: 1 }),
    ]);
    expect(findExternalHttpGatewayViolations("app/lib/supabase/rogue.ts", source)).toEqual([
      expect.objectContaining({ file: "app/lib/supabase/rogue.ts", line: 1 }),
    ]);
  });

  it.each(["app/lib/analytics/sinks/rogue.ts", "app/lib/supabase/rogue.ts"])(
    "rejects a raw fetch rediscovered at the retired owner path %s",
    async (relativePath) => {
      const root = await mkdtemp(path.join(os.tmpdir(), "external-http-owner-"));
      try {
        const target = path.join(root, relativePath);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, 'export const request = () => fetch("https://example.com");\n');

        const result = spawnSync(process.execPath, [HTTP_GUARD_PATH], {
          cwd: root,
          encoding: "utf8",
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(`${relativePath}:1`);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it.each(["app/auth/callback/route.ts", "proxy.ts"])(
    "rejects a raw fetch discovered at the HTTP entrypoint %s",
    async (relativePath) => {
      const root = await mkdtemp(path.join(os.tmpdir(), "external-http-entrypoint-"));
      try {
        const target = path.join(root, relativePath);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, 'export const request = () => fetch("https://example.com");\n');

        const result = spawnSync(process.execPath, [HTTP_GUARD_PATH], {
          cwd: root,
          encoding: "utf8",
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toContain(`${relativePath}:1`);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it.each([
    {
      current: "app/server/services/analytics/amplitude-sink.ts",
      historical: "app/lib/analytics/sinks/amplitude.ts",
    },
    {
      current: "app/server/auth/supabase.ts",
      historical: "app/lib/supabase/server.ts",
    },
  ])(
    "allows $historical only for an exclusive historical collection layout",
    async ({ current, historical }) => {
      const root = await mkdtemp(path.join(os.tmpdir(), "external-http-history-"));
      try {
        const historicalTarget = path.join(root, historical);
        await mkdir(path.dirname(historicalTarget), { recursive: true });
        await writeFile(
          historicalTarget,
          'export const request = () => fetch("https://example.com");\n',
        );

        const blocking = spawnSync(process.execPath, [HTTP_GUARD_PATH], {
          cwd: root,
          encoding: "utf8",
        });
        const replay = spawnSync(
          process.execPath,
          [HTTP_GUARD_PATH, "--allow-historical-outbound-owners"],
          { cwd: root, encoding: "utf8" },
        );

        expect(blocking.status).toBe(1);
        expect(blocking.stderr).toContain(`${historical}:1`);
        expect(replay.status).toBe(0);

        const currentTarget = path.join(root, current);
        await mkdir(path.dirname(currentTarget), { recursive: true });
        await writeFile(currentTarget, "export const currentOwner = true;\n");
        const duplicate = spawnSync(
          process.execPath,
          [HTTP_GUARD_PATH, "--allow-historical-outbound-owners"],
          { cwd: root, encoding: "utf8" },
        );

        expect(duplicate.status).toBe(1);
        expect(duplicate.stderr).toContain(`${historical}:1`);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
});
