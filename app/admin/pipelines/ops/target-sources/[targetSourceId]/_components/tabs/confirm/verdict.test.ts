import { describe, expect, it } from 'vitest';
import {
  deriveConfirmVerdict,
  type RequestFacet,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/verdict';

const NONE: RequestFacet = { kind: 'none' };
const AFTER_APPROVAL = '관리자가 승인하면 확정 정보를 입력할 수 있습니다.';
const AFTER_RESEND = '서비스가 연동 요청을 다시 보내고 관리자가 승인하면 확정 정보를 입력할 수 있습니다.';

const base = { installed: false, confirmedCount: 0, reconfirmNeeded: false, diffCount: null } as const;

describe('deriveConfirmVerdict — 문구 전수표', () => {
  it('설치가 끝나면 다른 모든 입력을 무시하고 완료를 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...base, installed: true, confirmedCount: 8, request: { kind: 'rejected' } });
    expect(verdict.tag).toBe('등록됨');
    expect(verdict.head).toBe('확정과 설치가 끝났습니다');
    expect(verdict.sub).toContain('8건');
  });

  it('설치 끝 + 확정 0건이면 건수 없이 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...base, installed: true, request: NONE });
    expect(verdict.tag).toBeNull();
    expect(verdict.sub).toBe('확정한 리소스가 인프라에 반영되었습니다.');
  });

  it('등록돼 있고 대조할 수 없으면 등록 사실과 다음 단계만 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...base, confirmedCount: 8, request: { kind: 'rejected' } });
    expect(verdict.tag).toBe('등록됨');
    expect(verdict.head).toBe('확정 정보 8건이 등록되어 있습니다');
    expect(verdict.sub).toBe('이 확정 정보로 설치(Terraform)를 진행합니다.');
  });

  it('미등록 + 반려는 반려 사실과 다음에 누가 무엇을 해야 하는지를 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...base, request: { kind: 'rejected' } });
    expect(verdict.tag).toBeNull();
    expect(verdict.head).toBe('연동 요청이 반려되었습니다');
    expect(verdict.sub).toBe(`반려된 요청으로는 확정 정보를 입력할 수 없습니다. ${AFTER_RESEND}`);
  });

  it('미등록 + 승인이면 건수를 말하고 입력을 요구한다 — 요청 번호는 어디에도 없다', () => {
    const verdict = deriveConfirmVerdict({ ...base, request: { kind: 'approved', count: 8 } });
    expect(verdict.head).toBe('확정 정보를 입력해야 합니다');
    expect(verdict.sub).toBe('연동 요청에서 리소스 8건이 승인되었습니다. 관리자가 확정 정보를 입력하면 설치를 진행할 수 있습니다.');
  });

  it('미등록 + 처리 대기는 승인이 필요하다고 머리에 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...base, request: { kind: 'pending' } });
    expect(verdict.head).toBe('연동 요청 승인이 필요합니다');
    expect(verdict.sub).toBe(`연동 요청이 승인 대기 중입니다. ${AFTER_APPROVAL}`);
  });

  it('미등록 + 요청 없음은 서비스가 먼저 보내야 한다고 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...base, request: NONE });
    expect(verdict.head).toBe('연동 요청 승인이 필요합니다');
    expect(verdict.sub).toBe(`연동 요청이 없습니다. 서비스가 연동 요청을 보내고 ${AFTER_APPROVAL}`);
  });

  it('승인 없이 끝난 요청은 대기라고 말하지 않는다 — 취소·연동 불가', () => {
    for (const label of ['요청 취소', '연동 불가']) {
      const verdict = deriveConfirmVerdict({ ...base, request: { kind: 'closed', label } });
      expect(verdict.tag).toBeNull();
      expect(verdict.sub).toBe(`최신 연동 요청이 ${label} 상태입니다. ${AFTER_RESEND}`);
      expect(verdict.sub).not.toContain('대기');
    }
  });

  it('끝난 요청의 어휘가 없으면 그 결말을 말하지 않고 다음 조건만 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...base, request: { kind: 'closed', label: null } });
    expect(verdict.sub).toBe(`아직 승인된 연동 요청이 없습니다. ${AFTER_RESEND}`);
  });

  it('요청 축이 없는 대상에서는 승인을 입에 담지 않는다', () => {
    const verdict = deriveConfirmVerdict({ ...base, request: { kind: 'absent' } });
    expect(verdict.tag).toBeNull();
    expect(verdict.head).toBe('확정 정보가 필요합니다');
    expect(verdict.sub).not.toContain('승인');
  });

  it('요청을 아직 모르면 승인이 없다고도, 필요하다고도 단정하지 않는다', () => {
    const verdict = deriveConfirmVerdict({ ...base, request: { kind: 'unknown' } });
    expect(verdict.head).toBe('확정 정보가 필요합니다');
    expect(verdict.sub).toBe('연동 요청 정보를 불러오지 못했습니다. 승인 여부를 확인한 뒤 확정 정보를 입력할 수 있습니다.');
  });

  it('어느 행도 대시로 두 절을 잇지 않고, 「직접 등록」을 말하지 않는다', () => {
    const requests: RequestFacet[] = [
      NONE,
      { kind: 'unknown' },
      { kind: 'absent' },
      { kind: 'pending' },
      { kind: 'rejected' },
      { kind: 'closed', label: '요청 취소' },
      { kind: 'closed', label: null },
      { kind: 'approved', count: 8 },
    ];
    for (const request of requests) {
      for (const installed of [false, true]) {
        for (const confirmedCount of [0, 8]) {
          for (const reconfirmNeeded of [false, true]) {
            for (const diffCount of [null, 0, 3]) {
              const verdict = deriveConfirmVerdict({ installed, confirmedCount, request, reconfirmNeeded, diffCount });
              for (const text of [verdict.head, verdict.sub]) {
                expect(text).not.toContain('—');
                expect(text).not.toContain(' - ');
                expect(text).not.toContain('직접 등록');
                expect(text).not.toContain('기준으로');
                expect(text).not.toContain('#');
              }
            }
          }
        }
      }
    }
  });
});

