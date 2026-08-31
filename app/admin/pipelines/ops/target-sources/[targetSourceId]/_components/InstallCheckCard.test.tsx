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
    // 그룹 머리글 + 행의 주체 태그 — 두 자리 모두 같은 낱말이다.
    expect(screen.getAllByText('서비스 측').length).toBeGreaterThan(1);
    expect(screen.getAllByText('BDC 측').length).toBeGreaterThan(1);
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
