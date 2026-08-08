'use client';

import { useSyncExternalStore } from 'react';
import type { TestConnectionVersionResult } from '@/app/lib/api';

/**
 * Step 5 폴링이 관찰한 최신 실행을 화면의 다른 표면(헤더 태그)과 공유하는
 * 모듈 레벨 스토어. 헤더는 마운트 1회 조회라, 같은 화면에서 새 실행이 돌아도
 * 예전 판정을 계속 말했다 — 카드와 헤더가 서로 모순되는 상태전이 구멍.
 * 프롭으로 잇지 않는 이유: ProjectPageMeta 와 Step 5 카드의 공통 조상은 페이지
 * 레벨이라, 한 태그를 위해 전 스텝 트리에 폴링을 끌어올려야 했다.
 */

const jobs = new Map<number, TestConnectionVersionResult>();
const listeners = new Set<() => void>();

/** 폴링 훅이 매 관찰마다 부른다. null(실행 없음)은 지식이 아니므로 지우지 않는다. */
export const publishTcJob = (
  targetSourceId: number,
  job: TestConnectionVersionResult | null,
): void => {
  if (!job) return;
  if (jobs.get(targetSourceId) === job) return;
  jobs.set(targetSourceId, job);
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Step 5 폴링이 이 대상에 대해 마지막으로 관찰한 실행 — 폴링이 없던 화면이면 null. */
export const useLiveTcJob = (targetSourceId: number): TestConnectionVersionResult | null =>
  useSyncExternalStore(
    subscribe,
    () => jobs.get(targetSourceId) ?? null,
    () => null,
  );

/** 테스트 전용 — 모듈 스토어를 비운다. */
export const clearTcJobsForTest = (): void => {
  jobs.clear();
};
