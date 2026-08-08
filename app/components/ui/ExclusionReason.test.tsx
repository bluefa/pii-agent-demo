// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExclusionReason } from '@/app/components/ui/ExclusionReason';

describe('ExclusionReason', () => {
  it('prints a user-written reason in full, with no code line', () => {
    render(<ExclusionReason reason="읽기 전용 복제본이라 원본만 연동" />);
    expect(screen.getByText('읽기 전용 복제본이라 원본만 연동')).toBeTruthy();
    expect(screen.queryByText(/^[A-Z_]+$/)).toBeNull();
  });

  // 15자로 자르던 시절 세 enum 은 전부 앞부분을 공유해 서로 구별되지 않았다.
  it('labels a scan verdict in Korean and keeps the raw enum underneath', () => {
    render(
      <ExclusionReason recommendFailReason="AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED" />,
    );
    expect(screen.getByText('Private Endpoint 연결 실패')).toBeTruthy();
    expect(
      screen.getByText('AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED'),
    ).toBeTruthy();
  });

  // 요청 어댑터가 판정 코드를 exclusion_reason 에 그대로 써 넣는 경로 — 어느 필드로 들어와도
  // 사용자에게는 코드가 아니라 한국어 한 줄이 보여야 한다.
  it('labels a verdict that arrived through exclusion_reason', () => {
    render(<ExclusionReason reason="GCP_CLOUD_SQL_HAS_PUBLIC_IP" />);
    expect(screen.getByText('공인 IP가 설정된 Cloud SQL 인스턴스')).toBeTruthy();
    expect(screen.getByText('GCP_CLOUD_SQL_HAS_PUBLIC_IP')).toBeTruthy();
  });

  // 대상 행은 사유가 없다 — em-dash 는 "있어야 하는데 빠졌다"로 읽힌다.
  it('renders nothing when there is no reason at all', () => {
    const { container } = render(<ExclusionReason />);
    expect(container.firstChild).toBeNull();
  });

  // 계약에 없는 값은 라벨을 지어내지 않고 원문 그대로 보여준다.
  it('passes an unrecognised code through verbatim rather than inventing a label', () => {
    render(<ExclusionReason recommendFailReason="SOME_FUTURE_REASON" />);
    expect(screen.getByText('SOME_FUTURE_REASON')).toBeTruthy();
  });
});
