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

  it('SKIP 이어도 계약이 사유를 주면 표를 지우지 않는다', () => {
    // AWS 는 Read Replica 를 SKIP + guide 로 말한다. 그 사유가 사는 곳은 이 표뿐이므로
    // (요약의 reasons 는 settled 셀을 건너뛴다) 빈 상태로 덮으면 정보가 사라진다.
    const guided = { status: 'SKIP' as const, guide: '설치 대상이 아닌 리소스입니다 (Read Replica).' };
    render(
      <InstallStatusDetail
        lastCheck={{ status: 'SUCCESS' }}
        resources={resources.map((r) => ({ ...r, cells: { ...r.cells, vm: guided } }))}
        steps={steps}
        meta={new Map()}
      />,
    );

    fireEvent.click(railItem(/VM Subnet 생성/));

    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.queryByText('이 단계에 해당하는 리소스가 없어요')).toBeNull();
    // 집계는 그대로 '해당 없음'이다 — 표를 남기는 것과 완료로 세는 것은 다른 문제다.
    expect(within(railItem(/VM Subnet 생성/)).getByText('해당 없음')).toBeTruthy();
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

/**
 * 그룹 레일(AWS)은 같은 집계를 다른 두 곳에서 다시 읽는다 — '내가 할 일 (N)' 카운트와
 * 기본 선택. 위 케이스들은 group 없는 레거시 레일이라 그 두 줄을 건드리지 못한다.
 */
const groupedSteps: InstallTableStep[] = [
  {
    id: 'service',
    title: '서비스 측 Terraform 적용',
    side: '서비스측 리소스 생성',
    group: 'todo',
    serviceAction: '다운로드한 Terraform 스크립트를 직접 적용해 주세요.',
    desc: '서비스 측 리소스를 Terraform으로 적용합니다.',
  },
  {
    id: 'bdc',
    title: 'BDC 공통 영역',
    side: 'BDC측 리소스 생성',
    group: 'auto',
    desc: 'BDC측 리소스를 구성합니다.',
  },
];

const renderGrouped = (service: InstallStepValue) =>
  render(
    <InstallStatusDetail
      lastCheck={{ status: 'SUCCESS' }}
      resources={['r-1', 'r-2'].map((resourceId) => ({
        resourceId,
        resourceName: null,
        rollup: cell('IN_PROGRESS'),
        cells: { service: cell(service), bdc: cell('IN_PROGRESS') },
      }))}
      steps={groupedSteps}
      meta={new Map()}
    />,
  );

const currentRailTitle = () => {
  const nav = screen.getByRole('navigation', { name: '설치 단계' });
  return [...nav.querySelectorAll('button')].find((b) => b.getAttribute('aria-current') === 'true')
    ?.textContent;
};

/**
 * 레일 항목이 두 줄이라는 사실 자체를 잰다. 잘림은 렌더된 글자로는 안 보이고
 * (textContent 는 잘리기 전 문자열 그대로다) 실측으로만 드러났다 — 224px 레일에서
 * 제목 상자 122px 에 169px 짜리 라벨이 들어가 「서비스 측 Terrafor…」로 끊겼고,
 * 이 레일에 Terraform 이 셋이라 어느 것인지 말하지 못했다. 그래서 여기서는 클래스를
 * 본다: `truncate` 가 다시 붙으면 화면은 조용히 예전으로 돌아가고 다른 어떤 단언도
 * 깨지지 않는다.
 */
describe('InstallStatusDetail 그룹 레일 — 제목은 잘리지 않는다', () => {
  const railButton = (name: RegExp) =>
    within(screen.getByRole('navigation', { name: '설치 단계' })).getByRole('button', { name });

  it('제목은 잘리는 대신 감긴다', () => {
    renderGrouped('IN_PROGRESS');

    const title = within(railButton(/서비스 측 Terraform 적용/)).getByText('서비스 측 Terraform 적용');
    expect(title.className).not.toContain('truncate');
    expect(title.className).toContain('break-keep');
  });

  it('상태는 제목과 다른 줄에 선다 — 제목이 한 줄을 독점한다', () => {
    renderGrouped('IN_PROGRESS');

    const button = railButton(/서비스 측 Terraform 적용/);
    // 제목과 상태가 같은 줄이면 항목은 flex row 다. 두 줄이면 column.
    expect(button.className).toContain('flex-col');
    expect(button.className).not.toContain('items-baseline');
  });

  /**
   * BDC 그룹 항목이 달고 있던 실행 순번(1·2·3) 삭제 — 오너 지시. 순서는 항목의
   * 위아래가 말하고, 숫자는 제목에서 22px 을 가져갔다. 되돌아오면 제목 폭이 다시
   * 좁아지므로(잘림의 원인 중 하나) 여기서 막는다.
   */
  it('레일 항목에 실행 순번을 달지 않는다', () => {
    renderGrouped('IN_PROGRESS');

    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    for (const button of nav.querySelectorAll('button')) {
      expect(button.textContent ?? '').not.toMatch(/^\d/);
    }
  });
});

describe('InstallStatusDetail 그룹 레일 — 손댈 수 없는 할 일', () => {
  it('전부 BDC 대기인 할 일을 카운트에서 빼되 완료라 부르지 않는다', () => {
    renderGrouped('BDC_INSTALL_REQUIRED');

    // 카운트는 0 이 맞다 — 지금 손댈 수 있는 게 없다.
    expect(screen.getByText('내가 할 일 (0)')).toBeTruthy();
    // 하지만 '모두 완료'는 거짓이다. 바로 아래 행이 'BDC 설치 대기'라 적혀 있다.
    expect(screen.queryByText('모두 완료')).toBeNull();
    expect(
      within(
        within(screen.getByRole('navigation', { name: '설치 단계' })).getByRole('button', {
          name: /서비스 측 Terraform 적용/,
        }),
      ).getByText('BDC 설치 대기'),
    ).toBeTruthy();
  });

  it('손댈 수 없는 할 일을 기본 선택으로 열지 않는다', () => {
    renderGrouped('BDC_INSTALL_REQUIRED');

    // 열어봐야 할 수 있는 일이 없다 — 실제로 움직이는 단계를 연다.
    expect(currentRailTitle()).toContain('BDC 공통 영역');
  });

  it('할 일이 실제로 끝났을 때는 모두 완료라 말한다', () => {
    renderGrouped('COMPLETED');

    expect(screen.getByText('내가 할 일 (0)')).toBeTruthy();
    expect(screen.getByText('모두 완료')).toBeTruthy();
  });

  it('해당 없음 단계만 제목에 취소선을 긋는다', () => {
    // 상태 글자로는 '해당 없음'과 '완료'가 같은 회색 한 단어라, 레일을 훑을 때
    // "끝난 단계"와 "애초에 없는 단계"가 구분되지 않았다(오너 지적).
    renderGrouped('SKIP');

    const titleClassOf = (name: RegExp) => {
      const nav = screen.getByRole('navigation', { name: '설치 단계' });
      const item = within(nav).getByRole('button', { name });
      // 제목만 집는다 — 상태 글자('해당 없음')는 설명이므로 긋지 않는다.
      return within(item).getByText(name).className;
    };

    expect(titleClassOf(/서비스 측 Terraform 적용/)).toContain('line-through');
    // 진행 중인 단계에는 걸리지 않는다 — 'na' 에만 붙는 표시다.
    expect(titleClassOf(/BDC 공통 영역/)).not.toContain('line-through');
  });
});