describe('deriveConfirmVerdict — 재확정과 대조', () => {
  const RECONFIRM = { installed: false, confirmedCount: 8, request: { kind: 'approved', count: 8 } as RequestFacet };

  it('차이가 없으면 목록이 일치해도 재확정이 필요할 수 있는 이유를 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, reconfirmNeeded: true, diffCount: 0 });
    expect(verdict.tag).toBe('다시 입력 필요');
    expect(verdict.head).toBe('3단계에서는 재확정이 필요할 수 있습니다');
    expect(verdict.sub).toBe(
      '확정 정보와 승인 정보의 리소스 목록은 일치합니다. 목록이 완전히 일치해도 재확정이 필요할 수 있습니다. 일부 필드 값이 정확히 일치하지 않거나 RDS Cluster에서 선택된 인스턴스가 다르면 그렇습니다. 재확정하면 확정 정보가 승인 내용으로 다시 등록됩니다.',
    );
  });

  it('대조할 수 없으면 일치를 주장하지 않는다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, reconfirmNeeded: true, diffCount: null });
    expect(verdict.tag).toBe('다시 입력 필요');
    expect(verdict.head).toBe('3단계에서는 재확정이 필요할 수 있습니다');
    expect(verdict.sub).not.toContain('일치');
  });

  it('차이가 있으면 건수를 첫 문장에 싣고 그것부터 보라고 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, reconfirmNeeded: true, diffCount: 3 });
    expect(verdict.tag).toBe('다시 입력 필요');
    expect(verdict.head).toBe('확정 정보를 다시 입력해야 합니다');
    expect(verdict.sub).toBe('승인 내용과 차이가 3건 있습니다. 차이를 확인한 뒤 재확정하세요. 진행 상태는 아직 3단계(반영 중)입니다.');
  });

  it('설치가 끝났으면 재확정 입력을 이긴다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, installed: true, reconfirmNeeded: true, diffCount: 3 });
    expect(verdict.head).toBe('확정과 설치가 끝났습니다');
  });

  it('재확정이 아니면 차이는 태그를 바꾸지 않는다 — 사실만 문장에 붙는다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, reconfirmNeeded: false, diffCount: 2 });
    expect(verdict.tag).toBe('등록됨');
    expect(verdict.head).toBe('확정 정보 8건이 등록되어 있습니다');
    expect(verdict.sub).toBe('승인 내용과 차이가 2건 있습니다.');
  });

  it('차이 0건이면 일치한다고 말한다', () => {
    const verdict = deriveConfirmVerdict({ ...RECONFIRM, reconfirmNeeded: false, diffCount: 0 });
    expect(verdict.sub).toBe('승인 내용과 리소스 목록이 일치합니다.');
  });
});
