import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  getRedirectUrl,
  unstable_getResponseFromNextConfig,
} from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

const PRODUCTION_AUTH_REDIRECT_URLS = [
  "https://search.themoonlight.io/",
  "https://search.themoonlight.io/auth/confirm",
  "https://scholar.themoonlight.io/",
  "https://scholar.themoonlight.io/auth/confirm",
];

describe("checked-in production auth redirect configuration", () => {
  it("declares every production alias and PKCE callback in the Supabase config", async () => {
    const config = await readFile(path.join(process.cwd(), "supabase/config.toml"), "utf8");

    for (const redirectUrl of PRODUCTION_AUTH_REDIRECT_URLS) {
      expect(config).toContain(`"${redirectUrl}"`);
    }
  });

  it("redirects the compatibility host to the canonical Scholar host", async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: "https://search.themoonlight.io/search?q=transformer&entry=route-bar",
      nextConfig,
    });

    expect(response.status).toBe(308);
    expect(getRedirectUrl(response)).toBe(
      "https://scholar.themoonlight.io/search?q=transformer&entry=route-bar",
    );
  });

  it("keeps the canonical Scholar host on the application route", async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: "https://scholar.themoonlight.io/search?q=transformer&entry=route-bar",
      nextConfig,
    });

    expect(response.status).toBe(200);
    expect(getRedirectUrl(response)).toBeNull();
  });
});
