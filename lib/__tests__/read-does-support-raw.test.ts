import { describe, expect, it } from 'vitest';
import { readDoesSupportRaw } from '@/lib/types';

/**
 * 계약에 아직 없는 필드를 읽는 코드라 컴파일러가 지켜주지 않는다 — `TargetSourceDetail`
 * 에도 `TargetSourceInfo` 에도 `doesSupportRaw` 가 없으므로, 키 이름을 잘못 적어도
 * tsc 는 아무 말 하지 않고 두 화면이 조용히 값을 한 번도 그리지 않는다. 그 조용함이
 * 이 테스트의 이유다 (`readIsEosService` 와 같은 자리).
 */
describe('readDoesSupportRaw', () => {
  it('BE 가 확인해 준 표기는 camelCase 하나다', () => {
    expect(readDoesSupportRaw({ doesSupportRaw: true })).toBe(true);
    expect(readDoesSupportRaw({ doesSupportRaw: false })).toBe(false);
    // snake 는 더 이상 읽지 않는다 — 읽으면 계약이 두 표기를 허용한다고 말하는 셈이다.
    expect(readDoesSupportRaw({ does_support_raw: true })).toBeUndefined();
  });

  it('없는 값은 false 가 아니라 모른다', () => {
    // 이 셋을 false 로 접으면 대상 운영 헤더가 읽은 적 없는 값을 "미포함" 으로 단정한다.
    expect(readDoesSupportRaw({ target_source_id: 1013 })).toBeUndefined();
    expect(readDoesSupportRaw({ doesSupportRaw: null })).toBeUndefined();
    expect(readDoesSupportRaw(undefined)).toBeUndefined();
    expect(readDoesSupportRaw(null)).toBeUndefined();
  });

  it('boolean 이 아닌 값은 승격되지 않는다', () => {
    // 문자열 "true" 나 1 이 참으로 읽히면, 오타 하나가 대상을 실데이터로 만든다.
    for (const truthy of ['true', 1, 'TRUE', {}]) {
      expect(readDoesSupportRaw({ doesSupportRaw: truthy })).toBeUndefined();
    }
  });
});
