// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PscSubnetGuide } from '@/app/components/features/process-status/gcp/PscSubnetGuide';
import { pscSubnetTargets } from '@/app/components/features/process-status/gcp/psc-subnet';

const targets = pscSubnetTargets(
  ['asia-northeast3', 'europe-west2'].map((region) => ({
    resource_id: `r-${region}`,
    resource_type: 'GCP_SQL',
    credential_id: null,
    metadata: { region, host_project: 'acme-net-host-prod', host_network: 'shared-vpc-prod' },
  })),
);

const openStates = (container: HTMLElement) =>
  [...container.querySelectorAll('details')].map((d) => d.open);

describe('PscSubnetGuide', () => {
  it('opens the first Region only — the user runs the command, so its shape shows once', () => {
    const { container } = render(<PscSubnetGuide targets={targets} />);
    expect(openStates(container)).toEqual([true, false]);
  });

  it('for the operator: every Region folded, and the lead asks them to REQUEST the subnet (오너 2026-09-14)', () => {
    const { container, getByText, queryByText } = render(<PscSubnetGuide targets={targets} admin />);
    expect(openStates(container)).toEqual([false, false]);
    expect(getByText(/서비스 측 담당자에게 .*요청해주세요/)).toBeTruthy();
    expect(queryByText(/실행해주세요/)).toBeNull();
  });
});
