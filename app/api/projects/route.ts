import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { ProcessStatus, Project, CloudProvider } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process';

export async function POST(request: Request) {
  const user = await dataAdapter.getCurrentUser();

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 과제를 등록할 수 있습니다.' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const {
    projectCode, serviceCode, cloudProvider, description,
    awsAccountId, awsRegionType, tenantId, subscriptionId, gcpProjectId,
  } = body as {
    projectCode: string;
    serviceCode: string;
    cloudProvider: CloudProvider;
    description?: string;
    awsAccountId?: string;
    awsRegionType?: 'global' | 'china';
    tenantId?: string;
    subscriptionId?: string;
    gcpProjectId?: string;
  };

  if (!projectCode || !serviceCode || !cloudProvider) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: '필수 필드가 누락되었습니다.' },
      { status: 400 }
    );
  }

  if (awsAccountId && !/^\d{12}$/.test(awsAccountId)) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'AWS Account ID는 12자리 숫자여야 합니다.' },
      { status: 400 }
    );
  }

  if (awsRegionType && !['global', 'china'].includes(awsRegionType)) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'AWS 리전 타입은 global 또는 china만 허용됩니다.' },
      { status: 400 }
    );
  }

  if (!(await dataAdapter.getServiceCodeByCode(serviceCode))) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '존재하지 않는 서비스 코드입니다.' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const initialStatus = createInitialProjectStatus();
  const newProject: Project = {
    id: await dataAdapter.generateId('proj'),
    projectCode,
    serviceCode,
    cloudProvider,
    processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    status: initialStatus,
    resources: [],
    terraformState: cloudProvider === 'AWS'
      ? { serviceTf: 'PENDING', bdcTf: 'PENDING' }
      : { bdcTf: 'PENDING' },
    createdAt: now,
    updatedAt: now,
    name: projectCode,
    description: description || '',
    isRejected: false,
    ...(awsAccountId && { awsAccountId }),
    ...(awsRegionType && { awsRegionType }),
    ...(tenantId && { tenantId }),
    ...(subscriptionId && { subscriptionId }),
    ...(gcpProjectId && { gcpProjectId }),
  };

  await dataAdapter.addProject(newProject);

  return NextResponse.json({ project: newProject }, { status: 201 });
}
