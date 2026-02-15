import { client } from '@/lib/api-client';

export const POST = async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  // v2 route: projectId는 body.accountId 기반으로 mock에서 처리
  // BFF 모드에서는 projectId 무시하고 body를 그대로 전달
  return client.aws.verifyTfRole('', body);
};
