// @vitest-environment jsdom
/**
 * The head's job after three owner calls:
 *
 *   "연동 확정 정보와 Terraform 상태를 하나의 카드로, 확정 정보는 라벨로" (2026-08-30)
 *   "작업 시작은 현재 작업 카드에만" (2026-08-30)
 *   "installationStatus 로 누가 뭘 할 차례다 / 완료됐다를 명확하게" (2026-09-13)
 *
 *   1. ONE card: the 연동 정보 label line, the verdict row, the step rows.
 *   2. The verdict names whose move it is; the rows carry each step's owner and
 *      state, and only the steps this target actually has.
 *   3. The 관리자 turn offers a link down to 현재 작업, never a 작업 시작 button.
 *   4. The card head carries 확인 시각 from installation-status, not terraform-status.
 *   5. The terraform-status task rows are gone; 연동 정보 still reads that response.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  InfraStatusHead,
  type InfraStatusHeadProps,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InfraStatusHead';
import type { InstallStateView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installState';
import type { TerraformStatusResponse } from '@/app/lib/api';

const CONFIRMED: TerraformStatusResponse = {
  target_source_id: 1010,
  cloud_provider: 'AWS',
  is_sdu_type: false,
  has_confirmed_infra: true,
  latest_confirmed_at: '2026-08-20T04:00:00.000Z',
  checked_at: '2026-08-27T01:00:00.000Z',
  overall_state: 'APPLY_FAILED',
  tasks: [
    { terraform_execution_side: 'BDC', terraform_task_name: 'aws-vpc-peering', state: 'APPLIED' },
  ],
};

const UNCONFIRMED: TerraformStatusResponse = { ...CONFIRMED, has_confirmed_infra: false };

const step = (
  id: string,
  title: string,
  side: '서비스' | '관리자',
  state: InstallStateView['steps'][number]['state'],
  extra: Partial<InstallStateView['steps'][number]> = {},
): InstallStateView['steps'][number] => ({
  id,
  title,
  side,
  state,
  done: state === 'done' ? 1 : 0,
  total: 1,
  failed: 0,
  open: [],
  listResources: true,
  openLabel: '조치 필요',
  ...extra,
});

/** AWS 수동 ② — the service applied, the operator is next. */
const OPERATOR_TURN: InstallStateView = {
  kind: 'me',
  sentence: '관리자가 Terraform을 적용할 차례입니다',
  steps: [
    step('service', '서비스 측 Terraform 적용', '서비스', 'done'),
    step('bdcCommon', 'BDC 공통 영역', '관리자', 'now'),
    step('bdcService', 'BDC 서비스 영역', '관리자', 'wait'),
  ],
};

const LAST_CHECK = { status: 'SUCCESS' as const, checkedAt: '2026-09-12T05:03:00.000Z' };

const renderHead = (
  overrides: Partial<InfraStatusHeadProps> = {},
) =>
  render(
    <InfraStatusHead
      status={CONFIRMED}
      loading={false}
      failed={false}
      processStatus="INSTALLED"
      onSelectTab={vi.fn()}
      install={OPERATOR_TURN}
      installLoading={false}
      installLastCheck={LAST_CHECK}
      onGoToCurrentWork={vi.fn()}
      {...overrides}
    />,
  );

const detailButton = () => screen.queryByRole('button', { name: /상세정보 보기/ });

