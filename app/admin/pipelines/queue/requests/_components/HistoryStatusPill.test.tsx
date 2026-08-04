import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HistoryStatusPill } from '@/app/admin/pipelines/queue/requests/_components/HistoryStatusPill';

describe('HistoryStatusPill', () => {
  it('maps every approval-history enum to its label + tone', () => {
    const cases: Array<[string, string, string]> = [
      ['PENDING', '승인 대기', '--pl-warn-bg'],
      ['APPROVED', '승인', '--pl-ok-bg'],
      ['AUTO_APPROVED', '자동 승인', '--pl-ok-bg'],
      ['REJECTED', '반려', '--pl-err-bg'],
      ['CANCELLED', '취소', '--pl-off-bg'],
      ['UNAVAILABLE', '연동 불가', '--pl-err-bg'],
      ['UNAVAILABLE_ACKNOWLEDGED', '연동 불가 확인', '--pl-off-bg'],
    ];
    for (const [status, label, tone] of cases) {
      const html = renderToStaticMarkup(<HistoryStatusPill status={status} />);
      expect(html).toContain(label);
      expect(html).toContain(tone);
    }
  });

  // 라벨을 줄인 값은 전문을 title 로 들고 있어야 한다 — pill 은 원자적
  // inline-flex 라 컬럼을 넘치면 말줄임조차 붙지 않고, 복구 수단이 title 뿐이다.
  it('carries the long wording in the title when the label is abbreviated', () => {
    const html = renderToStaticMarkup(<HistoryStatusPill status="UNAVAILABLE_ACKNOWLEDGED" />);
    expect(html).toContain('title="연동 불가 확인 (서비스 측 담당자 확인)"');
  });

  it('falls back to a gray pill carrying the raw value for an unknown enum', () => {
    const html = renderToStaticMarkup(<HistoryStatusPill status="SOMETHING_NEW" />);
    expect(html).toContain('SOMETHING_NEW');
    expect(html).toContain('--pl-off-bg');
  });

  it('renders an em dash on a null status', () => {
    const html = renderToStaticMarkup(<HistoryStatusPill status={null} />);
    expect(html).toContain('—');
    expect(html).toContain('--pl-off-bg');
  });
});
