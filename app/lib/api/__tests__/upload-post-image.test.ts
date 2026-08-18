/**
 * 이미지 업로드가 앱의 에러 계층을 통과하는지 본다.
 *
 * 예전 구현은 raw fetch 로 응답을 직접 열고 실패를 전부
 * `code: 'BAD_REQUEST', retriable: false` 로 찍었다. 그래서 BFF 가 503 을 주면
 * 재시도해야 할 상황이 "이 파일이 잘못됐다"로 읽혔고, BFF 가 아예 죽으면
 * 브라우저의 "Failed to fetch" 가 한국어 화면에 그대로 나왔다.
 *
 * 여기서 재는 것은 문구가 아니라 분류다 — status 와 retriable 이 서버가 말한
 * 대로 도착하는지. 문구를 고르는 일은 편집기(`PostBodyEditor.failureText`)가 한다.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { uploadPostImage } from '@/app/lib/api/posts';
import { AppError } from '@/lib/errors';

const pngFile = (): File => new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const failure = async (): Promise<AppError> => {
  try {
    await uploadPostImage(pngFile());
  } catch (cause) {
    expect(cause).toBeInstanceOf(AppError);
    return cause as AppError;
  }
  throw new Error('uploadPostImage 가 throw 하지 않았다');
};

afterEach(() => vi.restoreAllMocks());

describe('uploadPostImage', () => {
  it('성공 응답을 그대로 돌려준다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, { url: '/img/1.png', width: 800, height: 450 }),
    );

    await expect(uploadPostImage(pngFile())).resolves.toEqual({
      url: '/img/1.png',
      width: 800,
      height: 450,
    });
  });

  it('multipart 로 보낸다 — Content-Type 을 직접 정하지 않는다', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(201, { url: '/img/1.png', width: 8, height: 8 }));

    await uploadPostImage(pngFile());

    const init = spy.mock.calls[0][1];
    expect(init?.body).toBeInstanceOf(FormData);
    // 계약이 요구하는 파트 이름. `image` 로 보내면 BFF 가 400 을 준다.
    expect((init?.body as FormData).get('file')).toBeInstanceOf(File);
    expect(new Headers(init?.headers as HeadersInit).get('content-type')).toBeNull();
  });

  it('413 은 서버 문구를 그대로 전달한다 — 파일이 왜 거절됐는지는 서버가 안다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(413, { code: 'BAD_REQUEST', detail: '이미지 1개당 최대 5MB 입니다' }),
    );

    const err = await failure();
    expect(err.status).toBe(413);
    expect(err.message).toBe('이미지 1개당 최대 5MB 입니다');
  });

  it('503 은 retriable 로 도착한다 — 파일 문제가 아니다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(503, { title: 'upstream down' }));

    const err = await failure();
    expect(err.status).toBe(503);
    expect(err.retriable).toBe(true);
  });

  it('BFF 가 죽으면 NETWORK 로 도착한다 — "Failed to fetch" 가 아니라', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const err = await failure();
    expect(err.code).toBe('NETWORK');
    expect(err.message).toBe('네트워크 연결을 확인해주세요.');
  });
});
