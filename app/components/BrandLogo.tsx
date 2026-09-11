// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-result-basis-visible

import Image from "next/image";
import { BRAND_LOGO_ALT } from "@/app/i18n/public-shared-messages";

const BRAND_LOGO_SRC = "/brand/scholar-logo.png";
const BRAND_LOGO_WIDTH = 423;
const BRAND_LOGO_HEIGHT = 80;

const BRAND_LOGO_SIZE_CLASS = {
  topbar: "h-9 max-w-[12.375rem]",
  auth: "h-[3.75rem] max-w-[19.875rem]",
  intro: "h-9 max-w-[12.375rem]",
} as const;

interface BrandLogoProps {
  placement: keyof typeof BRAND_LOGO_SIZE_CLASS;
  priority?: boolean;
  testId?: string;
}

export function BrandLogo({ placement, priority = false, testId }: BrandLogoProps) {
  return (
    <Image
      src={BRAND_LOGO_SRC}
      alt={BRAND_LOGO_ALT}
      width={BRAND_LOGO_WIDTH}
      height={BRAND_LOGO_HEIGHT}
      priority={priority}
      className={`${BRAND_LOGO_SIZE_CLASS[placement]} w-auto object-contain`}
      data-testid={testId}
    />
  );
}
