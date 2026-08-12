import { describe, expect, it } from 'vitest';
import { readIsEosService } from '@/app/services/_components/ServiceManagementView';

/**
 * 계약에 없는 필드를 읽는 코드라 컴파일러가 지켜주지 않는다 — `ServiceItem` 에
 * `is_eos_service` 가 없으므로 키 이름을 잘못 적어도 tsc 는 아무 말 하지 않고,
 * 화면은 조용히 모든 서비스를 "운영 중"으로 그린다. 그 조용함이 이 테스트의 이유다.
 *
 * 짝이 되는 검증은 `app/api/v1/__tests__/user-services-page-route.test.ts` 에 있다:
 * 저쪽은 이 키가 zod 경계를 통과하는지를, 여기는 통과한 뒤 제대로 읽히는지를 잡는다.
 */
describe('readIsEosService', () => {
  it('와이어의 is_eos_service 를 그대로 읽는다', () => {
    expect(readIsEosService({ service_code: 'CSC', is_eos_service: true })).toBe(true);
    expect(readIsEosService({ service_code: 'CPN', is_eos_service: false })).toBe(false);
  });

  it('모른다는 false 가 아니다', () => {
    // 필드가 안 온 경우(계약 반영 전) · null(LOOSE 스키마) · 항목 자체가 없는 경우.
    expect(readIsEosService({ service_code: 'ADS' })).toBeUndefined();
    expect(readIsEosService({ is_eos_service: null })).toBeUndefined();
    expect(readIsEosService(undefined)).toBeUndefined();
    expect(readIsEosService(null)).toBeUndefined();
  });

  it('EOS 는 명시적 true 로만 성립한다', () => {
    // 문자열 "true" 나 1 이 EOS 로 승격되면, 오타 하나가 서비스를 미운영으로 만든다.
    for (const truthy of ['true', 1, 'TRUE', {}]) {
      expect(readIsEosService({ is_eos_service: truthy })).toBeUndefined();
    }
  });
});
