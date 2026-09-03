// @vitest-environment jsdom
/**
 * 확정 정보 입력기 v2.4 — 한 상자, 두 프레임.
 *
 * 여기 단언이 지키는 것은 배치가 아니라 **하나 뿐인 문**이다: 툴바는 버튼 하나만
 * 갖고, NLB 는 스위치가 켜졌을 때만 query 에 실리며, 결과는 같은 상자 안에서
 * 성공·실패로 갈려 성공은 닫기만, 실패는 편집으로 돌아가는 길을 하나 더 연다 —
 * 돌아가면 친 초안이 그대로 남는다.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const getApprovedRecommendations = vi.fn();
const createConfirmedResources = vi.fn();

vi.mock('@/app/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/app/lib/api')>();
  return {
    ...mod,
    getApprovedRecommendations: (...args: unknown[]) => getApprovedRecommendations(...args),
    createConfirmedResources: (...args: unknown[]) => createConfirmedResources(...args),
  };
});

import { ConfirmEditorModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmEditorModal';
import type { ConfirmedResourceProvider } from '@/app/lib/api';

const onClose = vi.fn();
const onDone = vi.fn();

const mount = (provider: ConfirmedResourceProvider = 'AWS') =>
  render(
    <ConfirmEditorModal targetSourceId={1642} provider={provider} onClose={onClose} onDone={onDone} />,
  );

const button = (name: string): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

const draftJson = (count: number): string =>
  JSON.stringify({
    resource_infos: Array.from({ length: count }, (_, index) => ({
      resource_id: `res-${index}`,
      resource_name: `confirmed-${index}`,
      resource_type: 'RDS',
      database_type: 'MYSQL',
    })),
  });

const notFound = new AppError({
  status: 404,
  code: 'CONFIRMED_INTEGRATION_NOT_FOUND',
  message: '추천값이 없습니다',
  retriable: false,
});

beforeEach(() => {
  vi.clearAllMocks();
  // 추천값 부재(404) 가 기본값 — 실패가 아니라 부재라 편집·등록은 그대로 열려 있다.
  getApprovedRecommendations.mockRejectedValue(notFound);
});

describe('입력 프레임', () => {
  it('툴바에는 문이 하나, 바닥에는 NLB 스위치가 선다', async () => {
    mount();

    expect(await screen.findByRole('button', { name: '추천값 불러오기' })).toBeTruthy();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    expect(screen.getByRole('switch')).toBeTruthy();
    // 「확정 정보 입력」은 제목이지 문이 아니다 — 머리에는 버튼이 없다.
    expect(screen.getByText('확정 정보 입력')).toBeTruthy();
  });

  it('IDC 는 계약이 NLB query 를 주지 않으므로 스위치째 없다', async () => {
    mount('IDC');
    await screen.findByRole('button', { name: '추천값 불러오기' });
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('스위치를 켠 채 입력하면 applyNLBSecurityGroup=true 로만 보낸다', async () => {
    createConfirmedResources.mockResolvedValue({});
    mount();

    fireEvent.click(screen.getByRole('switch'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: draftJson(1) } });
    fireEvent.click(button('입력'));

    await waitFor(() => expect(createConfirmedResources).toHaveBeenCalled());
    expect(createConfirmedResources).toHaveBeenCalledWith(1642, 'AWS', expect.anything(), true);
  });

  it('스위치를 켜지 않으면 applyNLBSecurityGroup 없이 보낸다', async () => {
    createConfirmedResources.mockResolvedValue({});
    mount();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: draftJson(1) } });
    fireEvent.click(button('입력'));

    await waitFor(() => expect(createConfirmedResources).toHaveBeenCalled());
    expect(createConfirmedResources).toHaveBeenCalledWith(1642, 'AWS', expect.anything(), false);
  });

  it('[취소] 는 확인 없이 바로 닫는다', async () => {
    mount();
    await waitFor(() => expect(getApprovedRecommendations).toHaveBeenCalled());

    fireEvent.click(button('취소'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('결과 — 성공', () => {
  it('성공하면 종점 화면이 서고, 닫을 때만 뒤 화면을 다시 읽는다', async () => {
    createConfirmedResources.mockResolvedValue({ ok: true });
    mount();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: draftJson(2) } });
    fireEvent.click(button('입력'));

    expect(await screen.findByText('확정 정보를 입력했습니다')).toBeTruthy();
    expect(screen.getByText('201 Created')).toBeTruthy();
    expect(screen.getByText('confirmed-0')).toBeTruthy();

    fireEvent.click(button('닫기'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('결과 — 실패', () => {
  it('실패하면 입력하지 못했습니다 화면이 서고, 편집으로 돌아가면 초안이 그대로 남는다', async () => {
    createConfirmedResources.mockRejectedValue(
      new AppError({ status: 400, code: 'BAD_REQUEST', message: '본문이 이상합니다', retriable: false }),
    );
    mount();

    const sent = draftJson(1);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: sent } });
    fireEvent.click(button('입력'));

    expect(await screen.findByText('입력하지 못했습니다')).toBeTruthy();
    expect(screen.getByText(/서버가 본문을 거절했습니다/)).toBeTruthy();

    fireEvent.click(button('편집으로 돌아가기'));

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe(sent);
    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
