/**
 * 스켈레톤 최소 노출 — 500ms.
 *
 * 로딩 인디케이터 권고는 두 단계다: 100~200ms 안에 끝나면 아예 띄우지 않고(표시 전 지연),
 * 일단 띄웠으면 500ms 이상 유지한다(최소 노출). 이 값은 후자다. 앞단(표시 전 지연)을 쓰지
 * 않는 이유는 이 화면이 스켈레톤을 "보여주는" 쪽을 원하기 때문(오너 결정).
 */
export const SKELETON_MIN_MS = 500;

/**
 * `startedAt` 부터 `minMs` 가 지날 때까지 기다린다. 이미 지났으면 즉시 반환한다.
 *
 * 로딩 상태를 붙잡아 두는 대신 **데이터 반영을 늦춘다**. 화면은 "그릴 데이터가 없으면
 * 스켈레톤"이라는 규칙 하나만 유지하면 되고, 최소 노출은 여기서 끝난다 — 렌더 중에 시간을
 * 재거나 effect 안에서 상태를 켜는 일이 없으니 리렌더 순수성도 건드리지 않는다.
 *
 * `signal` 이 이미 중단됐거나 대기 중 중단되면 즉시 풀려난다. 호출부는 어차피 그 다음
 * `signal.aborted` 로 걸러내므로, 여기서 예외를 던져 경로를 하나 더 만들지 않는다.
 */
export function holdFor(startedAt: number, minMs: number, signal?: AbortSignal): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining <= 0 || signal?.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, remaining);
    signal?.addEventListener('abort', done, { once: true });
  });
}
