/**
 * 확정 정보 쓰기·추천의 업스트림 경로 — CSP 마다 path 가 갈린다
 * (`…/{aws|gcp|azure|idc}-resources`, swagger `create/delete{Csp}ConfirmedResource` ·
 * `get{Csp}ApprovedRecommendations`).
 *
 * 이 파일이 있는 이유는 `bff-access-paths.test.ts` 와 같다: 목 어댑터가 `provider` 를
 * 버리므로(`createConfirmedResources: async (id, _provider, body)`) 목 모드에서는 네 경로를
 * 아예 타지 않고, 라우트 단위 테스트는 `bff.confirm.*` 를 모킹해서 그 아래를 못 본다.
 * 그래서 세그먼트가 틀려도 화면은 멀쩡히 돌아가고 실 BFF 에 붙는 순간에만 404 가 된다.
 *
 * `applyNLBSecurityGroup` 도 여기서 잰다. 계약이 그 파라미터를 aws path 에만 두는데, 게이트가
 * UI 에만 있으면(체크박스는 AWS 에서만 렌더된다) 내부 라우트를 직접 부르는 쪽이
 * `?provider=GCP&applyNLBSecurityGroup=true` 로 선언되지 않은 파라미터를 gcp path 에 실어
 * 보낼 수 있다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const BASE = 'https://bff.example.com';

/** 호출 한 번의 URL 을 잡아 온다. 응답 본문은 아무 JSON 이나 되면 된다. */
async function urlOf(call: (bff: typeof import('@/lib/bff/http').httpBff) => Promise<unknown>) {
  process.env.BFF_API_URL = BASE;
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  const { httpBff } = await import('@/lib/bff/http');
  await call(httpBff);
  const [url] = fetchSpy.mock.calls[0] ?? [];
  return String(url).replace(BASE, '');
}

const SEGMENT = {
  AWS: 'aws-resources',
  GCP: 'gcp-resources',
  AZURE: 'azure-resources',
  IDC: 'idc-resources',
} as const;

describe('httpBff.confirm — CSP 별 확정 리소스 경로', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  for (const [provider, segment] of Object.entries(SEGMENT)) {
    const csp = provider as keyof typeof SEGMENT;

    it(`${provider} 등록은 ${segment} 로 POST 한다`, async () => {
      expect(await urlOf((b) => b.confirm.createConfirmedResources(42, csp, {}, false))).toBe(
        `/install/v1/target-sources/42/${segment}`,
      );
    });

    it(`${provider} 삭제는 ${segment} 로 DELETE 한다`, async () => {
      expect(await urlOf((b) => b.confirm.deleteConfirmedResources(42, csp))).toBe(
        `/install/v1/target-sources/42/${segment}`,
      );
    });

    it(`${provider} 추천은 ${segment}/approved-recommendations 를 읽는다`, async () => {
      expect(await urlOf((b) => b.confirm.getApprovedRecommendations(42, csp))).toBe(
        `/install/v1/target-sources/42/${segment}/approved-recommendations`,
      );
    });
  }

  it('applyNLBSecurityGroup 은 AWS 에서 켠 경우에만 붙는다', async () => {
    expect(await urlOf((b) => b.confirm.createConfirmedResources(42, 'AWS', {}, true))).toBe(
      '/install/v1/target-sources/42/aws-resources?applyNLBSecurityGroup=true',
    );
  });

  // 한 it 에 여러 호출을 넣으면 fetch spy 가 누적돼 첫 호출만 검사하게 된다 — provider 마다
  // afterEach 가 도는 단위로 쪼갠다.
  for (const csp of ['GCP', 'AZURE', 'IDC'] as const) {
    it(`${csp} 는 applyNLBSecurityGroup 이 켜져 있어도 붙지 않는다 — 그 path 는 그 파라미터를 선언하지 않는다`, async () => {
      const url = await urlOf((b) => b.confirm.createConfirmedResources(42, csp, {}, true));
      expect(url).toBe(`/install/v1/target-sources/42/${SEGMENT[csp]}`);
      expect(url).not.toContain('applyNLBSecurityGroup');
    });
  }
});
