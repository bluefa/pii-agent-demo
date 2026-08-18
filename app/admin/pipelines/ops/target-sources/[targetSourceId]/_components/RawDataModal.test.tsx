// @vitest-environment jsdom
/**
 * 모르는 값으로 열었을 때의 프레임.
 *
 * 이 다이얼로그가 설치 모드 다이얼로그와 갈리는 유일한 지점이다: 현재 값이 세 번째 상태
 * (응답에 필드 없음)일 수 있고, 그때 아무것도 체크하지 않는다. "미포함"에 미리 체크해 두면
 * 운영자가 확인한 적 없는 값을 확인된 값으로 읽고, 그대로 저장을 눌러 그 추측을 사실로
 * 굳힌다. 저장 게이트도 같은 이유로 "고르기 전엔 못 누른다" 여야 한다.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { RawDataModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/RawDataModal';

vi.mock('@/app/lib/api/ops', () => ({
  updateTargetSourceDoesSupportRaw: vi.fn(async () => undefined),
}));

const open = (current: boolean | undefined) =>
  render(
    <RawDataModal
      open
      onClose={vi.fn()}
      targetSourceId={1013}
      current={current}
      onSaved={vi.fn()}
    />,
  );

const save = () => screen.getByRole('button', { name: '변경' });

describe('RawDataModal — 미확인으로 열었을 때', () => {
  it('아무것도 선택하지 않고, 왜 그런지 적는다', () => {
    open(undefined);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.getAttribute('aria-checked')).toBe('false');
    }
    // "못 읽었다"가 아니다 — 실패한 것은 없고 계약이 아직 그 필드를 안 싣는다.
    expect(screen.getByText(/응답에 없습니다/)).toBeTruthy();
    expect(save().hasAttribute('disabled')).toBe(true);
  });

  it('알고 있는 값으로 열면 그 값이 체크되고, 같은 값으로는 저장할 수 없다', () => {
    open(true);
    expect(screen.getByRole('radio', { name: /실데이터 포함/ }).getAttribute('aria-checked')).toBe('true');
    expect(save().hasAttribute('disabled')).toBe(true);
  });
});
