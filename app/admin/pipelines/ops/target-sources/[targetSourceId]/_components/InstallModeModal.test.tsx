// @vitest-environment jsdom
/**
 * ⛔ THE TRAP. 업스트림의 이 PUT 은 void 를 답한다(오너 확인 2026-09-07). 응답에서 값을
 * 읽으려 들면 성사된 쓰기가 「변경에 실패했습니다」로 보인다 — 204 면 읽을 객체가 없어
 * TypeError 가 나고, 본문 없는 200 이면 파싱이 던진다. 둘 다 같은 catch 로 떨어진다.
 * 값 없이 resolve 한 약속은 성공이고, 그때 화면에 앉는 값은 방금 고른 값이다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';

import { InstallModeModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallModeModal';

const updateInstallationMode = vi.fn();
vi.mock('@/app/lib/api/ops', () => ({
  updateInstallationMode: (...args: unknown[]) => updateInstallationMode(...args),
}));

describe('InstallModeModal — 본문 없는 응답', () => {
  it('값 없이 resolve 하면 성공이다 — 고른 값을 넘기고 실패 문구를 쓰지 않는다', async () => {
    updateInstallationMode.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    render(
      <InstallModeModal
        open
        onClose={vi.fn()}
        targetSourceId={1013}
        currentGrant
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /수동 설치/ }));
    fireEvent.click(screen.getByRole('button', { name: '변경' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(false));
    expect(updateInstallationMode).toHaveBeenCalledWith(1013, false);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
