/**
 * 부재(추천값이 없다) ↔ 실패(못 봤다) 판정. 이 판정이 코드 문자열로 되어 있을 때 **목에서만
 * 맞았다** — 목은 `TARGET_SOURCE_NOT_FOUND` 를 보내고 그 코드는 `KNOWN_ERROR_CODES` 에 없어
 * `NOT_FOUND` 로 떨어지지만, 허용 목록에 있는 코드는 그대로 보존된다(lib/fetch-json.ts).
 * 그래서 목 테스트로는 절대 드러나지 않는다.
 */
import { describe, expect, it } from 'vitest';
import { AppError, type AppErrorCode } from '@/lib/errors';
import { isRecommendationAbsent } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmEditorModal';

const err = (status: number, code: AppErrorCode): AppError =>
  new AppError({ status, code, message: 'x', retriable: false });

describe('isRecommendationAbsent — 부재는 status 로 판정한다', () => {
  it('허용 목록에 있는 404 코드도 부재로 읽는다 — 코드로 보면 여기서 뒤집힌다', () => {
    expect(isRecommendationAbsent(err(404, 'CONFIRMED_INTEGRATION_NOT_FOUND'))).toBe(true);
    expect(isRecommendationAbsent(err(404, 'APPROVED_INTEGRATION_NOT_FOUND'))).toBe(true);
  });

  it('목이 만드는 404(코드가 NOT_FOUND 로 떨어진 것)도 그대로 부재다', () => {
    expect(isRecommendationAbsent(err(404, 'NOT_FOUND'))).toBe(true);
  });

  it('404 가 아니면 실패다 — 못 본 것을 없다고 말하지 않는다', () => {
    expect(isRecommendationAbsent(err(403, 'FORBIDDEN'))).toBe(false);
    expect(isRecommendationAbsent(err(500, 'INTERNAL_ERROR'))).toBe(false);
    // 네트워크·타임아웃은 status 0 — 무엇인지 모르는 상태다.
    expect(isRecommendationAbsent(err(0, 'INTERNAL_ERROR'))).toBe(false);
  });

  it('AppError 가 아니면 실패다', () => {
    expect(isRecommendationAbsent(new Error('boom'))).toBe(false);
    expect(isRecommendationAbsent(null)).toBe(false);
  });
});
