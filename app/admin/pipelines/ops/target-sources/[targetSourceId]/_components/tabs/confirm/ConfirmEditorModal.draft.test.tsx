// @vitest-environment jsdom
/**
 * 편집기가 여는 초안과, 추천값 조회가 도는 시점. 오너 결정 두 가지를 여기서 박는다:
 * 초안은 **신규든 수정이든 빈 칸**이고(현재 확정을 되불러오지 않는다), 추천값은
 * **[추천값 불러오기]를 누를 때만** 조회한다(진입 콜 없음).
 *
 * 순수 함수로 뺄 수 없는 판정들이라 렌더로 잰다 — 빈 초안이 붉은 파싱 실패로 보이지
 * 않는가, 그 상태에서 저장이 잠기는가, 그리고 진입 시 조회가 정말 돌지 않는가.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/pipelines/ops/target-sources/1018',
}));

// `vi.mock` 은 파일 맨 위로 끌려 올라가므로 팩토리가 읽는 값도 같이 올려 둔다.
const { RECOMMENDED, loadRecommendations } = vi.hoisted(() => {
  const doc = { resource_infos: [{ resource_id: 'rec-1' }, { resource_id: 'rec-2' }] };
  return { RECOMMENDED: doc, loadRecommendations: vi.fn(async (): Promise<unknown> => doc) };
});

vi.mock('@/app/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/api')>()),
  getApprovedRecommendations: loadRecommendations,
}));

import { ConfirmEditorModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmEditorModal';
import type { ConfirmedIntegrationResponse } from '@/app/lib/api';
import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';

const info = (id: string): ConfirmedIntegrationResourceInfo => ({
  resource_id: id,
  resource_type: 'RDS',
  database_type: null,
  database_region: null,
  resource_name: null,
  port: null,
  host: null,
  oracle_service_id: null,
  network_interface_id: null,
  ip_configuration: null,
  credential_id: null,
});

/** 이미 확정 2건이 등록된 대상 — 그래도 초안은 비어 있어야 한다. */
const current: ConfirmedIntegrationResponse = { resource_infos: [info('r-1'), info('r-2')] };

const open = (over: Partial<Parameters<typeof ConfirmEditorModal>[0]> = {}): void => {
  render(
    <ConfirmEditorModal
      onClose={vi.fn()}
      targetSourceId={1018}
      provider="AWS"
      current={current}
      terraform={null}
      onOpenInfra={vi.fn()}
      onDone={vi.fn()}
      {...over}
    />,
  );
};

const editor = (): HTMLTextAreaElement =>
  screen.getByLabelText('확정 정보 JSON 초안') as HTMLTextAreaElement;

const button = (label: string): HTMLButtonElement =>
  screen.getByRole('button', { name: label }) as HTMLButtonElement;

beforeEach(() => {
  loadRecommendations.mockClear();
});

describe('ConfirmEditorModal — 빈 초안과 미룬 조회', () => {
  it('확정이 등록된 대상에서도 초안은 빈 칸이다', () => {
    open();
    expect(editor().value).toBe('');
  });

  it('신규 등록도 빈 칸이다 — 뼈대를 넣지 않는다', () => {
    open({ current: null });
    expect(editor().value).toBe('');
  });

  it('진입에서는 추천값을 조회하지 않는다', () => {
    open();
    expect(loadRecommendations).not.toHaveBeenCalled();
    // 조회 전에는 유무를 모르므로 버튼 옆에 아무 말도 없다.
    expect(screen.queryByText('추천 2건')).toBeNull();
    expect(screen.queryByText('불러올 추천값이 없습니다')).toBeNull();
    expect(screen.queryByText('추천값 확인 중…')).toBeNull();
  });

  it('빈 본문은 파싱 실패가 아니라 시작점으로 말하고, 저장을 잠근다', () => {
    open();
    expect(screen.getByText('비어 있음 — 직접 작성하거나 추천값을 불러오세요')).toBeTruthy();
    expect(screen.queryByText(/JSON 파싱 실패/)).toBeNull();
    // 수정 모드라 `creating && !dirty` 게이트가 걸리지 않는다 — 잠그는 것은 빈 본문 판정이다.
    expect(button('저장').disabled).toBe(true);
  });

  it('버튼을 누르면 그 때 조회하고, 받은 값을 그 자리에서 초안에 꽂는다', async () => {
    open();
    fireEvent.click(button('추천값 불러오기'));
    expect(loadRecommendations).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(editor().value).toBe(JSON.stringify(RECOMMENDED, null, 2)));
    expect(screen.getByText('추천 2건')).toBeTruthy();
    expect(button('저장').disabled).toBe(false);
  });
});
