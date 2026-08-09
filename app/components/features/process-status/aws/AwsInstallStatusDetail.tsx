'use client';

import { useMemo } from 'react';
import { borderColors, cn, stackGap, textColors, textStyles } from '@/lib/theme';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { formatDateTime } from '@/lib/utils/date';
import {
  InstallStatusDetail,
  type InstallPanelStep,
} from '@/app/components/features/process-status/install-status-detail/InstallStatusDetail';
import {
  INSTALL_STATUS_LABEL,
  type InstallDetailResource,
  type InstallReferenceStep,
  type InstallResourceMeta,
  type InstallTableStep,
} from '@/app/components/features/process-status/install-status-detail/model';
import { TerraformScriptPanel } from '@/app/components/features/process-status/aws/TerraformScriptPanel';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AwsInstallationStatus } from '@/lib/types';

/**
 * AWS Step-4 install status — maps the AWS domain (resource-centric
 * AwsInstallationStatusResponse) onto the shared InstallStatusDetail layout.
 * Auto mode leads with the Terraform role-verify panel step; manual mode hides
 * it and relabels the service step as a direct apply.
 */

const RoleVerifyPanel = ({ status }: { status: AwsInstallationStatus }) => (
  // 라벨↔값은 한 덩어리(tight), 항목끼리는 형제(related).
  <div className={cn('rounded-xl border px-5 py-4 flex flex-col', stackGap.related, borderColors.default)}>
    <div className={cn('flex items-center', stackGap.group, textStyles.body)}>
      <span className={cn('w-24 flex-shrink-0', textColors.tertiary)}>검증 결과</span>
      <span className={textColors.primary}>{INSTALL_STATUS_LABEL[status.roleVerify.status]}</span>
    </div>
    <div className={cn('flex items-center', stackGap.group, textStyles.body)}>
      <span className={cn('w-24 flex-shrink-0', textColors.tertiary)}>Role ARN</span>
      {status.roleVerify.roleArn ? (
        <span className="inline-flex items-center gap-1.5 min-w-0 group">
          <span className={cn('font-mono break-all', textStyles.caption, textColors.primary)}>
            {status.roleVerify.roleArn}
          </span>
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
      <div className={cn('flex items-center', stackGap.group, textStyles.body)}>
        <span className={cn('w-24 flex-shrink-0', textColors.tertiary)}>확인 시각</span>
        <span className={textColors.primary}>{formatDateTime(status.lastCheck.checkedAt)}</span>
      </div>
    )}
  </div>
);

// Execution order = service-side TF → BDC common → BDC service (common before
// service — confirmed step order).
const buildSteps = (manualInstall: boolean): InstallTableStep[] => [
  {
    id: 'service',
    title: manualInstall ? 'Terraform 직접 적용' : '서비스 측 Terraform 자동 적용',
    side: '서비스측 리소스 생성',
    // Only manual mode is executed by the service owner — in auto mode BDC
    // deploys, so the step joins the 'auto' group with no action copy.
    group: manualInstall ? 'todo' : 'auto',
    serviceAction: manualInstall
      ? '다운로드한 Terraform 스크립트를 서비스 AWS 계정에 직접 적용해 주세요.'
      : undefined,
    desc: manualInstall
      ? '다운로드한 Terraform 스크립트를 서비스 AWS 계정에 직접 적용합니다.'
      : '리소스별 Private Endpoint / IAM Role / Glue Policy 설정을 Terraform으로 자동 배포합니다.',
  },
  {
    id: 'bdcCommon',
    title: 'BDC 공통 영역',
    side: 'BDC측 리소스 생성',
    group: 'auto',
    desc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',
  },
  {
    id: 'bdcService',
    title: 'BDC 서비스 영역',
    side: 'BDC측 리소스 생성',
    group: 'auto',
    desc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',
  },
];

interface AwsInstallStatusDetailProps {
  status: AwsInstallationStatus;
  confirmed: readonly ConfirmedResource[];
  manualInstall: boolean;
  targetSourceId: number;
}

export const AwsInstallStatusDetail = ({
  status,
  confirmed,
  manualInstall,
  targetSourceId,
}: AwsInstallStatusDetailProps) => {
  const steps = useMemo(() => buildSteps(manualInstall), [manualInstall]);

  const reference = useMemo<InstallReferenceStep>(() => {
    // 설명은 실제 단계 이름을 인용한다 — 수동 설치에서는 그 단계가 'Terraform 직접 적용'
    // 이라, 자동 설치 문구를 박아두면 화면이 절반의 경우에 거짓말을 한다.
    const serviceStepTitle = steps.find((s) => s.id === 'service')!.title;
    return {
      id: 'tfScript',
      title: 'Terraform Script',
      desc: `${serviceStepTitle} 단계에서 수행하는 Terraform 작업 내역을 미리 확인할 수 있습니다.`,
      panel: <TerraformScriptPanel targetSourceId={targetSourceId} />,
    };
  }, [steps, targetSourceId]);

  const panelSteps = useMemo<InstallPanelStep[]>(
    () =>
      manualInstall
        ? []
        : [
            {
              id: 'perm',
              title: 'Terraform 권한 부여 확인',
              side: '서비스측 확인',
              group: 'todo',
              serviceAction: '대상 AWS 계정에 Terraform 실행용 IAM Role / AssumeRole 권한을 부여해 주세요.',
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

  const meta = useMemo(() => {
    const map = new Map<string, InstallResourceMeta>();
    for (const c of confirmed) {
      // Athena 설치 상태는 리전+카탈로그 단위(`athena:<acct>:<region>/<catalog>`)로 오고
      // 확정 정보는 DB 단위(`…:<catalog>/<db>`)라 resource_id 가 어긋난다. 같은 리전의
      // DB 행으로 리전 단위 키도 채워야 Database Type / Region 이 비지 않는다.
      const regionId = c.athenaRegionResourceId;
      if (regionId && !map.has(regionId)) {
        map.set(regionId, {
          resourceName: null,
          region: c.region,
          databaseType: c.databaseType,
          resourceType: c.type,
        });
      }
      map.set(c.resourceId, {
        resourceName: c.resourceName,
        region: c.region,
        databaseType: c.databaseType,
        resourceType: c.type,
      });
    }
    return map;
  }, [confirmed]);

  return (
    <InstallStatusDetail
      lastCheck={status.lastCheck}
      resources={resources}
      steps={steps}
      panelSteps={panelSteps}
      meta={meta}
      reference={reference}
    />
  );
};
