import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { StatusText, TargetCell } from '@/app/admin/pipelines/_dashboard/cells';
import { pipelineStyles } from '@/lib/theme';
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
   * 색을 받는 상태는 넷이다 — 실패 빨강, 완료 초록, 실행 중 파랑(오너 2026-08-14),
   * 중단 노랑(오너 2026-08-15). 넷이 서로 다른 토큰을 쓰는지가 이 자리의 요점이다:
   * 두 상태가 같은 색으로 접히면 열이 그만큼 덜 말한다.
   *
   * 실행 중의 파랑은 스트립의 진행 칸과 **같은 토큰**이다 — 한 행에서 "지금 여기"를
   * 말하는 두 자리가 서로 다른 파랑을 쓰면 같은 뜻으로 읽히지 않는다.
   */
  it('gives each of the four non-idle states its own hue', () => {
    expect(status('FAILED')).toContain('--pl-err-text');
    expect(status('DONE')).toContain('--pl-ok-text');
    expect(status('RUNNING')).toContain('--pl-info-text');
    expect(status('CANCELLED')).toContain('--pl-warn-text');

    const tone = pipelineStyles.dashboard.statusTextTone;
    const hues = ['FAILED', 'DONE', 'RUNNING', 'CANCELLED'] as const;
    expect(new Set(hues.map((k) => tone[k])).size).toBe(hues.length);
    // IN_PROGRESS 는 톤 맵에만 있는 키(`PipelineStatus` 밖)라 렌더로 닿지 않는다.
    // 같은 뜻인 두 키가 갈라지는 것이 정확히 이 자리의 버그다.
    expect(tone.IN_PROGRESS).toBe(tone.RUNNING);
  });

  /** 회색은 대기 하나만 남았다 — 색이 없다는 것이 "아직 시작하지 않았다"만 뜻한다. */
  it('leaves 대기 as the only uncoloured state', () => {
    const html = status('PENDING');
    expect(html).toContain('--pl-text-weak');
    for (const hue of ['--pl-err', '--pl-ok', '--pl-info', '--pl-warn']) {
      expect(html).not.toContain(hue);
    }
  });

  /**
   * 중단의 `stop` 마크는 색 예산을 아끼려던 우회로였다(오너 2026-08-15 에 노랑으로 뒤집힘).
   * 색이 그 일을 하는 지금 마크는 같은 말을 두 번 하는 것이라, 어느 상태에도 글리프가 없다.
   */
  it('renders no glyph in any state now that colour carries it', () => {
    for (const value of ['PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED'] as const) {
      expect(status(value), value).not.toContain('<svg');
    }
  });
});

describe('TargetCell', () => {
  /**
   * 식별자가 1행, 서비스 이름이 2행 (오너 2026-08-14). 이름을 위로 올리면 여러 행이
   * 같은 이름을 이고 있어 가장 큰 글자가 행을 구별해 주지 못한다.
   */
  it('leads with the Target identifier and puts the name under it', () => {
    const html = target();
    expect(html.indexOf('Target #')).toBeGreaterThan(-1);
    expect(html.indexOf('Target #')).toBeLessThan(html.indexOf('PII Agent 설치 - 고객 DB'));
    expect(html).toContain('코드:');
    expect(html).toContain('IRP');
  });

  /**
   * 1행은 라벨·값 쌍 둘이다 (오너): 라벨("Target #", "코드:")은 12px 문맥에 남고
   * 값(1023, IRP)만 14/600 으로 올라선다. 라벨이 값과 같은 단으로 올라오면 한 줄에
   * 강조가 넷이 되어 아무것도 강조되지 않는다.
   */
  it('raises the two values and leaves their labels as context', () => {
    const html = target();
    for (const value of ['1023', 'IRP']) {
      const span = html.match(new RegExp(`<span class="([^"]*)">${value}</span>`));
      expect(span?.[1], value).toContain('text-[14px]');
      expect(span?.[1], value).toContain('font-semibold');
    }
    for (const label of ['Target #', '코드: ']) {
      const span = html.match(new RegExp(`<span class="([^"]*)">${label}<span`));
      expect(span?.[1], label).toContain('text-[12px]');
      expect(span?.[1], label).not.toContain('font-semibold');
    }
  });

  /**
   * 부모의 `group-hover` 는 자식이 자기 색을 선언하는 순간 거기서 끊긴다. 번호에도
   * 직접 얹지 않으면 "Target #" 만 파래지고 정작 식별자인 번호는 검게 남는다.
   */
  it('turns the whole Target identifier to link colour on row hover, number included', () => {
    const html = target();
    const num = html.match(/<span class="([^"]*)">1023<\/span>/);
    expect(num?.[1]).toContain('group-hover:text-[var(--pl-info-text)]');
  });

  /**
   * 이 열에서 색을 가진 건 마크뿐이다 (오너 2026-08-14). 상태 색을 페이지당 두 낱말로
   * 줄이고 남은 자리를 마크에 준 것이라, 로고는 상태 채널을 잠식하지 않는다 — 로고는
   * 실행이 어떻게 되어가는지에 대해 아무 말도 하지 않기 때문이다.
   *
   * 브랜드 색 자체(주황·구글 4색·Azure 파랑)는 여기서 세지 않는다. 세는 것은 마크가
   * 여러 색 경로를 유지하고 있는지다 — mono 로 되돌아가면 0 이 된다.
   */
  const brandFills = (html: string): string[] => html.match(/fill="#[0-9A-F]{6}"/gi) ?? [];

  it('gives the three public clouds their own brand marks', () => {
    expect(brandFills(target({ provider: 'AWS' }))).toHaveLength(2); // 워드마크 + 스마일
    expect(brandFills(target({ provider: 'GCP' }))).toHaveLength(4); // 구글 4색
    expect(brandFills(target({ provider: 'AZURE' }))).toHaveLength(3);
  });

  it('leaves IDC and SDU on the column colour — neither has a brand', () => {
    for (const html of [target({ provider: 'IDC' }), target({ provider: 'AWS', isSdu: true })]) {
      expect(brandFills(html)).toHaveLength(0);
      expect(html).toContain('currentColor');
    }
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
    expect(target({ provider: 'UNKNOWN' })).toContain('flex-none w-5');
  });
});
