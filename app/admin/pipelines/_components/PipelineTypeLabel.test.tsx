import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { PipelineTypeTag } from '@/app/admin/pipelines/_components/PipelineTypeTag';
import { typeKo } from '@/lib/pipeline/format';
import type { PipelineType } from '@/lib/pipeline/types';

/**
 * 작업 유형의 **낱말과 색**을 지키는 가드 (오너 2026-08-15).
 *
 * 이 화면이 실제로 앓았던 병은 한 enum 이 네 개의 어휘를 갖고 있었던 것이다 —
 * 목록은 `INSTALL`, 상세는 `설치`, 모달은 `Custom`, 카드는 `Custom 작업`. 그래서
 * 검사 대상은 "라벨이 한글인가"가 아니라 **모두가 같은 한 벌을 쓰는가** 다.
 */
/** 오너가 고른 낱말 그대로. 여기서 자유도를 주면 `배포`/`제거`/`수동` 같은 오역이
 *  통과하고, 같은 함수를 읽는 태그 검사까지 함께 통과해 버린다. */
const EXPECTED: Record<PipelineType, string> = {
  INSTALL: '설치',
  DELETE: '삭제',
  CUSTOM: '커스텀',
};
const TYPES = Object.keys(EXPECTED) as PipelineType[];

describe('typeKo', () => {
  it.each(TYPES)('calls %s by the word the owner chose', (type) => {
    expect(typeKo(type)).toBe(EXPECTED[type]);
  });
});

describe('PipelineTypeTag', () => {
  it.each(TYPES)('labels %s with the shared vocabulary, not the wire enum', (type) => {
    const html = renderToStaticMarkup(<PipelineTypeTag type={type} />);
    expect(html).toContain(EXPECTED[type]);
    // enum 원문은 데이터 표기(TypePill)의 몫이다. 여기 남아 있으면 목록만
    // 다시 영어로 돌아간 것이고, 필터 메뉴와 어긋난다.
    expect(html).not.toContain(type);
  });

  /**
   * 색은 글리프만 입는다. 라벨까지 물들면 2026-08-14 에 틴트를 걷어낸 이유
   * (유형이 색으로도 말해 채널이 셋이 됨)로 그대로 되돌아간다.
   */
  it.each(TYPES)('tints only the %s glyph, and with that type’s own token', (type) => {
    const html = renderToStaticMarkup(<PipelineTypeTag type={type} />);
    const tint = `text-[var(--pl-type-${type.toLowerCase()})]`;
    expect(html).toContain(tint);

    // <svg> 를 통째로 들어내고 남은 마크업 — 즉 라벨을 감싸는 모든 것 — 에는 유형
    // 토큰이 없어야 한다. 앞부분만 자르면 라벨을 뒤에서 감싸는 회귀를 놓친다.
    const withoutGlyph = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
    expect(withoutGlyph).not.toContain('--pl-type-');
    expect(withoutGlyph).toContain(EXPECTED[type]); // 라벨은 그대로 남아 있다
  });

  it('keeps the three tints distinct', () => {
    const tints = TYPES.map((type) => {
      const html = renderToStaticMarkup(<PipelineTypeTag type={type} />);
      return /--pl-type-[a-z]+/.exec(html)?.[0];
    });
    expect(new Set(tints).size).toBe(TYPES.length);
  });

  it('draws the glyph at 20px (오너 2026-08-15, 14 에서 상향)', () => {
    const html = renderToStaticMarkup(<PipelineTypeTag type="INSTALL" />);
    expect(html).toContain('width="20"');
    expect(html).toContain('height="20"');
  });
});
