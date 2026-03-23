import type { BffConfirmedIntegration } from '@/lib/types';

export interface ConfirmedIntegrationEnvelopeResponse {
  confirmed_integration: BffConfirmedIntegration | null;
}

export type ConfirmedIntegrationResponsePayload =
  | BffConfirmedIntegration
  | ConfirmedIntegrationEnvelopeResponse;

export const createEmptyConfirmedIntegration = (): BffConfirmedIntegration => ({
  resource_infos: [],
});

export const extractConfirmedIntegration = (
  payload: ConfirmedIntegrationResponsePayload,
): BffConfirmedIntegration => {
  if ('confirmed_integration' in payload) {
    return payload.confirmed_integration ?? createEmptyConfirmedIntegration();
  }

  return payload;
};
