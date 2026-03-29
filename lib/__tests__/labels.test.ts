import { describe, expect, it } from 'vitest';
import {
  AZURE_RESOURCE_TYPE_ORDER,
  getResourceTypeLabel,
} from '@/lib/constants/labels';

describe('Azure resource label helpers', () => {
  it('returns friendly labels for Issue #222 Azure support resource enums', () => {
    expect(getResourceTypeLabel('AZURE_PRIVATE_ENDPOINT')).toBe('Azure Private Endpoint');
    expect(getResourceTypeLabel('AZURE_NETWORK_INTERFACE')).toBe('Azure Network Interface');
    expect(getResourceTypeLabel('AZURE_VIRTUAL_SUBNET')).toBe('Azure Virtual Subnet');
    expect(getResourceTypeLabel('AZURE_SERVICE_PRINCIPAL')).toBe('Azure Service Principal');
  });

  it('keeps Issue #222 Azure support resource enums in the display order', () => {
    expect(AZURE_RESOURCE_TYPE_ORDER).toEqual(expect.arrayContaining([
      'AZURE_PRIVATE_ENDPOINT',
      'AZURE_NETWORK_INTERFACE',
      'AZURE_VIRTUAL_SUBNET',
      'AZURE_SERVICE_PRINCIPAL',
    ]));
  });
});
