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
      reconfirmNeeded: false,
      diffCount: null,
    });
    expect(verdict.dot).toBe('done');
    expect(verdict.head).toBe('확정과 설치가 끝났습니다');
    expect(verdict.sub).toContain('8건');
  });

  it('설치 끝 + 확정 0건이면 건수 없이 말한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: true,
      confirmedCount: 0,
      request: NONE,
      reconfirmNeeded: false,
      diffCount: null,
    });
    expect(verdict.sub).toBe('확정한 리소스가 인프라에 반영되었습니다.');
  });

  it('등록돼 있으면 그 사실과 다음 단계(설치)의 관계만 말한다 — 요청의 결말은 밴드가 말한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 8,
      request: { kind: 'rejected' },
      reconfirmNeeded: false,
      diffCount: null,
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
      reconfirmNeeded: false,
      diffCount: null,
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
      reconfirmNeeded: false,
      diffCount: null,
    });
    expect(verdict.head).toBe('확정 정보가 필요합니다');
    expect(verdict.sub).toBe('승인 #12에 선택된 8건을 기준으로 확정 정보가 등록됩니다.');
  });

  it('승인됐지만 번호가 없으면 번호를 지어내지 않는다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'approved', requestId: null, count: 8 },
      reconfirmNeeded: false,
      diffCount: null,
    });
    expect(verdict.sub).toBe('승인된 리소스를 기준으로 확정 정보가 등록됩니다.');
  });

  it('미등록 + 처리 대기는 요청 번호와 함께 전제를 말한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'pending', requestId: 7 },
      reconfirmNeeded: false,
      diffCount: null,
    });
    expect(verdict.sub).toBe('요청 #7이 아직 처리되지 않았습니다 — 처리 결과를 기준으로 확정합니다.');
  });

  it('미등록 + 요청 없음은 그 사실을 sub에 병기한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: NONE,
      reconfirmNeeded: false,
      diffCount: null,
    });
    expect(verdict.head).toBe('확정 정보가 필요합니다');
    expect(verdict.sub).toBe('아직 승인 요청이 없습니다 — 승인된 리소스를 기준으로 등록됩니다.');
  });

  it('대기 + 요청 번호가 없으면 번호 없이 같은 전제를 말한다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'pending', requestId: null },
      reconfirmNeeded: false,
      diffCount: null,
    });
    expect(verdict.sub).toBe('요청이 아직 처리되지 않았습니다 — 처리 결과를 기준으로 확정합니다.');
  });

  it('승인 없이 끝난 요청은 대기라고 말하지 않는다 — 취소·연동 불가', () => {
    for (const label of ['요청 취소', '연동 불가']) {
      const verdict = deriveConfirmVerdict({
        installed: false,
        confirmedCount: 0,
        request: { kind: 'closed', label },
        reconfirmNeeded: false,
        diffCount: null,
      });
      // 반려가 아니므로 빨강으로 올리지 않는다.
      expect(verdict.dot).toBe('idle');
      expect(verdict.sub).toBe(
        `최신 요청이 ${label}로 처리되어 확정할 기준이 없습니다 — 재요청을 기다리거나 직접 등록할 수 있습니다.`,
      );
      expect(verdict.sub).not.toContain('처리되지 않았습니다');
    }
  });

  it('끝난 요청의 어휘가 없으면 요청에 대해 아무 말도 하지 않는다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'closed', label: null },
      reconfirmNeeded: false,
      diffCount: null,
    });
    expect(verdict.sub).toBe('승인된 리소스를 기준으로 확정 정보가 등록됩니다.');
  });

  it('요청 축이 없는 대상에서는 승인을 입에 담지 않는다', () => {
    // 모름(`unknown`)도 없음(`none`)도 아니다 — SDU 에는 승인 단계가 없어서(계약 §0)
    // 기준이 될 승인이 생길 수 없다. 두 어휘 중 어느 쪽을 써도 없는 것을 기다리게 만든다.
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'absent' },
      reconfirmNeeded: false,
      diffCount: null,
    });
    expect(verdict.dot).toBe('idle');
    expect(verdict.head).toBe('확정 정보가 필요합니다');
    expect(verdict.sub).toBe('설치(Terraform)는 확정 정보를 기준으로 진행됩니다.');
    expect(verdict.sub).not.toContain('승인');
  });

  it('요청을 아직 모르면 "요청 없음"이라고 말하지 않는다', () => {
    const verdict = deriveConfirmVerdict({
      installed: false,
      confirmedCount: 0,
      request: { kind: 'unknown' },
      reconfirmNeeded: false,
      diffCount: null,
    });
    expect(verdict.sub).toBe('승인된 리소스를 기준으로 확정 정보가 등록됩니다.');
    expect(verdict.sub).not.toContain('없습니다');
  });
});

/**
 * 재확정 — 확정 정보는 등록돼 있는데 진행 상태가 아직 3단계(CONFIRMING)다. 등록됐다는
 * 사실만 말하면 화면은 끝난 것처럼 읽히지만, 그 확정으로는 다음 단계로 넘어가지 않는다.
 */
describe('deriveConfirmVerdict — 재확정과 대조', () => {
  const RECONFIRM = { installed: false, confirmedCount: 8, request: { kind: 'approved', requestId: 12, count: 8 } as RequestFacet };

  it('차이가 없으면 일치한다는 사실과 함께 다시 입력하라고 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, reconfirmNeeded: true, diffCount: 0 });

    expect(verdict.dot).toBe('warn');
    expect(verdict.head).toBe('리소스 정보는 전부 일치하지만 확정 정보를 다시 입력해야 합니다');
    expect(verdict.sub).toBe(
      '진행 상태가 아직 3단계(반영 중)입니다. 현재 확정 정보로는 다음 단계로 넘어가지 않습니다.',
    );
  });

  it('대조할 수 없으면 일치를 주장하지 않는다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, reconfirmNeeded: true, diffCount: null });

    expect(verdict.dot).toBe('warn');
    expect(verdict.head).toBe('확정 정보를 다시 입력해야 합니다');
    expect(verdict.head).not.toContain('일치');
  });

  it('차이가 있으면 건수를 헤드라인에 싣고 그것부터 보라고 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, reconfirmNeeded: true, diffCount: 3 });

    expect(verdict.dot).toBe('warn');
    expect(verdict.head).toBe('확정 정보를 다시 입력해야 합니다 — 승인과 차이 3건');
    expect(verdict.sub).toBe('진행 상태가 아직 3단계(반영 중)입니다. 차이를 확인한 뒤 재확정하세요.');
  });

  it('설치가 끝났으면 재확정 입력을 이긴다', () => {
    const verdict = deriveConfirmVerdict({
      ...RECONFIRM,
      installed: true,
      reconfirmNeeded: true,
      diffCount: 3,
    });

    expect(verdict.dot).toBe('done');
    expect(verdict.head).toBe('확정과 설치가 끝났습니다');
  });

  it('재확정이 아니면 차이는 점을 물들이지 않는다 — 사실만 문장에 붙는다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, reconfirmNeeded: false, diffCount: 2 });

    expect(verdict.dot).toBe('done');
    expect(verdict.head).toBe('확정 정보 8건이 등록되어 있습니다');
    expect(verdict.sub).toBe('승인 내용과 차이 2건이 있습니다.');
  });

  it('차이 0건이면 등록된 확정의 다음 단계만 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, reconfirmNeeded: false, diffCount: 0 });

    expect(verdict.sub).toBe('설치(Terraform)는 이 확정 정보를 기준으로 진행됩니다.');
  });
});
