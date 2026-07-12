import { describe, it, expect } from 'vitest';
import { sanitizeLogPath } from '@/lib/log-path';

describe('sanitizeLogPath', () => {
  it('strips the query string from a relative path', () => {
    expect(sanitizeLogPath('/users/search?q=name')).toBe('/users/search');
  });

  it('strips the fragment', () => {
    expect(sanitizeLogPath('/a/b#section')).toBe('/a/b');
  });

  it('reduces an absolute URL to its pathname (drops scheme/host and query)', () => {
    expect(sanitizeLogPath('https://bff.example.com/install/v1/x?token=secret')).toBe('/install/v1/x');
  });

  it('returns "/" for an absolute URL with no path', () => {
    expect(sanitizeLogPath('https://bff.example.com')).toBe('/');
  });

  it('passes a clean relative path through unchanged', () => {
    expect(sanitizeLogPath('/integration/api/v1/thing')).toBe('/integration/api/v1/thing');
  });
});