describe('InfraStatusHead — 설치 상태', () => {
  it('says whose move it is in one sentence, with the tag beside it', () => {
    renderHead();

    expect(screen.getByRole('heading', { name: '설치 상태' })).toBeTruthy();
    expect(screen.getByText('관리자가 Terraform을 적용할 차례입니다')).toBeTruthy();
    expect(screen.getByText('관리자 조치 필요')).toBeTruthy();
  });

  it('renders one row per step with its owner and ONE state fact: tag only on the step to act on', () => {
    renderHead();

    expect(screen.getByText('서비스 측 Terraform 적용')).toBeTruthy();
    expect(screen.getByText('BDC 공통 영역')).toBeTruthy();
    expect(screen.getByText('BDC 서비스 영역')).toBeTruthy();
    // The owner is weak text after the title, not a tag of its own.
    expect(screen.getByText('· 서비스')).toBeTruthy();
    expect(screen.getAllByText('· 관리자')).toHaveLength(2);
    expect(screen.getByText('1건 모두 완료')).toBeTruthy();
    expect(screen.getByText('조치 필요')).toBeTruthy();
    expect(screen.getByText('대기')).toBeTruthy();
    // No resource table under a step that has none open in its list.
    expect(screen.queryByRole('table', { name: /남은 리소스/ })).toBeNull();
  });

  it('names the resources still open under the step to act on, in a fold with a table, in the step\'s own words', () => {
    renderHead({
      install: {
        kind: 'svc',
        sentence: '서비스 담당자가 접근 허용을 확인해야 합니다',
        steps: [
          step('cx', 'BDC CX 영역', '관리자', 'done', { done: 5, total: 5 }),
          step('firewall', '접근 허용', '서비스', 'now', {
            done: 3,
            total: 5,
            openLabel: '서비스측 방화벽 확인 요청 필요',
            open: [
              { resourceId: 'idc-res-002', resourceName: null, failed: false, guide: null },
              { resourceId: 'idc-res-004', resourceName: null, failed: false, guide: null },
            ],
          }),
        ],
      },
      identity: new Map([
        ['idc-res-002', { label: '10.20.31.10:1521', databaseType: 'ORACLE', sourceIps: ['10.10.0.21', '10.10.0.22'] }],
      ]),
    });

    expect(screen.getByText('5건 모두 완료')).toBeTruthy();
    expect(screen.getByText('5건 중 2건 남음')).toBeTruthy();
    expect(screen.getByText('남은 리소스')).toBeTruthy();
    expect(screen.getByText('2건')).toBeTruthy();
    const table = screen.getByRole('table', { name: '접근 허용 남은 리소스' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('10.20.31.10:1521')).toBeTruthy();
    // BDC측 출발지: the addresses the firewall has to admit, one per line.
    expect(within(table).getByRole('columnheader', { name: 'BDC측 출발지' })).toBeTruthy();
    expect(within(rows[0]).getByText('10.10.0.21')).toBeTruthy();
    expect(within(rows[0]).getByText('10.10.0.22')).toBeTruthy();
    expect(within(rows[0]).getByText('Oracle')).toBeTruthy();
    expect(within(rows[0]).getByText('서비스측 방화벽 확인 요청 필요')).toBeTruthy();
    // Not in the join: the wire id stands in, the DB cell is empty.
    expect(within(rows[1]).getByText('idc-res-004')).toBeTruthy();
    expect(within(rows[1]).getByText('-')).toBeTruthy();
    // Nothing failed: no note about the developer.
    expect(screen.queryByText(/개발자에게 연락/)).toBeNull();
  });

  it('offers the 관리자 turn a link to 현재 작업, never a 작업 시작 button', () => {
    const onGoToCurrentWork = vi.fn();
    renderHead({ onGoToCurrentWork });

    expect(screen.queryByRole('button', { name: /작업 시작/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /현재 작업으로 이동/ }));
    expect(onGoToCurrentWork).toHaveBeenCalledTimes(1);
  });

  it('offers no move on the service turn', () => {
    renderHead({
      install: {
        kind: 'svc',
        sentence: '서비스 담당자가 Terraform을 직접 적용해야 합니다',
        steps: [step('service', '서비스 측 Terraform 적용', '서비스', 'now')],
      },
    });

    expect(screen.getByText('서비스 조치 필요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /현재 작업으로 이동/ })).toBeNull();
  });

  it('writes the count and the guide on a failed row, and keeps the verdict', () => {
    renderHead({
      install: {
        kind: 'svc',
        sentence: '서비스 담당자가 Terraform을 직접 적용해야 합니다',
        steps: [
          step('service', '서비스 측 Terraform 적용', '서비스', 'fail', {
            done: 3,
            total: 4,
            failed: 1,
            open: [
              {
                resourceId: 'db-3',
                resourceName: 'orders-db',
                failed: true,
                guide: '서브넷 가용 IP 부족으로 ENI 생성에 실패했습니다.',
              },
            ],
          }),
        ],
      },
    });

    // FAIL is 조회 실패 (owner's word): the step tag, the count, and the resource row.
    expect(screen.getByText('조회 실패')).toBeTruthy();
    expect(screen.getByText('4건 중 1건 조회 실패')).toBeTruthy();
    expect(screen.getByText('orders-db')).toBeTruthy();
    expect(screen.getByText('조회 도중 실패')).toBeTruthy();
    expect(screen.getByText('서브넷 가용 IP 부족으로 ENI 생성에 실패했습니다.')).toBeTruthy();
    expect(screen.getByText('조회 실패가 여러 번 이어지면 개발자에게 연락하세요.')).toBeTruthy();
    expect(screen.getByText('서비스 조치 필요')).toBeTruthy();
  });

  it('draws no resource rows under a step that does not list them, but keeps the guide and the note', () => {
    renderHead({
      install: {
        kind: 'svc',
        sentence: '서비스 담당자가 Terraform을 직접 적용해야 합니다',
        steps: [
          step('service', '서비스 측 Terraform 적용', '서비스', 'fail', {
            done: 3,
            total: 4,
            failed: 1,
            listResources: false,
            open: [{ resourceId: 'db-3', resourceName: 'orders-db', failed: true, guide: 'timeout' }],
          }),
        ],
      },
    });

    expect(screen.queryByRole('table', { name: /남은 리소스/ })).toBeNull();
    expect(screen.queryByText('orders-db')).toBeNull();
    expect(screen.getByText('4건 중 1건 조회 실패')).toBeTruthy();
    expect(screen.getByText('timeout')).toBeTruthy();
    expect(screen.getByText('조회 실패가 여러 번 이어지면 개발자에게 연락하세요.')).toBeTruthy();
  });

  it('writes how many are left on a step partly through', () => {
    renderHead({
      install: {
        ...OPERATOR_TURN,
        steps: [step('bdcCommon', 'BDC 공통 영역', '관리자', 'now', { done: 2, total: 4 })],
      },
    });

    expect(screen.getByText('4건 중 2건 남음')).toBeTruthy();
  });

  it('draws no rows when the status could not be read', () => {
    renderHead({
      install: { kind: 'unk', sentence: '설치 상태를 확인하지 못했습니다', steps: [] },
      installLastCheck: null,
    });

    expect(screen.getByText('설치 상태를 확인하지 못했습니다')).toBeTruthy();
    // The mark's svg <title> carries the same words as the tag — both are on screen.
    expect(screen.getAllByText('확인 불가').length).toBeGreaterThan(0);
    expect(screen.queryByText('BDC 공통 영역')).toBeNull();
    expect(screen.queryByText(/^확인 \d/)).toBeNull();
  });

  it('hangs 확인 시각 on the card head, from installation-status', () => {
    renderHead();

    const checked = screen.getByText(/^확인 /);
    expect(checked.parentElement?.textContent).toContain('설치 상태');
    // terraform-status's own clock is not the one the rows run on.
    expect(screen.queryByText(/^조회 /)).toBeNull();
  });

  it('no longer lists the terraform-status tasks', () => {
    renderHead();

    expect(screen.queryByText('aws-vpc-peering')).toBeNull();
    expect(screen.queryByText('적용 완료')).toBeNull();
  });

  it('falls back to the terraform-status task rows for a target with no install status (SDU)', () => {
    renderHead({
      install: null,
      status: {
        has_confirmed_infra: true,
        tasks: [
          { terraform_task_name: 'SDU_BDC_SERVICE_COMMON', terraform_execution_side: 'BDC', state: 'APPLIED' },
          { terraform_task_name: 'SDU_BDC_SERVICE', terraform_execution_side: 'BDC', state: 'APPLYING' },
        ],
      } as never,
    });

    expect(screen.getByText('연동 정보')).toBeTruthy();
    expect(screen.queryByText(/조치 필요/)).toBeNull();
    expect(screen.getByText('SDU_BDC_SERVICE_COMMON')).toBeTruthy();
    expect(screen.getByText('적용 완료')).toBeTruthy();
    expect(screen.getByText('적용 중')).toBeTruthy();
  });
});

describe('InfraStatusHead — GCP subnet guide', () => {
  const gcpTurn: InstallStateView = {
    kind: 'svc',
    sentence: '서비스 담당자가 PSC용 Subnet을 만들어야 합니다',
    steps: [
      step('subnet', 'PSC용 Subnet 생성', '서비스', 'now'),
      step('service', '서비스측 Terraform 적용', '서비스', 'wait'),
      step('bdc', 'BDC측 Terraform 적용', '관리자', 'wait'),
    ],
  };

  it('draws the guide under the 「PSC용 Subnet 생성」 row while that row is open', () => {
    renderHead({ install: gcpTurn, subnetGuide: <div data-testid="psc-guide">gcloud …</div> });
    const guide = screen.getByTestId('psc-guide');
    const row = screen.getByText('PSC용 Subnet 생성').closest('div')?.parentElement;
    expect(row?.contains(guide)).toBe(true);
  });

  it('drops the guide once the subnet row is done — nothing left to hand over', () => {
    const done = { ...gcpTurn, steps: [step('subnet', 'PSC용 Subnet 생성', '서비스', 'done'), ...gcpTurn.steps.slice(1)] };
    renderHead({ install: done, subnetGuide: <div data-testid="psc-guide">gcloud …</div> });
    expect(screen.queryByTestId('psc-guide')).toBeNull();
  });
});

describe('InfraStatusHead — 불러오는 중', () => {
  it('draws the card frame while the install status is still in flight', () => {
    renderHead({ install: null, installLoading: true, installLastCheck: null });

    expect(screen.getByRole('heading', { name: '설치 상태' })).toBeTruthy();
    expect(screen.getByText('연동 정보')).toBeTruthy();
    expect(screen.queryByText(/조치 필요/)).toBeNull();
  });
});

describe('InfraStatusHead — 연동 정보', () => {
  it('reads 미확정 and names the step the target is waiting at', () => {
    renderHead({ status: UNCONFIRMED, processStatus: 'IDLE' });

    expect(screen.getByText('미확정')).toBeTruthy();
    expect(screen.getByText(/1단계 · 연동 대상 DB 선택/)).toBeTruthy();
    expect(screen.queryByText('확정된 연동 정보가 없습니다')).toBeNull();
  });

  it('says nothing about a step it does not know', () => {
    renderHead({ status: UNCONFIRMED, processStatus: null });

    expect(screen.getByText('미확정')).toBeTruthy();
    expect(screen.queryByText(/단계 ·/)).toBeNull();
  });

  it('states the verdict as a label/value pair, not a tag', () => {
    renderHead();

    const value = screen.getByText('확정됨');
    const pair = value.closest('dl');
    expect(pair).not.toBeNull();
    expect(pair?.querySelector('dt')?.textContent).toBe('연동 정보');
    expect(value.closest('dd')).not.toBeNull();
  });

  it('reads 확정됨 and offers the 확정 정보 tab as its detail', () => {
    const onSelectTab = vi.fn();
    renderHead({ onSelectTab });

    expect(screen.getByText('확정됨')).toBeTruthy();
    const detail = detailButton();
    expect(detail).not.toBeNull();
    expect(detail?.closest('dl')?.textContent).toContain('연동 정보');

    fireEvent.click(detail as HTMLElement);
    expect(onSelectTab).toHaveBeenCalledWith('확정 정보');
  });

  it('offers no detail link while there is nothing confirmed to open', () => {
    renderHead({ status: UNCONFIRMED, processStatus: 'IDLE' });

    expect(detailButton()).toBeNull();
  });

  it('says it could not read 연동 정보 when terraform-status failed, and keeps the install rows', () => {
    renderHead({ status: null, failed: true });

    expect(screen.getByText('확인하지 못했습니다')).toBeTruthy();
    expect(screen.getByText('BDC 공통 영역')).toBeTruthy();
  });

  it('keeps the verdict and the step rows inside ONE card', () => {
    renderHead();

    const card = screen.getByText('확정됨').closest('section');
    expect(card).not.toBeNull();
    expect(screen.getByText('BDC 공통 영역').closest('section')).toBe(card);
  });
});
