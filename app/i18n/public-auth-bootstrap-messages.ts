import { createMessageTranslator } from "./create-message-translator";

const publicAuthBootstrapMessages = {
  "auth.action.fallbackReload": "다시 시도",
  "auth.error.fallbackLoadFailed": "로그인 화면을 불러오지 못했습니다.",
  "auth.status.checking": "Moonlight Search 세션을 확인하고 있습니다.",
  "search.notice.moonlight-library-access-denied":
    "Moonlight Search 라이브러리 접근이 아직 허용되지 않았다. Moonlight admin에서 이 계정을 Scholar allowlist에 추가해야 내 라이브러리 기준 검색을 쓸 수 있다.",
} as const;

export type PublicAuthBootstrapMessageKey = keyof typeof publicAuthBootstrapMessages;

export const tPublicAuthBootstrap = createMessageTranslator(publicAuthBootstrapMessages);
