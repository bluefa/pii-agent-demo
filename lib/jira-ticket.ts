/**
 * JiraTicketResponse.browseUrl → 열어도 되는 주소.
 *
 * v5 계약부터 열 주소는 BFF 가 `browseUrl` 로 조립해 싣는다 — 프론트는 issueKey 를
 * 파싱하거나 도메인·경로를 조립하지 않는다(그 순간 Jira 도메인이 바뀔 때마다 프론트가
 * 같이 깨진다). 여기서 지키는 건 스킴 하나다: http(s) 가 아니면(`javascript:` 등)
 * href 에 싣지 않고 null 을 돌려준다 — 그때 화면은 링크가 아니라 글자로 보여준다.
 */
export function safeBrowseUrl(browseUrl: string | null | undefined): string | null {
  return browseUrl && /^https?:\/\//i.test(browseUrl) ? browseUrl : null;
}
