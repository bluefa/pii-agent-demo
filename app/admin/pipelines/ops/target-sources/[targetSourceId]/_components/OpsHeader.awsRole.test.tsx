// @vitest-environment jsdom
/**
 * AWS 역할 칸 — GCP 주체 칸과 같은 문법 (오너 2026-08-27 "ScanRole도 그냥 gcp처럼
 * 정리할래?"). 라벨은 한국어이고, 값은 읽으라고 짧으며, 복사는 전문 ARN 을 싣는다.
 *
 * 줄이는 판정은 `awsRoleArnDisplay` 가 지므로 여기서 다시 하지 않는다 — 다만 **어떤 ARN
 * 이든** 이름만 남는지는 이 화면에서도 지킨다 (오너 08-27 "ㄴㄴ 정리하라고"): 교차 계정
 * ARN 이 혼자 길어지면 4열 그리드에서 그 칸만 잘린 채 서고, 정작 전문이 필요한 사람은
 * 잘린 글자를 손으로 옮겨 적게 된다. 전문은 복사·title·「상세 정보」가 진다.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const ACCOUNT = '451814760281';

const detail = (
  scanArn: string | undefined,
  executionArn: string | undefined,
): RawTargetSourceDetail => ({
  target_source_id: 1006,
  service_name: 'AWS',
  service_code: 'aws',
  cloud_provider: 'AWS',
  metadata: {
    is_sdu_type: false,
    aws_account_id: ACCOUNT,
    aws_scan_role_arn: scanArn,
    aws_terraform_execution_role_arn: executionArn,
  },
});

const renderHeader = (d: RawTargetSourceDetail): void => {
  render(
    <OpsHeader
      targetSourceId={1006}
      detail={d}
      processStatus={null}
      processLoaded
      isAws
      savedRoleArns={{}}
      grantTfExecution
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

// jsdom 에는 클립보드가 없다 — 복사가 **무엇을** 싣는지 보려면 여기서 세운다.
const writeText = vi.fn(async () => undefined);
beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

/** 라벨이 든 kv 셀의 값 줄 — 라벨은 제 줄(`fmKeyRow`)에 서므로 셀(div)까지 올라간다. */
const valueOf = (label: string): string =>
  screen.getByText(label).closest('div')?.children[1]?.textContent ?? '';

describe('OpsHeader — AWS 역할 칸', () => {
  const scan = `arn:aws:iam::${ACCOUNT}:role/BDCPIIInfraScanRole`;
  const execution = `arn:aws:iam::${ACCOUNT}:role/bdc-infra-terraform-worker-service-role`;

  it('라벨은 한국어이고, 제 계정의 ARN 은 role 이름만 적는다', () => {
    renderHeader(detail(scan, execution));
    expect(valueOf('스캔 역할')).toBe('BDCPIIInfraScanRole');
    expect(valueOf('테라폼 역할')).toBe('bdc-infra-terraform-worker-service-role');
    expect(screen.queryByText('Scan Role')).toBeNull();
    expect(screen.queryByText('Terraform Role')).toBeNull();
  });

  it('교차 계정 ARN 도 role 이름만 적는다 — 전문은 복사가 진다', () => {
    const borrowed = 'arn:aws:iam::999988887777:role/BDCPIIInfraScanRole';
    renderHeader(detail(borrowed, execution));
    expect(valueOf('스캔 역할')).toBe('BDCPIIInfraScanRole');
    expect(screen.getByTitle(`${borrowed} — 스캔 역할 수정`)).toBeTruthy();
  });

  it('역할 칸마다 복사가 서고, 복사되는 값은 표시형이 아니라 전문 ARN 이다', async () => {
    renderHeader(detail(scan, execution));
    expect(screen.getByLabelText('테라폼 역할 복사')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('스캔 역할 복사'));
    // 화면은 이름만 적지만, 남에게 넘어가는 것은 prefix 를 단 전문이다.
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(scan));
    // 전문은 수정 버튼의 title 로도 닿는다 — 짧아진 이름 위에 걸린다.
    expect(screen.getByTitle(`${scan} — 스캔 역할 수정`).textContent).toBe('BDCPIIInfraScanRole');
  });

  it('복사는 수정 모달을 열지 않는다 — 한 자리에 두 동작이 겹치지 않는다', async () => {
    const onOpenEdit = vi.fn();
    render(
      <OpsHeader
        targetSourceId={1006}
        detail={detail(scan, execution)}
        processStatus={null}
        processLoaded
        isAws
        savedRoleArns={{}}
        grantTfExecution
        supportRawData={undefined}
        jiraTicket={null}
        ticketLoaded
        onOpenMode={vi.fn()}
        onOpenEdit={onOpenEdit}
        onOpenRawData={vi.fn()}
        onEditDescription={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('스캔 역할 복사'));
    // 복사는 클릭 뒤 제 상태를 비동기로 바꾼다 — 기다리지 않으면 그 갱신이 act 밖에서 난다.
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(onOpenEdit).not.toHaveBeenCalled();
  });

  it('ARN 이 없으면 복사도 없다 — 넘길 것이 없다', () => {
    renderHeader(detail(undefined, execution));
    expect(valueOf('스캔 역할')).toBe('미등록');
    expect(screen.queryByLabelText('스캔 역할 복사')).toBeNull();
    expect(screen.getByLabelText('테라폼 역할 복사')).toBeTruthy();
  });
});
