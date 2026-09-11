import { createMessageTranslator } from "./create-message-translator";

const publicClientMessages = {
  "auth.error.emailInvalid": "유효한 이메일을 입력해주세요",
  "auth.error.request-magic-link": "네트워크 오류가 발생했습니다",
  "auth.error.request-magic-link.2": "인증 메일 전송 중 오류가 발생했습니다",
  "auth.label.auth-helpers": "로컬 개발에서는 아무 이메일이나 사용할 수 있습니다.",
  "auth.label.auth-helpers.2":
    "현재 사내 테스트 기간입니다. @corca.ai 또는 초대된 이메일만 사용할 수 있습니다.",
  "auth.label.email-gate": "이메일을 입력하면 연구를 시작할 수 있어요",
  "auth.label.email-gate.sourceCoverage":
    "PubMed·arXiv·IEEE·Crossref 등 주요 학술 출처의 논문 2억 편 이상을 담은 Moonlight 논문 DB에서 찾습니다.",
  "auth.label.email-gate.2": "{email}로 보낸 로그인 링크를 눌러주세요",
  "auth.label.email-gate.3": "링크 받기",
  "auth.label.email-gate.inboxPrompt.prefix": "메일함에서 ",
  "auth.label.email-gate.inboxPrompt.strong": "로그인 링크",
  "auth.label.email-gate.inboxPrompt.suffix": " 메일을 열고, 링크를 눌러 다시 돌아오세요.",
  "auth.label.email-gate.localHelper.prefix":
    "로컬 개발에서는 아무 이메일이나 사용할 수 있고, 인증 메일은 ",
  "auth.label.email-gate.localHelper.link": "개발 메일함(Mailpit)",
  "auth.label.email-gate.localHelper.suffix": "에서 수동으로 확인합니다.",
  "auth.label.email-gate.loading": "확인 중...",
  "auth.label.email-gate.resend": "링크 다시 보내기",
  "auth.label.email-gate.reenter": "이메일 다시 입력",
  "onboarding.label.page": "연구 동료 시작",
} as const;

export type PublicClientMessageKey = keyof typeof publicClientMessages;

export const tPublicClient = createMessageTranslator(publicClientMessages);
