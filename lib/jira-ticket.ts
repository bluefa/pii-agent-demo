/**
 * JiraTicketResponse.issueKey → 화면 표시값과 열 주소.
 *
 * 연결할 때 입력하는 값은 티켓 키 문자열이지만, 조회 응답에는 티켓 주소
 * (`https://{domain}/path/BDCDIP-1231`)가 실려 온다. 화면은 마지막 `/` 뒤 조각만
 * 보여주고, 링크 주소는 받은 값을 그대로 쓴다 — 프론트가 도메인이나 경로를 조립하지
 * 않는다(계약은 `issueKey: string` 하나뿐이고 형식을 정하지 않는다,
 * docs/api/jira-tickets.md §1).
 */

export interface JiraLink {
  /** 화면에 쓰는 티켓 키 — 주소의 마지막 `/` 뒤 조각. */
  label: string;
  /** 열 수 있는 주소. null 이면 링크가 아니라 글자로 보여준다. */
  href: string | null;
}

/** http(s) 만 링크로 만든다 — javascript: 같은 스킴을 href 에 그대로 싣지 않기 위해서다. */
export function jiraTicketLink(issueKey: string): JiraLink {
  if (!/^https?:\/\//i.test(issueKey)) return { label: issueKey, href: null };
  const path = issueKey.split(/[?#]/)[0].replace(/\/+$/, '');
  return { label: path.slice(path.lastIndexOf('/') + 1) || issueKey, href: issueKey };
}
