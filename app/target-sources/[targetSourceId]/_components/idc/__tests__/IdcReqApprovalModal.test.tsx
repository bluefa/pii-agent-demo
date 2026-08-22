// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
const getSummariesMock = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getLatestTestConnectionResultSummaries: (...args: unknown[]) => getSummariesMock(...args),
}));

import { IdcReqApprovalModal } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcReqApprovalModal';
import type { IdcResourceView } from '@/app/lib/api/idc';

const target = (resourceId: string, overrides: Partial<IdcResourceView> = {}): IdcResourceView => ({
  resourceId,
  persisted: true,
  kind: 'SINGLE',
  hosts: [resourceId],
  port: 3306,
  databaseTypeLabel: 'MySQL',
  databaseTypeWire: 'MYSQL',
  sourceIps: ['10.10.0.21'],
  firewallOpen: true,
  connection: 'SUCCESS',
  health: null,
  done: null,
  excluded: false,
  credentialId: 'key-1',
  ...overrides,
});

const renderModal = (
  props: Partial<React.ComponentProps<typeof IdcReqApprovalModal>> = {},
) =>
  render(
    <IdcReqApprovalModal
      isOpen
      targetSourceId={42}
      resources={[target('10.20.30.40')]}
      phase="form"
      pending={false}
      onSubmit={() => {}}
      onRetry={() => {}}
      onClose={() => {}}
      {...props}
    />,
  );

const tile = (label: string) => screen.getByText(label).parentElement?.textContent;

describe('IdcReqApprovalModal', () => {
  beforeEach(() => {
    getSummariesMock.mockReset();
    getSummariesMock.mockResolvedValue([]);
  });

  // 손으로 뜬 표를 따로 두었을 때 어휘가 갈렸다(모달 Success vs 5단계 표 성공).
  // 이제 그 표(IdcResourceTable)를 그대로 쓰므로 갈릴 자리가 없다.
  it('draws the step-5 table, not a hand-rolled one', () => {
    renderModal();

    expect(screen.getByText('접속 주소')).toBeTruthy();
    expect(screen.getByText('Database Type')).toBeTruthy();
    expect(screen.queryByText('Success')).toBeNull();
  });

  // 제외 행은 승인 대상이 아니다 — 세지도, 그리지도 않는다.
  it('counts and lists only the live targets', () => {
    renderModal({
      resources: [target('10.20.30.40'), target('10.20.30.99', { excluded: true })],
    });

    expect(tile('연동 대상')).toBe('연동 대상1건');
    expect(screen.queryByText('10.20.30.99')).toBeNull();
  });

  // 대기 행을 들고 열리는 경우는 없다 — 카드 CTA 가 `buckets.ok === liveResources.length` 로,
  // 자격 증명 변경은 `credsDirty` 로 잠근다. 그래서 이 모달은 대기 건수를 **세기만** 한다.
  it('counts the waiting targets without gating on them', () => {
    renderModal();

    expect(tile('연결 대기')).toBe('연결 대기0건');
    expect(screen.getByRole('button', { name: '요청하기' }).hasAttribute('disabled')).toBe(false);
  });

  // 논리 DB 구성은 승인의 근거다 — 5단계 표에는 있고 모달에만 없으면, 이 PR 이
  // 클라우드에서 고친 그 불일치를 IDC 에 다시 만든다.
  it('carries the logical-DB columns the step-5 table shows', async () => {
    getSummariesMock.mockResolvedValue([
      { resource_id: '10.20.30.40', logical_database_count: 7, excluded_logical_database_count: 2 },
    ]);
    renderModal();

    expect(screen.getByText('연동 논리 DB')).toBeTruthy();
    expect(screen.getByText('연동 제외')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('7')).toBeTruthy());
    expect(screen.getByText('2')).toBeTruthy();
  });

  // 확인 모달 위에 또 모달을 얹지 않는다. `() => onLogicalOpen?.(r)` 은 언제나 truthy 라
  // 열 곳이 없어도 버튼으로 그려졌다 — 눌러도 아무 일이 없는 컨트롤이다.
  it('renders the counts as plain text, not controls that do nothing', async () => {
    getSummariesMock.mockResolvedValue([
      { resource_id: '10.20.30.40', logical_database_count: 7, excluded_logical_database_count: 2 },
    ]);
    renderModal();

    await waitFor(() => expect(screen.getByText('7')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /논리 DB 목록 보기/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /연동 제외 대상 보기/ })).toBeNull();
  });

  // 보고되지 않은 수는 0 이 아니다 — 조회가 실패해도 마찬가지다.
  it('renders — when the run reported no counts', async () => {
    renderModal();
    await waitFor(() => expect(getSummariesMock).toHaveBeenCalled());

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('0개')).toBeNull();
  });

  // 클라우드 모달과 같은 전환 — 확인 프레임이 본문과 푸터를 함께 대체한다.
  it('replaces the body with the result frame once the request settles', () => {
    renderModal({ phase: 'success' });

    expect(screen.getByText('승인 요청을 보냈어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '요청하기' })).toBeNull();
  });
});
