import { describe, expect, it } from 'vitest';
import { schemas } from '@/lib/generated/install-v1';
import { readSupportRawData } from '@/lib/types';

/**
 * 이 응답들이 아직 선언하지 않은 필드를 읽는 코드라 컴파일러가 지켜주지 않는다 —
 * `TargetSourceDetail` 에도 `TargetSourceInfo` 에도 `supportRawData` 가 없으므로,
 * 키 이름을 잘못 적어도 tsc 는 아무 말 하지 않고 두 화면이 조용히 값을 한 번도
 * 그리지 않는다. 그 조용함이 이 테스트의 이유다 (`readIsEosService` 와 같은 자리).
 */
describe('readSupportRawData', () => {
  it('계약이 선언한 표기 하나만 읽는다', () => {
    expect(readSupportRawData({ supportRawData: true })).toBe(true);
    expect(readSupportRawData({ supportRawData: false })).toBe(false);
    // 계약 밖의 철자는 읽지 않는다 — 읽으면 한 사실에 이름이 둘이라고 말하는 셈이고,
    // `doesSupportRaw` 는 실제로 한 번 그렇게 들어왔던 이름이다.
    expect(readSupportRawData({ support_raw_data: true })).toBeUndefined();
    expect(readSupportRawData({ doesSupportRaw: true })).toBeUndefined();
  });

  it('없는 값은 false 가 아니라 모른다', () => {
    // 이 셋을 false 로 접으면 대상 운영 헤더가 읽은 적 없는 값을 "미포함" 으로 단정한다.
    expect(readSupportRawData({ target_source_id: 1013 })).toBeUndefined();
    expect(readSupportRawData({ supportRawData: null })).toBeUndefined();
    expect(readSupportRawData(undefined)).toBeUndefined();
    expect(readSupportRawData(null)).toBeUndefined();
  });

  /**
   * 계약과의 어긋남을 잡는 트립와이어. 위 테스트들은 리터럴 키를 넣고 리터럴 키를
   * 읽으므로, 업스트림이 필드 이름을 바꾸고 `gen:api` 가 그걸 받아와도 전부 초록이다
   * — 리더는 그냥 `undefined` 를 돌려주고 두 화면이 조용히 꺼진다. #721 이 계약에 없는
   * 이름으로 머지될 수 있었던 것도 이 자리에 아무것도 없었기 때문이다.
   *
   * 리터럴을 한 번 더 적는 대신 **선언된 키 중 리더가 반응하는 것**을 세서, 리더 쪽을
   * 고쳐도 계약 쪽이 바뀌어도 양방향으로 걸리게 한다. 우리가 파스하는 두 응답
   * (`TargetSourceDetail`·`TargetSourceInfo`)은 이 필드를 아직 선언하지 않으므로,
   * 계약이 이름을 말하는 형제 응답에 묻는다.
   */
  it('리더가 반응하는 키는 계약이 선언한 그 키다', () => {
    const declared = Object.keys(schemas.TargetSourceResponse.shape);
    expect(declared.filter((key) => readSupportRawData({ [key]: true }) === true)).toEqual([
      'supportRawData',
    ]);
  });

  it('boolean 이 아닌 값은 승격되지 않는다', () => {
    // 문자열 "true" 나 1 이 참으로 읽히면, 오타 하나가 대상을 실데이터로 만든다.
    for (const truthy of ['true', 1, 'TRUE', {}]) {
      expect(readSupportRawData({ supportRawData: truthy })).toBeUndefined();
    }
  });
});
