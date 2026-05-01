import { describe, expect, it } from 'vitest';
import type { BffConfirmedIntegration } from '@/lib/types';
import {
  createEmptyConfirmedIntegration,
  extractConfirmedIntegration,
} from '@/lib/confirmed-integration-response';
import { camelCaseKeys } from '@/lib/object-case';

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
              endpoint_config: {
                resource_id: 'res-1',
                db_type: 'ORACLE',
                host: 'db.internal',
                port: 1521,
                oracleServiceId: 'ORCL',
                selectedNicId: 'nic-1',
              },
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

  // The real BFF call goes through httpBff.get(), which runs camelCaseKeys()
  // on every GET response (lib/bff/http.ts:40). So by the time the payload
  // reaches extractConfirmedIntegration, snake_case envelope keys are camelCase.
  // The extractor MUST tolerate that — otherwise the route returns an empty
  // integration in production while tests (using snake_case fixtures) still pass.
  it('handles fully camelCased payload (post httpBff GET)', () => {
    const camelPayload = camelCaseKeys({ confirmed_integration: confirmedIntegration });
    expect(extractConfirmedIntegration(camelPayload as never)).toEqual(confirmedIntegration);
  });

  it('handles mixed snake/camel payload from upstream BFF', () => {
    const mixed = {
      confirmed_integration: {
        resource_infos: [
          {
            resourceId: 'res-1',
            resource_type: 'ORACLE_DB',
            databaseType: 'ORACLE',
            host: 'db.internal',
            port: 1521,
            oracle_service_id: 'ORCL',
            networkInterfaceId: 'nic-1',
            ipConfigurationName: 'ipconfig-1',
            credential_id: 'cred-1',
          },
        ],
      },
    };
    expect(extractConfirmedIntegration(mixed as never)).toEqual(confirmedIntegration);
  });
});
