/**
 * Contract test: every BFF response normalizer used by Next.js API routes must
 * accept any input casing — snake_case, camelCase, or mixed — and produce the
 * same normalized output.
 *
 * Why: httpBff GET runs camelCaseKeys on every response; upstream BFF itself
 * sometimes emits mixed casing. Tests using snake_case fixtures only do not
 * catch the gap. Each normalizer is exercised here against three input shapes
 * derived from the same logical payload.
 */
import { describe, expect, it } from 'vitest';
import {
  buildApprovalHistoryPage,
  normalizeApprovalActionResponse,
  normalizeApprovalHistoryPage,
  normalizeApprovalRequestSummary,
  normalizeApprovedIntegration,
  normalizeConfirmedIntegration,
  normalizeProcessStatusResponse,
} from '@/lib/approval-bff';
import { extractConfirmedIntegration } from '@/lib/confirmed-integration-response';
import { extractResourceCatalog } from '@/lib/resource-catalog-response';
import { camelCaseKeys } from '@/lib/object-case';

/**
 * Build three shape variants of the same payload:
 *   - snake: all keys snake_case
 *   - camel: all keys camelCase (what httpBff GET produces)
 *   - mixed: some snake, some camel (what upstream BFF may emit raw)
 */
const variants = <T>(snake: T): { snake: T; camel: T; mixed: T } => ({
  snake,
  camel: camelCaseKeys(snake),
  mixed: mixCases(snake) as T,
});

/** Recursively flip every other key to camelCase so the result has both forms. */
const mixCases = (value: unknown, depth = 0): unknown => {
  if (Array.isArray(value)) return value.map((v) => mixCases(v, depth + 1));
  if (value === null || typeof value !== 'object') return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;

  const entries = Object.entries(value as Record<string, unknown>);
  return Object.fromEntries(
    entries.map(([key, v], idx) => {
      const flipKey = (idx + depth) % 2 === 0
        ? key
        : key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
      return [flipKey, mixCases(v, depth + 1)];
    }),
  );
};

const expectAllVariantsEqual = <In, Out>(
  name: string,
  snakeInput: In,
  run: (input: In) => Out,
) => {
  const { snake, camel, mixed } = variants(snakeInput);
  const fromSnake = run(snake);
  const fromCamel = run(camel);
  const fromMixed = run(mixed);
  expect(fromCamel, `${name}: camel input should equal snake input result`).toEqual(fromSnake);
  expect(fromMixed, `${name}: mixed input should equal snake input result`).toEqual(fromSnake);
};

