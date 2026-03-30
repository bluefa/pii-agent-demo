import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { resolveSwaggerSpecName } from '@/lib/swagger/specs';

interface RouteProps {
  params: Promise<{ swaggerFileName: string }>;
}

export const GET = async (_request: Request, { params }: RouteProps) => {
  const { swaggerFileName } = await params;
  const specName = resolveSwaggerSpecName(swaggerFileName);

  if (!specName) {
    return NextResponse.json(
      {
        error: {
          code: 'SWAGGER_SPEC_NOT_FOUND',
          message: '지원하지 않는 Swagger 파일입니다.',
        },
      },
      { status: 404 }
    );
  }

  const specPath = path.join(process.cwd(), 'docs', 'swagger', `${specName}.yaml`);

  try {
    const yamlContent = await readFile(specPath, 'utf-8');
    return new NextResponse(yamlContent, {
      status: 200,
      headers: {
        'content-type': 'application/yaml; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'SWAGGER_SPEC_READ_ERROR',
          message: 'Swagger 파일을 읽는 중 오류가 발생했습니다.',
        },
      },
      { status: 500 }
    );
  }
};
