import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTestConnectionPodLog } from '@/app/lib/api/task-queue-tc';

/**
 * 업스트림 `GET /install/v1/logs/{podId}` 는 줄 리스트를 **최신 줄부터** 준다(응답 예시).
 * 뷰어는 위에서 아래로 읽으므로 어댑터가 다시 세운다 — 이 정렬이 빠지면 화면은 로그를
 * 거꾸로 읽는데, 목·라우트 어느 쪽 테스트도 그걸 보지 못한다.
 */
describe('getTestConnectionPodLog — 줄 리스트 접기', () => {
  const stubFetch = (body: unknown) =>
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

  afterEach(() => vi.unstubAllGlobals());

  it('최신 줄부터 온 응답을 오래된 줄이 위로 오게 세운다', async () => {
    stubFetch([
      { timestamp: '2026-08-25T12:34:56Z', content: 'connection test succeeded', severity: 'INFO' },
      { timestamp: '2026-08-25T12:30:00Z', content: 'Failed to connect to database', severity: 'ERROR' },
    ]);

    const log = await getTestConnectionPodLog(2101, 'tc-pod-1');

    expect(log.entries.map((e) => e.content)).toEqual([
      'Failed to connect to database',
      'connection test succeeded',
    ]);
  });

  it('severity 는 대문자로, 본문 없는 줄은 버린다', async () => {
    stubFetch([
      { timestamp: '2026-08-25T12:30:00Z', content: 'starting', severity: 'info' },
      { timestamp: '2026-08-25T12:31:00Z', content: '', severity: 'INFO' },
      { timestamp: '2026-08-25T12:32:00Z', content: 'done' },
    ]);

    const log = await getTestConnectionPodLog(2101, 'tc-pod-1');

    expect(log.entries).toEqual([
      { severity: 'INFO', content: 'starting', timestamp: '2026-08-25T12:30:00Z' },
      { severity: 'DEFAULT', content: 'done', timestamp: '2026-08-25T12:32:00Z' },
    ]);
  });
});
