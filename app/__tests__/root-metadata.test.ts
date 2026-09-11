import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Noto_Sans_KR: () => ({ variable: "--app-font-sans" }),
  Noto_Serif_KR: () => ({ variable: "--app-font-display" }),
}));

vi.mock("@/app/server/auth/identity", () => ({
  resolveCurrentUser: vi.fn(),
}));

vi.mock("@/app/server/services/library-context-source", () => ({
  getLibraryContextForUser: vi.fn(),
  resolveLibraryContextForUser: vi.fn(),
}));

describe("root metadata", () => {
  it("uses Moonlight Search as the browser title and favicon", async () => {
    const { metadata } = await import("@/app/layout");

    expect(metadata.title).toEqual({
      default: "Moonlight Search",
      template: "%s | Moonlight Search",
    });
    expect(metadata.icons).toEqual({
      icon: [{ url: "/favicon.ico?v=moonlight-search", type: "image/png", sizes: "128x128" }],
    });
  });

  it("keeps the research route title on Moonlight Search", async () => {
    const { metadata } = await import("@/app/(research)/layout");

    // `absolute` bypasses the root template so the browser tab reads
    // "Moonlight Search", not the duplicated "Moonlight Search | Moonlight Search".
    expect(metadata.title).toEqual({ absolute: "Moonlight Search" });
  });
});
