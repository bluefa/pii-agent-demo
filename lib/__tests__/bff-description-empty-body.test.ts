/**
 * PUT …/description 의 성공 판정 (docs/api/ops-assumed-contracts.md §8).
 *
 * 응답 본문이 계약에 없는데도 `send()` 는 204 가 아닌 2xx 를 전부 `JSON.parse` 한다 —
 * 업스트림이 200 빈 본문이나 `"OK"` 로 답하면 **저장된 쓰기가 실패로 뒤집힌다.** 읽는
 * 값이 하나도 없으므로(호출부는 목록을 다시 읽는다) 판정은 status 뿐이어야 한다.
 *
 * 라우트 테스트는 `@/lib/bff/client` 를 모킹해 이 아래를 못 보고, 목 어댑터는 204 를
 * 내주므로 파싱까지 가지 않는다 — `emptyBodyOk` 를 지워도 저 둘은 초록이다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const BASE = 'https://bff.example.com';

async function put(response: Response) {
  process.env.BFF_API_URL = BASE;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const { httpBff } = await import('@/lib/bff/http');
  const result = await httpBff.targetSources.putDescription(1013, '수정된 설명');
  const [url, init] = fetchSpy.mock.calls[0] ?? [];
  return { result, path: String(url).replace(BASE, ''), init: init as RequestInit };
}

describe('httpBff.targetSources.putDescription — 성공은 status 로만 판정한다', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  it('204 는 성공이다', async () => {
    await expect(put(new Response(null, { status: 204 }))).resolves.toMatchObject({
      result: undefined,
    });
  });

  it('200 + 빈 본문도 성공이다 — 파싱이 저장된 쓰기를 실패로 뒤집으면 안 된다', async () => {
    await expect(put(new Response('', { status: 200 }))).resolves.toMatchObject({
      result: undefined,
    });
  });

  it('본문은 snake 로 실어 보낸다 — 읽는 쪽(TargetSourceDetail.description)과 같은 이름', async () => {
    const { path, init } = await put(new Response(null, { status: 204 }));
    expect(path).toBe('/install/v1/target-sources/1013/description');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ description: '수정된 설명' }));
  });

  it('4xx 는 여전히 에러다 — status 판정이 실패까지 통과시키면 안 된다', async () => {
    await expect(
      put(new Response(JSON.stringify({ message: '없음' }), { status: 404 })),
    ).rejects.toThrow();
  });
});
