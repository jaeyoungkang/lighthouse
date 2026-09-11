/** 이메일 정규화: trim + lowercase. case/공백 무관 비교·키잉용 순수 유틸. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
