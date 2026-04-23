import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSduInstallationStatus,
  checkSduInstallation,
  getS3UploadStatus,
  checkS3Upload,
  getIamUser,
  issueAkSk,
  getSourceIpList,
  registerSourceIp,
  confirmSourceIp,
  getAthenaTables,
  getSduServiceSettings,
  getSduConnectionTest,
  executeSduConnectionTest,
  resetSduStore,
} from '@/lib/mock-sdu';
import { resetStore } from '@/lib/mock-store';

// ===== Fixtures (W2 에서 targetSourceId 로 교체될 예정, assertion 은 동일하게 통과해야 함) =====

const SDU_TARGET_SOURCE_ID = 1001;   // proj-sdu-001
const SDU_TARGET_SOURCE_ID_2 = 1011; // sdu-proj-1
const AWS_TARGET_SOURCE_ID = 1006;   // proj-1
const NONEXISTENT_TARGET_SOURCE_ID = 99999;

// proj-sdu-001 에서 현재 production 코드가 생성하는 값 — 더블 하이픈은 slice(-8) 결과.
// W2 에서 내부 해시가 바뀌면 이 값이 바뀌어야 behavior 변경 플래그됨.
const EXPECTED_IAM_USERNAME = 'sdu-user--sdu-001';
const EXPECTED_ATHENA_DATABASE = 'sdu_db_-sdu-001';

const FIXED_DATE = new Date('2026-04-23T00:00:00.000Z');
const FIXED_ISO = FIXED_DATE.toISOString();

