// @vitest-environment jsdom
/**
 * 빈 목록에는 이유가 둘이고, 검색 miss 는 그중 하나일 뿐이다.
 *
 * `owners` 는 계약상 **잘려 올 수 있고**(`ownerCount` 만 언제나 맞는 전체 수), 호출부
 * 게이트는 `ownerCount === 0` 만 본다. 그래서 이름이 하나도 안 온 채로 수는 5 인 응답이
 * 모달까지 도달한다 — 그때 검색어가 없는데도 `‘’와 일치하는 담당자가 없습니다` 를 그리면
 * 하지도 않은 검색이 실패한 것처럼 읽힌다.
 *
 * 지금 목은 27행 모두 `len(owners) === owner_count` 라 이 경로를 타지 않는다. 개발에서
 * 안 보이는 결함이라 테스트가 유일한 파수꾼이다.
 *
 * 이 저장소에는 RTL 자동 cleanup 이 없다 — 모든 render 는 스스로 unmount 한다.
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { OwnersModal } from '@/app/admin/pipelines/access/_components/AccessModals';

const open = (owners: string[], ownerCount: number) =>
  render(
    <OwnersModal
      open
      onClose={() => {}}
      serviceCode="CPN"
      serviceName="쿠폰·프로모션 발급 정산"
      owners={owners}
      ownerCount={ownerCount}
    />,
  );

describe('담당자 모달의 빈 상태', () => {
  it('이름이 하나도 안 왔으면 검색 miss 로 말하지 않는다', () => {
    const { baseElement, unmount } = open([], 5);
    const text = baseElement.textContent ?? '';

    expect(text).not.toContain('일치하는 담당자가 없습니다');
    // 아는 것은 수뿐이다. 그 수를 말하고, 이름은 지어내지 않는다.
    expect(text).toContain('담당자 5명이 있지만 이름이 오지 않았어요');
    // `여기` 가 비어 있으므로 `여기 없는 …` 은 가리킬 곳이 없다.
    expect(text).not.toContain('여기 없는 담당자가');
    unmount();
  });

  it('이름이 왔는데 잘렸으면 각주로 남은 수를 말한다', () => {
    const { baseElement, unmount } = open(['gildong.hong', 'sujin.jung'], 5);
    const text = baseElement.textContent ?? '';

    expect(text).toContain('gildong.hong');
    expect(text).toContain('여기 없는 담당자가 3명 더 있어요');
    expect(text).not.toContain('이름이 오지 않았어요');
    unmount();
  });
});
