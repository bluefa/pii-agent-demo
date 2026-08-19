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
];
