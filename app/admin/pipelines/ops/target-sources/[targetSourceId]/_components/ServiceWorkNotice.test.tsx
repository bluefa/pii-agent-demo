// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
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

const STEP = { id: 'service', title: '서비스 측 Terraform 적용' };

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

const renderNotice = (result: ServiceWorkResult): void => {
  render(
    <ServiceWorkNotice
      data={{ result, lastCheck: { status: 'SUCCESS', checkedAt: '2026-08-31T01:00:00Z' } }}
    />,
  );
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
    // 단계 이름은 홑화살괄호 안에 든다 — 겹화살괄호(«»)가 아니다.
    expect(screen.getByText(/<서비스 측 Terraform 적용>이 끝나지 않은 리소스/)).toBeTruthy();
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
    // 상태는 이 콘솔의 낱말이다 — 서비스 화면의 「실패」·「진행중」이 아니다.
    expect(screen.getByText('조회실패')).toBeTruthy();
    expect(screen.getByText('작업필요')).toBeTruthy();
    expect(screen.queryByText('실패')).toBeNull();
    expect(screen.queryByText('진행중')).toBeNull();
    // 머리는 단계 이름을 되풀이하지 않는다 — 그 문장은 경고 상자의 것이고, 여기 남는 것은
    // 이 답이 언제 읽힌 것인가뿐이다.
    expect(screen.getByText('마지막 확인시간 26.08.31 10:00')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).queryByText(/<서비스 측 Terraform 적용>/)).toBeNull();
    expect(screen.getByText('Terraform 스크립트를 다시 적용해 주세요.')).toBeTruthy();
  });

  it('확인 시각이 없으면 그 줄도 없다 — 읽은 적 없는 시각을 지어내지 않는다', () => {
    render(
      <ServiceWorkNotice
        data={{ result: gateOf([resource('rds-1', 'FAIL')]), lastCheck: null }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /상세 정보 보기/ }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/마지막 확인시간/)).toBeNull();
  });

  it('열한 행은 두 장으로 나뉜다 — 다음 장은 남은 한 행이다', () => {
    renderNotice(
      gateOf(
        Array.from({ length: 11 }, (_, i) =>
          resource(`rds-${String(i + 1).padStart(2, '0')}`, 'IN_PROGRESS'),
        ),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /상세 정보 보기/ }));

    expect(screen.getAllByText(/^rds-\d+-name$/)).toHaveLength(10);
    expect(screen.getByText('rds-01-name')).toBeTruthy();
    expect(screen.queryByText('rds-11-name')).toBeNull();
    // 콘솔 표의 그 푸터다 — 페이지 단추와 이전/다음이 바에 든다.
    expect(screen.getByRole('button', { name: '2 페이지' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));

    expect(screen.getAllByText(/^rds-\d+-name$/)).toHaveLength(1);
    expect(screen.getByText('rds-11-name')).toBeTruthy();
  });

  it('닫기 단추가 모달을 닫는다', () => {
    renderNotice(gateOf([resource('rds-1', 'FAIL')]));

    fireEvent.click(screen.getByRole('button', { name: /상세 정보 보기/ }));
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('다시 읽는 단추는 없고, Esc 는 모달을 닫는다', () => {
    renderNotice(gateOf([resource('rds-1', 'FAIL')]));

    fireEvent.click(screen.getByRole('button', { name: /상세 정보 보기/ }));
    // 계약에 재점검 트리거가 없다 — 같은 GET 을 다시 부르는 단추를 두지 않는다.
    expect(screen.queryByRole('button', { name: '다시 확인' })).toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
