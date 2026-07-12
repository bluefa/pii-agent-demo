import { describe, it, expect } from 'vitest';
import { getRequestId } from '@/app/api/_lib/request-id';

const requestWith = (id?: string): Request =>
  new Request('http://localhost/test', id ? { headers: { 'x-request-id': id } } : undefined);

describe('getRequestId', () => {
  it('honors a valid inbound x-request-id (UUID)', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(getRequestId(requestWith(id))).toBe(id);
  });

  it('honors a valid inbound hex-and-dash id within the length bound', () => {
    const id = 'abcdef0123456789';
    expect(getRequestId(requestWith(id))).toBe(id);
  });

  it('rejects a garbage inbound id and generates a fresh UUID', () => {
    const generated = getRequestId(requestWith('drop table users; --'));
    expect(generated).not.toBe('drop table users; --');
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects an over-length inbound id', () => {
    const tooLong = 'a'.repeat(65);
    expect(getRequestId(requestWith(tooLong))).not.toBe(tooLong);
  });

  it('generates a UUID when no inbound header is present', () => {
    expect(getRequestId(requestWith())).toMatch(/^[0-9a-f-]{36}$/);
  });
});
