import { describe, expect, it } from 'vitest';
import { gcpServiceAccountDisplay } from '@/lib/constants/gcp-service-account';

describe('gcpServiceAccountDisplay', () => {
  it('이 대상의 프로젝트 아래면 이름만 남긴다', () => {
    expect(
      gcpServiceAccountDisplay('pii-agent-scan@sea-rvw-prd.iam.gserviceaccount.com', 'sea-rvw-prd'),
    ).toBe('pii-agent-scan');
  });

  it('다른 프로젝트의 계정은 주소를 통째로 남긴다 — 접미사가 어긋남의 유일한 증거다', () => {
    const borrowed = 'pii-agent-scan@other-project.iam.gserviceaccount.com';
    expect(gcpServiceAccountDisplay(borrowed, 'sea-rvw-prd')).toBe(borrowed);
  });

  it('프로젝트를 모르면 자르지 않는다', () => {
    const sa = 'pii-agent-scan@sea-rvw-prd.iam.gserviceaccount.com';
    expect(gcpServiceAccountDisplay(sa, '')).toBe(sa);
  });
});
