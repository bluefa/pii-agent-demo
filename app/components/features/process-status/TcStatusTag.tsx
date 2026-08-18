import type { ReactElement } from 'react';
import { cn, idcStyles, textColors } from '@/lib/theme';
import type { UnitTcStatus } from '@/lib/test-connection-summary';

/**
 * 연결 상태 칸의 내용 — Step 5 의 표가 한 리소스에 대해 말하는 판정 하나.
 *
 * 클라우드 카드(`ConnectionTestCard`)와 IDC 표(`IdcResourceTable`)가 **같은 것을 쓴다**.
 * 어휘는 접기 유틸의 판정을 그대로 옮긴 것이다:
 *   - 대기 = agent 가 PENDING 을 보고한 행. 보고 자체가 없는 행은 `—` 다(무보고).
 *   - 미확인 = 계약 밖 값. 세 사실을 전부 '대기' 로 접던 것이 P4 였다.
 * 이 칸은 **에이전트가 보고한 결과만** 말한다 — Credential 미설정 같은 사실을 겹쳐 쓰면
 * 실제로 연결된 대상이 그 말에 가려진다.
 *
 * 첫 폴링이 끝나기 전에는 이 칸에 대한 사실이 아직 없다. 그 사이의 `—`(무보고)와 '대기'는
 * 판정처럼 읽히고 응답이 오면 곧바로 뒤집히므로, 모르는 동안은 들어설 칩과 같은 크기의
 * 스켈레톤을 둔다.
 */
export function TcStatusTag({
  status,
  loading = false,
}: {
  status: UnitTcStatus | undefined;
  /** 첫 폴링 응답 전 — 판정 대신 스켈레톤. */
  loading?: boolean;
}): ReactElement {
  if (loading) {
    return (
      <span
        className={cn(idcStyles.skeletonBar, 'block h-[26px] w-[52px] rounded-lg')}
        aria-hidden="true"
      />
    );
  }
  switch (status) {
    case 'SUCCESS':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.green)}>성공</span>;
    case 'FAIL':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.red)}>실패</span>;
    case 'RUNNING':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.orange)}>진행 중</span>;
    case 'PENDING':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.gray)}>대기</span>;
    case 'UNKNOWN':
      return <span className={cn(idcStyles.tag.base, idcStyles.tag.gray)}>미확인</span>;
    default:
      return <span className={cn('text-[12px]', textColors.tertiary)}>—</span>;
  }
}
