import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestConnectionLatest, getLatestTestConnectionResultSummaries } from '@/app/lib/api';
import { getTestConnectionResults } from '@/app/lib/api/task-queue-tc';
import { getTestedLogicalDatabases } from '@/app/lib/api/logical-db';

/**
 * TcScope('latest' | 'latestSuccess') 는 오직 URL 경로 세그먼트 하나만 고른다.
 * 세그먼트를 잘못 고르면 화면은 "다른 회차"를 조용히 보여줄 뿐 아무것도 던지지 않는다 —
 * 어댑터 유닛 테스트도, 컴포넌트 테스트도 경로 문자열은 보지 못한다.
 * 그래서 네 함수 × 두 scope = 8가지 조합의 URL 을 여기서 문자열로 못박는다.
 */

const fetchMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** First fetch call's URL as a string. */
function calledUrl(): string {
  return String(fetchMock.mock.calls[0][0]);
}

const PREFIX = '/pass/api/v1/target-sources/1027';

describe('TcScope → URL 경로 세그먼트', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getTestConnectionLatest — 실행 상태', () => {
    it("latest 는 `latest_version` 을 친다", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      await getTestConnectionLatest(1027, 'latest');
      expect(calledUrl()).toBe(`${PREFIX}/test-connection/latest_version`);
    });

    it("latestSuccess 는 `latest_success_version` 을 친다", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      await getTestConnectionLatest(1027, 'latestSuccess');
      expect(calledUrl()).toBe(`${PREFIX}/test-connection/latest_success_version`);
    });
  });

  describe('getLatestTestConnectionResultSummaries — 리소스별 건수 요약', () => {
    it("latest 는 `latest-results` 를 친다", async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));
      await getLatestTestConnectionResultSummaries(1027, 'latest');
      expect(calledUrl()).toBe(`${PREFIX}/test-connection/latest-results`);
    });

    it("latestSuccess 는 `latest-success-results` 를 친다", async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));
      await getLatestTestConnectionResultSummaries(1027, 'latestSuccess');
      expect(calledUrl()).toBe(`${PREFIX}/test-connection/latest-success-results`);
    });
  });

  describe('getTestConnectionResults — 리소스별 결과 행', () => {
    it("latest 는 `latest-results` 를 친다", async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));
      await getTestConnectionResults(1027, 'latest');
      expect(calledUrl()).toBe(`${PREFIX}/test-connection/latest-results`);
    });

    it("latestSuccess 는 `latest-success-results` 를 친다", async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));
      await getTestConnectionResults(1027, 'latestSuccess');
      expect(calledUrl()).toBe(`${PREFIX}/test-connection/latest-success-results`);
    });
  });

  /**
   * ⚠️ 이 쌍만 이름이 뒤집혀 있다 — `-latest-` 가 붙은 쪽이 최신 실행(성공 불문)이고,
   * 안 붙은 쪽이 마지막 성공이다. 다른 두 쌍과 규칙이 반대라 표의 두 값을 서로 바꿔
   * 써도 타입은 통과하고 응답 모양도 같다. 이 테스트가 존재하는 이유가 그것이다.
   */
  describe('getTestedLogicalDatabases — 논리 DB 목록 (이름이 뒤집힌 쌍)', () => {
    it("latest 는 `-latest-` 가 붙은 `tested-latest-logical-databases` 를 친다", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ logical_database_list: [] }));
      await getTestedLogicalDatabases(1027, 'db-1', 'latest');
      expect(calledUrl()).toBe(
        `${PREFIX}/tested-latest-logical-databases/by-resource-id?resourceId=db-1`,
      );
    });

    it("latestSuccess 는 `-latest-` 가 없는 `tested-logical-databases` 를 친다", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ logical_database_list: [] }));
      await getTestedLogicalDatabases(1027, 'db-1', 'latestSuccess');
      expect(calledUrl()).toBe(
        `${PREFIX}/tested-logical-databases/by-resource-id?resourceId=db-1`,
      );
    });

    it('resourceId 는 encodeURIComponent 를 타고 쿼리에 들어간다', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ logical_database_list: [] }));
      await getTestedLogicalDatabases(1027, 'arn:aws:rds:ap-northeast-2/db one', 'latest');
      expect(calledUrl()).toBe(
        `${PREFIX}/tested-latest-logical-databases/by-resource-id`
          + '?resourceId=arn%3Aaws%3Ards%3Aap-northeast-2%2Fdb%20one',
      );
    });
  });
});
