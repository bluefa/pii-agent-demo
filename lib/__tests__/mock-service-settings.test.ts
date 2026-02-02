import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAwsServiceSettings,
  updateAwsServiceSettings,
  verifyScanRole,
} from '@/lib/mock-service-settings';
import { getStore } from '@/lib/mock-store';

// Store 초기화
const resetStore = () => {
  const store = getStore();
  store.awsServiceSettings = new Map();
};

describe('mock-service-settings', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('getAwsServiceSettings', () => {
    it('설정 미등록 시 guide 포함', () => {
      const result = getAwsServiceSettings('SERVICE-A');

      expect(result.scanRole.registered).toBe(false);
      expect(result.guide).toBeDefined();
      expect(result.guide?.title).toBe('AWS 연동 설정 필요');
    });

    it('설정 등록 후 조회', () => {
      // 먼저 설정 등록
      updateAwsServiceSettings('SERVICE-A', {
        accountId: '123456789012',
        scanRoleArn: 'arn:aws:iam::123456789012:role/ScanRole',
      });

      const result = getAwsServiceSettings('SERVICE-A');

      expect(result.accountId).toBe('123456789012');
      expect(result.scanRole.registered).toBe(true);
      expect(result.scanRole.roleArn).toBe('arn:aws:iam::123456789012:role/ScanRole');
      expect(result.scanRole.status).toBe('VALID');
      expect(result.guide).toBeUndefined();
    });
  });

  describe('updateAwsServiceSettings', () => {
    it('설정 수정 + 자동 검증 성공', () => {
      const result = updateAwsServiceSettings('SERVICE-A', {
        accountId: '123456789012',
        scanRoleArn: 'arn:aws:iam::123456789012:role/ScanRole',
      });

      expect(result.updated).toBe(true);
      if (result.updated) {
        expect(result.accountId).toBe('123456789012');
        expect(result.scanRole.registered).toBe(true);
        expect(result.scanRole.status).toBe('VALID');
      }
    });

    it('잘못된 accountId → INVALID_ACCOUNT_ID', () => {
      const result = updateAwsServiceSettings('SERVICE-A', {
        accountId: '12345', // 잘못된 형식
        scanRoleArn: 'arn:aws:iam::123456789012:role/ScanRole',
      });

      expect(result.updated).toBe(false);
      if (!result.updated) {
        expect(result.errorCode).toBe('INVALID_ACCOUNT_ID');
        expect(result.guide).toBeDefined();
      }
    });

    it('잘못된 Role ARN 형식 → ROLE_NOT_FOUND', () => {
      const result = updateAwsServiceSettings('SERVICE-A', {
        accountId: '123456789012',
        scanRoleArn: 'invalid-role-arn',
      });

      expect(result.updated).toBe(false);
      if (!result.updated) {
        expect(result.errorCode).toBe('ROLE_NOT_FOUND');
      }
    });

    it('Role 검증 실패 (ROLE_NOT_FOUND)', () => {
      const result = updateAwsServiceSettings('SERVICE-A', {
        accountId: '123456789000', // 000으로 끝남
        scanRoleArn: 'arn:aws:iam::123456789000:role/ScanRole',
      });

      expect(result.updated).toBe(false);
      if (!result.updated) {
        expect(result.errorCode).toBe('ROLE_NOT_FOUND');
        expect(result.guide).toBeDefined();
      }
    });

    it('Role 검증 실패 (INSUFFICIENT_PERMISSIONS)', () => {
      const result = updateAwsServiceSettings('SERVICE-A', {
        accountId: '123456789111', // 111로 끝남
        scanRoleArn: 'arn:aws:iam::123456789111:role/ScanRole',
      });

      expect(result.updated).toBe(false);
      if (!result.updated) {
        expect(result.errorCode).toBe('INSUFFICIENT_PERMISSIONS');
      }
    });

    it('Role 검증 실패 (ACCESS_DENIED)', () => {
      const result = updateAwsServiceSettings('SERVICE-A', {
        accountId: '123456789222', // 222로 끝남
        scanRoleArn: 'arn:aws:iam::123456789222:role/ScanRole',
      });

      expect(result.updated).toBe(false);
      if (!result.updated) {
        expect(result.errorCode).toBe('ACCESS_DENIED');
      }
    });
  });

  describe('verifyScanRole', () => {
    it('등록된 Role 재검증 성공', () => {
      // 먼저 설정 등록
      updateAwsServiceSettings('SERVICE-A', {
        accountId: '123456789012',
        scanRoleArn: 'arn:aws:iam::123456789012:role/ScanRole',
      });

      const result = verifyScanRole('SERVICE-A');

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.roleArn).toBe('arn:aws:iam::123456789012:role/ScanRole');
        expect(result.verifiedAt).toBeDefined();
      }
    });

    it('미등록 상태 → ROLE_NOT_FOUND', () => {
      const result = verifyScanRole('SERVICE-A');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errorCode).toBe('ROLE_NOT_FOUND');
        expect(result.errorMessage).toBe('등록된 Scan Role이 없습니다.');
      }
    });

    it('Role 삭제됨 → ROLE_NOT_FOUND', () => {
      // 설정 등록 (333으로 끝나는 accountId)
      updateAwsServiceSettings('SERVICE-B', {
        accountId: '123456789333',
        scanRoleArn: 'arn:aws:iam::123456789333:role/ScanRole',
      });

      const result = verifyScanRole('SERVICE-B');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errorCode).toBe('ROLE_NOT_FOUND');
        expect(result.errorMessage).toBe('Scan Role이 삭제되었습니다.');
      }
    });

    it('권한 변경됨 → INSUFFICIENT_PERMISSIONS', () => {
      // 설정 등록 (444로 끝나는 accountId)
      updateAwsServiceSettings('SERVICE-C', {
        accountId: '123456789444',
        scanRoleArn: 'arn:aws:iam::123456789444:role/ScanRole',
      });

      const result = verifyScanRole('SERVICE-C');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errorCode).toBe('INSUFFICIENT_PERMISSIONS');
        expect(result.errorMessage).toBe('Scan Role의 권한이 변경되었습니다.');
      }
    });
  });
});
