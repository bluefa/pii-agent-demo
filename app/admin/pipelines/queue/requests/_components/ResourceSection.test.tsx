// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResourceSection } from '@/app/admin/pipelines/queue/requests/_components/ResourceSection';
import { useResourceListState } from '@/app/admin/pipelines/queue/requests/_resourceQuery';
import { required } from '@/lib/test-dom';
import type { RequestResourceRow } from '@/app/lib/api/task-queue-requests';

const athena = (region: string, database: string): RequestResourceRow => ({
  resourceId: `athena:acct:${region}:AwsDataCatalog/${database}`,
  resourceName: database,
  selected: true,
  exclusionReason: null,
  integrationCategory: null,
  recommendFailReason: null,
  databaseType: 'athena',
  region,
  idcKind: null,
  connectTargets: [],
  port: null,
  oracleSid: null,
  sourceIps: [],
  nlbIndex: null,
  resourceType: 'AWS_ATHENA_DATABASE',
  rdsInstanceCandidates: [],
  selectedRdsInstanceResourceId: null,
});

const mysql = (name: string): RequestResourceRow => ({
  ...athena('ap-northeast-2', name),
  resourceId: `arn:aws:rds:ap-northeast-2:acct:db:${name}`,
  databaseType: 'mysql',
  resourceType: 'AWS_DB_INSTANCE',
});

/** The hook lives in the section's caller, so the test supplies it the same way the page does. */
const Harness = ({ resources }: { resources: readonly RequestResourceRow[] }) => (
  <ResourceSection
    resources={resources}
    isIdc={false}
    list={useResourceListState()}
    nlbLocked
    onAssignNlb={() => {}}
  />
);

describe('ResourceSection — pagination counts units, not rows', () => {
  // 한 Athena 리전이 데이터베이스 전부를 데리고 한 칸을 차지한다. 평평하게 자르면 12행이
  // 10/2 로 갈리고, 부모 행이 두 페이지에 걸쳐 두 번 그려진다.
  it('keeps a group of eleven databases whole on one page', () => {
    const databases = Array.from({ length: 11 }, (_, i) => athena('us-east-1', `db_${i}`));
    render(<Harness resources={[...databases, mysql('mysql-prod-01')]} />);

    // 12 rows → 2 units, so page 2 never exists.
    expect(screen.getByRole('button', { name: '1 페이지' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '2 페이지' })).toBeNull();

    const body = required(
      document.getElementById(
        required(
          screen
            .getByRole('button', { name: /^Athena us-east-1 그룹 / })
            .getAttribute('aria-controls'),
          'the parent chevron aria-controls',
        ),
      ),
      'the group body',
    );
    expect(body.querySelectorAll('tr')).toHaveLength(11);
    expect(screen.getByText('mysql-prod-01')).toBeTruthy();
  });

  // 그룹이 없는 목록은 지금까지와 똑같이 한 행이 한 칸이다.
  it('still pages a flat list by rows', () => {
    render(<Harness resources={Array.from({ length: 12 }, (_, i) => mysql(`mysql-${i}`))} />);
    expect(screen.getByRole('button', { name: '2 페이지' })).toBeTruthy();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(10);
  });
});
