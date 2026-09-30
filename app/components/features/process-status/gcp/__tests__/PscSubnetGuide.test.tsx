// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('leads the command with a comment saying which project and VPC it works in, and copies it too', () => {
    const { container } = render(<PscSubnetGuide targets={targets} />);
    const pre = container.querySelector('pre');
    expect(pre?.textContent?.split('\n')[0]).toBe(
      '# 호스트 프로젝트 acme-net-host-prod 의 VPC shared-vpc-prod 에 asia-northeast3 PSC용 proxy subnet 을 만듭니다',
    );
    expect(pre?.textContent?.split('\n')[1]).toContain('gcloud compute networks subnets create');
  });

  it('for the operator: every Region folded, and the lead asks them to REQUEST the subnet (오너 2026-09-14)', () => {
    const { container, getByText, queryByText } = render(<PscSubnetGuide targets={targets} admin />);
    expect(openStates(container)).toEqual([false, false]);
    expect(getByText('서비스 측 담당자에게 PSC용 Subnet 생성을 요청해 주세요.')).toBeTruthy();
    expect(queryByText('아래 명령으로 PSC용 Subnet을 생성해 주세요.')).toBeNull();
  });

  it('shows the execution scope and CIDR requirement before the commands', () => {
    const { container, getByText } = render(<PscSubnetGuide targets={targets} />);
    expect(getByText('호스트 프로젝트')).toBeTruthy();
    expect(getByText('호스트 VPC·Region 조합당 1개')).toBeTruthy();
    const cidrNote = getByText('명령의 {CIDR /24}를 프로젝트에서 사용하지 않는 /24 대역으로 바꿔 주세요.');
    const command = container.querySelector('details');
    expect(command).not.toBeNull();
    expect(cidrNote.compareDocumentPosition(command!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('copies the full command from a labelled button without unfolding the operator guide', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const { container, getByRole } = render(<PscSubnetGuide targets={targets} admin />);
    const button = getByRole('button', { name: 'asia-northeast3 명령 복사' });
    expect(button.textContent).toBe('명령 복사');
    fireEvent.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      `# 호스트 프로젝트 acme-net-host-prod 의 VPC shared-vpc-prod 에 asia-northeast3 PSC용 proxy subnet 을 만듭니다\n${targets[0].command}`,
    ));
    expect(openStates(container)).toEqual([false, false]);
  });
});
