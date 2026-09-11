import { createMessageTranslator } from "./create-message-translator";

const publicSharedMessages = {
  "common.label.brand.logoAlt": "Moonlight Search",
} as const;

export type PublicSharedMessageKey = keyof typeof publicSharedMessages;

export const tPublicShared = createMessageTranslator(publicSharedMessages);

export const BRAND_LOGO_ALT = tPublicShared("common.label.brand.logoAlt");
