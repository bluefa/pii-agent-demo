// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InstallCheckCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallCheckCard';
import {
  installGate,
  type InstallGateInput,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type {
  InstallDetailResource,
  InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';

const resource = (cells: Record<string, InstallStepValue>): InstallDetailResource => ({
  resourceId: 'rds-1',
  resourceName: 'rds-1',
  rollup: { status: 'IN_PROGRESS', guide: null },
  cells: Object.fromEntries(
    Object.entries(cells).map(([key, status]) => [key, { status, guide: null }]),
  ),
});

const gateFor = (cells: Record<string, InstallStepValue>) =>
  installGate({
    provider: 'aws',
    manualInstall: false,
    detail: {
      lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
      unavailable: false,
      resources: [resource(cells)],
    },
  } satisfies InstallGateInput);

const renderCard = (gate: ReturnType<typeof installGate>, onReload = vi.fn()) =>
  render(
    <InstallCheckCard
      gate={gate}
      lastCheck={{ status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' }}
      loading={false}
      failed={false}
      onReload={onReload}
    />,
  );

describe('InstallCheckCard', () => {
  it('판정 낱말은 하나이고, 단계는 주체로 묶여 선다', () => {
    renderCard(
      gateFor({ service: 'IN_PROGRESS', bdcCommon: 'COMPLETED', bdcService: 'COMPLETED' }),
    );

    expect(screen.getByText('미완료')).toBeTruthy();
    // 머리글은 문장 자리라 온전한 낱말, 행의 태그는 위 Terraform 카드와 같은 두 낱말이다.
    expect(screen.getByText('서비스 측')).toBeTruthy();
    expect(screen.getByText('BDC 측')).toBeTruthy();
    expect(screen.getAllByText('서비스')).toHaveLength(1);
    expect(screen.getAllByText('BDC')).toHaveLength(2);
    expect(screen.getByText('서비스 측 Terraform 자동 적용')).toBeTruthy();
    expect(screen.getByText('0/1')).toBeTruthy();
  });

  it('셀이 전부 SKIP 인 단계는 세지 않는다 — 해당 없음은 진척이 아니다', () => {
    renderCard(gateFor({ service: 'SKIP', bdcCommon: 'SKIP', bdcService: 'SKIP' }));

    expect(screen.getByText('완료')).toBeTruthy();
    // 세 단계 모두 해당 없음이라 n/N 이 하나도 그려지지 않는다.
    expect(screen.queryByText('1/1')).toBeNull();
    expect(screen.getAllByText('해당 없음')).toHaveLength(3);
  });

  it('확인하지 못했으면 판정만 서고 단계 행은 그리지 않는다', () => {
    renderCard({
      kind: 'unknown',
      steps: [
        { id: 'service', title: '서비스 측 Terraform 자동 적용', side: 'service', required: true, worst: 'UNKNOWN', done: 0, total: 0, na: false },
      ],
    });

    expect(screen.getByText('확인할 수 없음')).toBeTruthy();
    // 「확인 중 · 0/0」 은 못 읽었다는 사실을 단계 수만큼 반복할 뿐이다.
    expect(screen.queryByText('서비스 측 Terraform 자동 적용')).toBeNull();
    expect(screen.queryByText('0/0')).toBeNull();
  });

  it('조회에 실패하면 카드가 한 줄로 줄고, 다시 시도가 재조회를 부른다', () => {
    const onReload = vi.fn();
    render(
      <InstallCheckCard
        gate={{ kind: 'unknown', steps: [] }}
        lastCheck={null}
        loading={false}
        failed
        onReload={onReload}
      />,
    );

    expect(screen.getByText('설치 상태를 불러오지 못했습니다.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
