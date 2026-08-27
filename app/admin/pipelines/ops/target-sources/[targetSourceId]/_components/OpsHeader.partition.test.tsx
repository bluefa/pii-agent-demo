// @vitest-environment jsdom
/**
 * 파티션 태그 — 「연동 대상」 머리 줄, 단계 알약 오른쪽 (오너 2026-08-27 "오른쪽에 China
 * 태그 옮겨 … China Region 이렇게 표현해. China는 빨간색으로").
 *
 * 이 태그는 kv 라벨 줄에서 블록 머리로 **옮겨 온** 것이라, 옛 자리에 남아 있지 않다는 것도
 * 같이 고정한다 — 옮기다 만 상태(두 자리에 다 뜨는 것)가 이 변경의 실패 모드다.
 * 권역이 없는 IDC 는 태그도 없다.
 */
import { render, screen } from '@testing-library/react';
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

describe('OpsHeader — 파티션 태그', () => {
  it('중국 파티션이면 「China Region」, 아니면 「Global Region」', () => {
    renderHeader(detail('AWS', { aws_account_id: '918273645500', is_china_region: true }), true);
    expect(screen.getByText('China Region')).toBeTruthy();
    expect(screen.queryByText('Global Region')).toBeNull();
  });

  it('중국이 아니면 Global 하나만 선다', () => {
    renderHeader(detail('GCP', { gcp_project_id: 'pii-agent-prod-12345' }));
    expect(screen.getByText('Global Region')).toBeTruthy();
    expect(screen.queryByText('China Region')).toBeNull();
  });

  it('태그는 블록 머리에 서고, 옛 자리인 kv 라벨 줄에는 남지 않는다', () => {
    renderHeader(detail('GCP', { gcp_project_id: 'pii-agent-prod-12345' }));
    const tag = screen.getByText('Global Region');
    // 머리 줄: 블록 이름 「연동 대상」과 같은 부모 안에 선다.
    const name = screen.getByText('연동 대상').parentElement;
    expect(name?.contains(tag)).toBe(true);
    // 옛 자리: 프로젝트 셀 안에는 없다.
    expect(screen.getByText('프로젝트').closest('div')?.contains(tag)).toBe(false);
  });

  it('IDC 는 권역이 없으므로 태그도 없다', () => {
    renderHeader(detail('IDC'));
    expect(screen.queryByText('Global Region')).toBeNull();
    expect(screen.queryByText('China Region')).toBeNull();
  });
});
