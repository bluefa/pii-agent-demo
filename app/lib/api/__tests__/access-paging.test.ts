import { describe, it, expect, vi, afterEach } from 'vitest';
import { approveAccessRequest } from '@/app/lib/api/access';

/**
 * 승인 메시지는 선택 필드다. 비었을 때 `{ message: "" }` 를 보내면, 빈 문자열을 그대로
 * 저장하는 서버에서 상세의 "메시지 없이 승인했어요" 대체 문구가 빗나가 처리 결과가
 * 빈칸으로 남는다. 목은 `'' → null` 로 바꿔 주기 때문에 목으로는 드러나지 않는다.
 */
describe('approveAccessRequest — 빈 메시지는 키째 뺀다', () => {
  const stubFetch = () => {
    const seen: { body: unknown } = { body: null };
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.body = init?.body == null ? null : JSON.parse(String(init.body));
      return new Response(null, { status: 204 });
    });
    return seen;
  };

  afterEach(() => vi.unstubAllGlobals());

  it('메시지가 비면 body 에 `message` 가 없다', async () => {
    const seen = stubFetch();
    await approveAccessRequest(1001, '   ');

    expect(seen.body).toEqual({});
  });

  it('메시지가 있으면 잘라서 싣는다', async () => {
    const seen = stubFetch();
    await approveAccessRequest(1001, '  확인했습니다  ');

    expect(seen.body).toEqual({ message: '확인했습니다' });
  });
});
