// @vitest-environment jsdom
/**
 * 작업 시작 모달의 **첫 화면**이 이 대상에서 고를 수 있는 유형만 내놓는가 (ADR-023).
 *
 * 판정 자체는 `pipelineTypeGate` 의 몫이고 거기서 따로 검사한다. 여기서 지키는 것은 그
 * 판정이 실제 행으로 옮겨지는가다 — 열린 행은 누를 수 있고, 막힌 행은 이유를 달고 죽어
 * 있으며, 이 대상의 일이 아닌 행은 **그리지도 않는다**.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PreviewModal } from '@/app/admin/pipelines/_detail/PreviewModal';
import { pipelineTypeGate } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/gateStage';

afterEach(cleanup);

const renderChooseStep = (typeGate: ReturnType<typeof pipelineTypeGate>) =>
  render(
    <PreviewModal
      open
      onClose={vi.fn()}
      targetSourceId="1029"
      provider="AWS"
      typeGate={typeGate}
      showToast={vi.fn()}
      onStarted={vi.fn()}
    />,
  );

/** 행은 유형 이름을 가진 버튼이다 — 라벨은 한글 한 벌(`typeKo`)에서 온다. */
const row = (label: string): HTMLButtonElement | null =>
  screen
    .queryAllByRole('button')
    .find((el): el is HTMLButtonElement => el.textContent?.includes(label) === true) ?? null;

describe('PreviewModal 유형 선택 행', () => {
  it('CONFIRMING + 확정 인프라 — 재확정은 누를 수 있고, 설치는 이유를 달고 막힌다', () => {
    renderChooseStep(pipelineTypeGate('CONFIRMING', true));

    const reconfirm = row('재확정');
    expect(reconfirm).not.toBeNull();
    expect(reconfirm?.disabled).toBe(false);

    const install = row('설치');
    expect(install?.disabled).toBe(true);
    expect(install?.title).toBe('확정 정보를 다시 입력해야 합니다. 재확정을 먼저 실행하세요.');
  });

  it('CONFIRMED 에는 재확정 행이 없다 — 비활성이 아니라 없다', () => {
    renderChooseStep(pipelineTypeGate('CONFIRMED', true));

    expect(row('재확정')).toBeNull();
    expect(row('설치')?.disabled).toBe(false);
    expect(row('삭제')?.disabled).toBe(false);
  });

  it('재확정이 열려도 삭제·커스텀 행은 그대로다', () => {
    renderChooseStep(pipelineTypeGate('CONFIRMING', true));

    expect(row('삭제')?.disabled).toBe(false);
    expect(row('커스텀')?.disabled).toBe(false);
  });
});
