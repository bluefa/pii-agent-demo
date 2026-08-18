// @vitest-environment jsdom
/**
 * LIN-92 — the Target Source 목록 block must occupy the same height whatever the
 * data says, so the Jira Ticket 연결 section below it never moves.
 *
 * jsdom has no layout, so these tests cannot measure pixels. They pin the two
 * things that *produce* the constant height instead, both of which are real
 * regressions that already happened:
 *
 *   1. The list always renders exactly PAGE_SIZE slots — cards plus ghosts.
 *      A short last page, a single target and an empty service all draw three.
 *   2. Every card carries all three text layers. The account line and the
 *      description line used to be conditional, so two full pages of three cards
 *      could still differ in height. A target with no account and no description
 *      must still emit both rows, filled with 대체 문구.
 *
 * The measured side (120px slots, a 388px list across 0/1/2/3/4/7 targets) was
 * verified in the browser; what jsdom can hold is the structure that guarantees it.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ServiceDetailView } from '@/app/admin/pipelines/ops/services/_components/ServiceDetailView';
import type {
  OpsServiceDetail,
  OpsServiceTargetRow,
  OpsTargetSourceAccount,
} from '@/app/lib/api/ops';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const getOpsService = vi.fn();
const getServiceJiraTickets = vi.fn();

vi.mock('@/app/lib/api/ops', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/api/ops')>();
  return {
    ...actual,
    getOpsService: (...args: unknown[]) => getOpsService(...args),
    getServiceJiraTickets: (...args: unknown[]) => getServiceJiraTickets(...args),
  };
});

/** The skeleton holds for SKELETON_MIN_MS before the data is allowed to land. */
vi.mock('@/lib/min-duration', () => ({
  SKELETON_MIN_MS: 0,
  holdFor: async () => {},
}));

const PAGE_SIZE = 3;

/**
 * `as` 캐스트를 쓰지 않는다 — 캐스트가 있으면 계약에 필드가 늘어나도 픽스처가 그냥
 * 통과해, 라우트가 그 필드 매핑을 빠뜨려도 테스트가 아무 말을 안 한다. 실제로
 * `tenant_id` 가 그렇게 빠져 있었다. 타입을 그대로 맞춰 두면 컴파일이 먼저 잡는다.
 */
const meta = (over: Partial<OpsTargetSourceAccount> = {}): OpsTargetSourceAccount => ({
  aws_account_id: null,
  aws_region_type: null,
  subscription_id: null,
  tenant_id: null,
  gcp_project_id: null,
  is_china_region: false,
  ...over,
});

const target = (
  id: number,
  over: Partial<OpsServiceTargetRow> = {},
): OpsServiceTargetRow => ({
  target_source_id: id,
  cloud_provider: 'AWS',
  is_sdu_type: false,
  description: `설명 ${id}`,
  support_raw_data: false,
  last_changed_at: '2026-08-01T00:00:00Z',
  metadata: meta({ aws_account_id: `00000000000${id % 10}` }),
  ...over,
});

const detail = (rows: OpsServiceTargetRow[]): OpsServiceDetail => ({
  service_code: 'ORD',
  service_name: '주문서비스',
  total_count: rows.length,
  target_sources: rows,
});

/** Cards and ghosts alike — every child of the list that holds a slot. */
const slotCount = () => {
  const section = screen.getByLabelText('Target Source 목록');
  const cards = section.querySelectorAll('div.group');
  const ghosts = section.querySelectorAll('div[class*="border-dashed"]');
  return { cards: cards.length, ghosts: ghosts.length, total: cards.length + ghosts.length };
};

