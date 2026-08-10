// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstallStatusDetail } from '@/app/components/features/process-status/install-status-detail/InstallStatusDetail';
import type {
  InstallDetailResource,
  InstallStepValue,
  InstallTableStep,
} from '@/app/components/features/process-status/install-status-detail/model';

/**
 * 전부-SKIP / 전부-BDC_INSTALL_REQUIRED 가드.
 *
 * 계약은 여섯 값을 구분하는데 집계가 네 값으로 접으면 두 문장이 거짓이 된다:
 * SKIP 이 done 으로 접히면 레일이 "완료 12/12"라 말하고("할 게 없었다"와 "다 했다"가
 * 같은 말이 된다), BDC_INSTALL_REQUIRED 가 waiting 으로 접히면 정적 선언인
 * serviceAction 이 그대로 살아 "지금 서비스 측에서 확인이 필요합니다"를 띄운다.
 * 둘 다 화면이 멀쩡해 보이므로 테스트로만 잡힌다.
 */

const cell = (status: InstallStepValue) => ({ status, guide: null });

const steps: InstallTableStep[] = [
  {
    id: 'vm',
    title: 'VM Subnet 생성',
    side: '서비스측 리소스 생성',
    desc: 'VM 연동용 Subnet을 생성합니다.',
  },
  {
    id: 'bdc',
    title: 'BDC측 Terraform 적용',
    side: 'BDC측 리소스 생성',
    desc: 'BDC측 리소스를 구성합니다.',
  },
  {
    id: 'pe',
    title: 'Private Endpoint 승인',
    side: '서비스측 승인',
    serviceAction: 'Azure Portal에서 BDC가 요청한 Private Endpoint 연결을 승인해 주세요.',
    desc: 'BDC가 요청한 연결을 승인하는 단계입니다.',
  },
];

// VM 없는 Azure 대상: vm 은 전부 SKIP, bdc·pe 는 전부 BDC 설치 대기.
const resources: InstallDetailResource[] = ['r-1', 'r-2'].map((resourceId) => ({
  resourceId,
  resourceName: null,
  rollup: cell('BDC_INSTALL_REQUIRED'),
  cells: {
    vm: cell('SKIP'),
    bdc: cell('BDC_INSTALL_REQUIRED'),
    pe: cell('BDC_INSTALL_REQUIRED'),
  },
}));

/** 레일 항목만 집는다 — 요약의 조치 항목도 같은 단계 이름을 버튼으로 갖는다. */
const railItem = (title: RegExp) =>
  within(screen.getByRole('navigation', { name: '설치 단계' })).getByRole('button', {
    name: title,
  });

const renderDetail = () =>
  render(
    <InstallStatusDetail
      lastCheck={{ status: 'SUCCESS', checkedAt: '2026-08-10T02:00:00Z' }}
      resources={resources}
      steps={steps}
      meta={new Map()}
    />,
  );

describe('InstallStatusDetail — 전부 SKIP / 전부 BDC 대기', () => {
  it('전부 SKIP 인 단계를 완료로 세지 않는다', () => {
    renderDetail();

    const vmItem = railItem(/VM Subnet 생성/);
    expect(within(vmItem).getByText('해당 없음')).toBeTruthy();
    expect(within(vmItem).queryByText('완료')).toBeNull();
    // 셀 수만큼 센 개수는 진척으로 읽힌다 — 해당 없음에는 개수를 달지 않는다.
    expect(within(vmItem).queryByText('2/2')).toBeNull();
  });

  it('전부 SKIP 인 단계를 열면 표 대신 없다고 말한다', () => {
    renderDetail();

    fireEvent.click(railItem(/VM Subnet 생성/));

    expect(screen.getByText('이 단계에 해당하는 리소스가 없어요')).toBeTruthy();
    expect(screen.getByText(/연동 대상 2건 모두/)).toBeTruthy();
    // 표의 도구모음(검색)이 남아 있으면 "훑을 것이 있다"고 말하는 셈이다.
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('전부 BDC 대기인 단계를 조치 항목으로 띄우지 않는다', () => {
    renderDetail();

    // 요약이 기본 선택이다 — 손댈 수 있는 단계가 하나도 없으므로.
    expect(screen.getByText(/지금 서비스 측에서 확인할 항목은 없어요/)).toBeTruthy();
    expect(screen.queryByText('지금 서비스 측에서 확인이 필요합니다')).toBeNull();
    expect(
      screen.queryByText(/Private Endpoint 연결을 승인해 주세요/),
    ).toBeNull();

    const peItem = railItem(/Private Endpoint 승인/);
    expect(within(peItem).getByText('BDC 설치 대기')).toBeTruthy();
    // 기다리는 건수는 남긴다 — 없는 것은 진척이지 대상이 아니다.
    expect(within(peItem).getByText('0/2')).toBeTruthy();
  });

  it('일부만 SKIP 이면 그대로 완료·대기로 센다', () => {
    render(
      <InstallStatusDetail
        lastCheck={{ status: 'SUCCESS' }}
        resources={[
          {
            resourceId: 'r-1',
            resourceName: null,
            rollup: cell('COMPLETED'),
            cells: { vm: cell('SKIP'), bdc: cell('COMPLETED'), pe: cell('COMPLETED') },
          },
          {
            resourceId: 'r-2',
            resourceName: null,
            rollup: cell('COMPLETED'),
            cells: { vm: cell('COMPLETED'), bdc: cell('COMPLETED'), pe: cell('UNKNOWN') },
          },
        ]}
        steps={steps}
        meta={new Map()}
      />,
    );

    // SKIP 1 + COMPLETED 1 → 여전히 '완료 2/2' (na 는 전부일 때만).
    const vmItem = railItem(/VM Subnet 생성/);
    expect(within(vmItem).getByText('완료')).toBeTruthy();
    expect(within(vmItem).getByText('2/2')).toBeTruthy();

    // UNKNOWN 이 섞이면 blocked 가 아니라 기존 '대기'다.
    const peItem = railItem(/Private Endpoint 승인/);
    expect(within(peItem).getByText('대기')).toBeTruthy();
  });
});
