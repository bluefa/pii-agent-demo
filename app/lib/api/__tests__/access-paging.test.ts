import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  approveAccessRequest,
  fetchEveryPage,
  type AccessPage,
} from '@/app/lib/api/access';

/**
 * 화면이 전체를 들고 세는 목록들(신청 가능 서비스·접근 가능 서비스·내 요청 내역)은
 * 계약에 상태 필터가 없어서 전부 받아야 한다. 첫 장만 받아 놓고 전체인 척하면 그 뒤
 * 항목들은 존재하지 않는 것이 되고 헤더 건수까지 틀리는데, 목이 한 장에 다 담기는
 * 크기라 **화면으로는 절대 안 보인다.** 그래서 여기서 잡는다.
 */
describe('fetchEveryPage', () => {
  const page = <T,>(content: T[], number: number, totalPages: number): AccessPage<T> => ({
    content,
    totalElements: totalPages * 2,
    totalPages,
    number,
    size: 2,
  });

  it('마지막 장까지 읽어 순서대로 합친다', async () => {
    const pages = [page(['a', 'b'], 0, 3), page(['c', 'd'], 1, 3), page(['e'], 2, 3)];
    const asked: number[] = [];

    const all = await fetchEveryPage(async (n) => {
      asked.push(n);
      return pages[n];
    });

    expect(all).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(asked).toEqual([0, 1, 2]);
  });

  it('한 장뿐이면 한 번만 부른다', async () => {
    const asked: number[] = [];

    const all = await fetchEveryPage(async (n) => {
      asked.push(n);
      return page(['only'], n, 1);
    });

    expect(all).toEqual(['only']);
    expect(asked).toEqual([0]);
  });
});

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