const renderWith = async (rows: OpsServiceTargetRow[]) => {
  getOpsService.mockResolvedValue(detail(rows));
  getServiceJiraTickets.mockResolvedValue([]);
  render(<ServiceDetailView serviceCode="ORD" />);
  await screen.findByLabelText('Target Source 목록');
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LIN-92 — 고정 높이 슬롯', () => {
  it.each([0, 1, 2, 3])(
    '대상이 %i건이어도 슬롯은 언제나 PAGE_SIZE 장이다',
    async (n) => {
      await renderWith(Array.from({ length: n }, (_, i) => target(4100 + i)));
      await waitFor(() => expect(slotCount().total).toBe(PAGE_SIZE));
    },
  );

  it('마지막 페이지가 짧으면 빈 슬롯이 그 자리를 메운다', async () => {
    // 7건 → 3 / 3 / 1. 마지막 장은 카드 1 + 빈 슬롯 2.
    await renderWith(Array.from({ length: 7 }, (_, i) => target(4100 + i)));
    await waitFor(() => expect(slotCount()).toMatchObject({ cards: 3, ghosts: 0 }));

    const next = screen.getByLabelText('다음 페이지');
    fireEvent.click(next);
    fireEvent.click(next);

    expect(screen.getByText('3/3 페이지')).toBeTruthy();
    expect(slotCount()).toMatchObject({ cards: 1, ghosts: 2, total: PAGE_SIZE });
  });

  it('0건일 때도 자리는 셋 — 안내는 첫 슬롯이 맡는다', async () => {
    await renderWith([]);
    await waitFor(() => expect(slotCount().total).toBe(PAGE_SIZE));
    expect(screen.getByText('등록된 Target Source가 없습니다.')).toBeTruthy();
  });

  it('카드와 빈 슬롯이 같은 높이 클래스를 쓴다', async () => {
    // 슬롯 "개수"만 재는 테스트는 CARD_H 를 놓친다 — 빈 슬롯에서 높이를 빼도 개수는
    // 그대로라 전부 green 이다. 그런데 카드와 빈 슬롯이 어긋난 것이 실제로 일어난 일이고
    // (min-h 로 뒀을 때 1.6px), 높이를 한 값으로 묶는 것이 이 화면의 메커니즘이다.
    await renderWith([target(4101), target(4102)]);
    const section = screen.getByLabelText('Target Source 목록');
    const slots = [
      ...section.querySelectorAll('div.group'),
      ...section.querySelectorAll('div[class*="border-dashed"]'),
    ];
    expect(slots).toHaveLength(PAGE_SIZE);
    const heights = slots.map(
      (s) => (s.className.match(/(?:^|\s)(h-\[\d+px\])/) ?? [])[1] ?? '(none)',
    );
    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toMatch(/^h-\[\d+px\]$/);
  });

  it('페이지가 하나뿐이어도 페이지 바는 자리를 지킨다', async () => {
    await renderWith([target(4101)]);
    expect(await screen.findByText('1/1 페이지')).toBeTruthy();
    // 한 장뿐이면 양쪽 화살표가 모두 죽어 있다 — 띠는 남고 컨트롤만 꺼진다.
    expect((screen.getByLabelText('이전 페이지') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('다음 페이지') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('LIN-92 — 카드는 언제나 3층', () => {
  it('계정도 설명도 없는 대상이 두 줄을 모두 채운다', async () => {
    // 이 카드가 2층으로 줄어들던 것이 높이가 흔들리던 진짜 원인이었다.
    await renderWith([
      target(4104, { cloud_provider: 'IDC', metadata: meta(), description: '' }),
    ]);
    const card = screen.getByLabelText('Target Source 목록').querySelector('div.group');
    expect(card).not.toBeNull();
    // 2층: 계정이 없으면 그 provider 가 무엇인지로 대신한다.
    expect(within(card as HTMLElement).getByText('사내망')).toBeTruthy();
    // 3층: 설명이 없으면 "없음". 줄 자체는 사라지지 않는다.
    expect(within(card as HTMLElement).getByText('설명')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('없음')).toBeTruthy();
  });

  it('SDU 행은 밑에 깔린 CSP 계정을 내보이지 않는다', async () => {
    // 1층이 SDU 라고 말하는데 2층이 AWS Account 를 적으면 한 카드가 두 말을 한다.
    await renderWith([
      target(4107, { is_sdu_type: true, metadata: meta({ aws_account_id: '000000000007' }) }),
    ]);
    const card = screen.getByLabelText('Target Source 목록').querySelector('div.group') as HTMLElement;
    expect(within(card).queryByText('000000000007')).toBeNull();
    expect(within(card).getByText('서비스 담당자가 데이터를 직접 업로드')).toBeTruthy();
  });

  it('Azure 의 Tenant 를 구독 옆에 싣는다', async () => {
    await renderWith([
      target(4105, {
        cloud_provider: 'AZURE',
        metadata: {
          aws_account_id: null,
          aws_region_type: null,
          subscription_id: 'sub-0001',
          tenant_id: 'tnt-0001',
          gcp_project_id: null,
          is_china_region: false,
        },
      }),
    ]);
    const card = screen.getByLabelText('Target Source 목록').querySelector('div.group') as HTMLElement;
    expect(within(card).getByText('sub-0001')).toBeTruthy();
    expect(within(card).getByText('Tenant')).toBeTruthy();
    expect(within(card).getByText('tnt-0001')).toBeTruthy();
  });

  it('구독이 없고 Tenant 만 와도 그 값을 버리지 않는다', async () => {
    // 계약이 두 필드를 각각 optional 로 선언하므로 실제로 가능한 조합이다. 예전에는
    // Tenant 가 account 분기 안에 있어, 이 대상은 "계정 식별자 없음"이라고 말하면서
    // 가진 값을 조용히 버렸다.
    await renderWith([
      target(4109, {
        cloud_provider: 'AZURE',
        metadata: {
          aws_account_id: null,
          aws_region_type: null,
          subscription_id: null,
          tenant_id: 'tnt-0009',
          gcp_project_id: null,
          is_china_region: false,
        },
      }),
    ]);
    const card = screen.getByLabelText('Target Source 목록').querySelector('div.group') as HTMLElement;
    expect(within(card).getByText('tnt-0009')).toBeTruthy();
    expect(within(card).queryByText('계정 식별자 없음')).toBeNull();
  });

  it('계정 식별자가 없는 비-IDC 대상은 사내망이라고 둘러대지 않는다', async () => {
    await renderWith([target(4106, { metadata: meta() })]);
    const card = screen.getByLabelText('Target Source 목록').querySelector('div.group') as HTMLElement;
    expect(within(card).getByText('계정 식별자 없음')).toBeTruthy();
  });
});

describe('중국 리전 · SDU 표기', () => {
  it('is_china_region 이 참이면 계정 식별자가 없어도 중국 칩을 단다', async () => {
    // 칩이 account 에 매달려 있었다 — SDU 는 account 를 비우므로, 중국인 SDU 대상이
    // 아무 표시 없이 그려졌다. 중국은 계정의 성질이 아니라 대상의 성질이다.
    await renderWith([
      target(4110, { is_sdu_type: true, metadata: meta({ is_china_region: true }) }),
    ]);
    const card = screen.getByLabelText('Target Source 목록').querySelector('div.group') as HTMLElement;
    expect(within(card).getByText('중국')).toBeTruthy();
    expect(within(card).getByText('SDU')).toBeTruthy();
  });

  it('is_china_region 이 거짓이면 칩을 달지 않는다', async () => {
    await renderWith([target(4111, { metadata: meta({ aws_account_id: '000000000011' }) })]);
    const card = screen.getByLabelText('Target Source 목록').querySelector('div.group') as HTMLElement;
    expect(within(card).queryByText('중국')).toBeNull();
  });

  it('cloudProvider 가 SDU 로 와도 SDU 로 취급한다', async () => {
    // 계약은 SDU 를 두 자리에서 말한다 — metadata.is_sdu_type 과 cloudProvider enum.
    // 플래그만 보면 이 행만 다른 규칙으로 그려진다.
    await renderWith([
      target(4112, {
        cloud_provider: 'SDU',
        is_sdu_type: false,
        metadata: meta({ aws_account_id: '000000000012' }),
      }),
    ]);
    const card = screen.getByLabelText('Target Source 목록').querySelector('div.group') as HTMLElement;
    expect(within(card).getByText('SDU')).toBeTruthy();
    expect(within(card).getByText('서비스 담당자가 데이터를 직접 업로드')).toBeTruthy();
    expect(within(card).queryByText('000000000012')).toBeNull();
  });
});

describe('실데이터 태그', () => {
  it('support_raw_data 가 참인 대상에만 붙는다', async () => {
    // 한 목록 안에서 갈려야 태그가 의미를 갖는다 — 두 행이 다르게 그려지는지를 본다.
    await renderWith([
      target(4120, { support_raw_data: true }),
      target(4121, { support_raw_data: false }),
    ]);
    const cards = screen
      .getByLabelText('Target Source 목록')
      .querySelectorAll('div.group');
    expect(within(cards[0] as HTMLElement).getByText('실데이터')).toBeTruthy();
    expect(within(cards[1] as HTMLElement).queryByText('실데이터')).toBeNull();
  });
});

describe('LIN-92 — 걷어낸 컨트롤', () => {
  it('검색·필터·표시 개수 셀렉트가 없다', async () => {
    await renderWith(Array.from({ length: 7 }, (_, i) => target(4100 + i)));
    const section = screen.getByLabelText('Target Source 목록');
    // 이 셋이 다시 들어오면 섹션 높이가 사용자 손으로 돌아간다.
    expect(section.querySelector('input')).toBeNull();
    expect(section.querySelector('select')).toBeNull();
  });
});
