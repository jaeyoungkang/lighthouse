const ACCESS_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERNAL_EMAIL_PATTERN = /^[^\s@]+@corca\.ai$/;

export function normalizeAccessEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isInternalEmail(email: string): boolean {
  return INTERNAL_EMAIL_PATTERN.test(normalizeAccessEmail(email));
}

export function isValidExternalAccessEmail(email: string): boolean {
  const normalizedEmail = normalizeAccessEmail(email);
  return ACCESS_EMAIL_PATTERN.test(normalizedEmail) && !isInternalEmail(normalizedEmail);
}
