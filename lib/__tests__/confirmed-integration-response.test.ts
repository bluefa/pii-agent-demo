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
      database_type: 'ORACLE',
      host: 'db.internal',
      port: 1521,
      oracle_service_id: 'ORCL',
      network_interface_id: 'nic-1',
      ip_configuration_name: 'ipconfig-1',
      credential_id: 'cred-1',
    },
  ],
};

describe('extractConfirmedIntegration', () => {
  it('returns flat payload as-is', () => {
    expect(extractConfirmedIntegration(confirmedIntegration)).toEqual(confirmedIntegration);
  });

  it('unwraps legacy envelope payload', () => {
    expect(
      extractConfirmedIntegration({
        confirmed_integration: confirmedIntegration,
      }),
    ).toEqual(confirmedIntegration);
  });

  it('normalizes legacy endpoint_config payload to flat snake_case fields', () => {
    expect(
      extractConfirmedIntegration({
        confirmed_integration: {
          resource_infos: [
            {
              resource_id: 'res-1',
              resource_type: 'AZURE_VM',
              // Post-ADR-014 boundary shape: BFF response keys arrive snake_case
              // including the inner endpoint_config snapshot. Cast to bypass
              // the EndpointConfigSnapshot static type (which doubles as a
              // frontend form-input shape and stays camelCase for now).
              endpoint_config: {
                resource_id: 'res-1',
                db_type: 'ORACLE',
                host: 'db.internal',
                port: 1521,
                oracle_service_id: 'ORCL',
                selected_nic_id: 'nic-1',
              } as never,
              credential_id: 'cred-1',
            },
          ],
        },
      }),
    ).toEqual({
      resource_infos: [
        {
          resource_id: 'res-1',
          resource_type: 'AZURE_VM',
          database_type: 'ORACLE',
          host: 'db.internal',
          port: 1521,
          oracle_service_id: 'ORCL',
          network_interface_id: 'nic-1',
          ip_configuration_name: null,
          credential_id: 'cred-1',
        },
      ],
    });
  });

  it('converts null envelope payload to an empty confirmed integration', () => {
    expect(
      extractConfirmedIntegration({
        confirmed_integration: null,
      }),
    ).toEqual(createEmptyConfirmedIntegration());
  });
});
