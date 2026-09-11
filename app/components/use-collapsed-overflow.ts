"use client";

// @aspect aspect:progressive-content-spatial-stability

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Measures whether a clamped element actually overflows at its rendered width.
 * The last collapsed measurement is retained while expanded so the disclosure
 * remains available for returning to the compact state.
 */
export function useCollapsedOverflow<T extends HTMLElement>({
  contentKey,
  collapsed,
}: {
  contentKey: string;
  collapsed: boolean;
}) {
  const ref = useRef<T>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const measure = useCallback(() => {
    if (!collapsed || !ref.current) return;
    const element = ref.current;
    setIsOverflowing(
      element.scrollHeight > element.clientHeight + 1 ||
        element.scrollWidth > element.clientWidth + 1,
    );
  }, [collapsed]);

  useEffect(() => {
    if (!collapsed || !ref.current) return;
    const element = ref.current;
    const animationFrame = window.requestAnimationFrame(measure);

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resizeObserver?.observe(element);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [collapsed, contentKey, measure]);

  return { ref, isOverflowing };
}
