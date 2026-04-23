import type { ToastOptions } from './ToastProvider';

/**
 * 전역 토스트 버스 — 훅 환경에서 훅 규칙을 지킬 수 없는 경우에만 사용.
 *
 * `useApiMutation`, `useAsync` 같은 재사용 훅은 자기 자신이 훅이라
 * `useToast()` 를 안정적으로 호출할 수 없다. ToastProvider 가 마운트될 때
 * register 하고, 훅들은 `toastGlobal()?.error(...)` 로 fallback 한다.
 *
 * ⚠️ 제약:
 * - 싱글톤이라 SSR 환경에서는 null 이 정상 — caller 가 optional chaining 필수
 * - 일반 컴포넌트는 `useToast()` 를 직접 쓸 것. 이 API 는 훅 전용
 */
export interface ToastBus {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
}

let globalBus: ToastBus | null = null;

export const registerGlobalToast = (bus: ToastBus): void => {
  globalBus = bus;
};

export const unregisterGlobalToast = (bus: ToastBus): void => {
  if (globalBus === bus) {
    globalBus = null;
  }
};

export const toastGlobal = (): ToastBus | null => globalBus;
