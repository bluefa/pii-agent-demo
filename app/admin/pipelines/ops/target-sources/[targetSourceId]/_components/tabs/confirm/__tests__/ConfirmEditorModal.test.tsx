// @vitest-environment jsdom
/**
 * 확정 정보 입력기 v2.4 — 한 상자, 두 프레임.
 *
 * 여기 단언이 지키는 것은 배치가 아니라 **하나 뿐인 문**이다: 툴바는 버튼 하나만
 * 갖고, NLB 는 스위치가 켜졌을 때만 query 에 실리며, 결과는 같은 상자 안에서
 * 성공·실패로 갈려 성공은 닫기만, 실패는 편집으로 돌아가는 길을 하나 더 연다 —
 * 돌아가면 친 초안이 그대로 남는다. 그리고 저장하지 않은 초안을 들고 나가려 하면
 * 어느 문으로 나가든(취소·ESC·오버레이) 확인창이 먼저 선다. 그리고 **여는 것만으로는
 * 아무 요청도 나가지 않는다** — 추천값은 누를 때만 조회한다. 조회가 부재로든 실패로든
 * 끝나면 줄은 짧게 말하고, 서버가 준 본문은 「상세 에러보기」가 여는 창이 든다.
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

/** 503 의 code 는 허용 목록에 없어 status fallback 으로 떨어진다(lib/fetch-json.ts). */
const unavailable = new AppError({
  status: 503,
  code: 'INTERNAL_ERROR',
  message: '업스트림이 응답하지 않습니다',
  retriable: true,
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

  it('모달을 여는 것만으로는 아무것도 조회하지 않는다 — 버튼은 살아 있다', async () => {
    mount();

    const load = await screen.findByRole('button', { name: '추천값 불러오기' });
    // 진입 콜 0 — 렌더가 가라앉은 뒤에도 호출은 없다.
    await waitFor(() => expect(screen.getByRole('textbox')).toBeTruthy());
    expect(getApprovedRecommendations).not.toHaveBeenCalled();
    // 유무를 모르므로 막을 근거도 없다 — 문은 열려 있고 이유 줄도 서지 않는다.
    expect(load.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByText('연동 승인 정보가 존재하지 않습니다.')).toBeNull();
  });

  it('빈 초안에서 누르면 한 번 조회하고 그 자리에서 편집기를 채운다', async () => {
    const recommended = { resource_infos: [{ resource_id: 'rec-1', resource_name: 'recommended-1' }] };
    getApprovedRecommendations.mockResolvedValue(recommended);
    mount();

    fireEvent.click(button('추천값 불러오기'));

    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        JSON.stringify(recommended, null, 2),
      ),
    );
    expect(getApprovedRecommendations).toHaveBeenCalledTimes(1);
    expect(getApprovedRecommendations).toHaveBeenCalledWith(1642, 'AWS');
  });

  it('조회가 실패하면 짧게 말하고 [다시 확인] 이 되며, 다시 누르면 한 번 더 묻는다', async () => {
    getApprovedRecommendations.mockRejectedValue(unavailable);
    mount();

    fireEvent.click(button('추천값 불러오기'));

    const retry = await screen.findByRole('button', { name: '다시 확인' });
    // 부재와 같은 자리, 같은 한 줄 — status 도 본문도 이 줄에 없다.
    const reason = screen.getByText('추천값을 불러오지 못했습니다.');
    expect(retry.getAttribute('aria-describedby')).toBe(reason.getAttribute('id'));
    // 누른 뒤에 나타나므로 읽어 준다.
    expect(reason.getAttribute('role')).toBe('status');
    // 자세한 것을 볼 문이 옆에 하나 선다.
    expect(screen.getByRole('button', { name: '상세 에러보기' })).toBeTruthy();
    // 실패는 부재가 아니다 — 막지 않고, 부재 이유도 말하지 않는다.
    expect(retry.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByText('연동 승인 정보가 존재하지 않습니다.')).toBeNull();

    fireEvent.click(retry);
    await waitFor(() => expect(getApprovedRecommendations).toHaveBeenCalledTimes(2));
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

  it('친 초안이 있으면 첫 누름은 무장만 한다 — 요청도 나가지 않는다', async () => {
    const recommended = { resource_infos: [{ resource_id: 'rec-1', resource_name: 'recommended-1' }] };
    getApprovedRecommendations.mockResolvedValue(recommended);
    mount();

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: draftJson(1) } });

    const load = button('추천값 불러오기');
    fireEvent.click(load);
    // 첫 누름은 무장만 한다 — 초안은 그대로고, 콜도 쓰지 않는다.
    expect(textarea.value).toBe(draftJson(1));
    expect(getApprovedRecommendations).not.toHaveBeenCalled();
    expect(
      screen.getByText('다시 누르면 지금 초안을 추천값으로 덮어씁니다 — 적은 내용은 사라집니다.'),
    ).toBeTruthy();

    fireEvent.click(load);
    // 두 번째 누름이 조회하고 덮어쓴다.
    await waitFor(() => expect(textarea.value).toBe(JSON.stringify(recommended, null, 2)));
    expect(getApprovedRecommendations).toHaveBeenCalledTimes(1);
  });

  it('받아 둔 추천값이 있어도 초안을 고치면 다시 두 번 눌러야 덮어쓴다 — 무장이 풀리지 않던 회귀', async () => {
    const recommended = { resource_infos: [{ resource_id: 'rec-1', resource_name: 'recommended-1' }] };
    getApprovedRecommendations.mockResolvedValue(recommended);
    mount();

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const load = button('추천값 불러오기');

    fireEvent.click(load);
    await waitFor(() => expect(textarea.value).toBe(JSON.stringify(recommended, null, 2)));

    fireEvent.change(textarea, { target: { value: draftJson(1) } });
    fireEvent.click(load);
    // 이미 받아 둔 글이 있으므로 조회는 늘지 않고 무장만 한다.
    expect(textarea.value).toBe(draftJson(1));
    expect(getApprovedRecommendations).toHaveBeenCalledTimes(1);

    fireEvent.click(load);
    expect(textarea.value).toBe(JSON.stringify(recommended, null, 2));
    expect(getApprovedRecommendations).toHaveBeenCalledTimes(1);
  });

  it('눌러서 404 를 받아야 막힌 버튼 옆이 그 이유를 말한다', async () => {
    mount();

    const load = button('추천값 불러오기');
    fireEvent.click(load);

    await waitFor(() => expect(load.getAttribute('aria-disabled')).toBe('true'));
    const reason = screen.getByText('연동 승인 정보가 존재하지 않습니다.');
    expect(reason).toBeTruthy();
    // 이유는 버튼에 묶인다 — blocked 버튼은 포커스를 잃지 않으므로 읽어 줄 수 있다.
    expect(load.getAttribute('aria-describedby')).toBe(reason.getAttribute('id'));
    // 404 는 부재지 실패가 아니다 — 실패 말은 서지 않고, 버튼도 「다시 확인」이 되지 않는다.
    expect(screen.queryByText(/추천값을 불러오지 못했습니다/)).toBeNull();
    expect(screen.queryByRole('button', { name: '다시 확인' })).toBeNull();
    // 부재도 서버가 말을 담아 온다 — 지어낸 한 문장 옆에 같은 문이 선다.
    expect(screen.getByRole('button', { name: '상세 에러보기' })).toBeTruthy();
  });

  it('부재의 [상세 에러보기] 도 서버가 준 본문을 편다 — 지어낸 한 문장 뒤에 가리지 않는다', async () => {
    mount();

    fireEvent.click(button('추천값 불러오기'));
    fireEvent.click(await screen.findByRole('button', { name: '상세 에러보기' }));

    // 창의 제목은 마침표가 없다 — 줄의 그것과 다른 문자열이다.
    expect(screen.getByText('연동 승인 정보가 존재하지 않습니다')).toBeTruthy();
    expect(screen.getByText('404 Not Found')).toBeTruthy();
    expect(screen.getByText(/추천값이 없습니다/)).toBeTruthy();
    expect(screen.getByText(/CONFIRMED_INTEGRATION_NOT_FOUND/)).toBeTruthy();

    // 창만 닫힌다 — 줄도 막힌 버튼도 그대로다.
    fireEvent.click(button('닫기'));
    expect(screen.queryByText('연동 승인 정보가 존재하지 않습니다')).toBeNull();
    expect(screen.getByText('연동 승인 정보가 존재하지 않습니다.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('추천값이 있으면 이유 줄은 서지 않는다', async () => {
    getApprovedRecommendations.mockResolvedValue({ resource_infos: [] });
    mount();

    const load = button('추천값 불러오기');
    fireEvent.click(load);

    await waitFor(() => expect(getApprovedRecommendations).toHaveBeenCalled());
    expect(load.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByText('연동 승인 정보가 존재하지 않습니다.')).toBeNull();
    expect(load.getAttribute('aria-describedby')).toBeNull();
  });

  it('손대지 않은 초안이면 [취소] 는 묻지 않고 바로 닫는다', () => {
    mount();

    fireEvent.click(button('취소'));
    expect(screen.queryByText(LEAVE_TITLE)).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('상세 에러보기', () => {
  /** 실패까지 몰고 간다 — 초안이 없으면 첫 누름이 곧 조회다. */
  const failLoad = async (): Promise<HTMLButtonElement> => {
    fireEvent.click(button('추천값 불러오기'));
    await screen.findByRole('button', { name: '다시 확인' });
    return button('상세 에러보기');
  };

  it('누르면 서버 응답과 서버가 준 본문을 그대로 편다', async () => {
    getApprovedRecommendations.mockRejectedValue(unavailable);
    mount();

    fireEvent.click(await failLoad());

    // 창의 제목은 마침표가 없다 — 줄의 그것과 다른 문자열이다.
    expect(screen.getByText('추천값을 불러오지 못했습니다')).toBeTruthy();
    expect(screen.getByText('503 Service Unavailable')).toBeTruthy();
    expect(screen.getByText(/업스트림이 응답하지 않습니다/)).toBeTruthy();
    expect(screen.getByText(/INTERNAL_ERROR/)).toBeTruthy();
  });

  it('응답이 오지 않았으면 창이 응답 없음 이라고 말한다', async () => {
    getApprovedRecommendations.mockRejectedValue(new Error('Failed to fetch'));
    mount();

    fireEvent.click(await failLoad());

    expect(screen.getByText('응답 없음')).toBeTruthy();
    expect(screen.getByText(/Failed to fetch/)).toBeTruthy();
  });

  it('[닫기] 는 창만 닫는다 — 편집기도 초안도 그대로 선다', async () => {
    getApprovedRecommendations.mockRejectedValue(unavailable);
    mount();

    const sent = draftJson(1);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: sent } });
    // 초안이 있으면 첫 누름은 무장만 한다 — 조회는 두 번째 누름이다.
    fireEvent.click(button('추천값 불러오기'));
    fireEvent.click(button('추천값 불러오기'));
    fireEvent.click(await screen.findByRole('button', { name: '상세 에러보기' }));
    expect(screen.getByText('추천값을 불러오지 못했습니다')).toBeTruthy();

    fireEvent.click(button('닫기'));

    expect(screen.queryByText('추천값을 불러오지 못했습니다')).toBeNull();
    expect(screen.getByText('확정 정보 입력')).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(sent);
    // 창을 닫은 것이지 편집기를 닫은 것이 아니다.
    expect(onClose).not.toHaveBeenCalled();
    // 줄은 그대로 남는다.
    expect(screen.getByText('추천값을 불러오지 못했습니다.')).toBeTruthy();
  });
});

describe('나가기 확인', () => {
  it('작성 중인 초안이 있으면 [취소] 는 확인창을 세운다 — [계속 작성] 은 초안째 편집기로 돌려보낸다', () => {
    mount();

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

  it('ESC 도 같은 문이다 — 초안이 있으면 닫지 않고 확인창을 세운다', () => {
    mount();

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
