/**
 * PUT …/description 목의 왕복 (docs/api/ops-assumed-contracts.md §8) 과
 * `doesSupportRaw` 시드가 두 wire 에 실리는지, 그리고 §9 쓰기의 왕복.
 *
 * 왕복을 목 단위로 잡는 이유: 목이 시드 배열을 고치고 store 를 안 고치면 라우트는
 * 204/200 을 잘 내면서 다음 GET 이 옛 설명을 그대로 돌려준다 — 화면에서는 "저장은
 * 됐는데 목록이 안 바뀐다"로만 보이고, 단위 테스트는 초록이다.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NextResponse } from 'next/server';

import { mockTargetSources } from '@/lib/bff/mock/target-sources';
import { mockTaskQueue } from '@/lib/bff/mock/task-queue';
import { schemas } from '@/lib/generated/install-v1';
import * as mockData from '@/lib/mock-data';
import { readDoesSupportRaw } from '@/lib/types';

const body = async <T>(response: NextResponse | Response): Promise<T> =>
  (await response.json()) as T;

/** 1013 — Azure, serviceCode 'azure'. 실데이터 시드가 붙은 유일한 대상. */
const RAW_TARGET = 1013;
/** 같은 서비스·같은 provider 의 짝. 태그가 대상마다 갈리는지 보는 대조군. */
const PLAIN_TARGET = 1014;

describe('mockTargetSources.putDescription', () => {
  beforeEach(() => {
    // store 는 globalThis 에 살아 케이스 사이에 남는다 — 시드 문구로 되돌려 놓는다.
    const project = mockData.getProjectByTargetSourceId(RAW_TARGET);
    if (project) {
      mockData.updateProject(project.id, {
        description: '연동 대상 2건, 사용자 제외 1건, 연동 불가 2건',
      });
    }
  });

  it('저장한 설명이 다음 GET 에 그대로 보인다', async () => {
    await mockTargetSources.putDescription(RAW_TARGET, '실데이터 검증용 Azure 구독');

    const detail = await body<{ description?: string }>(
      await mockTargetSources.get(String(RAW_TARGET)),
    );
    expect(detail.description).toBe('실데이터 검증용 Azure 구독');
  });

  it('빈 문자열은 설명을 지운다', async () => {
    await mockTargetSources.putDescription(RAW_TARGET, '');

    const detail = await body<{ description?: string }>(
      await mockTargetSources.get(String(RAW_TARGET)),
    );
    expect(detail.description).toBe('');
  });

  it('없는 대상은 404', async () => {
    const response = await mockTargetSources.putDescription(999999, 'x');
    expect(response.status).toBe(404);
  });
});

/**
 * §9 왕복. 설명 왕복과 같은 이유로 목 단위에서 잡는다 — 헤더는 저장 뒤 상세를 다시
 * 읽으므로, 목이 store 를 안 고치면 화면은 "바꿨는데 그대로"가 된다.
 */
describe('mockTargetSources.setDoesSupportRaw', () => {
  // store 는 globalThis 에 살아 파일 안의 다음 케이스까지 따라간다 — 시드로 되돌린다.
  afterEach(() => {
    const project = mockData.getProjectByTargetSourceId(RAW_TARGET);
    if (project) mockData.updateProject(project.id, { doesSupportRaw: true });
  });

  it('끈 값이 다음 GET 에 그대로 보인다', async () => {
    const off = await mockTargetSources.setDoesSupportRaw(RAW_TARGET, false);
    expect(off.status).toBe(204);
    expect(readDoesSupportRaw(await body(await mockTargetSources.get(String(RAW_TARGET))))).toBe(false);

    await mockTargetSources.setDoesSupportRaw(RAW_TARGET, true);
    expect(readDoesSupportRaw(await body(await mockTargetSources.get(String(RAW_TARGET))))).toBe(true);
  });

  it('없는 대상은 404', async () => {
    const response = await mockTargetSources.setDoesSupportRaw(999999, true);
    expect(response.status).toBe(404);
  });
});

describe('doesSupportRaw 시드', () => {
  it('TargetSourceDetail 에 실린다 — 두 상태 모두', async () => {
    const raw = await body<unknown>(await mockTargetSources.get(String(RAW_TARGET)));
    const plain = await body<unknown>(await mockTargetSources.get(String(PLAIN_TARGET)));

    expect(readDoesSupportRaw(raw)).toBe(true);
    // 근거가 없는 대상도 `false` 로 실린다: 끌 수 있는 값이 된 순간, 키가 없는 것은
    // "꺼짐" 이 아니라 "못 읽음" 이고 화면이 그 둘을 다르게 그린다.
    expect(readDoesSupportRaw(plain)).toBe(false);
  });

  /**
   * 두 태그가 전부 이 한 홉에 걸려 있다: 계약에 없는 키라, 생성 스키마가
   * `.passthrough()` 를 잃고 `.strip()` 로 바뀌면 파스가 조용히 키를 버리고 태그는
   * 모든 대상에서 꺼진다 — 목도 라우트도 에러를 내지 않으므로 나머지 테스트는 전부
   * 초록이다. gen:api 재생성이 그 성질을 바꾸면 여기서 걸린다.
   */
  it('생성 스키마가 계약에 없는 키를 통과시킨다 (.passthrough)', () => {
    expect(schemas.TargetSourceInfo.parse({ targetSourceId: 1, doesSupportRaw: true })).toHaveProperty(
      'doesSupportRaw',
      true,
    );
    expect(schemas.TargetSourceDetail.parse({ targetSourceId: 1, doesSupportRaw: true })).toHaveProperty(
      'doesSupportRaw',
      true,
    );
  });

  it('TargetSourceInfo (camel wire) 에도 실린다 — /target-sources/page?serviceCode', async () => {
    const page = await body<{ content: unknown[] }>(
      await mockTaskQueue.getTargetSourcesPage({ serviceCode: 'azure', page: 0, size: 50 }),
    );
    const byId = new Map(
      page.content.map((row) => [(row as { targetSourceId: number }).targetSourceId, row]),
    );

    expect(readDoesSupportRaw(byId.get(RAW_TARGET))).toBe(true);
    expect(readDoesSupportRaw(byId.get(PLAIN_TARGET))).toBe(false);
  });
});
