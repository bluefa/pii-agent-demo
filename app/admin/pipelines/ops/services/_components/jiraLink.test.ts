import { describe, expect, it } from 'vitest';

import { jiraTicketLink } from '@/app/admin/pipelines/ops/services/_components/jiraLink';

describe('jiraTicketLink', () => {
  it('티켓 주소는 마지막 조각만 보여주고 값 그대로 연다', () => {
    expect(jiraTicketLink('https://jira.example.com/some/path/BDCDIP-12312')).toEqual({
      label: 'BDCDIP-12312',
      href: 'https://jira.example.com/some/path/BDCDIP-12312',
    });
  });

  it('쿼리·해시·끝 슬래시가 붙어도 키를 뽑는다', () => {
    expect(jiraTicketLink('https://jira.example.com/browse/BDCDIP-1/?focus=1#c2').label).toBe(
      'BDCDIP-1',
    );
  });

  it('주소가 아니라 키가 오면 링크로 만들지 않는다 — 도메인을 프론트가 지어내지 않는다', () => {
    expect(jiraTicketLink('BDCDIP-12312')).toEqual({ label: 'BDCDIP-12312', href: null });
  });

  it('http(s) 가 아닌 스킴은 href 로 싣지 않는다', () => {
    expect(jiraTicketLink('javascript:alert(1)').href).toBeNull();
  });
});
