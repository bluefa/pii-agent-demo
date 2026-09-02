/**
 * The gate on this proxy is the whole feature: it is the one route that hands an
 * arbitrary upstream path to the BFF with the caller's own credentials. So every
 * denial asserts BOTH the 404 AND that `fetch` never ran — a 404 produced after
 * the upstream call has already leaked the request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { meMock, authHeadersMock } = vi.hoisted(() => ({
  meMock: vi.fn(),
  authHeadersMock: vi.fn(async () => ({ cookie: 'session=abc' })),
}));

vi.mock('@/lib/bff/current-user', () => ({ getMeOrNull: meMock }));
vi.mock('@/lib/bff/auth-headers', () => ({ authHeaders: authHeadersMock }));

import { GET } from '@/app/admin/bff-swagger/[...path]/route';

const BFF = 'https://bff.example.com';
/** 이 앱 안에서 프록시가 서 있는 자리 — `basePath` 포함. */
const BASE_PATH = '/pass/admin/bff-swagger';

const call = (path: string[], search = '') =>
  GET(new Request(`http://localhost/pass/admin/bff-swagger/${path.join('/')}${search}`), {
    params: Promise.resolve({ path }),
  });

let fetchSpy: ReturnType<typeof vi.spyOn>;

const upstreamReturns = (body: string, contentType: string) => {
  fetchSpy.mockResolvedValue(new Response(body, { headers: { 'content-type': contentType } }));
};

describe('GET /pass/admin/bff-swagger/[...path]', () => {
  beforeEach(() => {
    process.env.BFF_API_URL = BFF;
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    meMock.mockResolvedValue({ role: 'ADMIN' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BFF_API_URL;
  });

  it('비관리자는 404 이고 업스트림을 부르지 않는다', async () => {
    meMock.mockResolvedValue({ role: 'USER' });

    const res = await call(['swagger-ui', 'index.html']);

    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('/user/me 가 답하지 못하면(미인증·BFF 다운) 404 이고 업스트림을 부르지 않는다', async () => {
    meMock.mockResolvedValue(null);

    const res = await call(['swagger-ui', 'index.html']);

    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('관리자여도 허용 목록 밖 첫 조각은 404 이고 업스트림을 부르지 않는다', async () => {
    const res = await call(['actuator', 'env']);

    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('관리자는 swagger-ui 를 받고, 절대 경로 /install/ 은 프록시 경로로 바뀐다', async () => {
    upstreamReturns(
      '<script>const configUrl = "/install/v3/api-docs/swagger-config";</script>',
      'text/html;charset=utf-8',
    );

    const res = await call(['swagger-ui', 'index.html'], '?urls.primaryName=install');

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BFF}/install/swagger-ui/index.html?urls.primaryName=install`,
      expect.objectContaining({ headers: { cookie: 'session=abc' }, cache: 'no-store' }),
    );
    const body = await res.text();
    expect(body).toContain(`${BASE_PATH}/v3/api-docs/swagger-config`);
    expect(body).not.toContain('/install/');
    expect(res.headers.get('content-type')).toBe('text/html;charset=utf-8');
  });

  /**
   * 트립와이어. BFF 가 내주는 OpenAPI 문서 자체의 path 키가 `/install/v1/...` 로
   * 시작한다(현재 81개). `/install/` 를 통째로 치환하면 이 문서화된 엔드포인트
   * 경로들이 함께 바뀌어, Swagger UI 가 존재하지 않는 경로를 보여준다 — 이 화면이
   * 읽으라고 있는 계약 그 자체가 망가진다.
   */
  it('스펙 본문의 /install/v1 path 키는 건드리지 않는다', async () => {
    const specPath = '/install/v1/target-sources/{targetSourceId}/excluded-databases';
    upstreamReturns(
      JSON.stringify({ paths: { [specPath]: { get: { operationId: 'getExcludedDatabases' } } } }),
      'application/json',
    );

    const res = await call(['v3', 'api-docs']);

    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain(specPath);
    expect(body).not.toContain(`${BASE_PATH}/v1/`);
  });

  it('바이너리 응답은 문자열 치환 없이 그대로 흘려보낸다', async () => {
    upstreamReturns('/install/not-a-url-just-bytes', 'image/png');

    const res = await call(['swagger-ui', 'favicon.png']);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(await res.text()).toBe('/install/not-a-url-just-bytes');
  });
});
