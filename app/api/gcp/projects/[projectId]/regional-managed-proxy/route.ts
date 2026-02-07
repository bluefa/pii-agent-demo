import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { GCP_ERROR_CODES } from '@/lib/constants/gcp';

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await dataAdapter.getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: GCP_ERROR_CODES.UNAUTHORIZED.code, message: GCP_ERROR_CODES.UNAUTHORIZED.message },
      { status: GCP_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  const project = await dataAdapter.getProjectById(projectId);
  if (!project) {
    return NextResponse.json(
      { error: GCP_ERROR_CODES.NOT_FOUND.code, message: GCP_ERROR_CODES.NOT_FOUND.message },
      { status: GCP_ERROR_CODES.NOT_FOUND.status }
    );
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: GCP_ERROR_CODES.FORBIDDEN.code, message: GCP_ERROR_CODES.FORBIDDEN.message },
      { status: GCP_ERROR_CODES.FORBIDDEN.status }
    );
  }

  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get('resourceId') || '';

  if (!resourceId) {
    return NextResponse.json(
      { error: GCP_ERROR_CODES.VALIDATION_FAILED.code, message: 'resourceId 파라미터가 필요합니다.' },
      { status: GCP_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  const result = await dataAdapter.getGcpRegionalManagedProxy(projectId, resourceId);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
};

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const user = await dataAdapter.getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: GCP_ERROR_CODES.UNAUTHORIZED.code, message: GCP_ERROR_CODES.UNAUTHORIZED.message },
      { status: GCP_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  const project = await dataAdapter.getProjectById(projectId);
  if (!project) {
    return NextResponse.json(
      { error: GCP_ERROR_CODES.NOT_FOUND.code, message: GCP_ERROR_CODES.NOT_FOUND.message },
      { status: GCP_ERROR_CODES.NOT_FOUND.status }
    );
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: GCP_ERROR_CODES.FORBIDDEN.code, message: GCP_ERROR_CODES.FORBIDDEN.message },
      { status: GCP_ERROR_CODES.FORBIDDEN.status }
    );
  }

  const body = await request.json();
  const { resourceId } = body;

  if (!resourceId) {
    return NextResponse.json(
      { error: GCP_ERROR_CODES.VALIDATION_FAILED.code, message: 'resourceId가 필요합니다.' },
      { status: GCP_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }

  const result = await dataAdapter.createGcpProxySubnet(projectId, resourceId);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
};
