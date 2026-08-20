import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAirflowHost } from '@/app/lib/api/ops';

/**
 * databaseUri 는 `mysql://10.20.4.31:3306/review_media` 처럼 `://` 와 `/` 를 품은 채
 * 쿼리에 실린다. 인코딩을 빠뜨려도 **양쪽 단위 테스트는 아무것도 못 본다** — 목은
 * 우리가 만든 문자열을 그대로 읽고, 라우트 테스트는 이미 파싱된 값을 받는다. 그래서
 * 나가는 URL 자체를 잰다 (feedback: 경로에 실리는 값은 fetch URL 을 직접 재라).
 */
describe('getAirflowHost — 쿼리 인코딩', () => {
  const stubFetch = (body: string) => {
    const seen: { url: string } = { url: '' };
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      seen.url = String(input);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    return seen;
  };

  afterEach(() => vi.unstubAllGlobals());

  it('databaseUri 는 인코딩되어 나간다 — 날 슬래시가 경로를 갈라놓지 않는다', async () => {
    const seen = stubFetch('https://airflow-prod.pii.internal/dags/pii_scan_review_media/grid');
    await getAirflowHost('mysql://10.20.4.31:3306/review_media');

    expect(seen.url).toContain(
      'databaseUri=mysql%3A%2F%2F10.20.4.31%3A3306%2Freview_media',
    );
    // 경로 조각은 airflow-host 하나뿐이어야 한다 — uri 의 `/` 가 새 조각을 만들면 404.
    expect(seen.url.split('?')[0]).toMatch(/\/pipeline-manager\/airflow-host$/);
  });

  it('본문은 문자열 하나 — 객체로 감싸지 않는다', async () => {
    stubFetch('https://airflow-prod.pii.internal/dags/pii_scan_orders/grid');
    await expect(getAirflowHost('mysql://10.0.0.1:3306/orders')).resolves.toBe(
      'https://airflow-prod.pii.internal/dags/pii_scan_orders/grid',
    );
  });
});
