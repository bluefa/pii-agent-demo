import type { ReactElement } from 'react';
import { cn, idcStyles } from '@/lib/theme';
import type { UnitTcStatus } from '@/lib/test-connection-summary';

/**
 * 연결 상태 칸의 내용 — Step 5 의 표가 한 리소스에 대해 말하는 판정 하나.
 *
 * 클라우드 카드(`ConnectionTestCard`)와 IDC 표(`IdcResourceTable`)가 **같은 것을 쓴다**.
 * 어휘는 접기 유틸의 판정을 그대로 옮긴 것이다:
 *   - 대기 = agent 가 PENDING 을 보고한 행.
 *   - 미보고 = 실행은 있었는데 이 행에 대한 보고가 없다. 카드 카운트 줄의 '미보고 N' 이
 *     세는 바로 그 행들이라, 같은 말을 써야 요약의 숫자와 표의 행이 이어진다.
 *   - 미실행 = 아직 아무 회차도 없다. 실행이 없는데 '미보고' 라 하면 보고 의무가 있었던
 *     것처럼 읽힌다 — 없는 사실을 만들지 않는다. 그래서 `hasRun` 이 필요하다.
 *   - 미확인 = 계약 밖 값. 세 사실을 전부 '대기' 로 접던 것이 P4 였다.
 *
 * **이 칸은 전부 태그다.** 판정이 없는 행만 맨 `—` 로 두면, 알약이 늘어선 열에서 그 행은
 * "값이 없다" 가 아니라 "이 행은 다른 종류다" 로 읽힌다. 없음도 하나의 상태이므로 중립
 * 태그가 그 자리를 지킨다 — 열의 모양이 행마다 바뀌지 않는 것 자체가 정보다.
 * 이 칸은 **에이전트가 보고한 결과만** 말한다 — Credential 미설정 같은 사실을 겹쳐 쓰면
 * 실제로 연결된 대상이 그 말에 가려진다.
 *
 * 첫 폴링이 끝나기 전에는 이 칸에 대한 사실이 아직 없다. 그 사이의 `—`(무보고)와 '대기'는
 * 판정처럼 읽히고 응답이 오면 곧바로 뒤집히므로, 모르는 동안은 들어설 칩과 같은 크기의
 * 스켈레톤을 둔다.
 */
export function TcStatusTag({
  status,
  hasRun,
  loading = false,
}: {
  status: UnitTcStatus | undefined;
  /** 이 대상에 실행 회차가 하나라도 있는가 — 미보고와 미실행을 가르는 유일한 근거. */
  hasRun: boolean;
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
      return (
        <span className={cn(idcStyles.tag.base, idcStyles.tag.gray)}>
          {hasRun ? '미보고' : '미실행'}
        </span>
      );
  }
}
