import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { AwsResourceType, DatabaseType } from '@/lib/types';

const awsTypeToDatabaseType = (awsType: AwsResourceType): DatabaseType => {
  switch (awsType) {
    case 'RDS':
    case 'RDS_CLUSTER':
      // RDS는 MySQL이나 PostgreSQL일 수 있음 - 랜덤 선택
      return Math.random() > 0.5 ? 'MYSQL' : 'POSTGRESQL';
    case 'DYNAMODB':
      return 'DYNAMODB';
    case 'ATHENA':
      return 'ATHENA';
    case 'REDSHIFT':
      return 'REDSHIFT';
    default:
      return 'MYSQL';
  }
};

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

  // IDC는 스캔 기능 없음
  if (project.cloudProvider === 'IDC') {
    return NextResponse.json(
      { error: 'NOT_SUPPORTED', message: 'IDC 환경에서는 스캔 기능을 지원하지 않습니다.' },
      { status: 400 }
    );
  }

  // Mock: 50% 확률로 새 리소스 발견
  const shouldAddNew = Math.random() > 0.5;
  let newResourcesFound = 0;
  const updatedResources = [...project.resources];

  if (shouldAddNew) {
    const awsTypes = ['RDS', 'RDS_CLUSTER', 'DYNAMODB', 'ATHENA', 'REDSHIFT'] as const;
    const regions = ['ap-northeast-2', 'ap-northeast-1', 'us-east-1'] as const;
    const accountIds = ['123456789012', '210987654321'] as const;

    const awsType = awsTypes[Math.floor(Math.random() * awsTypes.length)];
    const region = regions[Math.floor(Math.random() * regions.length)];
    const accountId = accountIds[Math.floor(Math.random() * accountIds.length)];

    const rand = Math.random().toString(36).substring(2, 10);

    const makeArn = () => {
      // ARN 포맷(데모용):
      // RDS DB: arn:aws:rds:{region}:{accountId}:db:{dbIdentifier}
      // RDS Cluster: arn:aws:rds:{region}:{accountId}:cluster:{clusterIdentifier}
      // DynamoDB Table: arn:aws:dynamodb:{region}:{accountId}:table/{tableName}
      // Athena WorkGroup: arn:aws:athena:{region}:{accountId}:workgroup/{workGroupName}
      // Redshift Cluster: arn:aws:redshift:{region}:{accountId}:cluster:{clusterIdentifier}

      if (awsType === 'RDS') {
        return `arn:aws:rds:${region}:${accountId}:db:pii-demo-db-${rand}`;
      }

      if (awsType === 'RDS_CLUSTER') {
        return `arn:aws:rds:${region}:${accountId}:cluster:pii-demo-cluster-${rand}`;
      }

      if (awsType === 'DYNAMODB') {
        return `arn:aws:dynamodb:${region}:${accountId}:table/pii_demo_table_${rand}`;
      }

      if (awsType === 'ATHENA') {
        return `arn:aws:athena:${region}:${accountId}:workgroup/pii-demo-wg-${rand}`;
      }

      // REDSHIFT
      return `arn:aws:redshift:${region}:${accountId}:cluster:pii-demo-rs-${rand}`;
    };

    const newResource = {
      id: await dataAdapter.generateId('res'),
      type: awsType,
      resourceId: makeArn(),
      databaseType: awsTypeToDatabaseType(awsType),
      connectionStatus: 'PENDING' as const,
      isSelected: false,

      awsType,
      region,
      lifecycleStatus: 'DISCOVERED' as const,
      isNew: true,
      note: 'NEW',
    };

    updatedResources.push(newResource);
    newResourcesFound = 1;
  }

  const updatedProject = await dataAdapter.updateProject(projectId, {
    resources: updatedResources,
  });

  return NextResponse.json({
    success: true,
    newResourcesFound,
    resources: updatedProject?.resources || [],
  });
}
