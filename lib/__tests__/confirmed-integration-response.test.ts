import { describe, expect, it } from 'vitest';
import type { BffConfirmedIntegration } from '@/lib/types';
import {
  createEmptyConfirmedIntegration,
  extractConfirmedIntegration,
} from '@/lib/confirmed-integration-response';

const confirmedIntegration: BffConfirmedIntegration = {
  resource_infos: [
    {
      resource_id: 'res-1',
      resource_type: 'ORACLE_DB',
      endpoint_config: {
        resource_id: 'res-1',
        db_type: 'ORACLE',
        host: 'db.internal',
        port: 1521,
        oracleServiceId: 'ORCL',
      },
      credential_id: 'cred-1',
    },
  ],
};

describe('extractConfirmedIntegration', () => {
  it('returns flat payload as-is', () => {
    expect(extractConfirmedIntegration(confirmedIntegration)).toBe(confirmedIntegration);
  });

  it('unwraps legacy envelope payload', () => {
    expect(
      extractConfirmedIntegration({
        confirmed_integration: confirmedIntegration,
      }),
    ).toBe(confirmedIntegration);
  });

  it('converts null envelope payload to an empty confirmed integration', () => {
    expect(
      extractConfirmedIntegration({
        confirmed_integration: null,
      }),
    ).toEqual(createEmptyConfirmedIntegration());
  });
});
