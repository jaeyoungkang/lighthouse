import { afterEach, describe, expect, it, vi } from "vitest";

import { navigateFollowupRoute, shouldOpenFollowupInNewWindow } from "../view-followup-window";

describe("document follow-up window navigation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens modified follow-up activations in a new window", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const navigate = vi.fn();

    expect(shouldOpenFollowupInNewWindow({ ctrlKey: true })).toBe(true);
    expect(shouldOpenFollowupInNewWindow({ metaKey: true })).toBe(true);
    expect(shouldOpenFollowupInNewWindow({ shiftKey: true })).toBe(true);
    expect(shouldOpenFollowupInNewWindow({ button: 1 })).toBe(true);

    const didNavigate = navigateFollowupRoute("/gap/gap-report-1", navigate, { ctrlKey: true });

    expect(didNavigate).toBe(false);
    expect(openSpy).toHaveBeenCalledWith("/gap/gap-report-1", "_blank", "noopener,noreferrer");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("uses same-window navigation for unmodified primary activations", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const navigate = vi.fn();

    expect(shouldOpenFollowupInNewWindow({ button: 0 })).toBe(false);

    const didNavigate = navigateFollowupRoute("/search/paper-1", navigate, { button: 0 });

    expect(didNavigate).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/search/paper-1");
    expect(openSpy).not.toHaveBeenCalled();
  });
});
