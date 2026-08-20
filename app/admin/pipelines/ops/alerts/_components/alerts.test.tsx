// @vitest-environment jsdom
/**
 * 운영 알림 — SSR 로 옮긴 뒤의 축.
 *
 * 데이터는 서버가 읽어 props 로 내려온다. 그래서 여기서 박아 두는 것은 fetch 가
 * 아니라 ① 기본 버킷 판정(건수 있는 첫 버킷, 프로세스 순서) ② 타일이 **주소를**
 * 바꾸는 링크라는 것 ③ 실패와 0건이 서로 다른 문장을 받는 것 ④ 행 활성화가 그 버킷의
 * 탭으로 간다는 것이다.
 */
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';

import type { AlertListRow } from '@/lib/types/task-queue';
import { passRoutes } from '@/lib/routes';
import {
  ALERT_BUCKETS,
  EMPTY_ALERT_COUNTS,
  defaultAlertKind,
} from '@/app/admin/pipelines/ops/alerts/_components/buckets';

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

import { AlertsHeader } from '@/app/admin/pipelines/ops/alerts/_components/AlertsHeader';
import { AlertWorklist } from '@/app/admin/pipelines/ops/alerts/_components/AlertWorklist';

const ROW: AlertListRow = {
  targetSourceId: 1861,
  serviceName: '정산서비스',
  description: '정산 마감 배치 RDS',
  serviceCode: 'STL',
  cloudProvider: 'AWS',
  confirmStatus: 'CONFIRMED',
  latestApprovalRequest: null,
  delaySeconds: 262000,
  statusChangedAt: '2026-07-17T18:56:00Z',
};

const worklist = (props: Partial<Parameters<typeof AlertWorklist>[0]> = {}) => (
  <AlertWorklist
    kind="need-install"
    label="설치 필요"
    owner="인프라 담당"
    count={3}
    icon="terraform"
    tab="infra"
    rows={[ROW]}
    page={0}
    totalPages={1}
    failed={false}
    {...props}
  />
);

describe('기본 버킷은 건수가 정한다', () => {
  it('건수 있는 첫 버킷(프로세스 순서)을 고른다', () => {
    expect(
      defaultAlertKind({ ...EMPTY_ALERT_COUNTS, needInstallCount: 2, needTestConnectionCount: 1 }),
    ).toBe('need-install');
  });

  it('전부 0건이면 첫 버킷', () => {
    expect(defaultAlertKind(EMPTY_ALERT_COUNTS)).toBe(ALERT_BUCKETS[0].kind);
  });
});

describe('AlertsHeader — 타일은 주소를 바꾸는 링크다', () => {
  it('버킷마다 ?kind= 링크를 갖고, 선택된 하나만 aria-current 다', () => {
    render(
      <AlertsHeader
        total={5}
        counts={{ ...EMPTY_ALERT_COUNTS, needInstallCount: 3, confirmingCount: 2 }}
        selected="need-install"
      />,
    );

    const selected = screen.getByRole('link', { name: /설치 필요/ });
    expect(selected.getAttribute('href')).toBe(
      `${passRoutes.pipelines.ops.alerts}?kind=need-install`,
    );
    expect(selected.getAttribute('aria-current')).toBe('true');

    const other = screen.getByRole('link', { name: /리소스 확정 진행 중/ });
    expect(other.getAttribute('href')).toBe(`${passRoutes.pipelines.ops.alerts}?kind=confirming`);
    expect(other.getAttribute('aria-current')).toBeNull();

    // 버킷을 바꾸는 링크는 페이지 번호를 물고 가지 않는다 — 다른 목록의 자리다.
    expect(other.getAttribute('href')).not.toContain('page=');
  });
});

describe('AlertWorklist — 서버가 준 한 페이지를 그린다', () => {
  it('표 위에는 제목이 아니라 메타 한 줄이 온다 — 이름 · 건수 · 담당', () => {
    const { container } = render(worklist());

    // 카드 제목(h2)이 없어야 한다: 같은 이름을 타일이 이미 말한다.
    expect(container.querySelector('h2')).toBeNull();
    // 건수는 요약이 준 값이지 행 수가 아니다 — 한 페이지는 최대 10건이다.
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('인프라 담당')).toBeDefined();
  });

  it('담당이 없는 버킷은 그 조각을 아예 빼고 그린다', () => {
    render(worklist({ label: '연결 테스트 필요', owner: null }));
    expect(screen.getByText('연결 테스트 필요')).toBeDefined();
    // 담당이 없으면 구분점도 함께 빠진다 — 조각 없는 구분자는 남지 않는다.
    expect(screen.queryByText('·')).toBeNull();
  });

  it('행을 그리고, 활성화하면 그 버킷의 탭으로 간다', () => {
    render(worklist());

    expect(screen.getByText('AWS')).toBeDefined();
    expect(screen.getByText('1861')).toBeDefined();
    expect(screen.getByText('STL')).toBeDefined();
    expect(screen.getByText('정산서비스')).toBeDefined();
    expect(screen.getByText('정산 마감 배치 RDS')).toBeDefined();
    expect(screen.getByText('3일')).toBeDefined();

    fireEvent.click(screen.getByText('정산서비스').closest('tr') as HTMLElement);
    expect(push).toHaveBeenCalledWith(passRoutes.pipelines.ops.targetSource('1861', 'infra'));
  });

  it('실패와 0건은 다른 문장을 받는다', () => {
    const { unmount } = render(worklist({ rows: [], failed: true }));
    expect(screen.getByText('목록을 불러오지 못했습니다.')).toBeDefined();
    unmount();

    render(worklist({ rows: [] }));
    expect(screen.getByText('해당 단계의 대상이 없습니다.')).toBeDefined();
  });

  it('페이지 이동은 1-based 주소를 민다', () => {
    push.mockClear();
    render(worklist({ page: 0, totalPages: 3 }));
    fireEvent.click(screen.getByLabelText('다음 페이지'));
    expect(push).toHaveBeenCalledWith(
      `${passRoutes.pipelines.ops.alerts}?kind=need-install&page=2`,
    );
  });
});
