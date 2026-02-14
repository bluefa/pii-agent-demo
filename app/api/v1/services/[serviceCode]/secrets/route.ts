import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { getProjectsByServiceCode } from '@/lib/mock-data';

export const GET = withV1(async (_request, { requestId, params }) => {
  const projects = getProjectsByServiceCode(params.serviceCode);
  if (projects.length === 0) {
    return problemResponse(
      createProblem(
        'SERVICE_NOT_FOUND',
        `serviceCode "${params.serviceCode}"에 해당하는 서비스를 찾을 수 없습니다.`,
        requestId,
      ),
    );
  }

  const response = await client.projects.credentials(projects[0].id);
  if (!response.ok) return response;

  // Swagger: response is SecretEntry[] (array), legacy returns { credentials: [...] }
  const data = await response.json() as { credentials: unknown[] };
  return NextResponse.json(data.credentials);
});
