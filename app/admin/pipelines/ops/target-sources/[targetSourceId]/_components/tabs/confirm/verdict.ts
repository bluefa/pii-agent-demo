/**
 * 확정 정보 탭의 판정 — 헤드라인 넷, 부제는 대조 결과 한 줄 (owner 2026-09-13).
 *
 * Three facts decide it, first match wins:
 *   확정 있음 + 3단계     → 재확정 필요
 *   확정 있음             → 확정됨 (installed targets included)
 *   확정 없음 + 승인 있음 → 확정 필요
 *   확정 없음             → 승인 필요
 *
 * The headline IS the state — no tag beside it, no 「상태」 kv in the card repeating it.
 * A running pipeline is not a headline: the 작업 줄 says that and the doors lock. Why
 * approval is missing (대기 · 반려 · 취소 …) is the chip on the 연동 요청 card. A failed
 * load is the tab's error banner, not a sentence here.
 */
export interface ConfirmVerdict {
  head: string;
  /** The reconcile result, or `null` when the two records cannot be compared. */
  sub: string | null;
}

/**
 * Why a matching list can still need 재확정 (owner 2026-09-12) — the join is by resource id,
 * not by value, so a field mismatch or a different selected RDS cluster instance hides behind
 * 「일치」.
 */
const LIST_MATCH_STILL_RECONFIRM =
  '리소스 목록은 승인 내용과 일치합니다. 목록이 일치해도 일부 필드 값이 다르거나 RDS Cluster에서 선택된 인스턴스가 다르면 재확정이 필요합니다.';

export function deriveConfirmVerdict(input: {
  confirmedCount: number;
  /** Step 3 (`CONFIRMING`) with a confirmed record already written. */
  reconfirmNeeded: boolean;
  /** An approved request exists — or the target has no approval axis at all (SDU). */
  approved: boolean;
  /** Rows that differ, or `null` when the records cannot be compared. `null` is not 0. */
  diffCount: number | null;
}): ConfirmVerdict {
  const { confirmedCount, reconfirmNeeded, approved, diffCount } = input;

  if (confirmedCount > 0) {
    const sub =
      diffCount == null ? null
        : diffCount > 0 ? `승인 내용과 차이가 ${diffCount}건 있습니다.`
          : reconfirmNeeded ? LIST_MATCH_STILL_RECONFIRM
            : '승인 내용과 리소스 목록이 일치합니다.';
    return { head: reconfirmNeeded ? '재확정 필요' : '확정됨', sub };
  }

  return { head: approved ? '확정 필요' : '승인 필요', sub: null };
}
