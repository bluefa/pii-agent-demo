/**
 * `countOf` 는 0건 저장 게이트의 입력이다 — 그래서 헬퍼가 아니라 가드로 취급하고 직접 잰다.
 *
 * 0건 저장은 삭제와 같은 결말인데(실측: 확정 10건인 대상에 빈 배열을 저장하면 201 이 오고
 * 조회가 404 가 된다) 삭제에는 게이트가 둘 있다 — 대상 id 입력, Terraform APPLIED 차단.
 * 그러므로 "0건인지 못 세는 경우"는 곧 게이트가 열리는 경우다. 목이 `resource_infos` 와
 * `resources` 두 키를 다 받으므로 두 키를 다 세야 한다.
 */
import { describe, expect, it } from 'vitest';
import { countOf } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmEditorModal';

describe('countOf — 0건 저장 게이트의 입력', () => {
  it('두 키의 빈 배열을 모두 0으로 센다 — 한 키만 세면 다른 키가 게이트를 통과한다', () => {
    expect(countOf({ resource_infos: [] })).toBe(0);
    expect(countOf({ resources: [] })).toBe(0);
  });

  it('두 키의 건수를 모두 센다', () => {
    expect(countOf({ resource_infos: [{ a: 1 }, { a: 2 }] })).toBe(2);
    expect(countOf({ resources: [{ a: 1 }] })).toBe(1);
  });

  it('둘 다 있으면 계약이 조회에 쓰는 이름을 먼저 본다', () => {
    expect(countOf({ resource_infos: [{ a: 1 }], resources: [] })).toBe(1);
  });

  it('셀 수 없으면 null 이다 — 계약이 모양을 말하지 않으므로 건수를 지어내지 않는다', () => {
    expect(countOf({})).toBeNull();
    expect(countOf({ resource_infos: {} })).toBeNull();
    expect(countOf({ other: [] })).toBeNull();
    expect(countOf([])).toBeNull();
    expect(countOf(null)).toBeNull();
    expect(countOf('x')).toBeNull();
  });
});
