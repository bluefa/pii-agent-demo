import { describe, it, expect } from 'vitest';
import { normalizePathTemplate, sanitizeLogPath } from '@/lib/log-path';

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

describe('normalizePathTemplate', () => {
  it('collapses a purely numeric id segment', () => {
    expect(normalizePathTemplate('/integration/target-sources/123')).toBe(
      '/integration/target-sources/:id',
    );
  });

  it('collapses a UUID segment (any case)', () => {
    expect(normalizePathTemplate('/resources/11111111-2222-4333-8444-555555555555')).toBe(
      '/resources/:id',
    );
    expect(normalizePathTemplate('/resources/AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE')).toBe(
      '/resources/:id',
    );
  });

  it('collapses a long (≥8) hex segment', () => {
    expect(normalizePathTemplate('/jobs/deadbeef12')).toBe('/jobs/:id');
  });

  it('preserves a short (<8) hex segment', () => {
    expect(normalizePathTemplate('/jobs/cafe')).toBe('/jobs/cafe');
  });

  it('collapses only id-like segments in a mixed path', () => {
    expect(
      normalizePathTemplate('/a/123/b/11111111-2222-4333-8444-555555555555/c'),
    ).toBe('/a/:id/b/:id/c');
  });

  it('leaves a path with no id segments unchanged', () => {
    expect(normalizePathTemplate('/integration/services')).toBe('/integration/services');
  });

  it('preserves leading slash and non-id words that contain non-hex chars', () => {
    expect(normalizePathTemplate('/api/v1/target-sources/installation-status')).toBe(
      '/api/v1/target-sources/installation-status',
    );
  });
});
