import { describe, expect, it } from 'vitest';
import { readDoesSupportRaw } from '@/lib/types';

/**
 * 계약에 아직 없는 필드를 읽는 코드라 컴파일러가 지켜주지 않는다 — `TargetSourceDetail`
 * 에도 `TargetSourceInfo` 에도 `does_support_raw` 가 없으므로, 키 이름을 잘못 적어도
 * tsc 는 아무 말 하지 않고 두 화면이 조용히 태그를 한 번도 그리지 않는다. 그 조용함이
 * 이 테스트의 이유다 (`readIsEosService` 와 같은 자리).
 */
describe('readDoesSupportRaw', () => {
  it('두 표기를 모두 읽는다', () => {
    // 이 값을 실어 나를 DTO 가 둘이고 표기가 갈린다 — TargetSourceDetail 은 snake,
    // TargetSourceInfo 는 camel 섬이다. 한쪽만 읽으면 화면 하나가 조용히 꺼진다.
    expect(readDoesSupportRaw({ does_support_raw: true })).toBe(true);
    expect(readDoesSupportRaw({ doesSupportRaw: true })).toBe(true);
  });

  it('모른다는 실데이터가 아니다', () => {
    // 필드가 안 온 경우(계약 반영 전) · null(LOOSE 스키마) · 항목 자체가 없는 경우.
    expect(readDoesSupportRaw({ target_source_id: 1013 })).toBe(false);
    expect(readDoesSupportRaw({ does_support_raw: null })).toBe(false);
    expect(readDoesSupportRaw({ does_support_raw: false })).toBe(false);
    expect(readDoesSupportRaw(undefined)).toBe(false);
    expect(readDoesSupportRaw(null)).toBe(false);
  });

  it('명시적 true 로만 성립한다', () => {
    // 문자열 "true" 나 1 이 승격되면, 오타 하나가 대상을 실데이터로 만든다.
    for (const truthy of ['true', 1, 'TRUE', {}]) {
      expect(readDoesSupportRaw({ does_support_raw: truthy })).toBe(false);
      expect(readDoesSupportRaw({ doesSupportRaw: truthy })).toBe(false);
    }
  });
});