describe('BFF response normalizers — case tolerance', () => {
  it('extractConfirmedIntegration', () => {
    expectAllVariantsEqual(
      'extractConfirmedIntegration',
      {
        confirmed_integration: {
          resource_infos: [
            {
              resource_id: 'res-1',
              resource_type: 'ORACLE_DB',
              database_type: 'ORACLE',
              host: 'db.internal',
              port: 1521,
              oracle_service_id: 'ORCL',
              network_interface_id: 'nic-1',
              ip_configuration_name: 'ipconfig-1',
              credential_id: 'cred-1',
            },
          ],
        },
      },
      (input) => extractConfirmedIntegration(input as never),
    );
  });

  it('extractResourceCatalog', () => {
    expectAllVariantsEqual(
      'extractResourceCatalog',
      {
        resources: [
          {
            resource_id: 'vm-1',
            name: 'vm-1',
            resource_type: 'AZURE_VM',
            database_type: 'ORACLE',
            integration_category: 'NO_INSTALL_NEEDED',
            host: 'db.internal',
            port: 1521,
            oracle_service_id: 'ORCL',
            network_interface_id: 'nic-1',
            ip_configuration_name: null,
            metadata: {
              provider: 'Azure',
              resource_type: 'AZURE_VM',
              raw_resource_type: 'AZURE_VM',
            },
          },
        ],
        total_count: 1,
      },
      (input) => extractResourceCatalog(input as never),
    );
  });

  it('normalizeApprovedIntegration', () => {
    expectAllVariantsEqual(
      'normalizeApprovedIntegration',
      {
        approved_integration: {
          id: 7,
          request_id: 42,
          approved_at: '2026-05-01T00:00:00Z',
          approved_by: { user_id: 'admin' },
          resource_infos: [
            {
              resource_id: 'res-1',
              resource_type: 'AZURE_VM',
              database_type: 'ORACLE',
              port: 1521,
              host: 'db.internal',
              oracle_service_id: 'ORCL',
              network_interface_id: 'nic-1',
              ip_configuration: 'ipconfig-1',
              credential_id: 'cred-1',
            },
          ],
          excluded_resource_infos: [
            {
              resource_id: 'res-2',
              exclusion_reason: 'manual',
            },
          ],
        },
      },
      (input) => normalizeApprovedIntegration(input),
    );
  });

  it('normalizeConfirmedIntegration', () => {
    expectAllVariantsEqual(
      'normalizeConfirmedIntegration',
      {
        confirmed_integration: {
          resource_infos: [
            {
              resource_id: 'res-1',
              resource_type: 'AZURE_VM',
              database_type: 'ORACLE',
              port: 1521,
              host: 'db.internal',
              oracle_service_id: 'ORCL',
              network_interface_id: 'nic-1',
              ip_configuration_name: 'ipconfig-1',
              credential_id: 'cred-1',
            },
          ],
        },
      },
      (input) => normalizeConfirmedIntegration(input),
    );
  });

  it('normalizeProcessStatusResponse', () => {
    expectAllVariantsEqual(
      'normalizeProcessStatusResponse',
      {
        target_source_id: 1001,
        process_status: 'CONFIRMED',
        healthy: 'HEALTHY',
        evaluated_at: '2026-05-01T00:00:00Z',
      },
      (input) => normalizeProcessStatusResponse(input),
    );
  });

  it('normalizeApprovalRequestSummary', () => {
    expectAllVariantsEqual(
      'normalizeApprovalRequestSummary',
      {
        approval_request: {
          id: 9,
          target_source_id: 1001,
          status: 'PENDING',
          requested_by: { user_id: 'requester' },
          requested_at: '2026-05-01T00:00:00Z',
          resource_total_count: 5,
          resource_selected_count: 3,
        },
      },
      (input) => normalizeApprovalRequestSummary(input),
    );
  });

  it('normalizeApprovalActionResponse', () => {
    expectAllVariantsEqual(
      'normalizeApprovalActionResponse',
      {
        request_id: 9,
        status: 'APPROVED',
        processed_by: { user_id: 'approver' },
        processed_at: '2026-05-01T00:00:00Z',
        reason: 'looks good',
      },
      (input) => normalizeApprovalActionResponse(input),
    );
  });

  it('normalizeApprovalHistoryPage', () => {
    expectAllVariantsEqual(
      'normalizeApprovalHistoryPage',
      {
        content: [
          {
            request: {
              id: 9,
              target_source_id: 1001,
              status: 'APPROVED',
              requested_by: { user_id: 'requester' },
              requested_at: '2026-05-01T00:00:00Z',
              resource_total_count: 1,
              resource_selected_count: 1,
            },
            result: {
              request_id: 9,
              status: 'APPROVED',
              processed_by: { user_id: 'approver' },
              processed_at: '2026-05-01T00:00:00Z',
            },
          },
        ],
        page: {
          number: 0,
          size: 20,
          total_elements: 1,
          total_pages: 1,
        },
      },
      (input) => normalizeApprovalHistoryPage(input, 1001),
    );
  });

  it('buildApprovalHistoryPage page metadata', () => {
    expectAllVariantsEqual(
      'buildApprovalHistoryPage',
      {
        page: {
          number: 2,
          size: 10,
          total_elements: 25,
          total_pages: 3,
        },
      },
      (input) => buildApprovalHistoryPage([], input),
    );
  });
});

