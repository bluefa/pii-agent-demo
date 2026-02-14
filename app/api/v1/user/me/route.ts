import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async () => {
  const response = await client.users.getMe();
  if (!response.ok) return response;

  // Swagger: flat { id, name, email }, legacy returns { user: { ... } }
  const data = await response.json() as { user: { id: string; name: string; email: string } };
  return NextResponse.json(data.user);
});
