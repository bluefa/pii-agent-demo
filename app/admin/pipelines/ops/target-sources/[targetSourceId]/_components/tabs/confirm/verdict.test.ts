import { describe, expect, it } from 'vitest';
import {
  deriveConfirmVerdict,
  type RequestFacet,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/verdict';

const NONE: RequestFacet = { kind: 'none' };

describe('deriveConfirmVerdict — 문구 전수표의 아홉 행', () => {
  it('설치가 끝나면 다른 모든 입력을 무시하고 완료를 말한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: true,
      confirmedCount: 8,
      request: { kind: 'rejected' },
    });
    expect(verdict.dot).toBe('done');
    expect(verdict.head).toBe('확정과 설치가 끝났습니다');
    expect(verdict.sub).toContain('8건');
  });

  it('설치 끝 + 확정 수를 모르면 건수 없이 말한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: true,
      confirmedCount: 0,
      request: NONE,
    });
    expect(verdict.sub).toBe('확정한 리소스가 인프라에 반영되었습니다.');
  });

  it('등록돼 있으면 그 사실과 다음 단계(설치)의 관계만 말한다 — 요청의 결말은 밴드가 말한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 8,
      request: { kind: 'rejected' },
    });
    expect(verdict.dot).toBe('done');
    expect(verdict.head).toBe('확정 정보 8건이 등록되어 있습니다');
    expect(verdict.sub).toBe('설치(Terraform)는 이 확정 정보를 기준으로 진행됩니다.');
  });

  it('미등록 + 반려는 종합해서 말한다 — 사실(밴드)과 다음 행동(헤드라인)', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'rejected' },
    });
    expect(verdict.dot).toBe('failed');
    expect(verdict.head).toBe('승인이 반려되어 확정할 기준이 없습니다');
    expect(verdict.sub).toBe('재요청을 기다리거나, 필요하면 직접 등록할 수 있습니다.');
  });

  it('미등록 + 승인이면 승인 번호와 건수를 기준으로 제시한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'approved', requestId: 12, count: 8 },
    });
    expect(verdict.head).toBe('확정 정보가 필요합니다');
    expect(verdict.sub).toBe('승인 #12에 선택된 8건을 기준으로 확정 정보가 등록됩니다.');
  });

  it('승인됐지만 번호가 없으면 번호를 지어내지 않는다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'approved', requestId: null, count: 8 },
    });
    expect(verdict.sub).toBe('승인된 리소스를 기준으로 확정 정보가 등록됩니다.');
  });

  it('미등록 + 처리 대기는 요청 번호와 함께 전제를 말한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'pending', requestId: 7 },
    });
    expect(verdict.sub).toBe('요청 #7이 아직 처리되지 않았습니다 — 처리 결과를 기준으로 확정합니다.');
  });

  it('미등록 + 요청 없음은 그 사실을 sub에 병기한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: NONE,
    });
    expect(verdict.head).toBe('확정 정보가 필요합니다');
    expect(verdict.sub).toBe('아직 승인 요청이 없습니다 — 승인된 리소스를 기준으로 등록됩니다.');
  });

  it('요청을 아직 모르면 "요청 없음"이라고 말하지 않는다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'unknown' },
    });
    expect(verdict.sub).toBe('승인된 리소스를 기준으로 확정 정보가 등록됩니다.');
    expect(verdict.sub).not.toContain('없습니다');
  });
});
