import { describe, expect, it } from 'vitest';
import {
  betaEmailToUsername,
  betaLoginErrorMessage,
  betaUsernameToEmail,
  isValidBetaLogin,
  isValidBetaUsername,
  normalizeBetaUsername,
} from './betaAccess';

describe('beta access helpers', () => {
  it('normalizza lo username', () => {
    expect(normalizeBetaUsername('  Tester.01 ')).toBe('tester.01');
  });

  it('converte lo username nell email tecnica Supabase', () => {
    expect(betaUsernameToEmail('tester01')).toBe('tester01@buildernutrition.app');
  });

  it('usa direttamente una email reale', () => {
    expect(betaUsernameToEmail('User@Example.com')).toBe('user@example.com');
  });

  it('valida gli username semplici', () => {
    expect(isValidBetaUsername('tester_01')).toBe(true);
    expect(isValidBetaUsername('te')).toBe(false);
    expect(isValidBetaUsername('tester 01')).toBe(false);
  });

  it('accetta username oppure email come login', () => {
    expect(isValidBetaLogin('tester01')).toBe(true);
    expect(isValidBetaLogin('salvatore@example.com')).toBe(true);
    expect(isValidBetaLogin('salvatore@')).toBe(false);
  });

  it('ricava lo username dalla email tecnica', () => {
    expect(betaEmailToUsername('tester01@buildernutrition.app')).toBe('tester01');
  });

  it('non espone dettagli negli errori di login', () => {
    expect(betaLoginErrorMessage()).toBe('Username o password non validi.');
  });
});
