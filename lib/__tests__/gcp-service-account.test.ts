import { describe, expect, it } from 'vitest';
import { gcpServiceAccountDisplay } from '@/lib/constants/gcp-service-account';

describe('gcpServiceAccountDisplay', () => {
  it('이 대상의 프로젝트 아래면 이름만 남긴다', () => {
    expect(gcpServiceAccountDisplay('pii-agent-scan@sea-rvw-prd.iam.gserviceaccount.com')).toBe(
      'pii-agent-scan',
    );
  });

  it('다른 프로젝트의 계정도 이름만 남긴다 (오너 2026-08-27)', () => {
    // 접미사를 증거로 남기던 규칙은 폐기됐다 — 전문은 복사 값·title·「상세 정보」에 있다.
    expect(gcpServiceAccountDisplay('pii-agent-scan@other-project.iam.gserviceaccount.com')).toBe(
      'pii-agent-scan',
    );
  });

  it('@ 앞이 비면 통째로 남긴다 — 칸이 비어 보이지 않는다', () => {
    const headless = '@sea-rvw-prd.iam.gserviceaccount.com';
    expect(gcpServiceAccountDisplay(headless)).toBe(headless);
    expect(gcpServiceAccountDisplay('pii-agent-scan')).toBe('pii-agent-scan');
  });
});
