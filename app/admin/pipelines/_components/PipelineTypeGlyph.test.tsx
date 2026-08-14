import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { PipelineTypeTag } from '@/app/admin/pipelines/_components/PipelineTypeTag';
import { TypeTile } from '@/app/admin/pipelines/_detail/r24Task';
import type { PipelineType } from '@/lib/pipeline/types';

/**
 * 유형→글리프 매핑의 회귀 가드. 아이콘 이름은 DOM 에 남지 않으므로 각 글리프에서
 * 그 글리프에만 있는 path 조각으로 검사한다.
 *
 * `install` 은 세트에 남아 있다 — 유형이 아닌 뜻으로 쓰는 소비자가 셋 있기 때문이다
 * (ConfirmedInfoCard 제목·빈 상태, RequestTab 빈 상태). 그래서 되돌아갈 수 있는 값이고,
 * 되돌아가면 여기서 죽어야 한다. `sliders` 는 세트에서 지웠으므로 타입이 먼저 막는다.
 */
const GEOMETRY = {
  'package-plus': 'M19 14v6', // + 의 세로획
  blocks: '<rect x="14" y="2"', // 떨어져 있는 작은 사각형
  trash: 'M4.5 7h15', // 뚜껑 선
  install: 'M12 3.5V13', // 옛 INSTALL — 받침대로 내려오던 화살표
} as const;

const EXPECTED: Record<PipelineType, keyof typeof GEOMETRY> = {
  INSTALL: 'package-plus',
  DELETE: 'trash',
  CUSTOM: 'blocks',
};

const SURFACES = {
  PipelineTypeTag: (type: PipelineType) => renderToStaticMarkup(<PipelineTypeTag type={type} />),
  TypeTile: (type: PipelineType) => renderToStaticMarkup(<TypeTile type={type} />),
} as const;

describe('pipeline type glyphs', () => {
  for (const [surface, render] of Object.entries(SURFACES)) {
    describe(surface, () => {
      it.each(Object.keys(EXPECTED) as PipelineType[])('draws the %s glyph', (type) => {
        const html = render(type);
        const mine = EXPECTED[type];
        expect(html).toContain(GEOMETRY[mine]);

        // 다른 유형의 글리프가 섞여 들어오지 않는다.
        for (const [name, fragment] of Object.entries(GEOMETRY)) {
          if (name !== mine) expect(html, `${type} must not draw ${name}`).not.toContain(fragment);
        }
      });
    });
  }

  /**
   * 두 표면이 갈라지는 것이 이 자리의 실제 버그다 — 한쪽만 고치면 목록과 상세가
   * 같은 파이프라인을 다른 그림으로 말한다.
   */
  it('keeps the two surfaces on the same mapping', () => {
    for (const type of Object.keys(EXPECTED) as PipelineType[]) {
      const fragment = GEOMETRY[EXPECTED[type]];
      expect(SURFACES.PipelineTypeTag(type)).toContain(fragment);
      expect(SURFACES.TypeTile(type)).toContain(fragment);
    }
  });
});
