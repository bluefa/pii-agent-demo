/**
 * PUT …/description 목의 왕복 (docs/api/ops-assumed-contracts.md §8) 과
 * `does_support_raw` 시드가 두 wire 에 실리는지.
 *
 * 왕복을 목 단위로 잡는 이유: 목이 시드 배열을 고치고 store 를 안 고치면 라우트는
 * 204/200 을 잘 내면서 다음 GET 이 옛 설명을 그대로 돌려준다 — 화면에서는 "저장은
 * 됐는데 목록이 안 바뀐다"로만 보이고, 단위 테스트는 초록이다.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { NextResponse } from 'next/server';

import { mockTargetSources } from '@/lib/bff/mock/target-sources';
import { mockTaskQueue } from '@/lib/bff/mock/task-queue';
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

describe('does_support_raw 시드', () => {
  it('TargetSourceDetail (snake wire) 에 실린다', async () => {
    const raw = await body<unknown>(await mockTargetSources.get(String(RAW_TARGET)));
    const plain = await body<unknown>(await mockTargetSources.get(String(PLAIN_TARGET)));

    expect(readDoesSupportRaw(raw)).toBe(true);
    // 근거가 없는 대상에는 키 자체가 없다 — 목이 `false` 를 깔면 계약에 없는 단정이 된다.
    expect(readDoesSupportRaw(plain)).toBe(false);
    expect(plain).not.toHaveProperty('does_support_raw');
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
