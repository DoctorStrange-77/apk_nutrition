export const BETA_EMAIL_DOMAIN = 'buildernutrition.app';

export function normalizeBetaUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidBetaUsername(value: string): boolean {
  const username = normalizeBetaUsername(value);
  if (!username || username.length < 3 || username.length > 40) return false;
  return /^[a-z0-9._-]+$/.test(username);
}

export function betaUsernameToEmail(value: string): string {
  const username = normalizeBetaUsername(value);
  if (username.includes('@')) return username;
  return `${username}@${BETA_EMAIL_DOMAIN}`;
}

export function betaEmailToUsername(email?: string | null): string {
  if (!email) return 'tester';
  const normalized = email.trim().toLowerCase();
  const suffix = `@${BETA_EMAIL_DOMAIN}`;
  return normalized.endsWith(suffix) ? normalized.slice(0, -suffix.length) : normalized.split('@')[0] || 'tester';
}

export function betaLoginErrorMessage(): string {
  return 'Username o password non validi.';
}

export function isAuthorizedBetaEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${BETA_EMAIL_DOMAIN}`);
}
