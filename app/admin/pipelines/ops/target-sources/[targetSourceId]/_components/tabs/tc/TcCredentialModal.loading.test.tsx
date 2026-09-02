// @vitest-environment jsdom
/**
 * Credential 목록 모달의 대기 프레임.
 *
 * 이 모달을 여는 CTA 는 TC **상태** 조회에 걸려 있고 목록은 탭의 **별도** 조회라, 상태가
 * 먼저 도착한 창에서 모달이 빈 목록을 들고 열린다 — 그 창을 「등록된 Credential이
 * 없습니다」로 그리면 화면이 세지도 않은 사실을 단언한다.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TcCredentialModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcCredentialModal';

const open = (props: { loading: boolean; failed?: boolean }) =>
  render(
    <TcCredentialModal
      secrets={[]}
      rows={[]}
      loading={props.loading}
      failed={props.failed ?? false}
      onClose={() => {}}
    />,
  );

describe('TcCredentialModal — 조회 중', () => {
  it('목록이 도착하기 전에는 없다고 말하지 않는다', () => {
    const { container } = open({ loading: true });

    expect(screen.queryByText('등록된 Credential이 없습니다.')).toBeNull();
    const busy = container.querySelector('[aria-busy]');
    expect(busy).not.toBeNull();
    expect(busy?.textContent).toContain('불러오는 중');
    // 열 이름은 고정 문자열이라 실물로 서고, 값과 바닥 줄의 두 수만 자국이다.
    expect(screen.getByText('이름')).toBeTruthy();
    expect(screen.getByText('최종 수정')).toBeTruthy();
    expect(container.textContent).not.toContain('총 0개');
  });

  it('정착한 빈 목록은 그대로 빈 상태다', () => {
    open({ loading: false });
    expect(screen.getByText('등록된 Credential이 없습니다.')).toBeTruthy();
  });

  it('실패는 조회 중보다 뒤가 아니라 그 다음이다', () => {
    open({ loading: false, failed: true });
    expect(screen.getByText('Credential 목록을 불러오지 못했습니다.')).toBeTruthy();
  });
});
