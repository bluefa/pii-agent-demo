import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchAccessUsers } from '@/app/lib/api/access';

/**
 * 부여 피커 검색의 두 가지가 계약과 어긋나면 **실 BFF 에서만** 조용히 깨진다 — 목은
 * 우리가 보낸 이름을 그대로 읽으므로 화면상으로는 멀쩡해 보인다. 그래서 여기서 잡는다.
 *
 *  1. 질의 키는 swagger 가 선언한 `q` 다. `query` 로 보내면 서버가 무시하고 명부 전체를
 *     돌려준다 — 검색창이 아무 일도 하지 않는 채로.
 *  2. 이미 가진 사람 제외는 **응답에서** 한다. 계약의 `excludeIds` 키잉이 미확정이라
 *     서버에 맡기면 후보 목록에 담당자가 다시 올라온다.
 */
describe('searchAccessUsers — 계약 파라미터와 제외 처리', () => {
  /** 호출된 URL 을 담는 상자를 돌려준다 — 첫 호출 뒤 `.url` 에 들어 있다. */
  const stubFetch = (users: { knox_id: string; email: string; role: string }[]) => {
    const seen: { url: string } = { url: '' };
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      seen.url = String(input);
      return new Response(JSON.stringify({ users }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    return seen;
  };

  const user = (knoxId: string) => ({
    knox_id: knoxId,
    email: `${knoxId}@company.com`,
    role: 'USER',
  });

  afterEach(() => vi.unstubAllGlobals());

  it('질의는 `q` 로 나간다 — `query` 가 아니다', async () => {
    const seen = stubFetch([user('gildong.hong')]);
    await searchAccessUsers('gildong', []);

    expect(seen.url).toContain('q=gildong');
    expect(seen.url).not.toContain('query=');
  });

  it('제외 목록은 서버로 나가지 않는다 — 응답에서 걸러 낸다', async () => {
    const seen = stubFetch([user('gildong.hong'), user('chulsoo.kim')]);
    const found = await searchAccessUsers('company', ['CHULSOO.KIM@company.com']);

    expect(seen.url).not.toContain('exclude');
    // 대소문자가 달라도 같은 사람이다 — 계약이 email 을 case-insensitive 로 비교한다.
    expect(found.map((row) => row.knoxId)).toEqual(['gildong.hong']);
  });
});
