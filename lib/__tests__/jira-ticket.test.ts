import { describe, expect, it } from 'vitest';

import { safeBrowseUrl } from '@/lib/jira-ticket';

describe('safeBrowseUrl', () => {
  it('http(s) 주소는 그대로 연다', () => {
    expect(safeBrowseUrl('https://jira.example.com/browse/BDCDIP-12312')).toBe(
      'https://jira.example.com/browse/BDCDIP-12312',
    );
  });

  it('없으면 링크를 만들지 않는다 — 도메인을 프론트가 지어내지 않는다', () => {
    expect(safeBrowseUrl(null)).toBeNull();
    expect(safeBrowseUrl(undefined)).toBeNull();
    expect(safeBrowseUrl('')).toBeNull();
  });

  it('http(s) 가 아닌 스킴은 href 로 싣지 않는다', () => {
    expect(safeBrowseUrl('javascript:alert(1)')).toBeNull();
  });
});
