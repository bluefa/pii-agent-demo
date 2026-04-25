import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as mockInstallation from '@/lib/mock-installation';
import type { AwsInstallationMode } from '@/lib/types';

interface SetInstallationModeBody {
  mode: AwsInstallationMode;
}

export const mockAws = {
  checkInstallation: async (targetSourceId: string) => {
    const numericTargetSourceId = Number(targetSourceId);
    const project = mockData.getProjectByTargetSourceId(numericTargetSourceId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (project.cloudProvider !== 'AWS') {
      return NextResponse.json(
        { error: 'INVALID_PROVIDER', message: 'AWS 프로젝트가 아닙니다.' },
        { status: 400 }
      );
    }

    let result = mockInstallation.checkInstallation(numericTargetSourceId);

    if (!result) {
      const hasTfPermission = project.terraformState.serviceTf === 'COMPLETED';
      mockInstallation.initializeInstallation(numericTargetSourceId, hasTfPermission);
      result = mockInstallation.checkInstallation(numericTargetSourceId);
    }

    return NextResponse.json(result);
  },

  setInstallationMode: async (targetSourceId: string, body: SetInstallationModeBody) => {
    if (!body.mode || !['AUTO', 'MANUAL'].includes(body.mode)) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: '유효하지 않은 설치 모드입니다. AUTO 또는 MANUAL을 선택하세요.' },
        { status: 400 }
      );
    }

    const numericTargetSourceId = Number(targetSourceId);
    const project = mockData.getProjectByTargetSourceId(numericTargetSourceId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (project.cloudProvider !== 'AWS') {
      return NextResponse.json(
        { error: 'INVALID_PROVIDER', message: 'AWS 프로젝트가 아닙니다.' },
        { status: 400 }
      );
    }

    if (project.awsInstallationMode) {
      return NextResponse.json(
        { error: 'ALREADY_SET', message: '설치 모드가 이미 설정되어 변경할 수 없습니다.' },
        { status: 409 }
      );
    }

    const hasTfPermission = body.mode === 'AUTO';

    const updatedProject = mockData.updateProject(project.id, {
      awsInstallationMode: body.mode,
    });

    mockInstallation.initializeInstallation(numericTargetSourceId, hasTfPermission);

    return NextResponse.json({
      success: true,
      project: updatedProject,
    });
  },

  getInstallationStatus: async (targetSourceId: string) => {
    const numericTargetSourceId = Number(targetSourceId);
    const project = mockData.getProjectByTargetSourceId(numericTargetSourceId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (project.cloudProvider !== 'AWS') {
      return NextResponse.json(
        { error: 'INVALID_PROVIDER', message: 'AWS 프로젝트가 아닙니다.' },
        { status: 400 }
      );
    }

    let status = mockInstallation.getInstallationStatus(numericTargetSourceId);

    if (!status) {
      const hasTfPermission = project.terraformState.serviceTf === 'COMPLETED';
      status = mockInstallation.initializeInstallation(numericTargetSourceId, hasTfPermission);
    }

    return NextResponse.json(status);
  },

  getTerraformScript: async (targetSourceId: string) => {
    const numericTargetSourceId = Number(targetSourceId);
    const project = mockData.getProjectByTargetSourceId(numericTargetSourceId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (project.cloudProvider !== 'AWS') {
      return NextResponse.json(
        { error: 'INVALID_PROVIDER', message: 'AWS 프로젝트가 아닙니다.' },
        { status: 400 }
      );
    }

    let status = mockInstallation.getInstallationStatus(numericTargetSourceId);

    if (!status) {
      status = mockInstallation.initializeInstallation(numericTargetSourceId, false);
    }

    if (status.hasTfPermission) {
      return NextResponse.json(
        { error: 'NOT_AVAILABLE', message: 'TF 권한이 있어 스크립트가 필요하지 않습니다.' },
        { status: 400 }
      );
    }

    const result = mockInstallation.getTerraformScript(numericTargetSourceId);

    if (!result) {
      return NextResponse.json(
        { error: 'NOT_AVAILABLE', message: '스크립트를 생성할 수 없습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  },

  verifyTfRole: async (targetSourceId: string, body?: { roleArn?: string; accountId?: string }) => {
    // v1: targetSourceId로 accountId 유도, v2(legacy): body.accountId 직접 사용
    let accountId = body?.accountId;

    if (!accountId && targetSourceId) {
      const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
      if (!project) {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      accountId = project.id.replace(/\D/g, '').padStart(12, '1').slice(0, 12);
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'accountId 또는 targetSourceId가 필요합니다.' },
        { status: 400 }
      );
    }

    const result = mockInstallation.verifyTfRole({ accountId, roleArn: body?.roleArn });
    return NextResponse.json(result);
  },
};
