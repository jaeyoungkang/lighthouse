import { describe, expect, it } from "vitest";
import { resolvePdfUrl } from "@/app/server/services/pdf-url-resolver";

describe("resolvePdfUrl", () => {
  it("derives ACL Anthology PDFs from normalized ACL ids", () => {
    expect(resolvePdfUrl(null, { ACL: " 2020.acl-main.447 " })).toBe(
      "https://aclanthology.org/2020.acl-main.447.pdf",
    );
    expect(resolvePdfUrl(null, { ACL: "2020.acl-main.447.pdf" })).toBe(
      "https://aclanthology.org/2020.acl-main.447.pdf",
    );
  });

  it("ignores ACL values that are already URLs or path-like strings", () => {
    expect(resolvePdfUrl(null, { ACL: "https://aclanthology.org/2020.acl-main.447/" })).toBeNull();
    expect(resolvePdfUrl(null, { ACL: "anthology/2020.acl-main.447" })).toBeNull();
  });
});
