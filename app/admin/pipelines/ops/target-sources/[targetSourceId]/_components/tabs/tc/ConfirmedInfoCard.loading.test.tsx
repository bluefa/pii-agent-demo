// @vitest-environment jsdom
/**
 * 확정 정보 표의 대기 프레임.
 *
 * 종전의 대기 갈래는 프레임도 열 머리도 없는 h-10 막대 넷이었다. 이 탭에서 가장 큰 면이
 * 행이 도착하는 순간 테두리를 얻고 머리 두 단만큼 자랐다 — 스켈레톤이 막으려던 바로 그
 * 리플로우다. 열 이름은 `isIdc` 프롭 하나로 정해지는 고정 문자열이라 기다리는 동안에도
 * 실물로 설 수 있다.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/lib/api', () => ({ updateResourceCredential: vi.fn() }));

const { ConfirmedInfoCard } = await import(
  '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard'
);

const renderLoading = (isIdc = false) =>
  render(
    <ConfirmedInfoCard
      targetSourceId={1642}
      isIdc={isIdc}
      rows={[]}
      secrets={[]}
      tcResults={[]}
      facts={new Map()}
      tcLoading
      credMissingOnly={false}
      loading
      failed={false}
      onReload={vi.fn()}
    />,
  );

describe('확정 정보 표 — 대기 프레임', () => {
  it('행을 기다리는 동안 셸의 머리와 프레임을 그대로 세운다', () => {
    const { container } = renderLoading();

    const busy = container.querySelector('[aria-busy]');
    expect(busy).not.toBeNull();
    // 정착본과 **같은 셸**이 그린 머리 — 두 tier 가 다 선다.
    expect(screen.getByText('Resource Name')).toBeTruthy();
    expect(screen.getByText('Credential')).toBeTruthy();
    expect(container.querySelector('thead th[scope="colgroup"]')).not.toBeNull();
    // 몇 건인지가 지금 오는 값이라, 자리는 페이지 크기(10)만큼 잡는다.
    expect(busy?.querySelectorAll('tbody tr').length).toBe(10);
    // 비어 있는 것과 아직 안 온 것은 다르다.
    expect(screen.queryByText('확정된 연동 정보가 없습니다.')).toBeNull();
  });

  it('온프렘 변종도 제 열 머리로 기다린다', () => {
    renderLoading(true);
    expect(screen.getByText('접속 주소')).toBeTruthy();
    expect(screen.queryByText('Resource ID')).toBeNull();
  });
});
