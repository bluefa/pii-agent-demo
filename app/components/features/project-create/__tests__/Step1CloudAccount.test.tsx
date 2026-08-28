// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Step1CloudAccount } from '@/app/components/features/project-create/Step1CloudAccount';
import type { OperatingRegion } from '@/app/components/features/project-create/wizard-model';
import type { ProviderChipKey } from '@/lib/constants/provider-mapping';

const renderStep = (providerKey: ProviderChipKey, region: OperatingRegion = 'global') => {
  const onRegionChange = vi.fn<(region: OperatingRegion) => void>();
  render(
    <Step1CloudAccount
      providerKey={providerKey}
      onProviderChange={vi.fn()}
      region={region}
      onRegionChange={onRegionChange}
    />,
  );
  return { onRegionChange };
};

const regionPair = () => screen.queryByRole('radiogroup', { name: '운영 리전' });
const chinaOptIn = () => screen.queryByRole('checkbox', { name: /중국/ });

describe('Step1CloudAccount — how each chip is asked about China', () => {
  it('gives AWS the Global/China card pair, not the opt-in', () => {
    renderStep('aws');
    expect(regionPair()).not.toBeNull();
    expect(chinaOptIn()).toBeNull();
  });

  it('asks GCP nothing at all — it has no China partition', () => {
    renderStep('gcp');
    expect(regionPair()).toBeNull();
    expect(chinaOptIn()).toBeNull();
  });

  it.each(['idc', 'other'] as const)('gives %s the opt-in, not the card pair', (providerKey) => {
    renderStep(providerKey);
    expect(regionPair()).toBeNull();
    const optIn = chinaOptIn();
    expect(optIn).not.toBeNull();
    expect(optIn?.getAttribute('aria-checked')).toBe('false');
  });

  it.each(['idc', 'other'] as const)(
    'labels the %s opt-in 운영 리전 with no required mark',
    (providerKey) => {
      renderStep(providerKey);
      // Exact-string name match: a `*` in the legend would land in the accessible name,
      // so this only passes while the opt-in legend stays unmarked.
      expect(screen.queryByRole('group', { name: '운영 리전' })).not.toBeNull();
      expect(screen.queryByRole('group', { name: /운영 리전\s*\*/ })).toBeNull();
    },
  );

  it.each(['idc', 'other'] as const)('checks %s into China on click', (providerKey) => {
    const { onRegionChange } = renderStep(providerKey);
    fireEvent.click(screen.getByRole('checkbox', { name: /중국/ }));
    expect(onRegionChange).toHaveBeenCalledWith('china');
  });

  it.each(['idc', 'other'] as const)('shows %s as checked and unchecks it back', (providerKey) => {
    const { onRegionChange } = renderStep(providerKey, 'china');
    const optIn = screen.getByRole('checkbox', { name: /중국/ });
    expect(optIn.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(optIn);
    expect(onRegionChange).toHaveBeenCalledWith('global');
  });
});
