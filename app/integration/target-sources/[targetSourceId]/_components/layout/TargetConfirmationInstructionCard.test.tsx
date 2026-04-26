// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import { TargetConfirmationInstructionCard } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/TargetConfirmationInstructionCard';

const baseFixture: Omit<CloudTargetSource, 'cloudProvider'> = {
  id: 'proj-1',
  targetSourceId: 1001,
  projectCode: 'PROJ-001',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'Test integration',
  description: 'Test description',
  isRejected: false,
};

const awsFixture: CloudTargetSource = {
  ...baseFixture,
  cloudProvider: 'AWS',
};

const azureFixture: CloudTargetSource = {
  ...baseFixture,
  cloudProvider: 'Azure',
};

const gcpFixture: CloudTargetSource = {
  ...baseFixture,
  cloudProvider: 'GCP',
};

describe('TargetConfirmationInstructionCard', () => {
  it('renders AWS variant with title, all 4 ordered-list items, and IAM note', () => {
    render(<TargetConfirmationInstructionCard project={awsFixture} />);

    expect(screen.getByText('수행 절차')).toBeTruthy();
    expect(
      screen.getByText('[리소스 스캔] 버튼을 클릭하여 AWS 계정의 RDS, S3 등 리소스를 조회하세요'),
    ).toBeTruthy();
    expect(screen.getByText('스캔 결과에서 PII Agent를 연동할 리소스를 선택하세요')).toBeTruthy();
    expect(screen.getByText('EC2(VM) 포함이 필요한 경우 필터에서 VM 포함을 선택하세요')).toBeTruthy();
    expect(screen.getByText('선택 완료 후 [연동 대상 확정] 버튼을 클릭하세요')).toBeTruthy();
    expect(
      screen.getByText(
        '리소스가 조회되지 않으면 AWS Console > IAM에서 스캔 Role이 등록되어 있는지 확인해주세요',
      ),
    ).toBeTruthy();
  });

  it('renders Azure variant with 안내 title, single instruction, and no IAM note', () => {
    render(<TargetConfirmationInstructionCard project={azureFixture} />);

    expect(screen.getByText('안내')).toBeTruthy();
    expect(
      screen.getByText('리소스를 스캔하고 연동할 대상을 선택한 뒤 확정해주세요'),
    ).toBeTruthy();
    expect(screen.queryByText('수행 절차')).toBeNull();
    expect(
      screen.queryByText(
        '리소스가 조회되지 않으면 AWS Console > IAM에서 스캔 Role이 등록되어 있는지 확인해주세요',
      ),
    ).toBeNull();
  });

  it('renders GCP variant with 안내 title, single instruction, and no IAM note', () => {
    render(<TargetConfirmationInstructionCard project={gcpFixture} />);

    expect(screen.getByText('안내')).toBeTruthy();
    expect(
      screen.getByText('리소스를 스캔하고 연동할 대상을 선택한 뒤 확정해주세요'),
    ).toBeTruthy();
    expect(screen.queryByText('수행 절차')).toBeNull();
    expect(
      screen.queryByText(
        '리소스가 조회되지 않으면 AWS Console > IAM에서 스캔 Role이 등록되어 있는지 확인해주세요',
      ),
    ).toBeNull();
  });
});