describe('mock-sdu behavior lock-in', () => {
  beforeEach(() => {
    resetStore();
    resetSduStore();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
    // Math.random 기본값: 0.5 — checkXxx 류의 진행 시뮬레이션이 전부 skip 되도록
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getSduInstallationStatus', () => {
    it('SDU project → 초기 installation status 반환', () => {
      const result = getSduInstallationStatus(SDU_TARGET_SOURCE_ID);

      expect(result.error).toBeUndefined();
      expect(result.data?.provider).toBe('SDU');
      expect(result.data?.crawler).toEqual({ configured: false, lastRunStatus: 'NONE' });
      expect(result.data?.athenaTable).toEqual({
        status: 'PENDING',
        tableCount: 0,
        database: EXPECTED_ATHENA_DATABASE,
      });
      expect(result.data?.targetConfirmed).toBe(false);
      expect(result.data?.athenaSetup).toEqual({ status: 'PENDING' });
      expect(result.data?.lastCheckedAt).toBe(FIXED_ISO);
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = getSduInstallationStatus(NONEXISTENT_TARGET_SOURCE_ID);

      expect(result.data).toBeUndefined();
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.status).toBe(404);
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = getSduInstallationStatus(AWS_TARGET_SOURCE_ID);

      expect(result.data).toBeUndefined();
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
      expect(result.error?.status).toBe(400);
    });

    it('캐시: 두번째 호출도 동일 객체 반환 (reference equality)', () => {
      const first = getSduInstallationStatus(SDU_TARGET_SOURCE_ID);
      const second = getSduInstallationStatus(SDU_TARGET_SOURCE_ID);

      expect(second.data).toBe(first.data);
    });
  });

  describe('checkSduInstallation', () => {
    it('Math.random=0.5 → 진행 없음 (모든 조건 threshold 미달)', () => {
      getSduInstallationStatus(SDU_TARGET_SOURCE_ID);
      const result = checkSduInstallation(SDU_TARGET_SOURCE_ID);

      expect(result.data?.crawler.configured).toBe(false);
      expect(result.data?.athenaTable.status).toBe('PENDING');
      expect(result.data?.athenaSetup.status).toBe('PENDING');
    });

    it('Math.random=0 → 모든 단계 진행 (crawler → athena → setup)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      getSduInstallationStatus(SDU_TARGET_SOURCE_ID);

      // 1회 호출: crawler configured, athenaTable CREATED, athenaSetup IN_PROGRESS
      const r1 = checkSduInstallation(SDU_TARGET_SOURCE_ID);
      expect(r1.data?.crawler.configured).toBe(true);
      expect(r1.data?.crawler.lastRunStatus).toBe('SUCCESS');
      expect(r1.data?.athenaTable.status).toBe('CREATED');
      expect(r1.data?.athenaTable.tableCount).toBe(2);
      expect(r1.data?.athenaSetup.status).toBe('IN_PROGRESS');

      // 2회 호출: athenaSetup COMPLETED 까지 진행
      const r2 = checkSduInstallation(SDU_TARGET_SOURCE_ID);
      expect(r2.data?.athenaSetup.status).toBe('COMPLETED');
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = checkSduInstallation(NONEXISTENT_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = checkSduInstallation(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });

    it('lastCheckedAt 갱신 (fake timer tick)', () => {
      const first = getSduInstallationStatus(SDU_TARGET_SOURCE_ID);
      expect(first.data?.lastCheckedAt).toBe(FIXED_ISO);

      vi.setSystemTime(new Date('2026-04-23T00:05:00.000Z'));
      const second = checkSduInstallation(SDU_TARGET_SOURCE_ID);
      expect(second.data?.lastCheckedAt).toBe('2026-04-23T00:05:00.000Z');
    });
  });

  describe('getS3UploadStatus', () => {
    it('SDU project → 초기 PENDING 상태 반환', () => {
      const result = getS3UploadStatus(SDU_TARGET_SOURCE_ID);

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ status: 'PENDING' });
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = getS3UploadStatus(NONEXISTENT_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = getS3UploadStatus(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });

    it('캐시: 두번째 호출도 동일 객체 반환', () => {
      const first = getS3UploadStatus(SDU_TARGET_SOURCE_ID);
      const second = getS3UploadStatus(SDU_TARGET_SOURCE_ID);
      expect(second.data).toBe(first.data);
    });
  });

  describe('checkS3Upload', () => {
    it('Math.random=0 → PENDING → CONFIRMED 전환', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      getS3UploadStatus(SDU_TARGET_SOURCE_ID);

      const result = checkS3Upload(SDU_TARGET_SOURCE_ID);
      expect(result.data?.status).toBe('CONFIRMED');
      expect(result.data?.confirmedAt).toBe(FIXED_ISO);
    });

    it('Math.random=0.5 → PENDING 유지', () => {
      getS3UploadStatus(SDU_TARGET_SOURCE_ID);
      const result = checkS3Upload(SDU_TARGET_SOURCE_ID);
      expect(result.data?.status).toBe('PENDING');
    });

    it('이미 CONFIRMED → 그대로 반환 (추가 전환 없음)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      getS3UploadStatus(SDU_TARGET_SOURCE_ID);
      const firstConfirm = checkS3Upload(SDU_TARGET_SOURCE_ID);
      expect(firstConfirm.data?.status).toBe('CONFIRMED');

      // Random 을 다시 0.5 로 바꿔도 CONFIRMED 유지
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const second = checkS3Upload(SDU_TARGET_SOURCE_ID);
      expect(second.data?.status).toBe('CONFIRMED');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = checkS3Upload(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });
  });

  describe('getIamUser', () => {
    it('SDU project → deterministic IAM user 생성', () => {
      const result = getIamUser(SDU_TARGET_SOURCE_ID);

      expect(result.error).toBeUndefined();
      expect(result.data?.userName).toBe(EXPECTED_IAM_USERNAME);
      expect(result.data?.akSkIssuedAt).toBe(FIXED_ISO);
      expect(result.data?.akSkIssuedBy).toBe('admin@example.com');
      expect(result.data?.akSkExpiresAt).toBe('2027-04-23T00:00:00.000Z');
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = getIamUser(NONEXISTENT_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = getIamUser(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });

    it('캐시: 두번째 호출도 동일 객체 반환', () => {
      const first = getIamUser(SDU_TARGET_SOURCE_ID);
      const second = getIamUser(SDU_TARGET_SOURCE_ID);
      expect(second.data).toBe(first.data);
    });
  });

  describe('issueAkSk', () => {
    it('SDU project → accessKey AKIA prefix + 구조 확인', () => {
      const result = issueAkSk(SDU_TARGET_SOURCE_ID, 'issuer@example.com');

      expect(result.error).toBeUndefined();
      expect(result.data?.success).toBe(true);
      expect(result.data?.accessKey).toMatch(/^AKIA[A-Z0-9]*$/);
      // secretKey 길이는 상한 40 고정, 하한은 Math.random 분포에 따라 가변 — Known quirks 참조.
      expect(result.data?.secretKey).toBeDefined();
      expect(result.data?.secretKey.length).toBeLessThanOrEqual(40);
      expect(result.data?.issuedAt).toBe(FIXED_ISO);
      expect(result.data?.expiresAt).toBe('2027-04-23T00:00:00.000Z');
    });

    it('IAM user의 akSkIssuedBy 를 파라미터로 갱신', () => {
      getIamUser(SDU_TARGET_SOURCE_ID); // 캐시 생성 (admin@example.com)
      issueAkSk(SDU_TARGET_SOURCE_ID, 'new-issuer@example.com');
      const after = getIamUser(SDU_TARGET_SOURCE_ID);

      expect(after.data?.akSkIssuedBy).toBe('new-issuer@example.com');
      expect(after.data?.akSkIssuedAt).toBe(FIXED_ISO);
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = issueAkSk(NONEXISTENT_TARGET_SOURCE_ID, 'x@example.com');
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = issueAkSk(AWS_TARGET_SOURCE_ID, 'x@example.com');
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });
  });

  describe('getSourceIpList', () => {
    it('SDU project → 초기 entries 2개 반환 (CONFIRMED + PENDING)', () => {
      const result = getSourceIpList(SDU_TARGET_SOURCE_ID);

      expect(result.error).toBeUndefined();
      expect(result.data?.entries).toHaveLength(2);

      const [confirmed, pending] = result.data!.entries;
      expect(confirmed.cidr).toBe('10.0.1.0/24');
      expect(confirmed.status).toBe('CONFIRMED');
      expect(confirmed.registeredBy).toBe('admin@example.com');
      expect(confirmed.confirmedBy).toBe('bdc-admin@example.com');

      expect(pending.cidr).toBe('192.168.1.0/24');
      expect(pending.status).toBe('PENDING');
      expect(pending.registeredBy).toBe('admin@example.com');
      expect(pending.confirmedBy).toBeUndefined();
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = getSourceIpList(NONEXISTENT_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = getSourceIpList(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });
  });

  describe('registerSourceIp', () => {
    it('신규 CIDR 추가 → PENDING entry 로 append', () => {
      const result = registerSourceIp(SDU_TARGET_SOURCE_ID, '172.16.0.0/16', 'alice@example.com');

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({
        cidr: '172.16.0.0/16',
        status: 'PENDING',
        registeredBy: 'alice@example.com',
        registeredAt: FIXED_ISO,
      });

      const listed = getSourceIpList(SDU_TARGET_SOURCE_ID);
      expect(listed.data?.entries).toHaveLength(3);
      expect(listed.data?.entries[2].cidr).toBe('172.16.0.0/16');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = registerSourceIp(AWS_TARGET_SOURCE_ID, '10.0.0.0/24', 'x@example.com');
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = registerSourceIp(NONEXISTENT_TARGET_SOURCE_ID, '10.0.0.0/24', 'x@example.com');
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('confirmSourceIp', () => {
    it('PENDING entry 를 CONFIRMED 로 전환', () => {
      const result = confirmSourceIp(SDU_TARGET_SOURCE_ID, '192.168.1.0/24', 'bdc@example.com');

      expect(result.error).toBeUndefined();
      expect(result.data?.cidr).toBe('192.168.1.0/24');
      expect(result.data?.status).toBe('CONFIRMED');
      expect(result.data?.confirmedBy).toBe('bdc@example.com');
      expect(result.data?.confirmedAt).toBe(FIXED_ISO);
    });

    it('등록되지 않은 CIDR → SOURCE_IP_NOT_REGISTERED', () => {
      const result = confirmSourceIp(SDU_TARGET_SOURCE_ID, '99.99.99.0/24', 'bdc@example.com');
      expect(result.error?.code).toBe('SOURCE_IP_NOT_REGISTERED');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = confirmSourceIp(AWS_TARGET_SOURCE_ID, '10.0.0.0/24', 'x@example.com');
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });
  });

  describe('getAthenaTables', () => {
    it('SDU project → 초기 tables 2개 반환 (deterministic 이름)', () => {
      const result = getAthenaTables(SDU_TARGET_SOURCE_ID);

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual([
        {
          tableName: 'pii_users',
          database: EXPECTED_ATHENA_DATABASE,
          s3Location: 's3://sdu-data--sdu-001/pii_users/',
        },
        {
          tableName: 'pii_transactions',
          database: EXPECTED_ATHENA_DATABASE,
          s3Location: 's3://sdu-data--sdu-001/pii_transactions/',
        },
      ]);
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = getAthenaTables(NONEXISTENT_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = getAthenaTables(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });
  });

  describe('getSduServiceSettings', () => {
    // SERVICE-A charCode sum = 639, 639 % 2 = 1 → hasIamUser false
    it('SERVICE-A (hash odd) → iamUser undefined + guide 포함', () => {
      const result = getSduServiceSettings('SERVICE-A');

      expect(result.error).toBeUndefined();
      expect(result.data?.iamUser).toBeUndefined();
      expect(result.data?.sourceIp).toEqual({ entries: [] });
      expect(result.data?.guide?.description).toBe('SDU 연동을 위한 환경 설정이 필요합니다.');
      expect(result.data?.guide?.documentUrl).toBe(
        'https://docs.example.com/sdu/environment-setup'
      );
    });

    // SERVICE-B charCode sum = 640, 640 % 2 = 0 → hasIamUser true
    it('SERVICE-B (hash even) → iamUser 포함 (serviceCode suffix 기반 userName)', () => {
      const result = getSduServiceSettings('SERVICE-B');

      expect(result.data?.iamUser).toBeDefined();
      expect(result.data?.iamUser?.userName).toBe('sdu-service-CE-B');
      expect(result.data?.iamUser?.akSkIssuedBy).toBe('admin@example.com');
    });

    it('시간 필드: akSkIssuedAt = 30일 전, akSkExpiresAt = 335일 후 (fake timer 기준)', () => {
      const result = getSduServiceSettings('SERVICE-B');

      expect(result.data?.iamUser?.akSkIssuedAt).toBe('2026-03-24T00:00:00.000Z');
      expect(result.data?.iamUser?.akSkExpiresAt).toBe('2027-03-24T00:00:00.000Z');
    });
  });

  describe('getSduConnectionTest', () => {
    it('SDU project → 초기 NOT_TESTED 상태 반환', () => {
      const result = getSduConnectionTest(SDU_TARGET_SOURCE_ID);

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ status: 'NOT_TESTED' });
    });

    it('존재하지 않는 project → NOT_FOUND 에러', () => {
      const result = getSduConnectionTest(NONEXISTENT_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = getSduConnectionTest(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });

    it('캐시: 두번째 호출도 동일 객체 반환', () => {
      const first = getSduConnectionTest(SDU_TARGET_SOURCE_ID);
      const second = getSduConnectionTest(SDU_TARGET_SOURCE_ID);
      expect(second.data).toBe(first.data);
    });
  });

  describe('executeSduConnectionTest', () => {
    it('Math.random=0 (<0.8) → PASSED', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = executeSduConnectionTest(SDU_TARGET_SOURCE_ID);
      expect(result.data).toEqual({ status: 'PASSED' });
    });

    it('Math.random=0.9 (>=0.8) → FAILED', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      const result = executeSduConnectionTest(SDU_TARGET_SOURCE_ID);
      expect(result.data).toEqual({ status: 'FAILED' });
    });

    it('결과는 getSduConnectionTest 캐시에 반영', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      executeSduConnectionTest(SDU_TARGET_SOURCE_ID);
      const cached = getSduConnectionTest(SDU_TARGET_SOURCE_ID);
      expect(cached.data?.status).toBe('PASSED');
    });

    it('비-SDU project → NOT_SDU_PROJECT 에러', () => {
      const result = executeSduConnectionTest(AWS_TARGET_SOURCE_ID);
      expect(result.error?.code).toBe('NOT_SDU_PROJECT');
    });
  });

  describe('store 격리 — 두 SDU project 간 cross-contamination 없음', () => {
    it('proj-sdu-001 의 IAM user 변경이 sdu-proj-1 에 영향 없음', () => {
      issueAkSk(SDU_TARGET_SOURCE_ID, 'issuer-a@example.com');
      const other = getIamUser(SDU_TARGET_SOURCE_ID_2);

      expect(other.data?.userName).toBe('sdu-user-u-proj-1');
      expect(other.data?.akSkIssuedBy).toBe('admin@example.com');
    });
  });
});
