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
const TYPES: readonly PipelineType[] = ['INSTALL', 'DELETE', 'CUSTOM'];

describe('typeKo', () => {
  it('gives each type its own Korean word', () => {
    const words = TYPES.map(typeKo);
    expect(new Set(words).size).toBe(TYPES.length);
    for (const w of words) expect(w).toMatch(/^[가-힣]+$/);
  });
});

describe('PipelineTypeTag', () => {
  it.each(TYPES)('labels %s with the shared vocabulary, not the wire enum', (type) => {
    const html = renderToStaticMarkup(<PipelineTypeTag type={type} />);
    expect(html).toContain(typeKo(type));
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

    // 틴트는 <svg> 에만 붙어야 한다 — 바깥 <span>(라벨을 감싸는 쪽)이 아니라.
    const outer = html.slice(0, html.indexOf('<svg'));
    expect(outer).not.toContain('--pl-type-');
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
