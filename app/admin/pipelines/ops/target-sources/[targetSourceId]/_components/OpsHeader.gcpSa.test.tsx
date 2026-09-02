// @vitest-environment jsdom
/**
 * GCP kv 줄의 서비스 계정 — 이름만 적고, 복사는 전문을 싣는다 (오너 2026-08-27).
 *
 * 빌려 온 계정의 꼬리를 증거로 남기던 규칙은 같은 날 폐기됐다 ("ㄴㄴ 정리하라고") —
 * 프로젝트가 어디든 이름만 적고, 전문은 복사 값·title·「상세 정보」 세 자리가 진다.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';

// next/link 는 App Router 컨텍스트를 요구한다 — 평범한 anchor 로 세운다.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OpsHeader } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsHeader';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';

const detail = (
  scan: string,
  terraform: string,
  projectId = 'pii-agent-prod-12345',
): RawTargetSourceDetail => ({
  target_source_id: 1042,
  service_name: 'GCP',
  service_code: 'gcp',
  cloud_provider: 'GCP',
  metadata: {
    is_sdu_type: false,
    gcp_project_id: projectId,
    gcp_scan_service_account: scan,
    gcp_terraform_service_account: terraform,
  },
});

const renderHeader = (d: RawTargetSourceDetail): void => {
  render(
    <OpsHeader
      targetSourceId={1042}
      detail={d}
      processStatus={null}
      processLoaded
      isAws={false}
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

/** 라벨이 든 kv 셀의 값 줄 — 라벨은 제 줄(`fmKeyRow`)에 서므로 셀(div)까지 올라간다. */
const valueOf = (label: string): string =>
  screen.getByText(label).closest('div')?.children[1]?.textContent ?? '';

describe('OpsHeader — GCP 서비스 계정 칸', () => {
  const scan = 'pii-agent-scan@pii-agent-prod-12345.iam.gserviceaccount.com';
  const terraform = 'pii-agent-terraform@pii-agent-prod-12345.iam.gserviceaccount.com';

  it('라벨은 한국어이고, 제 프로젝트의 계정은 이름만 적는다', () => {
    renderHeader(detail(scan, terraform));
    expect(valueOf('스캔 서비스 계정')).toContain('pii-agent-scan');
    expect(valueOf('테라폼 서비스 계정')).toContain('pii-agent-terraform');
    // 꼬리는 화면에서 사라진다 — 읽는 자리이지 전달하는 자리가 아니다.
    expect(valueOf('스캔 서비스 계정')).not.toContain('iam.gserviceaccount.com');
    expect(screen.queryByText('Scan Service Account')).toBeNull();
  });

  it('다른 프로젝트에서 빌려 온 계정도 이름만 적는다 — 전문은 복사가 진다', () => {
    const borrowed = 'pii-agent-scan@pii-agent-shared-99999.iam.gserviceaccount.com';
    renderHeader(detail(borrowed, terraform));
    expect(valueOf('스캔 서비스 계정')).toBe('pii-agent-scan');
    expect(screen.getByTitle(borrowed)).toBeTruthy();
  });

  it('주체 칸마다 복사가 서고, 복사되는 값은 전문이다', () => {
    renderHeader(detail(scan, terraform));
    expect(screen.getByLabelText('스캔 서비스 계정 복사')).toBeTruthy();
    expect(screen.getByLabelText('테라폼 서비스 계정 복사')).toBeTruthy();
    // 전문은 title 로도 닿는다 — 짧아진 이름 위에 걸린다.
    expect(screen.getByTitle(scan).textContent).toBe('pii-agent-scan');
  });

  it('프로젝트 칸에는 복사가 없다', () => {
    renderHeader(detail(scan, terraform));
    expect(valueOf('프로젝트')).toContain('pii-agent-prod-12345');
    expect(screen.queryByLabelText('프로젝트 복사')).toBeNull();
  });
});
