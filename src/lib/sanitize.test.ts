import { describe, it, expect } from 'vitest';
import { sanitizeUsername, sanitizeEmail, sanitizeText } from './sanitize';

describe('sanitize', () => {
  it('sanitizeUsername strips unsafe characters', () => {
    expect(sanitizeUsername('  bad-user_01!  ')).toBe('bad-user_01');
  });

  it('sanitizeEmail lowercases and trims', () => {
    expect(sanitizeEmail('  Test@Example.COM ')).toBe('test@example.com');
  });

  it('sanitizeText returns empty for non-string', () => {
    expect(sanitizeText(null as unknown as string)).toBe('');
  });
});
