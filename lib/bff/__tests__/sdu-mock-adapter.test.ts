/**
 * 목 모드에서 SDU 쓰기 다섯이 **배선까지** 성공하는지.
 *
 * `mockSdu` 를 직접 부르는 테스트는 이 층을 건너뛴다. 목 핸들러가 204(본문 없음)를 내도록
 * 바꾼 순간, `unwrap()` 의 성공 경로가 `response.json()` 이라 어댑터에서 전부 터졌는데
 * 기존 테스트는 전부 초록이었다 — 화면에서만 재현되는 실패다.
 *
 * 그래서 이 파일은 `mockBff` 를 부른다. 값은 없다(다섯 다 void). 확인하는 것은 하나,
 * **던지지 않는가**.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { mockBff } from '@/lib/bff/mock-adapter';
import { resetSduMockStore } from '@/lib/bff/mock/sdu';
import * as mockData from '@/lib/mock-data';

const SEEDED_ID = 1100;

beforeEach(() => {
  resetSduMockStore();
  mockData.setCurrentUser('admin-1');
});

describe('SDU 목 어댑터 — 본문 없는 쓰기', () => {
  it('정의 제출은 204 를 성공으로 받는다', async () => {
    await expect(mockBff.sdu.submitDefinition(SEEDED_ID)).resolves.toBeUndefined();
  });

  it('두 확인 답변은 204 를 성공으로 받는다', async () => {
    await expect(
      mockBff.sdu.putFirewallAck(SEEDED_ID, { confirmed: true }),
    ).resolves.toBeUndefined();
    await expect(
      mockBff.sdu.putCommandsAck(SEEDED_ID, { confirmed: false }),
    ).resolves.toBeUndefined();
  });

  it('수신자 등록은 204 를 성공으로 받는다', async () => {
    await expect(
      mockBff.sdu.putAccessKeyRecipients(SEEDED_ID, ['user-1']),
    ).resolves.toBeUndefined();
  });

  it('BDC 완료 단언도 204 를 성공으로 받는다 — 두 방향 다', async () => {
    // 1100 은 데이터 업로드 확인이 아직 없다. 전제가 없으므로(델타 §4) 그대로 통과한다.
    await expect(
      mockBff.sdu.putBdcCompletion(SEEDED_ID, { completed: true }),
    ).resolves.toBeUndefined();
    // 되돌리기도 같은 경로다 — 값만 다르다.
    await expect(
      mockBff.sdu.putBdcCompletion(SEEDED_ID, { completed: false }),
    ).resolves.toBeUndefined();
  });

  it('실패는 그대로 던진다 — 빈 본문 처리가 오류까지 삼키지 않는다', async () => {
    await expect(mockBff.sdu.putAccessKeyRecipients(SEEDED_ID, ['nope'])).rejects.toThrow();
    // 남은 400 은 본문의 모양뿐이다. 전제 미충족은 더 이상 거절 사유가 아니다.
    await expect(
      mockBff.sdu.putBdcCompletion(SEEDED_ID, { completed: 'yes' } as unknown as {
        completed: boolean;
      }),
    ).rejects.toThrow();
  });
});
