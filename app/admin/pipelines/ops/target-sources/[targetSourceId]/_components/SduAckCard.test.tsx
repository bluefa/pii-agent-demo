// @vitest-environment jsdom
/**
 * 「담당자 확인」 카드의 제 축 (계약 §5).
 *
 * 뷰를 통과하는 경로로는 닿지 않는 것이 둘이다:
 *
 *  1. **무효화 배지**(§3.1). 원인이 둘(Region 추가 · 업로드 IP 변경)이고 서로 다른 문장을
 *     쓰며, **동시에 참일 수 있다** — 계약이 `added_regions` 는 합집합으로,
 *     `upload_ip_changed` 는 OR 로 쌓으라고 못박은 자리다. 한 저장이 지운 답의 이유가
 *     사라지면 관리자는 설명 없이 비어 있는 확인 줄을 본다.
 *  2. **답과 출처의 경계**. 값(예/아니오)과 그 답을 남긴 사람·시각은 다른 사실이라,
 *     글자 흐름에서도 갈라져야 한다 — 여백만으로 가르면 텍스트는 「예홍길동」이 된다.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SduAckCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduAckCard';
import type { SduUpload } from '@/lib/types/sdu';

const getSduUpload = vi.fn();
vi.mock('@/app/lib/api/sdu', () => ({
  getSduDefinition: vi.fn(),
  getSduUpload: (...args: unknown[]) => getSduUpload(...args),
}));

const upload = (over: Partial<SduUpload> = {}): SduUpload => ({
  submittedAt: '2026-08-24T05:41:00Z',
  regions: ['us'],
  firewall: {
    rows: [],
    acked: false,
    ackedAt: '2026-08-25T10:40:00Z',
    ackedBy: { id: 'user-1', name: '홍길동', email: 'hong@company.com' },
  },
  accessKeyRecipients: {
    users: [{ id: 'user-3', name: '이영희', email: 'lee@company.com' }],
    updatedAt: '2026-08-24T07:41:00Z',
  },
  commands: { rows: [], acked: false, ackedAt: null, ackedBy: null },
  bdc: { status: 'NOT_STARTED', checkedAt: '2026-08-24T07:50:00Z', completedAt: null },
  invalidation: { addedRegions: [], uploadIpChanged: false },
  ...over,
});

const draw = (): void => {
  render(<SduAckCard targetSourceId={1100} />);
};

beforeEach(() => {
  vi.clearAllMocks();
  getSduUpload.mockResolvedValue(upload());
});

describe('SduAckCard — 답과 출처', () => {
  it('「아니오」와 「미답」을 같은 말로 적지 않는다', async () => {
    // 계약 §5: `acked: false` 하나로는 둘이 구별되지 않는다. 가르는 것은 `ackedAt` 이다.
    draw();

    const firewall = await screen.findByText('방화벽 결재 확인');
    expect(firewall.nextElementSibling?.textContent).toContain('아니오');
    expect(firewall.nextElementSibling?.textContent).toContain('홍길동');
    expect(screen.getByText('데이터 업로드 확인').nextElementSibling?.textContent).toBe('미답');
  });

  it('답과 출처가 한 낱말로 붙지 않는다', async () => {
    getSduUpload.mockResolvedValue(
      upload({
        firewall: {
          rows: [],
          acked: true,
          ackedAt: '2026-08-25T10:40:00Z',
          ackedBy: { id: 'user-1', name: '홍길동', email: 'hong@company.com' },
        },
      }),
    );
    draw();

    const value = (await screen.findByText('방화벽 결재 확인')).nextElementSibling;
    // 여백은 눈에만 있다 — 낭독과 복사가 읽는 것은 이 문자열이다.
    expect(value?.textContent).not.toContain('예홍길동');
    expect(value?.textContent).toContain('예 · 홍길동');
  });

  it('미답에는 붙일 사람도 시각도 없다 — 구분자도 서지 않는다', async () => {
    draw();

    await screen.findByText('방화벽 결재 확인');
    expect(screen.getByText('데이터 업로드 확인').nextElementSibling?.textContent).toBe('미답');
  });
});

describe('SduAckCard — 무효화 배지 (§3.1)', () => {
  it('Region 추가는 두 확인이 초기화됐다고 말한다', async () => {
    getSduUpload.mockResolvedValue(
      upload({ invalidation: { addedRegions: ['eu'], uploadIpChanged: false } }),
    );
    draw();

    const note = await screen.findByText(/Region 추가/);
    expect(note.textContent).toContain('EU');
    expect(note.textContent).toContain('방화벽 결재 확인과 데이터 업로드 확인이 초기화됐습니다');
    // 업로드 IP 문장은 서지 않는다 — 그 저장이 한 일이 아니다.
    expect(screen.queryByText(/업로드 IP 변경/)).toBeNull();
  });

  it('업로드 IP 변경은 방화벽만 초기화한다 — 업로드 확인은 살아남는다', async () => {
    getSduUpload.mockResolvedValue(
      upload({ invalidation: { addedRegions: [], uploadIpChanged: true } }),
    );
    draw();

    const note = await screen.findByText(/업로드 IP 변경/);
    expect(note.textContent).toContain('방화벽 결재 확인이 초기화됐습니다');
    expect(screen.queryByText(/Region 추가/)).toBeNull();
  });

  it('둘 다 참이면 두 문장이 함께 선다 — 저장이 여러 번이면 안내는 쌓인다', async () => {
    getSduUpload.mockResolvedValue(
      upload({ invalidation: { addedRegions: ['asia', 'eu'], uploadIpChanged: true } }),
    );
    draw();

    // 정규 순서로 선다 (asia → eu).
    const regions = await screen.findByText(/Region 추가/);
    expect(regions.textContent).toContain('Asia, EU');
    expect(screen.getByText(/업로드 IP 변경/)).toBeTruthy();
  });

  it('무효화가 없으면 배지도 없다', async () => {
    draw();

    await screen.findByText('방화벽 결재 확인');
    expect(screen.queryByText(/초기화됐습니다/)).toBeNull();
  });
});

describe('SduAckCard — 조회 실패', () => {
  it('거절되면 미답이 아니라 모른다고 말한다', async () => {
    // 정의만 저장하고 아직 제출하지 않은 대상이 이 모양이다.
    getSduUpload.mockRejectedValue(new Error('not submitted'));
    draw();

    expect(await screen.findByText('담당자 확인 정보를 불러오지 못했습니다.')).toBeTruthy();
    expect(screen.queryByText('미답')).toBeNull();
  });
});
