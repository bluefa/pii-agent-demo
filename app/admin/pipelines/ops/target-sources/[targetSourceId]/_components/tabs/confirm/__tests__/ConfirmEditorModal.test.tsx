// @vitest-environment jsdom
/**
 * 확정 정보 입력기 v2.4 — 한 상자, 두 프레임.
 *
 * 여기 단언이 지키는 것은 배치가 아니라 **하나 뿐인 문**이다: 툴바는 버튼 하나만
 * 갖고, NLB 는 스위치가 켜졌을 때만 query 에 실리며, 결과는 같은 상자 안에서
 * 성공·실패로 갈려 성공은 닫기만, 실패는 편집으로 돌아가는 길을 하나 더 연다 —
 * 돌아가면 친 초안이 그대로 남는다. 그리고 저장하지 않은 초안을 들고 나가려 하면
 * 어느 문으로 나가든(취소·ESC·오버레이) 확인창이 먼저 선다.
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

/** 나가기 확인창의 제목 — 이것이 화면에 있으면 아직 닫히지 않았다. */
const LEAVE_TITLE = '작성 중인 내용이 있습니다';

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

  it('추천값을 두 번 눌러야 덮어쓴다 — 무장이 풀리지 않던 회귀', async () => {
    const recommended = { resource_infos: [{ resource_id: 'rec-1', resource_name: 'recommended-1' }] };
    getApprovedRecommendations.mockResolvedValue(recommended);
    mount();
    await waitFor(() => expect(getApprovedRecommendations).toHaveBeenCalled());

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: draftJson(1) } });

    const load = await screen.findByRole('button', { name: '추천값 불러오기' });
    fireEvent.click(load);
    // 첫 누름은 무장만 한다 — 초안은 그대로다.
    expect(textarea.value).toBe(draftJson(1));

    fireEvent.click(load);
    // 두 번째 누름이 실제로 덮어쓴다.
    expect(textarea.value).toBe(JSON.stringify(recommended, null, 2));
  });

  it('추천값이 없으면(404) 막힌 버튼 옆이 그 이유를 말한다', async () => {
    mount();

    const load = await screen.findByRole('button', { name: '추천값 불러오기' });
    expect(load.getAttribute('aria-disabled')).toBe('true');
    const reason = screen.getByText('연동 승인 정보가 존재하지 않습니다.');
    expect(reason).toBeTruthy();
    // 이유는 버튼에 묶인다 — blocked 버튼은 포커스를 잃지 않으므로 읽어 줄 수 있다.
    expect(load.getAttribute('aria-describedby')).toBe(reason.getAttribute('id'));
  });

  it('추천값이 있으면 이유 줄은 서지 않는다', async () => {
    getApprovedRecommendations.mockResolvedValue({ resource_infos: [] });
    mount();

    const load = await screen.findByRole('button', { name: '추천값 불러오기' });
    await waitFor(() => expect(load.getAttribute('aria-disabled')).toBeNull());
    expect(screen.queryByText('연동 승인 정보가 존재하지 않습니다.')).toBeNull();
    expect(load.getAttribute('aria-describedby')).toBeNull();
  });

  it('손대지 않은 초안이면 [취소] 는 묻지 않고 바로 닫는다', async () => {
    mount();
    await waitFor(() => expect(getApprovedRecommendations).toHaveBeenCalled());

    fireEvent.click(button('취소'));
    expect(screen.queryByText(LEAVE_TITLE)).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('나가기 확인', () => {
  it('작성 중인 초안이 있으면 [취소] 는 확인창을 세운다 — [계속 작성] 은 초안째 편집기로 돌려보낸다', async () => {
    mount();
    await waitFor(() => expect(getApprovedRecommendations).toHaveBeenCalled());

    const sent = draftJson(1);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: sent } });
    fireEvent.click(button('취소'));

    expect(screen.getByText(LEAVE_TITLE)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(button('계속 작성'));
    expect(screen.queryByText(LEAVE_TITLE)).toBeNull();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(sent);
    expect(onClose).not.toHaveBeenCalled();

    // 두 번째 시도에서 [닫기] 를 누르면 그제서야 닫힌다 — 다른 자리의 다른 버튼이다.
    fireEvent.click(button('취소'));
    fireEvent.click(button('닫기'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('ESC 도 같은 문이다 — 초안이 있으면 닫지 않고 확인창을 세운다', async () => {
    mount();
    await waitFor(() => expect(getApprovedRecommendations).toHaveBeenCalled());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: draftJson(1) } });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByText(LEAVE_TITLE)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('입력에 성공하면 잃을 초안이 없다 — 결과 프레임의 [닫기] 는 묻지 않는다', async () => {
    createConfirmedResources.mockResolvedValue({ ok: true });
    mount();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: draftJson(1) } });
    fireEvent.click(button('입력'));
    await screen.findByText('확정 정보를 입력했습니다');

    fireEvent.click(button('닫기'));
    expect(screen.queryByText(LEAVE_TITLE)).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('실패 프레임의 [닫기] 는 아직 초안을 들고 있으므로 되묻는다', async () => {
    createConfirmedResources.mockRejectedValue(
      new AppError({ status: 400, code: 'BAD_REQUEST', message: '본문이 이상합니다', retriable: false }),
    );
    mount();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: draftJson(1) } });
    fireEvent.click(button('입력'));
    await screen.findByText('입력하지 못했습니다');

    fireEvent.click(button('닫기'));
    expect(screen.getByText(LEAVE_TITLE)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
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
