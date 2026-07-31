import { describe, expect, it } from 'vitest';
import { getResourceDisplayName } from '@/lib/resource/display-name';

describe('getResourceDisplayName', () => {
  it('prefers the BFF resource name over the id tail', () => {
    // dynamodb region ids have no meaningful tail — the wire name is the only
    // correct label.
    expect(
      getResourceDisplayName({
        resourceId: 'dynamodb:451814760281:ap-northeast-2',
        resourceName: 'dynamodb:451814760281:ap-northeast-2',
      }),
    ).toBe('dynamodb:451814760281:ap-northeast-2');
  });

  it('falls back to the id tail when no name is published', () => {
    expect(
      getResourceDisplayName({
        resourceId: 'athena:804656952396:ap-northeast-1:AwsDataCatalog/sampledb',
      }),
    ).toBe('sampledb');
    expect(
      getResourceDisplayName({
        resourceId: 'arn:aws:rds:ap-northeast-2:804656952396:cluster:database-1',
        resourceName: '   ',
      }),
    ).toBe('database-1');
  });
});
