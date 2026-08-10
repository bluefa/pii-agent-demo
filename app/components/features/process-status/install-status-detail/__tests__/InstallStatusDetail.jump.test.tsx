// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstallStatusDetail } from '@/app/components/features/process-status/install-status-detail/InstallStatusDetail';
import type {
  InstallDetailResource,
  InstallTableStep,
} from '@/app/components/features/process-status/install-status-detail/model';

/**
 * 레일 항목끼리의 점프 링크 가드. 링크 대상은 adapter 가 문자열로 넘기므로 타입이
 * 지켜주지 못한다 — 어긋난 id 로 선택이 굳으면 어떤 행도 aria-current 를 갖지 못하고
 * 패널은 조용히 첫 단계로 튄다. 둘 다 에러 없이 일어나므로 테스트로만 잡힌다.
 */

const resources: InstallDetailResource[] = [
  {
    resourceId: 'r-1',
    resourceName: 'db-1',
    rollup: { status: 'IN_PROGRESS', guide: null },
    cells: {
      first: { status: 'IN_PROGRESS', guide: null },
      second: { status: 'COMPLETED', guide: null },
    },
  },
];

const steps = (noteStepId: string): InstallTableStep[] => [
  {
    id: 'first',
    title: '단계 하나',
    side: '서비스측 리소스 생성',
    group: 'todo',
    desc: '첫 단계입니다.',
    note: { link: { label: '참고 항목', stepId: noteStepId }, text: '으로 갑니다.' },
  },
  {
    id: 'second',
    title: '단계 둘',
    side: 'BDC측 리소스 생성',
    group: 'auto',
    desc: '둘째 단계입니다.',
  },
];

const renderWith = (noteStepId: string) =>
  render(
    <InstallStatusDetail
      lastCheck={{ status: 'SUCCESS' }}
      resources={resources}
      steps={steps(noteStepId)}
      meta={new Map()}
      reference={{
        id: 'ref',
        title: '참고 항목',
        desc: '참고 내용입니다.',
        panel: <div>참고 패널</div>,
      }}
    />,
  );

const currentRailItems = () => {
  const nav = screen.getByRole('navigation', { name: '설치 단계' });
  return [...nav.querySelectorAll('button')]
    .filter((b) => b.getAttribute('aria-current') === 'true')
    .map((b) => b.textContent?.trim());
};

/** 레일 항목과 이름이 같으므로(실제 화면도 그렇다) 패널 쪽 링크만 골라낸다. */
const clickNoteLink = () => {
  const nav = screen.getByRole('navigation', { name: '설치 단계' });
  const [link] = screen.getAllByRole('button', { name: '참고 항목' }).filter((b) => !nav.contains(b));
  fireEvent.click(link);
};

describe('InstallStatusDetail 점프 링크', () => {
  it('note 링크가 참고 항목을 연다', () => {
    renderWith('ref');

    clickNoteLink();

    expect(screen.getByText('참고 패널')).toBeTruthy();
    expect(currentRailItems()).toEqual(['참고 항목']);
  });

  it('어긋난 stepId 는 선택을 잃지 않고 hot step 으로 되돌아간다', () => {
    renderWith('없는-id');
    expect(currentRailItems()).toEqual(['단계 하나진행중']);

    clickNoteLink();

    // 죽은 링크 → 아무 데도 가지 않는다. 가드가 없으면 selected 가 '없는-id' 로 굳어
    // 어떤 행도 aria-current 를 갖지 못하고 패널은 첫 단계로 튄다.
    expect(currentRailItems()).toEqual(['단계 하나진행중']);
    expect(screen.getByRole('heading', { name: '단계 하나' })).toBeTruthy();
    expect(screen.queryByText('참고 패널')).toBeNull();
  });
});
