import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  BACKEND_ERROR_CODES,
  isBackendErrorCode,
  type BackendErrorCode,
} from '@/lib/constants/backend-error-codes';
import { isKnownErrorCode } from '@/lib/errors';

describe('backend error contract snapshot', () => {
  it('contains only the supplied BFF, Infra and partial Jira inventories', () => {
    const codes = Object.keys(BACKEND_ERROR_CODES);
    expect(codes).toHaveLength(82);
    expect(codes.filter((code) => code.startsWith('BFF_'))).toHaveLength(13);
    expect(codes.filter((code) => code.startsWith('INFRA_'))).toHaveLength(67);
    expect(codes.filter((code) => code.startsWith('JIRA_'))).toEqual([
      'JIRA_TICKET_NOT_FOUND',
      'JIRA_USER_NOT_FOUND',
    ]);
  });

  it('matches every documented code/status pair without duplicate catalog rows', () => {
    const catalog = readFileSync(
      resolve(process.cwd(), 'docs/bff-api/catalogs/error-codes.md'),
      'utf8',
    );
    const rows = Array.from(catalog.matchAll(
      /^\| `(BFF_[A-Z_]+|INFRA_[A-Z_]+|JIRA_[A-Z_]+)` \| (\d{3}) \|/gm,
    ));
    expect(rows).toHaveLength(82);
    expect(new Set(rows.map((row) => row[1])).size).toBe(rows.length);
    expect(Object.fromEntries(rows.map((row) => [row[1], Number(row[2])]))).toEqual(
      BACKEND_ERROR_CODES,
    );
  });

  it.each([
    ['INFRA_CREDENTIAL_NOT_FOUND', 400],
    ['INFRA_SCAN_FAILED', 403],
    ['INFRA_AWS_AUTH_FAILED', 403],
    ['INFRA_GCP_VPC_SERVICE_CONTROLS_VIOLATION', 403],
    ['INFRA_AWS_TARGET_NOT_INITIALIZED', 425],
    ['INFRA_TERRAFORM_TYPE_MISMATCH', 422],
    ['INFRA_OPERATION_NOT_SUPPORTED', 501],
    ['INFRA_TERRAFORM_WORKER_IN_PROGRESS', 503],
    ['BFF_AUTHENTICATION_FAILED', 401],
    ['BFF_ACCESS_DENIED', 403],
    ['BFF_UPSTREAM_AUTH_FAILED', 502],
    ['BFF_UPSTREAM_UNAVAILABLE', 502],
    ['BFF_UPSTREAM_TIMEOUT', 504],
  ] as const)('preserves the supplied status for %s', (code, status) => {
    expect(BACKEND_ERROR_CODES[code]).toBe(status);
  });

  it('accepts each registered code without enabling the legacy UI allowlist', () => {
    for (const code of Object.keys(BACKEND_ERROR_CODES)) {
      expect(isBackendErrorCode(code)).toBe(true);
      expect(isKnownErrorCode(code)).toBe(false);
    }
    expect(isKnownErrorCode('FORBIDDEN')).toBe(true);
    expect(isKnownErrorCode('NOT_FOUND')).toBe(true);
    expect(isKnownErrorCode('CONFLICT')).toBe(true);
  });

  it.each([
    undefined, null, '', ' ', 403, {}, [],
    'BFF_FUTURE_ERROR', 'INFRA_FUTURE_ERROR', 'JIRA_FUTURE_ERROR',
    'ORCHESTRATION_UNKNOWN', 'INFRA_', 'infra_scan_failed',
    ' INFRA_SCAN_FAILED', 'INFRA_SCAN_FAILED ',
    'FORBIDDEN', 'VALIDATION_FAILED', 'GUIDE_CONTENT_INVALID',
    'constructor', 'toString', '__proto__',
  ])('rejects an unregistered or non-string input: %j', (value) => {
    expect(isBackendErrorCode(value)).toBe(false);
  });

  it('narrows unknown input to the derived contract type', () => {
    const code: unknown = 'INFRA_SCAN_FAILED';
    if (!isBackendErrorCode(code)) throw new Error('Expected a registered code');
    expectTypeOf(code).toEqualTypeOf<BackendErrorCode>();
    expect(BACKEND_ERROR_CODES[code]).toBe(403);
  });
});
