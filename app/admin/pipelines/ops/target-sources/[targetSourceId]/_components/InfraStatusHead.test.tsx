// @vitest-environment jsdom
/**
 * The head's job after two owner calls:
 *
 *   "각 작업이 어떤 상태인지 보여주도록 하자. 조합 상태는 필요없음" (2026-08-27)
 *   "연동 확정 정보와 Terraform 상태를 하나의 카드로, 확정 정보는 라벨로" (2026-08-30)
 *
 *   1. Every task in the response is on screen with ITS OWN state. A rolled-up
 *      pill cannot say which of three tasks failed.
 *   2. 미확정 is a stage, not an absence — it names the step the target sits at.
 *   3. Neither the combined 적용 상태 pill nor the 설치 현황 modal link comes back.
 *   4. The card head carries the list-wide qualifier (조회), and the 연동 정보
 *      label line carries the verdict plus the 확정 정보 link — the link only when
 *      there IS confirmed detail to open.
 *   5. Both facts live in ONE card, and the rows carry no column header.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  InfraStatusHead,
  type InfraStatusHeadProps,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InfraStatusHead';
import type { TerraformStatusResponse } from '@/app/lib/api';

const THREE_TASKS: TerraformStatusResponse = {
  target_source_id: 1010,
  cloud_provider: 'AWS',
  is_sdu_type: false,
  has_confirmed_infra: true,
  latest_confirmed_at: '2026-08-20T04:00:00.000Z',
  checked_at: '2026-08-27T01:00:00.000Z',
  overall_state: 'APPLY_FAILED',
  tasks: [
    { terraform_execution_side: 'BDC', terraform_task_name: 'aws-vpc-peering', state: 'APPLIED' },
    { terraform_execution_side: 'SERVICE', terraform_task_name: 'aws-iam-role', state: 'APPLYING' },
    {
      terraform_execution_side: 'SERVICE',
      terraform_task_name: 'aws-security-group',
      state: 'APPLY_FAILED',
    },
  ],
};

const UNCONFIRMED: TerraformStatusResponse = { ...THREE_TASKS, has_confirmed_infra: false };

const renderHead = (
  status: TerraformStatusResponse,
  processStatus: InfraStatusHeadProps['processStatus'] = 'INSTALLED',
  onSelectTab: InfraStatusHeadProps['onSelectTab'] = vi.fn(),
) =>
  render(
    <InfraStatusHead
      status={status}
      loading={false}
      failed={false}
      processStatus={processStatus}
      onSelectTab={onSelectTab}
    />,
  );

const detailButton = () => screen.queryByRole('button', { name: /상세정보 보기/ });

describe('InfraStatusHead — Terraform 작업', () => {
  it('renders one row per task, each wearing its own state', () => {
    renderHead(THREE_TASKS);

    expect(screen.getByText('aws-vpc-peering')).toBeTruthy();
    expect(screen.getByText('aws-iam-role')).toBeTruthy();
    expect(screen.getByText('aws-security-group')).toBeTruthy();
    // Three different states on three rows — the exact thing one pill could not say.
    expect(screen.getByText('적용 완료')).toBeTruthy();
    expect(screen.getByText('적용 중')).toBeTruthy();
    expect(screen.getByText('적용 실패')).toBeTruthy();
    // 실행 주체 rides each row, in Korean.
    expect(screen.getByText('BDC')).toBeTruthy();
    expect(screen.getAllByText('서비스')).toHaveLength(2);
  });

  it('drops the combined pill and the modal link the rows replaced', () => {
    // `적용 상태` alone was the combined pill's label. The card's own title reads
    // `Terraform 적용 상태`, a different string, so it is not that pill returning.
    renderHead(THREE_TASKS);

    expect(screen.queryByText('적용 상태')).toBeNull();
    expect(screen.queryByRole('button', { name: /설치 현황 보기/ })).toBeNull();
  });

  it('hangs 조회 on the card head, not under the last task', () => {
    renderHead(THREE_TASKS);

    // The lookup time qualifies the whole list. Under the rows it read as a
    // footnote to whichever task happened to be last.
    const checked = screen.getByText(/^조회 /);
    expect(checked.parentElement?.textContent).toContain('Terraform 적용 상태');
  });

  it('leaves the head alone when the response has no 조회 시각', () => {
    renderHead({ ...THREE_TASKS, checked_at: null });

    expect(screen.queryByText(/^조회 /)).toBeNull();
    expect(screen.getByText('aws-vpc-peering')).toBeTruthy();
  });

  it('says so when the response carries no task at all', () => {
    renderHead({ ...THREE_TASKS, tasks: null });

    expect(screen.getByText('작업 정보가 없습니다.')).toBeTruthy();
  });

  it('renders no column-header row above the tasks', () => {
    // At most three rows ever land here (AWS 3 · GCP/IDC/SDU 2 · Azure 1), so a
    // header would cost a line and buy nothing — the card title names the list.
    // Asserted structurally, not by three literal strings: a re-added header is
    // as likely to read `Task` or `구분` as `작업`, and a string list would let
    // those through while claiming the row is gone.
    const { container } = renderHead(THREE_TASKS);

    expect(container.querySelector('thead')).toBeNull();
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
  });
});

describe('InfraStatusHead — 불러오는 중', () => {
  it('draws the card frame while the response is still in flight', () => {
    // The loading branch used to be a blank reserved box, so the card appeared
    // only when the data did. It now stands as itself with bars where the data
    // goes — the title is a fixed string, the tasks are not.
    render(
      <InfraStatusHead
        status={null}
        loading
        failed={false}
        processStatus="INSTALLED"
        onSelectTab={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Terraform 적용 상태' })).toBeTruthy();
    expect(screen.getByText('연동 정보')).toBeTruthy();
    expect(screen.queryByText('aws-vpc-peering')).toBeNull();
    expect(screen.queryByText('작업 정보가 없습니다.')).toBeNull();
  });
});

describe('InfraStatusHead — 연동 정보', () => {
  it('reads 미확정 and names the step the target is waiting at', () => {
    renderHead(UNCONFIRMED, 'IDLE');

    expect(screen.getByText('미확정')).toBeTruthy();
    expect(screen.getByText(/1단계 · 연동 대상 DB 선택/)).toBeTruthy();
    // The banner that used to shout this is gone — the line states it once.
    expect(screen.queryByText('확정된 연동 정보가 없습니다')).toBeNull();
  });

  it('says nothing about a step it does not know', () => {
    renderHead(UNCONFIRMED, null);

    expect(screen.getByText('미확정')).toBeTruthy();
    expect(screen.queryByText(/단계 ·/)).toBeNull();
  });

  it('states the verdict as a label/value pair, not a tag', () => {
    renderHead(THREE_TASKS);

    // The label stands in front of the value — that pairing is why this round
    // chose a label line over a tag, and it survives in the a11y tree only as
    // real dt/dd.
    const value = screen.getByText('확정됨');
    const pair = value.closest('dl');
    expect(pair).not.toBeNull();
    expect(pair?.querySelector('dt')?.textContent).toBe('연동 정보');
    expect(value.closest('dd')).not.toBeNull();
  });

  it('reads 확정됨 and offers the 확정 정보 tab as its detail', () => {
    const onSelectTab = vi.fn();
    renderHead(THREE_TASKS, 'INSTALLED', onSelectTab);

    expect(screen.getByText('확정됨')).toBeTruthy();
    const detail = detailButton();
    expect(detail).not.toBeNull();
    // It follows the value on the same 연동 정보 line.
    expect(detail?.closest('dl')?.textContent).toContain('연동 정보');

    fireEvent.click(detail as HTMLElement);
    expect(onSelectTab).toHaveBeenCalledWith('확정 정보');
  });

  it('drops the 최근 확정 date the 확정 정보 tab owns', () => {
    renderHead(THREE_TASKS);

    expect(screen.queryByText(/최근 확정/)).toBeNull();
  });

  it('offers no detail link while there is nothing confirmed to open', () => {
    renderHead(UNCONFIRMED, 'IDLE');

    expect(detailButton()).toBeNull();
  });

  it('keeps the verdict and the task rows inside ONE card', () => {
    // Owner call 2026-08-30: 하나의 카드. Splitting the verdict back out into its
    // own container fails here.
    renderHead(THREE_TASKS);

    const card = screen.getByText('확정됨').closest('section');
    expect(card).not.toBeNull();
    expect(screen.getByText('aws-vpc-peering').closest('section')).toBe(card);
  });
});
