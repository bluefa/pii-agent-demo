/**
 * 스캔 시각은 뷰어의 로컬 타임존으로 읽혀야 한다 — 관리자 표는 오래
 * `lib/pipeline/format` 의 Asia/Seoul 고정 포맷터를 썼으므로, 고정이 되살아나면
 * 세 존의 출력이 같아진다. 그래서 TZ 를 실제로 바꿔 가며 재검한다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

/** 스캔 잡 하나의 wire 값 — UTC instant. */
const WIRE = '2026-08-20T09:31:31.230343Z';

const ORIGINAL_TZ = process.env.TZ;

const loadIn = async (timeZone: string) => {
  process.env.TZ = timeZone;
  vi.resetModules();
  return import('@/lib/utils/date');
};

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
  vi.resetModules();
});

describe('formatDateTimeLocalDashed', () => {
  it('뷰어의 존으로 렌더하고 오프셋을 붙인다 (Asia/Seoul 고정이 아니다)', async () => {
    expect((await loadIn('Asia/Seoul')).formatDateTimeLocalDashed(WIRE)).toBe(
      '2026-08-20 18:31 GMT+9',
    );
    expect((await loadIn('America/New_York')).formatDateTimeLocalDashed(WIRE)).toBe(
      '2026-08-20 05:31 GMT-4',
    );
    expect((await loadIn('UTC')).formatDateTimeLocalDashed(WIRE)).toBe('2026-08-20 09:31 GMT+0');
  });

  it('withSeconds 는 초까지 낸다', async () => {
    const { formatDateTimeLocalDashed } = await loadIn('Asia/Seoul');
    expect(formatDateTimeLocalDashed(WIRE, true)).toBe('2026-08-20 18:31:31 GMT+9');
  });

  it('자정의 24시는 00시로 정규화한다', async () => {
    const { formatDateTimeLocalDashed } = await loadIn('Asia/Seoul');
    // 2026-08-19T15:00:00Z === 2026-08-20 00:00 KST
    expect(formatDateTimeLocalDashed('2026-08-19T15:00:00Z')).toBe('2026-08-20 00:00 GMT+9');
  });

  it('null·undefined·invalid 는 대시', async () => {
    const { formatDateTimeLocalDashed } = await loadIn('Asia/Seoul');
    expect(formatDateTimeLocalDashed(null)).toBe('-');
    expect(formatDateTimeLocalDashed(undefined)).toBe('-');
    expect(formatDateTimeLocalDashed('nope')).toBe('-');
  });
});

describe('formatDateTimeLocal', () => {
  it('뷰어의 존으로 렌더하고 오프셋 라벨로 끝난다', async () => {
    const seoul = (await loadIn('Asia/Seoul')).formatDateTimeLocal(WIRE);
    const newYork = (await loadIn('America/New_York')).formatDateTimeLocal(WIRE);
    expect(seoul).toMatch(/^2026\. 08\. 20\..*06:31 GMT\+9$/);
    expect(newYork).toMatch(/^2026\. 08\. 20\..*05:31 GMT-4$/);
  });

  it('같은 순간이면 wire 표기가 달라도 같은 문자열 — 벽시계가 아니라 instant', async () => {
    const { formatDateTimeLocal, formatDateTimeLocalDashed } = await loadIn('Asia/Seoul');
    expect(formatDateTimeLocal('2026-08-20T18:31:31.230343+09:00')).toBe(
      formatDateTimeLocal(WIRE),
    );
    expect(formatDateTimeLocalDashed('2026-08-20T18:31:31.230343+09:00', true)).toBe(
      formatDateTimeLocalDashed(WIRE, true),
    );
  });
});
