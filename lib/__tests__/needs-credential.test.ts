import { describe, expect, it } from 'vitest';
import { hasLogicalDatabases, needsCredential } from '@/lib/types';

describe('needsCredential', () => {
  // 판정을 허용 목록으로 두었을 때 mssql·oracle·mongodb 가 조용히 "불필요"로 떨어져
  // Credential 을 지정할 자리가 없어졌다. 기본값은 "필요"여야 새 엔진이 안 샌다.
  it.each(['mysql', 'postgresql', 'redshift', 'mssql', 'oracle', 'mongodb', 'mariadb', 'synapse'])(
    'is true for %s',
    (engine) => {
      expect(needsCredential(engine)).toBe(true);
    },
  );

  it.each(['athena', 'dynamodb', 'cosmosdb', 'bigquery'])('is false for %s', (engine) => {
    expect(needsCredential(engine)).toBe(false);
  });

  // 스캔 wire 는 `COSMOSDB`, 설치 요청 enum 은 `cosmosdb_nosql` — 두 표기가 같은 엔진이다.
  it('covers both spellings of CosmosDB', () => {
    expect(needsCredential('COSMOSDB')).toBe(false);
    expect(needsCredential('cosmosdb_nosql')).toBe(false);
  });

  it('is case-insensitive, because legacy scan data is uppercase', () => {
    expect(needsCredential('MSSQL')).toBe(true);
    expect(needsCredential('ATHENA')).toBe(false);
  });

  // 두 목록은 다르다: CosmosDB·BigQuery 는 자격 증명이 없어도 논리 DB 는 있다.
  it('is not the same list as hasLogicalDatabases', () => {
    expect(needsCredential('cosmosdb')).toBe(false);
    expect(hasLogicalDatabases('cosmosdb')).toBe(true);
    expect(needsCredential('bigquery')).toBe(false);
    expect(hasLogicalDatabases('bigquery')).toBe(true);
  });
});
