/**
 * ADR-014 §D5 — boundary contract test.
 *
 * Both `httpBff` and `mockBff` MUST return snake_case keys recursively for
 * every method exposed by `BffClient`. Upstream BFF emits mixed casing in
 * practice (some snake, some camel); the boundary's job is to neutralize it.
 *
 * If a future change reverts or weakens the boundary, this test fails first
 * — before consumer/route tests start producing confusing runtime errors.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SNAKE_CASE_KEY = /^[a-z][a-z0-9_]*$/;

/**
 * Walks an object/array recursively and asserts every property name matches
 * snake_case. Throws an AssertionError naming the offending path on the first
 * failure so the test report tells you exactly which field drifted.
 */
const assertAllKeysSnakeCase = (value: unknown, path: string = 'root'): void => {
  if (Array.isArray(value)) {
    value.forEach((item, idx) => assertAllKeysSnakeCase(item, `${path}[${idx}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;

  for (const key of Object.keys(value)) {
    if (!SNAKE_CASE_KEY.test(key)) {
      throw new Error(
        `Key "${key}" at ${path} does not match snake_case (regex ${SNAKE_CASE_KEY.source}). ` +
        `BFF response keys must be snake_case at the boundary — see ADR-014.`,
      );
    }
    assertAllKeysSnakeCase(
      (value as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
  }
};

describe('ADR-014 boundary contract: snake_case recursive', () => {
  describe('httpBff (mocked fetch — exercises snakeCaseKeys)', () => {
    const originalFetch = global.fetch;
    const originalEnv = process.env.BFF_API_URL;

    beforeEach(() => {
      process.env.BFF_API_URL = 'http://test-bff';
      vi.resetModules();
    });

    afterEach(() => {
      global.fetch = originalFetch;
      process.env.BFF_API_URL = originalEnv;
      vi.restoreAllMocks();
    });

    it('users.me — mixed-case upstream response is snake_cased', async () => {
      // Upstream emits a deliberately mixed payload (snake + camel together)
      // as has been observed in production. Boundary must collapse to snake.
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: {
              id: 'user-1',
              name: '홍길동',
              email: 'a@b.c',
              role: 'ADMIN',
              serviceCodePermissions: ['SERVICE-A'],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      const { httpBff } = await import('@/lib/bff/http');
      const result = await httpBff.users.me();
      assertAllKeysSnakeCase(result, 'users.me');
      expect((result.user as unknown as Record<string, unknown>).service_code_permissions).toEqual(['SERVICE-A']);
    });

    it('dashboard.summary — pure camelCase upstream is snake_cased', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            totalSystems: 7,
            statusBreakdown: { activeCount: 3, idleCount: 4 },
            updatedAt: '2026-05-01T00:00:00Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      const { httpBff } = await import('@/lib/bff/http');
      const result = await httpBff.dashboard.summary();
      assertAllKeysSnakeCase(result, 'dashboard.summary');
    });

    it('aws.getInstallationStatus — already-snake upstream stays snake', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            provider: 'AWS',
            installed: true,
            tf_execution_role_arn: 'arn:aws:iam::123:role/x',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      const { httpBff } = await import('@/lib/bff/http');
      const result = await httpBff.aws.getInstallationStatus(1001);
      assertAllKeysSnakeCase(result, 'aws.getInstallationStatus');
    });

    it('confirm.testConnection (POST) — POST responses are snake_cased too', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'tc-1', requestId: 'req-1' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      const { httpBff } = await import('@/lib/bff/http');
      const result = await httpBff.confirm.testConnection(1001, {});
      assertAllKeysSnakeCase(result, 'confirm.testConnection');
    });
  });

  describe('mockBff (in-memory) — unwrap() enforces snake_case', () => {
    it('users.me', async () => {
      const { mockBff } = await import('@/lib/bff/mock-adapter');
      const result = await mockBff.users.me();
      assertAllKeysSnakeCase(result, 'mockBff.users.me');
    });

    it('dashboard.summary', async () => {
      const { mockBff } = await import('@/lib/bff/mock-adapter');
      const result = await mockBff.dashboard.summary();
      assertAllKeysSnakeCase(result, 'mockBff.dashboard.summary');
    });
  });
});
