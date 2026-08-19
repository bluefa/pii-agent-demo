/**
 * 게시글 저장이 계약(handoff §3.2)의 multipart 형태로 wire 에 실리는지 본다.
 *
 * 파트 이름(`post`/`files`)과 filename-이-cid-키 규칙이 계약 그 자체라, 여기가
 * 어긋나면 서버는 400 이 아니라 조용히 깨진 이미지를 저장하게 된다. 에러 분류
 * (retriable · NETWORK 정규화)는 업로드 시절과 같은 이유로 같은 것을 잰다 —
 * 저장은 이제 이미지 바이트까지 싣는 유일한 호출이다.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createPost, updatePost } from '@/app/lib/api/posts';
import { AppError } from '@/lib/errors';

const pngFile = (): File => new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });

const body = {
  type: 'NOTICE' as const,
  categoryId: null,
  titles: { ko: '제목', en: 'Title' },
  contents: { ko: '<p>ko</p><img src="cid:k7f3a91cdeadbeef">', en: '<p>en</p>' },
};

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => vi.restoreAllMocks());

describe('createPost — multipart 계약', () => {
  it('post 파트는 JSON 이고, files 파트의 filename 이 cid 키다', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(201, { id: 1 }));

    await createPost(body, [{ key: 'k7f3a91cdeadbeef', file: pngFile() }]);

    const init = spy.mock.calls[0][1];
    expect(init?.body).toBeInstanceOf(FormData);
    const form = init?.body as FormData;

    const post = form.get('post') as Blob;
    expect(post).toBeInstanceOf(Blob);
    expect(post.type).toBe('application/json');
    expect(JSON.parse(await post.text())).toEqual(body);

    const files = form.getAll('files') as File[];
    // 본문의 cid: 가 가리키는 것은 이 filename 이다 — 원래 파일명(a.png)이 아니라.
    expect(files.map((file) => file.name)).toEqual(['k7f3a91cdeadbeef']);

    // boundary 는 fetch 가 만든다 — Content-Type 을 직접 정하면 multipart 가 깨진다.
    expect(new Headers(init?.headers as HeadersInit).get('content-type')).toBeNull();
  });

  it('파일이 없으면 files 파트도 없다 — 이미지 없는 Phase 1 저장과 같은 모양', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(201, { id: 1 }));

    await createPost({ ...body, contents: { ko: '<p>ko</p>', en: '<p>en</p>' } });

    const form = spy.mock.calls[0][1]?.body as FormData;
    expect(form.getAll('files')).toEqual([]);
    expect(form.get('post')).toBeInstanceOf(Blob);
  });
});

describe('updatePost — 에러 분류', () => {
  const attempt = async (): Promise<AppError> => {
    try {
      await updatePost(1, { categoryId: null, titles: body.titles, contents: body.contents }, [
        { key: 'k7f3a91cdeadbeef', file: pngFile() },
      ]);
    } catch (cause) {
      expect(cause).toBeInstanceOf(AppError);
      return cause as AppError;
    }
    throw new Error('updatePost 가 throw 하지 않았다');
  };

  it('400 은 서버 문구를 그대로 전달한다 — 어느 키가 잘못됐는지는 서버가 안다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(400, {
        code: 'POST_IMAGE_REF_MISSING',
        detail: '본문의 cid:k7f3a91cdeadbeef 에 대응하는 파일 파트가 없습니다',
      }),
    );

    const err = await attempt();
    expect(err.status).toBe(400);
    expect(err.message).toBe('본문의 cid:k7f3a91cdeadbeef 에 대응하는 파일 파트가 없습니다');
  });

  it('503 은 retriable 로 도착한다 — 재시도가 바이트를 다시 보내면 된다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(503, { title: 'upstream down' }));

    const err = await attempt();
    expect(err.status).toBe(503);
    expect(err.retriable).toBe(true);
  });

  it('BFF 가 죽으면 NETWORK 로 도착한다 — "Failed to fetch" 가 아니라', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const err = await attempt();
    expect(err.code).toBe('NETWORK');
    expect(err.message).toBe('네트워크 연결을 확인해주세요.');
  });
});
