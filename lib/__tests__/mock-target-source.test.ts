import { describe, it, expect, beforeEach } from 'vitest';
import {
  mockProjects,
  getProjectById,
  getProjectByTargetSourceId,
  getTargetSourceIdByProjectId,
  getProjectIdByTargetSourceId,
  generateTargetSourceId,
  addProject,
} from '@/lib/mock-data';
import { getStore } from '@/lib/mock-store';
import type { Project } from '@/lib/types';

beforeEach(() => {
  // global store 리셋 — 테스트 간 격리
  globalThis.__piiAgentMockStore = undefined;
});

describe('targetSourceId — seed 데이터', () => {
  it('모든 seed project에 targetSourceId가 존재하고 number 타입이다', () => {
    const store = getStore();
    for (const project of store.projects) {
      expect(project.targetSourceId).toBeDefined();
      expect(typeof project.targetSourceId).toBe('number');
    }
  });

  it('모든 targetSourceId가 양의 정수이다', () => {
    const store = getStore();
    for (const project of store.projects) {
      expect(project.targetSourceId).toBeGreaterThan(0);
      expect(Number.isInteger(project.targetSourceId)).toBe(true);
    }
  });

  it('targetSourceId가 모두 유일하다 (중복 없음)', () => {
    const store = getStore();
    const ids = store.projects.map(p => p.targetSourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('seed 데이터는 11개 프로젝트를 포함한다', () => {
    expect(mockProjects).toHaveLength(11);
  });
});

describe('targetSourceId — 매핑 함수', () => {
  it('getProjectByTargetSourceId: 존재하는 ID로 Project를 반환한다', () => {
    const project = getProjectByTargetSourceId(1001);
    expect(project).toBeDefined();
    expect(project!.id).toBe('proj-sdu-001');
  });

  it('getProjectByTargetSourceId: 존재하지 않는 ID는 undefined를 반환한다', () => {
    expect(getProjectByTargetSourceId(9999)).toBeUndefined();
  });

  it('getTargetSourceIdByProjectId: projectId로 targetSourceId를 반환한다', () => {
    expect(getTargetSourceIdByProjectId('proj-1')).toBe(1006);
  });

  it('getTargetSourceIdByProjectId: 존재하지 않는 projectId는 undefined를 반환한다', () => {
    expect(getTargetSourceIdByProjectId('nonexistent')).toBeUndefined();
  });

  it('getProjectIdByTargetSourceId: targetSourceId로 projectId를 반환한다', () => {
    expect(getProjectIdByTargetSourceId(1006)).toBe('proj-1');
  });

  it('getProjectIdByTargetSourceId: 존재하지 않는 targetSourceId는 undefined를 반환한다', () => {
    expect(getProjectIdByTargetSourceId(9999)).toBeUndefined();
  });

  it('왕복 검증: projectId → targetSourceId → projectId', () => {
    const store = getStore();
    for (const project of store.projects) {
      const tsId = getTargetSourceIdByProjectId(project.id);
      expect(tsId).toBeDefined();
      const backToProjectId = getProjectIdByTargetSourceId(tsId!);
      expect(backToProjectId).toBe(project.id);
    }
  });

  it('왕복 검증: targetSourceId → projectId → targetSourceId', () => {
    const store = getStore();
    for (const project of store.projects) {
      const projectId = getProjectIdByTargetSourceId(project.targetSourceId);
      expect(projectId).toBeDefined();
      const backToTsId = getTargetSourceIdByProjectId(projectId!);
      expect(backToTsId).toBe(project.targetSourceId);
    }
  });
});

describe('targetSourceId — 생성', () => {
  it('generateTargetSourceId: seed 데이터 max + 1을 반환한다', () => {
    const store = getStore();
    const maxId = Math.max(...store.projects.map(p => p.targetSourceId));
    expect(generateTargetSourceId()).toBe(maxId + 1);
  });

  it('신규 프로젝트 추가 후 다시 호출하면 그 다음 값을 반환한다', () => {
    const firstId = generateTargetSourceId();

    const newProject: Project = {
      ...getStore().projects[0],
      id: 'test-new-1',
      targetSourceId: firstId,
    };
    addProject(newProject);

    expect(generateTargetSourceId()).toBe(firstId + 1);
  });

  it('연속 생성 시 중복이 없다', () => {
    const generated: number[] = [];
    for (let i = 0; i < 5; i++) {
      const tsId = generateTargetSourceId();
      expect(generated).not.toContain(tsId);
      generated.push(tsId);

      const newProject: Project = {
        ...getStore().projects[0],
        id: `test-dup-${i}`,
        targetSourceId: tsId,
      };
      addProject(newProject);
    }
  });
});

describe('기존 함수 하위호환', () => {
  it('getProjectById는 여전히 정상 동작한다', () => {
    const project = getProjectById('proj-1');
    expect(project).toBeDefined();
    expect(project!.id).toBe('proj-1');
    expect(project!.targetSourceId).toBe(1006);
  });
});
