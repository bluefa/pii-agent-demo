import { describe, expect, it } from 'vitest';
import { deriveConfirmVerdict } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/verdict';

const base = { confirmedCount: 0, reconfirmNeeded: false, approved: false, diffCount: null } as const;

describe('deriveConfirmVerdict — 헤드라인 넷, 부제는 대조 한 줄', () => {
  it('확정 없음 · 승인 없음 → 승인 필요', () => {
    expect(deriveConfirmVerdict(base)).toEqual({ head: '승인 필요', sub: null });
  });

  it('확정 없음 · 승인 있음(또는 승인 축 없음) → 확정 필요', () => {
    expect(deriveConfirmVerdict({ ...base, approved: true })).toEqual({ head: '확정 필요', sub: null });
  });

  it('확정 있음 → 확정됨, 부제는 대조 결과', () => {
    expect(deriveConfirmVerdict({ ...base, confirmedCount: 3 })).toEqual({ head: '확정됨', sub: null });
    expect(deriveConfirmVerdict({ ...base, confirmedCount: 3, approved: true, diffCount: 0 }).sub)
      .toBe('승인 내용과 리소스 목록이 일치합니다.');
    expect(deriveConfirmVerdict({ ...base, confirmedCount: 3, approved: true, diffCount: 2 }).sub)
      .toBe('승인 내용과 차이가 2건 있습니다.');
  });

  it('확정 있음 · 3단계 → 재확정 필요, 목록이 일치해도 그 이유를 말한다', () => {
    const v = deriveConfirmVerdict({ ...base, confirmedCount: 3, reconfirmNeeded: true, approved: true, diffCount: 0 });
    expect(v.head).toBe('재확정 필요');
    expect(v.sub).toContain('RDS Cluster');
    expect(deriveConfirmVerdict({ ...base, confirmedCount: 3, reconfirmNeeded: true, diffCount: 1 }).sub)
      .toBe('승인 내용과 차이가 1건 있습니다.');
    // 승인이 없어도 기록이 있으면 기록의 상태를 말한다 — 대조는 없다.
    expect(deriveConfirmVerdict({ ...base, confirmedCount: 3, reconfirmNeeded: true }))
      .toEqual({ head: '재확정 필요', sub: null });
  });
});
