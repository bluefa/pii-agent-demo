// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { IdcReqApprovalModal } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcReqApprovalModal';
import type { IdcResourceView } from '@/app/lib/api/idc';
import type { UnitTcStatus } from '@/lib/test-connection-summary';

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

const status = (...entries: [string, UnitTcStatus][]) => new Map<string, UnitTcStatus>(entries);

const renderModal = (
  props: Partial<React.ComponentProps<typeof IdcReqApprovalModal>> = {},
) =>
  render(
    <IdcReqApprovalModal
      isOpen
      resources={[target('10.20.30.40')]}
      connectionStatus={status(['10.20.30.40', 'SUCCESS'])}
      connectionLoading={false}
      connectionHasRun
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
  // 손으로 뜬 표를 따로 두었더니 같은 판정을 두 어휘로 말했다 — 모달은 Success,
  // 두 줄 위의 5단계 표는 성공. 이제 그 표(IdcResourceTable)를 그대로 쓴다.
  it('says the verdict in the same words the step-5 table uses', () => {
    renderModal();

    expect(screen.getByText('성공')).toBeTruthy();
    expect(screen.queryByText('Success')).toBeNull();
    expect(screen.getByText('접속 주소')).toBeTruthy();
  });

  // 제외 행은 승인 대상이 아니다 — 세지도, 그리지도 않는다.
  it('counts and lists only the live targets', () => {
    renderModal({
      resources: [target('10.20.30.40'), target('10.20.30.99', { excluded: true })],
      connectionStatus: status(['10.20.30.40', 'SUCCESS'], ['10.20.30.99', 'SUCCESS']),
    });

    expect(tile('연동 대상')).toBe('연동 대상1건');
    expect(screen.queryByText('10.20.30.99')).toBeNull();
  });

  // 카드의 CTA 가 이미 막지만, 열려 있는 사이에 바뀌면 카드의 게이트는 다음 렌더에나
  // 반영된다 — 확정을 커밋하는 버튼은 스스로도 막는다.
  it('locks 요청하기 while any live target is still waiting', () => {
    renderModal({
      resources: [target('10.20.30.40'), target('10.20.31.10', { connection: 'PENDING' })],
      connectionStatus: status(['10.20.30.40', 'SUCCESS'], ['10.20.31.10', 'PENDING']),
    });

    expect(tile('연결 대기')).toBe('연결 대기1건');
    expect(screen.getByRole('button', { name: '요청하기' }).hasAttribute('disabled')).toBe(true);
  });

  it('opens 요청하기 once every live target has passed', () => {
    renderModal();

    expect(tile('연결 대기')).toBe('연결 대기0건');
    expect(screen.getByRole('button', { name: '요청하기' }).hasAttribute('disabled')).toBe(false);
  });

  // 클라우드 모달과 같은 전환 — 확인 프레임이 본문과 푸터를 함께 대체한다.
  it('replaces the body with the result frame once the request settles', () => {
    renderModal({ phase: 'success' });

    expect(screen.getByText('승인 요청을 보냈어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '요청하기' })).toBeNull();
  });
});
