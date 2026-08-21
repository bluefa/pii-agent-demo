import { describe, it, expect } from 'vitest';
import { parseAirflowHostBody } from '@/lib/bff/http';

/**
 * §11 은 "문자열 하나"라고만 말한다. 그 하나가 실제로 오는 모양이 둘이라 — JSON 문자열과
 * text/plain 날 문자열 — 한쪽만 읽으면 다른 쪽이 통째로 "주소 확인 불가"가 된다.
 */
describe('parseAirflowHostBody', () => {
  const url = 'https://airflow-prod.pii.internal/dags/pii_scan_review_media/grid';

  it('JSON 문자열 본문을 읽는다', () => {
    expect(parseAirflowHostBody(JSON.stringify(url))).toBe(url);
  });

  it('따옴표 없는 text/plain 본문도 읽는다 — res.json() 이 던지던 모양', () => {
    expect(parseAirflowHostBody(url)).toBe(url);
    expect(parseAirflowHostBody(`  ${url}\n`)).toBe(url);
  });

  it('빈 본문은 주소 없음', () => {
    expect(parseAirflowHostBody('')).toBe('');
    expect(parseAirflowHostBody('   ')).toBe('');
    expect(parseAirflowHostBody('""')).toBe('');
  });

  it('http/https 가 아닌 것은 주소로 세우지 않는다 — 이 값은 <a href> 가 된다', () => {
    expect(parseAirflowHostBody('javascript:alert(1)')).toBe('');
    expect(parseAirflowHostBody('"javascript:alert(1)"')).toBe('');
    expect(parseAirflowHostBody('<!doctype html><html>...')).toBe('');
    expect(parseAirflowHostBody('{"url":"https://airflow/x"}')).toBe('');
    expect(parseAirflowHostBody('null')).toBe('');
  });
});
