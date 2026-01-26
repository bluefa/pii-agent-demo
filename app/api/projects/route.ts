import { NextResponse } from 'next/server';
import { getCurrentUser, addProject, generateId, mockServiceCodes } from '@/lib/mock-data';
import { ProcessStatus, Project, CloudProvider } from '@/lib/types';

export async function POST(request: Request) {
  const user = getCurrentUser();

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 과제를 등록할 수 있습니다.' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { projectCode, serviceCode, cloudProvider, description } = body as {
    projectCode: string;
    serviceCode: string;
    cloudProvider: CloudProvider;
    description?: string;
  };

  if (!projectCode || !serviceCode || !cloudProvider) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: '필수 필드가 누락되었습니다.' },
      { status: 400 }
    );
  }

  if (!mockServiceCodes.find((s) => s.code === serviceCode)) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '존재하지 않는 서비스 코드입니다.' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const newProject: Project = {
    id: generateId('proj'),
    projectCode,
    serviceCode,
    cloudProvider,
    processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
    resources: [],
    terraformState: cloudProvider === 'AWS'
      ? { serviceTf: 'PENDING', bdcTf: 'PENDING' }
      : { bdcTf: 'PENDING' },
    createdAt: now,
    updatedAt: now,
    name: projectCode,
    description: description || '',
    isRejected: false,
  };

  addProject(newProject);

  return NextResponse.json({ project: newProject }, { status: 201 });
}
