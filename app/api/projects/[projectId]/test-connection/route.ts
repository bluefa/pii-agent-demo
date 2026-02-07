import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { ProcessStatus, ResourceLifecycleStatus, ConnectionStatus, ConnectionTestResult, ConnectionTestHistory, needsCredential, ProjectStatus } from '@/lib/types';
import { getCurrentStep } from '@/lib/process';

interface ResourceCredentialInput {
  resourceId: string;
  credentialId?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await dataAdapter.getCurrentUser();
  const { projectId } = await params;

  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  const project = await dataAdapter.getProjectById(projectId);

  if (!project) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '해당 과제에 대한 권한이 없습니다.' },
      { status: 403 }
    );
  }

  // 4단계(연결 테스트), 5단계(연결 확인), 6단계(완료)에서 테스트 가능
  if (project.processStatus !== ProcessStatus.WAITING_CONNECTION_TEST &&
      project.processStatus !== ProcessStatus.CONNECTION_VERIFIED &&
      project.processStatus !== ProcessStatus.INSTALLATION_COMPLETE) {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: '연결 테스트가 필요한 상태가 아닙니다.' },
      { status: 400 }
    );
  }

  // Request body에서 resourceCredentials 가져오기
  let resourceCredentials: ResourceCredentialInput[] = [];
  try {
    const body = await request.json();
    resourceCredentials = body.resourceCredentials || [];
  } catch {
    // body가 없으면 빈 배열로 처리
  }

  // 선택된 리소스들에 대해 테스트 실행
  const selectedResources = project.resources.filter((r) => r.isSelected);

  // resourceCredentials를 map으로 변환
  const credentialMap = new Map<string, string | undefined>();
  resourceCredentials.forEach((rc) => {
    credentialMap.set(rc.resourceId, rc.credentialId);
  });

  // 각 리소스에 대해 시뮬레이션
  const results: ConnectionTestResult[] = await Promise.all(selectedResources.map(async (r) => {
    const credentialId = credentialMap.get(r.id);
    const credential = credentialId ? await dataAdapter.getCredentialById(credentialId) : undefined;
    return dataAdapter.simulateConnectionTest(
      r.resourceId,
      r.type,
      r.databaseType,
      credentialId,
      credential?.name
    );
  }));

  // 성공/실패 카운트
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const allSuccess = failCount === 0;

  // History 생성
  const historyEntry: ConnectionTestHistory = {
    id: await dataAdapter.generateId('history'),
    executedAt: new Date().toISOString(),
    status: allSuccess ? 'SUCCESS' : 'FAIL',
    successCount,
    failCount,
    results,
  };

  // 리소스 상태 업데이트 (selectedCredentialId도 저장)
  const updatedResources = project.resources.map((r) => {
    if (!r.isSelected) return r;

    const credentialId = credentialMap.get(r.id);
    const result = results.find((res) => res.resourceId === r.resourceId);

    if (!result) {
      return {
        ...r,
        selectedCredentialId: credentialId,
      };
    }

    if (result.success) {
      return {
        ...r,
        connectionStatus: 'CONNECTED' as ConnectionStatus,
        lifecycleStatus: 'ACTIVE' as ResourceLifecycleStatus,
        isNew: false,
        note: r.note === 'NEW' ? undefined : r.note,
        selectedCredentialId: credentialId,
      };
    } else {
      return {
        ...r,
        connectionStatus: 'DISCONNECTED' as ConnectionStatus,
        selectedCredentialId: credentialId,
      };
    }
  });

  // 기존 히스토리에 추가 (최신이 앞으로)
  const existingHistory = project.connectionTestHistory || [];
  const updatedHistory = [historyEntry, ...existingHistory];

  // 프로젝트 업데이트
  // 4단계에서 첫 성공 시 5단계(CONNECTION_VERIFIED)로 전환
  const shouldUpdateConnectionTest = allSuccess && project.status.connectionTest.status !== 'PASSED';

  // 최초 연결 성공 시간 기록 (기존에 기록이 없을 때만)
  const isFirstSuccess = allSuccess && !project.piiAgentConnectedAt;
  const now = new Date().toISOString();

  // status 필드 업데이트 (ADR-004)
  const updatedStatus: ProjectStatus = shouldUpdateConnectionTest
    ? {
        ...project.status,
        connectionTest: {
          status: 'PASSED',
          lastTestedAt: now,
          passedAt: now,
        },
      }
    : {
        ...project.status,
        connectionTest: {
          ...project.status.connectionTest,
          status: allSuccess ? 'PASSED' : 'FAILED',
          lastTestedAt: now,
        },
      };

  // 계산된 processStatus
  const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

  const updatedProject = await dataAdapter.updateProject(projectId, {
    resources: updatedResources,
    connectionTestHistory: updatedHistory,
    status: updatedStatus,
    processStatus: calculatedProcessStatus,
    ...(isFirstSuccess ? { piiAgentConnectedAt: now } : {}),
  });

  return NextResponse.json({
    success: allSuccess,
    project: updatedProject,
    history: historyEntry,
  });
}
