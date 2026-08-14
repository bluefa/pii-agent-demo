import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { StatusText, TargetCell } from '@/app/admin/pipelines/_dashboard/cells';
import type { PipelineStatus } from '@/lib/pipeline/types';

const status = (value: PipelineStatus): string =>
  renderToStaticMarkup(<StatusText status={value} />);

const target = (over: Partial<Parameters<typeof TargetCell>[0]> = {}): string =>
  renderToStaticMarkup(
    <TargetCell
      name="PII Agent 설치 - 고객 DB"
      code="IRP"
      targetId="1023"
      provider="AWS"
      {...over}
    />,
  );

describe('StatusText', () => {
  it('says the status in Korean, not the wire enum', () => {
    expect(status('PENDING')).toContain('대기');
    expect(status('RUNNING')).toContain('실행 중');
    expect(status('DONE')).toContain('완료');
    expect(status('FAILED')).toContain('실패');
    expect(status('CANCELLED')).toContain('중단');
  });

  it('leaves no wire enum on screen', () => {
    const wire: readonly PipelineStatus[] = ['PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED'];
    for (const value of wire) {
      // The class strings are tokens, not copy — only the text node is checked.
      const text = status(value).replace(/<[^>]*>/g, '');
      expect(text).not.toContain(value);
    }
  });

  /**
   * 오너 2026-08-14, "색상이 강하지 않게": 실패만 색상을 갖고 나머지는 명도로만
   * 갈린다. 이 표에서 색이 켜져 있는 행이 곧 손이 필요한 행이라는 규칙이라,
   * 완료에 초록이 돌아오면 그 규칙이 조용히 깨진다.
   */
  it('spends its only hue on 실패', () => {
    expect(status('FAILED')).toContain('--pl-err-text');
    for (const quiet of ['PENDING', 'RUNNING', 'DONE', 'CANCELLED'] as const) {
      expect(status(quiet)).not.toContain('--pl-err');
      expect(status(quiet)).not.toContain('--pl-ok');
      expect(status(quiet)).not.toContain('--pl-info');
    }
  });

  it('separates 실행 중 from the settled states by weight', () => {
    expect(status('RUNNING')).toContain('--pl-text-medium');
    expect(status('DONE')).toContain('--pl-text-weak');
    expect(status('PENDING')).toContain('--pl-text-weak');
  });
});

describe('TargetCell', () => {
  /**
   * 식별자가 1행, 서비스 이름이 2행 (오너 2026-08-14). 이름을 위로 올리면 여러 행이
   * 같은 이름을 이고 있어 가장 큰 글자가 행을 구별해 주지 못한다.
   */
  it('leads with the Target Source identifier and puts the name under it', () => {
    const html = target();
    expect(html.indexOf('TargetSource #1023')).toBeGreaterThan(-1);
    expect(html.indexOf('TargetSource #1023')).toBeLessThan(
      html.indexOf('PII Agent 설치 - 고객 DB'),
    );
    expect(html).toContain('코드: IRP');
  });

  it('names the provider for a reader who cannot see the glyph', () => {
    expect(target({ provider: 'AWS' })).toContain('aria-label="AWS"');
    expect(target({ provider: 'AWS', isSdu: true })).toContain('aria-label="SDU"');
  });

  /**
   * `ProviderGlyph` 는 UNKNOWN 에서 null 을 돌려준다. 슬롯이 폭을 잃으면 마크 없는
   * 행만 글자가 왼쪽으로 당겨져 열이 어긋나므로, 빈 슬롯도 자리를 지켜야 한다.
   */
  it('keeps the mark slot even when the provider has no glyph', () => {
    expect(target({ provider: 'UNKNOWN' })).toContain('w-[18px]');
  });
});
