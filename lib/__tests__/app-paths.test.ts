import { describe, expect, it } from 'vitest';
import { APP_BASE_PATH, stripAppBasePath, withAppBasePath } from '@/lib/app-paths';
import { toInternalInfraApiPath, toUpstreamInfraApiPath } from '@/lib/infra-api';

describe('app paths', () => {
  it('page 경로에 basePath를 한 번만 붙인다', () => {
    expect(withAppBasePath('/admin')).toBe(`${APP_BASE_PATH}/admin`);
    expect(withAppBasePath(`${APP_BASE_PATH}/admin`)).toBe(`${APP_BASE_PATH}/admin`);
  });

  it('현재 pathname에서 basePath를 제거해 라우트 비교에 쓸 수 있다', () => {
    expect(stripAppBasePath(`${APP_BASE_PATH}/admin`)).toBe('/admin');
    expect(stripAppBasePath(APP_BASE_PATH)).toBe('/');
  });

  it('internal infra API 경로에 basePath를 반영한다', () => {
    expect(toInternalInfraApiPath('/user/me')).toBe(`${APP_BASE_PATH}/api/infra/v1/user/me`);
    expect(toInternalInfraApiPath('/api/v1/user/me')).toBe(`${APP_BASE_PATH}/api/infra/v1/user/me`);
  });

  it('upstream infra API 경로에는 basePath를 붙이지 않는다', () => {
    expect(toUpstreamInfraApiPath('/v1/user/me')).toBe('/infra/v1/user/me');
  });
});
