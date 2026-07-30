'use client';

import { useMemo } from 'react';
import { borderColors, cn, textColors } from '@/lib/theme';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { formatDateTime } from '@/lib/utils/date';
import {
  InstallStatusDetail,
  type InstallPanelStep,
} from '@/app/components/features/process-status/install-status-detail/InstallStatusDetail';
import {
  INSTALL_STATUS_LABEL,
  type InstallDetailResource,
  type InstallResourceMeta,
  type InstallTableStep,
} from '@/app/components/features/process-status/install-status-detail/model';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AwsInstallationStatus } from '@/lib/types';

/**
 * AWS Step-4 install status — maps the AWS domain (resource-centric
 * AwsInstallationStatusResponse) onto the shared InstallStatusDetail layout.
 * Auto mode leads with the Terraform role-verify panel step; manual mode hides
 * it and relabels the service step as a direct apply.
 */

const RoleVerifyPanel = ({ status }: { status: AwsInstallationStatus }) => (
  <div className={cn('rounded-xl border px-5 py-4 flex flex-col gap-1', borderColors.default)}>
    <div className="flex gap-3 py-1.5 text-sm items-center">
      <span className={cn('w-24 flex-shrink-0', textColors.tertiary)}>검증 결과</span>
      <span className={textColors.primary}>{INSTALL_STATUS_LABEL[status.roleVerify.status]}</span>
    </div>
    <div className="flex gap-3 py-1.5 text-sm items-center">
      <span className={cn('w-24 flex-shrink-0', textColors.tertiary)}>Role ARN</span>
      {status.roleVerify.roleArn ? (
        <span className="inline-flex items-center gap-1.5 min-w-0 group">
          <span className={cn('font-mono text-[12px] break-all', textColors.primary)}>{status.roleVerify.roleArn}</span>
          <CopyButton
            value={status.roleVerify.roleArn}
            label="Role ARN 복사"
            className="opacity-0 group-hover:opacity-100"
          />
        </span>
      ) : (
        <span className={textColors.tertiary}>—</span>
      )}
    </div>
    {status.lastCheck.checkedAt && (
      <div className="flex gap-3 py-1.5 text-sm items-center">
        <span className={cn('w-24 flex-shrink-0', textColors.tertiary)}>확인 시각</span>
        <span className={textColors.primary}>{formatDateTime(status.lastCheck.checkedAt)}</span>
      </div>
    )}
  </div>
);

const buildSteps = (manualInstall: boolean): InstallTableStep[] => [
  {
    id: 'service',
    title: manualInstall ? 'Terraform 직접 적용' : 'Terraform 자동 적용',
    side: '서비스측 리소스 생성',
    desc: manualInstall
      ? '다운로드한 Terraform 스크립트를 서비스 AWS 계정에 직접 적용합니다.'
      : '리소스별 Private Endpoint / IAM Role / Glue Policy 설정을 Terraform으로 자동 배포합니다.',
  },
  {
    id: 'bdcService',
    title: 'BDC 서비스 영역',
    side: 'BDC측 리소스 생성',
    desc: '리소스별 BDC 계정 측 Private Endpoint Service / IAM Role 설정을 자동 배포합니다.',
  },
  {
    id: 'bdcCommon',
    title: 'BDC 공통 영역',
    side: 'BDC측 리소스 생성',
    desc: '대상 소스 공통 BDC 인프라 설정을 자동 배포합니다.',
  },
];

interface AwsInstallStatusDetailProps {
  status: AwsInstallationStatus;
  confirmed: readonly ConfirmedResource[];
  manualInstall: boolean;
}

export const AwsInstallStatusDetail = ({
  status,
  confirmed,
  manualInstall,
}: AwsInstallStatusDetailProps) => {
  const steps = useMemo(() => buildSteps(manualInstall), [manualInstall]);

  const panelSteps = useMemo<InstallPanelStep[]>(
    () =>
      manualInstall
        ? []
        : [
            {
              id: 'perm',
              title: 'Terraform 권한 부여 확인',
              side: '서비스측 확인',
              desc: '대상 AWS 계정에 Terraform 실행을 위한 IAM Role / AssumeRole 권한이 부여되었는지 검증합니다.',
              status: status.roleVerify.status,
              panel: <RoleVerifyPanel status={status} />,
            },
          ],
    [manualInstall, status],
  );

  const resources = useMemo<InstallDetailResource[]>(
    () =>
      status.resources.map((r) => ({
        resourceId: r.resourceId,
        resourceName: r.resourceName,
        rollup: { status: r.installationStatus, guide: null },
        cells: {
          service: r.serviceTerraform,
          bdcService: r.bdcServiceTerraform,
          bdcCommon: r.bdcCommonTerraform,
        },
      })),
    [status.resources],
  );

  const meta = useMemo(
    () =>
      new Map<string, InstallResourceMeta>(
        confirmed.map((c) => [
          c.resourceId,
          { resourceName: c.resourceName, region: c.region, databaseType: c.databaseType },
        ]),
      ),
    [confirmed],
  );

  return (
    <InstallStatusDetail
      lastCheck={status.lastCheck}
      resources={resources}
      steps={steps}
      panelSteps={panelSteps}
      meta={meta}
    />
  );
};
