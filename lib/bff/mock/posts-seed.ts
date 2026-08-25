/**
 * FAQ & Notices — mock seed.
 *
 * The pinned/published dates reproduce the worked example in
 * docs/bff-api/tag-guides/faq-notices.md §5 정렬: a pinned post published
 * EARLIER still outranks an unpinned post published later.
 *
 * One post is hidden so the Admin screen has something to restore and the
 * user screen has something it must not show.
 */

import type { StoredPost } from '@/lib/bff/mock/posts';
import type { PostCategory, PostType } from '@/lib/types/post';

interface SeedCategory extends PostCategory {
  active: boolean;
}

export const postCategoriesSeed: SeedCategory[] = [
  { id: 1, type: 'NOTICE', name: '서비스 점검', displayOrder: 1, active: true },
  { id: 2, type: 'NOTICE', name: '기능 업데이트', displayOrder: 2, active: true },
  { id: 3, type: 'FAQ', name: '연동', displayOrder: 1, active: true },
  { id: 4, type: 'FAQ', name: '스캔', displayOrder: 2, active: true },
  { id: 5, type: 'FAQ', name: '권한', displayOrder: 3, active: true },
  { id: 6, type: 'NOTICE', name: '서비스 안내', displayOrder: 3, active: true },
];

const post = (
  id: number,
  type: PostType,
  categoryId: number | null,
  titleKo: string,
  titleEn: string,
  bodyKo: string,
  bodyEn: string,
  publishedAt: string,
  flags: { pinned?: boolean; hidden?: boolean } = {},
): StoredPost => ({
  id,
  type,
  categoryId,
  categoryName: null, // resolved by the store at read time
  titles: { ko: titleKo, en: titleEn },
  contents: { ko: bodyKo, en: bodyEn },
  publishedAt,
  updatedAt: publishedAt,
  pinned: flags.pinned ?? false,
  hidden: flags.hidden ?? false,
  hiddenAt: flags.hidden ? publishedAt : null,
  createdBy: 'seed',
  updatedBy: 'seed',
  // Seed bodies are text-only; a post gains images through the save request.
  images: [],
});

