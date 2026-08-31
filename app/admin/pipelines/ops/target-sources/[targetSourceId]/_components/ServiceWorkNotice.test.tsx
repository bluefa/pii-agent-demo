// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServiceWorkNotice } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ServiceWorkNotice';
import {
  serviceWorkGate,
  type ServiceWorkResult,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type {
  InstallDetailResource,
  InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/pipelines/ops/target-sources/1006' }));

const STEP = { id: 'service', title: 'Terraform 직접 적용' };

const resource = (
  resourceId: string,
  status: InstallStepValue,
  guide: string | null = null,
): InstallDetailResource => ({
  resourceId,
  resourceName: `${resourceId}-name`,
  rollup: { status, guide: null },
  cells: { service: { status, guide } },
});

const gateOf = (resources: readonly InstallDetailResource[]): ServiceWorkResult =>
  serviceWorkGate({
    step: STEP,
    detail: {
      lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
      unavailable: false,
      resources,
    },
  });

const renderNotice = (result: ServiceWorkResult, onReload = vi.fn()) => {
  render(
    <ServiceWorkNotice
      data={{
        result,
        lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' },
        onReload,
      }}
    />,
  );
  return onReload;
};

describe('ServiceWorkNotice', () => {
  it('needed 일 때만 그린다 — done·unknown·없음은 아무것도 말하지 않는다', () => {
    const { unmount } = render(<ServiceWorkNotice data={null} />);
    expect(screen.queryByText(/서비스 측 대응/)).toBeNull();
    unmount();

    render(
      <ServiceWorkNotice
        data={{
          result: gateOf([resource('rds-1', 'COMPLETED')]),
          lastCheck: null,
          onReload: vi.fn(),
        }}
      />,
    );
    expect(screen.queryByText(/서비스 측 대응/)).toBeNull();
  });

  it('안 끝난 건수를 세어 말하고, 단계 이름은 서비스 화면의 그 이름이다', () => {
    renderNotice(
      gateOf([
        resource('rds-1', 'FAIL'),
        resource('rds-2', 'IN_PROGRESS'),
        resource('rds-3', 'COMPLETED'),
      ]),
    );

    expect(screen.getByText('설치 작업 전에 서비스 측 대응이 먼저 필요합니다')).toBeTruthy();
    // 분모(3)가 아니라 남은 수(2)다 — 운영자가 연락해야 할 리소스의 수.
    expect(screen.getByText('2건')).toBeTruthy();
    expect(screen.getByText(/Terraform 직접 적용/)).toBeTruthy();
  });

  it('상세 정보 보기가 모달을 열고, 정착하지 않은 행만 실린다', () => {
    renderNotice(
      gateOf([
        resource('rds-1', 'FAIL', 'Terraform 스크립트를 다시 적용해 주세요.'),
        resource('rds-2', 'IN_PROGRESS'),
        resource('rds-3', 'COMPLETED'),
        resource('rds-4', 'SKIP'),
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: /상세 정보 보기/ }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('서비스 측 작업이 필요한 리소스')).toBeTruthy();
    expect(screen.getByText('rds-1-name')).toBeTruthy();
    expect(screen.getByText('rds-2-name')).toBeTruthy();
    // 끝난 것과 해당 없는 것은 이 목록의 것이 아니다.
    expect(screen.queryByText('rds-3-name')).toBeNull();
    expect(screen.queryByText('rds-4-name')).toBeNull();
    expect(screen.getByText('총 2건')).toBeTruthy();
    expect(screen.getByText('실패')).toBeTruthy();
    expect(screen.getByText('진행중')).toBeTruthy();
    expect(screen.getByText('Terraform 스크립트를 다시 적용해 주세요.')).toBeTruthy();
  });

  it('다시 확인은 같은 조회를 다시 부르고, Esc 는 모달을 닫는다', () => {
    const onReload = renderNotice(gateOf([resource('rds-1', 'FAIL')]));

    fireEvent.click(screen.getByRole('button', { name: /상세 정보 보기/ }));
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
    expect(onReload).toHaveBeenCalledTimes(1);
    // 재조회는 모달을 닫지 않는다 — 답이 바뀌면 이 표가 그 자리에서 바뀐다.
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
