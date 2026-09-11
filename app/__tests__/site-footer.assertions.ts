import { expect } from "vitest";

export function assertCommonFooter(container: HTMLElement, testId: string) {
  const footer = container.querySelector(`[data-testid="${testId}"]`);
  expect(footer, `${testId} footer`).not.toBeNull();
  const text = footer?.textContent ?? "";

  expect(text).toContain("Scholar란?");
  expect(text).toContain("PubMed·arXiv·IEEE·Crossref");
  expect(text).toContain("주식회사 코르카");
  expect(text).toContain("moonlight@corca.ai");
  expect(text).toContain("©");
  expect(footer?.querySelector('a[href="/about/search"]')).not.toBeNull();
  expect(footer?.querySelector('a[href="/about/graph/sample"]')).not.toBeNull();
  expect(footer?.querySelector('a[href="/about/promises"]')).not.toBeNull();
  expect(footer?.querySelector('a[href="/about/changes"]')).toBeNull();
  expect(footer?.querySelector('a[href="/admin/intent"]')).toBeNull();
  expect(footer?.querySelector('a[href="/terms"]')).toBeNull();
  expect(footer?.querySelector('a[href="/privacy"]')).toBeNull();
  expect(text).not.toContain("Terms");
  expect(text).not.toContain("Privacy");
  expect(text).not.toContain("GitHub");
  expect(text).not.toContain("Medium");
}