export const postsSeed: StoredPost[] = [
  post(
    1,
    'NOTICE',
    1,
    '8월 정기 점검 안내',
    'August maintenance window',
    '<p>8월 20일 02:00 ~ 04:00 정기 점검이 진행됩니다.</p><ul><li>점검 중 신규 연동 요청이 제한됩니다.</li><li>진행 중인 스캔은 점검 후 자동으로 재개됩니다.</li></ul>',
    '<p>Scheduled maintenance runs on Aug 20, 02:00–04:00.</p><ul><li>New integration requests are blocked during the window.</li><li>Running scans resume automatically afterwards.</li></ul>',
    '2026-08-10T09:00:00Z',
    { pinned: true },
  ),
  post(
    2,
    'NOTICE',
    2,
    'IDC 연동 방식이 개선되었습니다',
    'IDC integration flow improved',
    '<p>IDC 연동 시 IP Set 단위로 요청할 수 있게 되었습니다.</p><p>자세한 내용은 <a href="/pass/services" target="_blank" rel="noreferrer">서비스 목록</a>에서 확인하세요.</p>',
    '<p>IDC integrations can now be requested per IP Set.</p><p>See <a href="/pass/services" target="_blank" rel="noreferrer">Services</a> for details.</p>',
    '2026-08-09T04:00:00Z',
  ),
  post(
    3,
    'NOTICE',
    null,
    '구버전 스캔 리포트 다운로드 종료',
    'Legacy scan report download retired',
    '<p>구버전 리포트 다운로드는 8월 말 종료됩니다.</p>',
    '<p>The legacy report download is retired at the end of August.</p>',
    '2026-07-28T01:00:00Z',
    { hidden: true },
  ),
  post(
    4,
    'FAQ',
    3,
    '연동 요청 후 얼마나 기다려야 하나요?',
    'How long does an integration request take?',
    '<p>관리자 승인까지 보통 <strong>1영업일</strong> 이내입니다.</p><p>승인 이후 설치는 자동으로 진행되며, 진행 상태는 대상 상세 화면에서 확인할 수 있습니다.</p>',
    '<p>Admin approval usually lands within <strong>one business day</strong>.</p><p>Installation then runs automatically; progress is visible on the target detail screen.</p>',
    '2026-08-12T02:00:00Z',
    { pinned: true },
  ),
  post(
    5,
    'FAQ',
    5,
    '스캔에 필요한 권한은 무엇인가요?',
    'Which permissions does a scan need?',
    '<p>스캔은 읽기 전용 역할만 사용합니다.</p><ol><li>리소스 목록 조회</li><li>메타데이터 조회</li></ol><p>쓰기 권한은 요구하지 않습니다.</p>',
    '<p>Scanning uses a read-only role.</p><ol><li>List resources</li><li>Read metadata</li></ol><p>No write permission is requested.</p>',
    '2026-08-11T06:30:00Z',
  ),
  post(
    6,
    'FAQ',
    4,
    '스캔 결과가 비어 있어요',
    'My scan came back empty',
    '<p>대상 계정에 스캔 대상 리소스가 없거나, 역할 신뢰 관계가 아직 반영되지 않은 경우입니다.</p><p>역할 검증을 다시 실행한 뒤 스캔을 재시도하세요.</p>',
    '<p>Either the account holds no scannable resources, or the role trust relationship has not propagated yet.</p><p>Re-run role verification, then retry the scan.</p>',
    '2026-08-05T08:15:00Z',
  ),

  // 온보딩 배너(`PassBanner`)가 제목으로 찾아 여는 글들. 배너는 계약 범위 밖의 고정
  // 콘텐츠라 링크가 id 가 아니라 제목을 쥐고 있다 — 여기 제목을 고치면 배너도 고친다.
  // 마지막 둘은 요약 카드의 5행 밖에 떨어지도록 날짜를 잡아 뒀다(카드가 잘린 행을
  // 마저 그리는지 확인하는 자리).
  post(
    7,
    'NOTICE',
    6,
    'PASS 서비스 소개 안내',
    'What PASS does',
    '<p>PASS는 담당 시스템의 PII 모니터링 모듈 연동과 상태 조회를 한 화면에서 처리합니다.</p><ul><li>인프라 등록 → 권한 점검 → 연결 테스트 → 스캔까지 한 흐름으로 이어집니다.</li><li>담당자는 연동 요청과 확정만 확인하면 됩니다.</li><li>연동 이후 상태는 대상 상세 화면에서 실시간으로 확인할 수 있습니다.</li></ul>',
    '<p>PASS connects your PII monitoring modules and reports their state on a single screen.</p><ul><li>Register infrastructure, verify roles, test the connection, then scan — one flow.</li><li>You only step in to request and confirm the integration.</li><li>State after integration is visible on the target detail screen.</li></ul>',
    '2026-08-06T00:00:00Z',
  ),
  post(
    8,
    'NOTICE',
    6,
    'PII 모니터링 모듈(PII Agent/SDU) 소개',
    'PII monitoring modules (PII Agent / SDU)',
    '<p>PII 모니터링 모듈은 두 가지입니다.</p><ul><li><strong>PII Agent</strong> — 대상 시스템에 설치되어 개인정보 항목을 주기적으로 스캔합니다.</li><li><strong>SDU</strong> — 스캔 결과를 수집·적재하는 데이터 수집 모듈입니다.</li></ul><p>연동 대상의 종류에 따라 둘 중 하나 또는 둘 모두를 설치합니다.</p>',
    '<p>Two modules do the monitoring.</p><ul><li><strong>PII Agent</strong> — installed on the target system, scans for personal data on a schedule.</li><li><strong>SDU</strong> — collects and stores what the scan produced.</li></ul><p>Depending on the target, one or both are installed.</p>',
    '2026-08-05T00:00:00Z',
  ),
  post(
    9,
    'NOTICE',
    6,
    'PII Agent 지원 환경 소개',
    'Where PII Agent runs',
    '<p>현재 지원하는 환경입니다.</p><ul><li>AWS — RDS, Aurora, Redshift, Athena, EC2 기반 DB</li><li>Azure — SQL Database, PostgreSQL, MySQL</li><li>GCP — Cloud SQL, BigQuery</li><li>IDC — 사내망 DB(IP Set 단위 방화벽 요청 필요)</li></ul>',
    '<p>Supported environments.</p><ul><li>AWS — RDS, Aurora, Redshift, Athena, EC2-hosted databases</li><li>Azure — SQL Database, PostgreSQL, MySQL</li><li>GCP — Cloud SQL, BigQuery</li><li>IDC — on-premise databases (firewall requested per IP Set)</li></ul>',
    '2026-08-04T00:00:00Z',
  ),
  post(
    10,
    'NOTICE',
    6,
    'PII Agent 연동 절차 안내',
    'How to integrate PII Agent',
    '<ol><li>서비스 목록에서 대상 시스템을 선택합니다.</li><li>인프라를 등록하고 스캔으로 연동 대상을 찾습니다.</li><li>연동을 요청하면 관리자 승인이 진행됩니다.</li><li>승인 이후 설치와 연결 테스트가 자동으로 이어집니다.</li><li>확정 정보를 확인하면 연동이 끝납니다.</li></ol>',
    '<ol><li>Pick the target system from the service list.</li><li>Register the infrastructure and scan for integration targets.</li><li>Request the integration; an admin reviews it.</li><li>Installation and the connection test run automatically after approval.</li><li>Confirm the resulting information and the integration is done.</li></ol>',
    '2026-08-03T00:00:00Z',
  ),
  post(
    11,
    'NOTICE',
    6,
    'SDU 연동 절차 안내',
    'How to integrate SDU',
    '<p>SDU 연동은 PII Agent 연동이 끝난 대상에 대해 진행합니다.</p><ol><li>대상 상세 화면에서 SDU 연동을 요청합니다.</li><li>수집 경로(네트워크 · 계정)를 관리자가 점검합니다.</li><li>연결 테스트를 통과하면 수집이 시작됩니다.</li></ol>',
    '<p>SDU is integrated on targets that already have PII Agent.</p><ol><li>Request SDU integration from the target detail screen.</li><li>An admin checks the collection path — network and account.</li><li>Collection starts once the connection test passes.</li></ol>',
    '2026-08-02T00:00:00Z',
  ),
];
