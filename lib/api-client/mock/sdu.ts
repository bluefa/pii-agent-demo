import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as sduFns from '@/lib/mock-sdu';
import { SDU_ERROR_CODES, SDU_VALIDATION } from '@/lib/constants/sdu';

const authCheck = async () => {
  const user = await mockData.getCurrentUser();
  if (!user) {
    return { error: NextResponse.json(
      { error: SDU_ERROR_CODES.UNAUTHORIZED.code, message: SDU_ERROR_CODES.UNAUTHORIZED.message },
      { status: SDU_ERROR_CODES.UNAUTHORIZED.status }
    ) };
  }
  return { user };
};

const projectCheck = async (targetSourceId: string) => {
  const project = await mockData.getProjectById(targetSourceId);
  if (!project) {
    return { error: NextResponse.json(
      { error: SDU_ERROR_CODES.NOT_FOUND.code, message: SDU_ERROR_CODES.NOT_FOUND.message },
      { status: SDU_ERROR_CODES.NOT_FOUND.status }
    ) };
  }
  return { project };
};

const sduCheck = (cloudProvider: string) => {
  if (cloudProvider !== 'SDU') {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.NOT_SDU_PROJECT.code, message: SDU_ERROR_CODES.NOT_SDU_PROJECT.message },
      { status: SDU_ERROR_CODES.NOT_SDU_PROJECT.status }
    );
  }
  return null;
};

const permissionCheck = (userRole: string, serviceCodePermissions: string[], serviceCode: string) => {
  if (userRole !== 'ADMIN' && !serviceCodePermissions.includes(serviceCode)) {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.FORBIDDEN.code, message: SDU_ERROR_CODES.FORBIDDEN.message },
      { status: SDU_ERROR_CODES.FORBIDDEN.status }
    );
  }
  return null;
};

const adminOnlyCheck = (userRole: string) => {
  if (userRole !== 'ADMIN') {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.FORBIDDEN.code, message: SDU_ERROR_CODES.FORBIDDEN.message },
      { status: SDU_ERROR_CODES.FORBIDDEN.status }
    );
  }
  return null;
};

const handleResult = (result: { error?: { code: string; message: string; status: number }; data?: unknown }) => {
  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }
  return NextResponse.json(result.data);
};

const validateCidr = (cidr: string) => {
  if (!cidr) {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.VALIDATION_FAILED.code, message: 'CIDR 필드는 필수입니다.' },
      { status: SDU_ERROR_CODES.VALIDATION_FAILED.status }
    );
  }
  if (!SDU_VALIDATION.CIDR_REGEX.test(cidr)) {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.INVALID_CIDR.code, message: SDU_ERROR_CODES.INVALID_CIDR.message },
      { status: SDU_ERROR_CODES.INVALID_CIDR.status }
    );
  }
  return null;
};

export const mockSdu = {
  checkInstallation: async (targetSourceId: string) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = permissionCheck(auth.user!.role, auth.user!.serviceCodePermissions, proj.project!.serviceCode);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    return handleResult(await sduFns.checkSduInstallation(targetSourceId));
  },

  getAthenaTables: async (targetSourceId: string) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = permissionCheck(auth.user!.role, auth.user!.serviceCodePermissions, proj.project!.serviceCode);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    return handleResult(await sduFns.getAthenaTables(targetSourceId));
  },

  executeConnectionTest: async (targetSourceId: string) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = adminOnlyCheck(auth.user!.role);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    return handleResult(await sduFns.executeSduConnectionTest(targetSourceId));
  },

  getConnectionTest: async (targetSourceId: string) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = permissionCheck(auth.user!.role, auth.user!.serviceCodePermissions, proj.project!.serviceCode);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    return handleResult(await sduFns.getSduConnectionTest(targetSourceId));
  },

  issueAkSk: async (targetSourceId: string, body: { issuedBy: string }) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = adminOnlyCheck(auth.user!.role);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    if (!body.issuedBy) {
      return NextResponse.json(
        { error: SDU_ERROR_CODES.VALIDATION_FAILED.code, message: 'issuedBy 필드는 필수입니다.' },
        { status: SDU_ERROR_CODES.VALIDATION_FAILED.status }
      );
    }

    return handleResult(await sduFns.issueAkSk(targetSourceId, body.issuedBy));
  },

  getIamUser: async (targetSourceId: string) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = permissionCheck(auth.user!.role, auth.user!.serviceCodePermissions, proj.project!.serviceCode);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    return handleResult(await sduFns.getIamUser(targetSourceId));
  },

  getInstallationStatus: async (targetSourceId: string) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = permissionCheck(auth.user!.role, auth.user!.serviceCodePermissions, proj.project!.serviceCode);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    return handleResult(await sduFns.getSduInstallationStatus(targetSourceId));
  },

  checkS3Upload: async (targetSourceId: string) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    return handleResult(await sduFns.checkS3Upload(targetSourceId));
  },

  getS3Upload: async (targetSourceId: string) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = permissionCheck(auth.user!.role, auth.user!.serviceCodePermissions, proj.project!.serviceCode);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    return handleResult(await sduFns.getS3UploadStatus(targetSourceId));
  },

  confirmSourceIp: async (targetSourceId: string, body: { cidr: string }) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = adminOnlyCheck(auth.user!.role);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    const cidrError = validateCidr(body.cidr);
    if (cidrError) return cidrError;

    return handleResult(await sduFns.confirmSourceIp(targetSourceId, body.cidr, auth.user!.name));
  },

  registerSourceIp: async (targetSourceId: string, body: { cidr: string }) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = permissionCheck(auth.user!.role, auth.user!.serviceCodePermissions, proj.project!.serviceCode);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    const cidrError = validateCidr(body.cidr);
    if (cidrError) return cidrError;

    return handleResult(await sduFns.registerSourceIp(targetSourceId, body.cidr, auth.user!.name));
  },

  getSourceIpList: async (targetSourceId: string) => {
    const auth = await authCheck();
    if (auth.error) return auth.error;

    const proj = await projectCheck(targetSourceId);
    if (proj.error) return proj.error;

    const forbidden = permissionCheck(auth.user!.role, auth.user!.serviceCodePermissions, proj.project!.serviceCode);
    if (forbidden) return forbidden;

    const notSdu = sduCheck(proj.project!.cloudProvider);
    if (notSdu) return notSdu;

    return handleResult(await sduFns.getSourceIpList(targetSourceId));
  },
};
