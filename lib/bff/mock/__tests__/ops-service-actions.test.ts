/**
 * 서비스 운영 상세의 두 동작이 목 어댑터를 실제로 통과하는지.
 *
 * 이 자리를 따로 잡는 이유: 라우트 테스트는 `@/lib/bff/client` 를 통째로 모킹하므로
 * `unwrap` 이 아예 경로에 없다. 그런데 두 목은 본문 없는 204 를 돌려주고, `unwrap` 은
 * 응답을 `response.json()` 으로 읽는다 — 빈 본문에서 SyntaxError 가 나고 `withV1` 이
 * 그것을 500 으로 감싼다. 성공한 동작이 서버 장애의 얼굴을 하고 화면에 도착했고,
 * 단위 테스트는 그동안 전부 초록이었다. 목 어댑터를 그대로 부르는 테스트만 이걸 본다.
 */
import { describe, expect, it } from 'vitest';

import { mockBff } from '@/lib/bff/mock-adapter';
import { BffError } from '@/lib/bff/errors';
import * as mockData from '@/lib/mock-data';

/** 목이 아는 서비스코드 하나 — 픽스처에서 센다 (하드코딩하면 시드가 바뀔 때 조용히 썩는다). */
const KNOWN_CODE = [...new Set(mockData.mockProjects.map((p) => p.serviceCode))].sort()[0];

describe('mockBff.ops — 본문 없는 두 쓰기', () => {
  it('서비스 PII Agent 설치완료는 204 를 성공으로 돌려준다 (파싱하지 않는다)', async () => {
    await expect(mockBff.ops.updateServiceInstalled(KNOWN_CODE)).resolves.toBeUndefined();
  });

  it('EOS 처리도 마찬가지다', async () => {
    await expect(mockBff.ops.endOfService(KNOWN_CODE)).resolves.toBeUndefined();
  });

  it('모르는 서비스코드는 404 BffError 로 남는다 — 성공 경로를 고치며 에러 경로를 잃지 않는다', async () => {
    await expect(mockBff.ops.updateServiceInstalled('NO_SUCH_SERVICE')).rejects.toBeInstanceOf(
      BffError,
    );
    await expect(mockBff.ops.endOfService('NO_SUCH_SERVICE')).rejects.toMatchObject({ status: 404 });
  });
});
