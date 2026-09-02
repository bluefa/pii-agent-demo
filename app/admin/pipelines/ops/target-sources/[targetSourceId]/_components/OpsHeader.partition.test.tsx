// @vitest-environment jsdom
/**
 * 파티션 태그 — 「연동 대상」 머리 줄, 단계 알약 오른쪽 (오너 2026-08-28 "Admin 페이지에서
 * 중국으로 표기하라는거야. Global로 표현되고 있던 부분이 있으면 이것도 그냥 없애. 따로
 * 보여주지마").
 *
 * 그래서 이 파일이 붙드는 것은 하나다: 태그는 중국에만 서고, 그 밖에는 **아무 표시도 없다**.
 * 없음을 검사하는 테스트가 이 변경의 전부인 이유는, 있는 쪽만 보면 Global 태그를 되살려도
 * 전부 초록이기 때문이다. 옛 어휘(Global Region · China Region · Global)가 화면 어디에도
 * 남지 않았다는 것까지 같이 못 박는다.
 *
 * 태그는 kv 라벨 줄에서 블록 머리로 옮겨 온 것이라 옛 자리에 남지 않았다는 것도 그대로
 * 지킨다. 권역이 없는 IDC 는 애초에 태그가 없다.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OpsHeader } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsHeader';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';

const detail = (
  provider: string,
  metadata: Record<string, unknown> = {},
): RawTargetSourceDetail => ({
  target_source_id: 1042,
  service_name: provider,
  service_code: provider.toLowerCase(),
  cloud_provider: provider,
  metadata: { is_sdu_type: false, ...metadata },
});

const renderHeader = (d: RawTargetSourceDetail, isAws = false): void => {
  render(
    <OpsHeader
      targetSourceId={1042}
      detail={d}
      processStatus={null}
      processLoaded
      isAws={isAws}
      savedRoleArns={{}}
      grantTfExecution={false}
      supportRawData={undefined}
      jiraTicket={null}
      ticketLoaded
      onOpenMode={vi.fn()}
      onOpenEdit={vi.fn()}
      onOpenRawData={vi.fn()}
      onEditDescription={vi.fn()}
    />,
  );
};

/** 단계 조회의 두 시점을 갈라 그린다 — 태그가 서는 자리가 그 시점에 달려 있다. */
const renderAtStep = (
  d: RawTargetSourceDetail,
  step: { status: ProcessStatus | null; loaded: boolean },
): void => {
  render(
    <OpsHeader
      targetSourceId={1042}
      detail={d}
      processStatus={step.status}
      processLoaded={step.loaded}
      isAws
      savedRoleArns={{}}
      grantTfExecution={false}
      supportRawData={undefined}
      jiraTicket={null}
      ticketLoaded
      onOpenMode={vi.fn()}
      onOpenEdit={vi.fn()}
      onOpenRawData={vi.fn()}
      onEditDescription={vi.fn()}
    />,
  );
};

const china = (): RawTargetSourceDetail =>
  detail('AWS', { aws_account_id: '918273645500', is_china_region: true });

/** 머리 줄 — 글리프·블록 이름·알약·태그가 사는 그 한 줄. */
const nameRow = (): HTMLElement => {
  const row = screen.getByText('연동 대상').parentElement;
  if (!row) throw new Error('머리 줄을 찾지 못했다');
  return row;
};

/** 옛 어휘 셋 — 화면 어디에도 남으면 안 된다. */
const RETIRED = ['Global Region', 'China Region', 'Global'];

describe('OpsHeader — 파티션 태그', () => {
  it('중국 파티션이면 「중국」 태그가 선다', () => {
    renderHeader(detail('AWS', { aws_account_id: '918273645500', is_china_region: true }), true);
    expect(screen.getByText('중국')).toBeTruthy();
    for (const retired of RETIRED) expect(screen.queryByText(retired)).toBeNull();
  });

  it('중국이 아니면 태그 자체가 없다 — Global 은 그리지 않는다', () => {
    renderHeader(detail('GCP', { gcp_project_id: 'pii-agent-prod-12345' }));
    expect(screen.queryByText('중국')).toBeNull();
    for (const retired of RETIRED) expect(screen.queryByText(retired)).toBeNull();
    // 대체 문구도 없다: 없앤 것이지 다른 말로 바꾼 것이 아니다.
    expect(document.body.textContent).not.toContain('Global');
  });

  it('태그는 블록 머리에 서고, 옛 자리인 kv 라벨 줄에는 남지 않는다', () => {
    renderHeader(detail('AWS', { aws_account_id: '918273645500', is_china_region: true }), true);
    const tag = screen.getByText('중국');
    // 머리 줄: 블록 이름 「연동 대상」과 같은 부모 안에 선다.
    const name = screen.getByText('연동 대상').parentElement;
    expect(name?.contains(tag)).toBe(true);
    // 옛 자리: 계정 셀 안에는 없다.
    expect(screen.getByText('계정').closest('div')?.contains(tag)).toBe(false);
  });

  it('IDC 는 권역이 없으므로 태그도 없다', () => {
    renderHeader(detail('IDC'));
    expect(screen.queryByText('중국')).toBeNull();
    for (const retired of RETIRED) expect(screen.queryByText(retired)).toBeNull();
  });
});

/**
 * 알약은 상세보다 늦게 도착한다. 늦게 끼어들면 그 오른쪽의 태그를 민다 — 브라우저
 * 실측으로 x 344.72 → 445.44, 100.72px. 알약의 폭은 단계 라벨이 정하므로(「완료」
 * 92.72px ↔ 「연동 대상 승인 대기」 173.75px) 폭으로 자리를 잡을 수는 없다. 그래서
 * 자리는 시점으로 잡는다: 조회 중에는 알약 자리에 막대만 서고, 태그는 알약의 폭이
 * 정해지는 그 커밋에서 함께 선다.
 */
describe('OpsHeader — 단계 알약의 자리', () => {
  it('단계를 조회하는 동안에는 태그가 서지 않는다 — 밀릴 자리에 미리 서지 않는다', () => {
    renderAtStep(china(), { status: null, loaded: false });

    expect(screen.queryByText('중국')).toBeNull();
    // 자리는 비어 있지 않다 — 알약 자리에 막대 하나가 선다.
    expect(nameRow().querySelector('.animate-pulse')).not.toBeNull();
  });

  it('단계가 도착하면 알약과 태그가 같은 줄에 함께 선다 — 막대는 사라진다', () => {
    renderAtStep(china(), { status: 'COMPLETED', loaded: true });

    const row = nameRow();
    expect(within(row).getByText('중국')).toBeTruthy();
    expect(within(row).getByText('7')).toBeTruthy();
    expect(row.querySelector('.animate-pulse')).toBeNull();
  });

  it('단계를 못 읽었어도 태그는 선다 — 조회 실패가 태그를 영영 지우지 않는다', () => {
    renderAtStep(china(), { status: null, loaded: true });

    expect(within(nameRow()).getByText('중국')).toBeTruthy();
    expect(nameRow().querySelector('.animate-pulse')).toBeNull();
  });
});
