// @vitest-environment jsdom
/**
 * Terraform Role 칸은 설치 모드와 상관없이 늘 선다 (오너 08-26).
 *
 * 예전에는 `grantTfExecution &&` 로 칸이 통째로 사라져서, 수동 대상의 그리드는 뒤 칸이
 * 한 자리씩 당겨진 채로 섰다 — 두 모드를 오가며 대조하는 운영자에게 열 순서가 바뀌었고,
 * 「없다」와 「아직 못 읽었다」도 구분되지 않았다. 그 조건은 한 줄이라 되돌려도 다른
 * 테스트는 전부 초록이다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';

const getRawTargetSourceDetail = vi.fn();

vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: (...args: unknown[]) => getRawTargetSourceDetail(...args),
}));
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: vi.fn(async () => ({ content: [], totalPages: 1 })),
  startScan: vi.fn(async () => null),
}));
vi.mock('@/app/lib/api', () => ({ getProcessStatus: vi.fn(async () => null) }));
vi.mock('@/app/hooks/useTestConnectionPolling', () => ({ fetchLatestTest: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/aws', () => ({ getAwsRoleVerification: vi.fn(async () => null) }));
vi.mock('@/app/lib/api/ops', () => ({
  getCollaborationChannel: vi.fn(async () => null),
  getTargetJiraTicket: vi.fn(async () => null),
  updateTargetSourceDoesSupportRaw: vi.fn(async () => undefined),
  getDagStatus: vi.fn(() => Promise.reject(new Error('no dag-status fixture'))),
}));
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: vi.fn(async () => null),
  getTestConnectionResults: vi.fn(async () => []),
}));

const detail = (grant: boolean) => ({
  target_source_id: 1006,
  service_name: 'AWS',
  service_code: 'aws',
  cloud_provider: 'AWS',
  metadata: {
    is_sdu_type: false,
    aws_account_id: '451814760281',
    aws_scan_role_arn: 'arn:aws:iam::451814760281:role/BDCPIIInfraScanRole',
    aws_terraform_execution_role_arn:
      'arn:aws:iam::451814760281:role/bdc-infra-terraform-worker-service-role',
    grant_service_terraform_execution_permission: grant,
  },
});

/** 「Terraform Role」 라벨이 든 kv 셀의 값 — 라벨이 값 위에 서므로 형제 하나를 읽는다. */
const tfValue = async (): Promise<string> => {
  const key = await screen.findByText('Terraform Role');
  const cell = key.parentElement;
  await waitFor(() => expect(cell?.children[1]?.textContent).toBeTruthy());
  return cell?.children[1]?.textContent ?? '';
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1006');
});

describe('OpsTargetView — Terraform Role 칸', () => {
  it('자동 설치면 등록된 role 을 그린다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail(true));
    render(<OpsTargetView targetSourceId={1006} initialTab="진행 상태" />);
    expect(await tfValue()).toContain('bdc-infra-terraform-worker-service-role');
  });

  it('수동 설치여도 칸은 사라지지 않고, 왜 비었는지를 적는다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail(false));
    render(<OpsTargetView targetSourceId={1006} initialTab="진행 상태" />);
    // 「미등록」이 아니다 — 등록을 빠뜨린 게 아니라 이 모드에 필요하지 않은 것이다.
    expect(await tfValue()).toBe('역할 불필요');
  });
});
