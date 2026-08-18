/**
 * 실데이터 여부 쓰기의 업스트림 경로 (docs/api/ops-assumed-contracts.md §9).
 *
 * 이 파일이 있는 이유는 `bff-confirmed-resource-paths.test.ts` 와 같다: 값이 본문이
 * 아니라 **경로**에 실리는 계약이라, `enabled ? 'enabled' : 'disabled'` 한 줄이 뒤집히면
 * 모든 변경이 반대 값을 쓴다. 그런데 라우트 테스트는 `@/lib/bff/client` 를 모킹해서 이
 * 아래를 못 보고, 목 어댑터는 boolean 을 그대로 받아 경로를 아예 타지 않는다. 화면은
 * 고른 값을 로컬 상태에서 그리므로 **실 BFF 에 붙기 전까지 아무도 눈치채지 못한다.**
 *
 * 본문이 없다는 것도 계약이라 함께 잰다 — 빈 객체라도 실으면 `Content-Type` 이 붙는다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const BASE = 'https://bff.example.com';

async function requestOf(enabled: boolean) {
  process.env.BFF_API_URL = BASE;
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(null, { status: 204 }));
  const { httpBff } = await import('@/lib/bff/http');
  await httpBff.targetSources.setDoesSupportRaw(1013, enabled);
  const [url, init] = fetchSpy.mock.calls[0] ?? [];
  return { path: String(url).replace(BASE, ''), init: init as RequestInit };
}

describe('httpBff.targetSources.setDoesSupportRaw — 값이 경로다', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  it('true 는 /enabled 로 PUT 한다', async () => {
    const { path, init } = await requestOf(true);
    expect(path).toBe('/install/v1/target-sources/1013/does-support-raw/enabled');
    expect(init.method).toBe('PUT');
  });

  it('false 는 /disabled 로 PUT 한다', async () => {
    const { path } = await requestOf(false);
    expect(path).toBe('/install/v1/target-sources/1013/does-support-raw/disabled');
  });

  it('본문 없이 보낸다', async () => {
    const { init } = await requestOf(true);
    expect(init.body).toBeUndefined();
  });
});
