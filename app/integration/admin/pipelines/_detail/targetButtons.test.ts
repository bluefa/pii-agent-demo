import { describe, expect, it } from 'vitest';
import { targetButtons } from '@/app/integration/admin/pipelines/_detail/targetButtons';

describe('targetButtons — gating matrix', () => {
  it('active run locks install & delete, exposes cancel, and carries the runId', () => {
    const b = targetButtons('CONNECTED', 4210);
    expect(b).toMatchObject({ install: false, delete: false, cancel: true, runId: 4210 });
    expect(b.installTitle).toBe('진행·대기 중 파이프라인이 있어 잠금(중복 방지)');
    expect(b.deleteTitle).toBe('진행·대기 중 파이프라인이 있어 잠금(중복 방지)');
    expect(b.lockMsg).toBe('진행·대기 중 파이프라인이 있어 설치·삭제는 잠깁니다');
  });

  it.each(['CONNECTED', 'COMPLETED', 'INSTALLED'])(
    'installed status %s → delete only',
    (status) => {
      const b = targetButtons(status, null);
      expect(b).toMatchObject({ install: false, delete: true, cancel: false, runId: null, installed: true });
      expect(b.installTitle).toBe('이미 설치된 대상');
      expect(b.deleteTitle).toBe('삭제 파이프라인을 시작합니다');
      expect(b.lockMsg).toBe('설치된 대상 — 삭제만 가능합니다');
    },
  );

  it.each(['IDLE', 'PENDING', 'CONFIRMING', 'CONFIRMED', undefined, null, ''])(
    'un-installed status %s → install only',
    (status) => {
      const b = targetButtons(status as string | null | undefined, null);
      expect(b).toMatchObject({ install: true, delete: false, cancel: false, installed: false });
      expect(b.installTitle).toBe('설치 파이프라인을 시작합니다');
      expect(b.deleteTitle).toBe('설치되지 않은 대상');
      expect(b.lockMsg).toBe('미설치 대상 — 설치만 가능합니다');
    },
  );

  it('active run wins even when process_status is installed', () => {
    const b = targetButtons('COMPLETED', 99);
    expect(b.cancel).toBe(true);
    expect(b.install).toBe(false);
    expect(b.delete).toBe(false);
  });
});
