import {
  isSettledInstallStatus,
  type InstallStepCell,
} from '@/app/components/features/process-status/install-status-detail/model';
import {
  installStepTitle,
  type InstallPendingInput,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';
import type { InstallResourceListRow } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallResourceListModal';

type Owner = 'service' | 'bdc';
export interface InstallTask {
  id: string;
  owner: Owner;
  title: string;
  description: string;
  state: 'needed' | 'waiting' | 'done' | 'check';
  label: string;
  rows: InstallResourceListRow[];
}

interface TaskDefinition {
  id: string;
  owner: Owner;
  keys: string[];
  title: string;
  description: string;
  requires?: string[];
  waitingFor?: Owner;
  include?: (cell: InstallStepCell) => boolean;
}

const definitionsFor = (provider: string, manualInstall: boolean): TaskDefinition[] => {
  switch (provider) {
    case 'aws':
      return [
        ...(manualInstall ? [{
          id: 'service', owner: 'service' as const, keys: ['service'],
          title: '서비스 측 Terraform 수동 적용',
          description: '서비스 담당자가 제공된 스크립트를 서비스 AWS 계정에 직접 적용해야 합니다.',
        }] : []),
        {
          id: 'bdc', owner: 'bdc',
          keys: manualInstall ? ['bdcCommon', 'bdcService'] : ['service', 'bdcCommon', 'bdcService'],
          title: manualInstall ? 'BDC 측 후속 설치' : 'AWS 자동 설치',
          description: manualInstall
            ? '인프라 작업 탭에서 BDC 측 리소스 설치를 진행해 주세요.'
            : '인프라 작업 탭에서 서비스 계정 및 BDC 측 리소스 설치를 진행해 주세요.',
          requires: manualInstall ? ['service'] : [], waitingFor: 'service',
        },
      ];
    case 'azure':
      return [
        { id: 'vm', owner: 'service', keys: ['vmSubnet', 'vmApply'], title: 'VM 연동 준비',
          description: '서비스 담당자가 VM Subnet 구성 및 VM용 Terraform 적용을 진행해야 합니다.' },
        { id: 'bdc', owner: 'bdc', keys: ['bdc'], title: 'BDC 인프라 구성 및 연결 요청',
          description: 'BDC 측 리소스를 구성하고 Private Endpoint 연결을 요청해 주세요.',
          requires: ['vmSubnet', 'vmApply'], waitingFor: 'service' },
        { id: 'pe', owner: 'service', keys: ['pe'], title: 'Private Endpoint 연결 승인',
          description: '서비스 담당자가 Azure Portal에서 BDC 측 연결 요청을 승인해야 합니다.',
          requires: ['bdc'], waitingFor: 'bdc',
          include: (cell) => cell.status !== 'FAIL' && cell.status !== 'UNKNOWN' },
        { id: 'peReview', owner: 'bdc', keys: ['pe'], title: 'Private Endpoint 연결 요청 확인',
          description: 'BDC 측에서 연결 요청 상태를 확인해 주세요. 재신청이 필요한 대상은 상세 안내를 확인해 주세요.',
          include: (cell) => cell.status === 'FAIL' || cell.status === 'UNKNOWN' },
      ];
    case 'gcp':
      return [
        { id: 'subnet', owner: 'service', keys: ['subnet'], title: '연동용 Subnet 준비',
          description: '서비스 담당자가 서비스 프로젝트에 연동에 필요한 Subnet을 생성해야 합니다.' },
        { id: 'bdc', owner: 'bdc', keys: ['service', 'bdc'], title: '서비스 프로젝트 및 BDC 측 Terraform 적용',
          description: '서비스 프로젝트와 BDC 측 Terraform 적용은 BDC 담당자가 진행합니다.',
          requires: ['subnet'], waitingFor: 'service' },
      ];
    case 'idc':
      return [
        { id: 'bdc', owner: 'bdc', keys: ['cx', 'bdp'], title: 'BDC 측 리소스 구성',
          description: 'DB 접근에 필요한 CX·BDP 영역의 설치를 진행해 주세요.' },
        { id: 'firewall', owner: 'service', keys: ['firewall'], title: '방화벽 접근 허용',
          description: '서비스 담당자가 BDC 측 출발지 → 연동 대상 IP·Port의 접근을 허용해야 합니다. 방화벽 등록은 BDC 설치와 병행할 수 있고, 접근 확인은 설치 완료 후 가능합니다.',
          waitingFor: 'bdc' },
      ];
    default:
      return [];
  }
};

/** Assign work by executor, not by the account where Terraform creates resources. */
export const buildInstallTasks = ({ provider, manualInstall, detail }: InstallPendingInput): InstallTask[] => {
  if (!detail || detail.unavailable || detail.lastCheck?.status === 'FAILED' || !detail.resources.length) return [];

  const role = provider === 'aws' && !manualInstall ? detail.roleVerify : undefined;
  const tasks: InstallTask[] = [];
  if (role && role.status !== 'SKIP') {
    const done = isSettledInstallStatus(role.status);
    tasks.push({
      id: 'permission', owner: 'service', title: 'Terraform 실행 권한 설정',
      description: '서비스 담당자가 AWS 자동 설치를 위한 Terraform 실행 권한을 설정해야 합니다.',
      state: done ? 'done' : 'check', label: done ? '완료' : '권한 확인 필요', rows: [],
    });
  }

  for (const definition of definitionsFor(provider, manualInstall)) {
    let applicable = 0;
    let actionable = 0;
    let uncertain = 0;
    const rows: InstallResourceListRow[] = [];
    for (const resource of detail.resources) {
      for (const key of definition.keys) {
        const cell = resource.cells[key];
        if (!cell || cell.status === 'SKIP' || (definition.include && !definition.include(cell))) continue;
        applicable++;
        if (isSettledInstallStatus(cell.status)) continue;
        rows.push({
          resourceId: resource.resourceId, resourceName: resource.resourceName,
          stepTitle: installStepTitle(provider, manualInstall, key), status: cell.status, guide: cell.guide,
        });
        const prerequisitesDone = (definition.requires ?? []).every(
          (dependency) => isSettledInstallStatus(resource.cells[dependency]?.status ?? 'UNKNOWN'),
        ) && (!role || isSettledInstallStatus(role.status));
        if (cell.status === 'UNKNOWN' || cell.status === 'FAIL') uncertain++;
        else if (prerequisitesDone && !(definition.owner === 'service' && cell.status === 'BDC_INSTALL_REQUIRED')) actionable++;
      }
    }
    if (!applicable) continue;
    // Count dependencies per resource: one blocked DB must not block another ready DB.
    let state: InstallTask['state'] = 'waiting';
    if (!rows.length) state = 'done';
    else if (actionable) state = 'needed';
    else if (uncertain) state = 'check';

    const waitingOwner = definition.waitingFor === 'service' ? '서비스' : 'BDC';
    const labels: Record<InstallTask['state'], string> = {
      done: '완료', needed: '작업 필요', check: '상태 확인 필요', waiting: `${waitingOwner} 작업 대기`,
    };
    let description = definition.description;
    if (state === 'done') description = '해당 작업이 완료되었습니다.';
    if (state === 'waiting') {
      description = `${waitingOwner} 측 선행 작업이 완료된 후 진행할 수 있습니다.`;
      if (provider === 'idc' && definition.id === 'firewall') {
        description = 'BDC 설치 후 접근 여부를 확인할 수 있습니다. 서비스 담당자의 방화벽 등록은 미리 진행할 수 있습니다.';
      }
    }
    if (state === 'check' && definition.id !== 'peReview') {
      description = '아직 작업 완료 여부를 확인하지 못했습니다. 대상 리소스의 상태와 상세 안내를 확인해 주세요.';
    }
    tasks.push({ id: definition.id, owner: definition.owner, title: definition.title, description, state, label: labels[state], rows });
  }
  return tasks;
};
