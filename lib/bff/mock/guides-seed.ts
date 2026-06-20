/**
 * Guide CMS — mock seed.
 *
 * 22 entries, one per `GuideName`. Each entry's `ko` HTML is derived
 * from `DEFAULT_STEP_GUIDES` + provider overrides in
 * `lib/constants/process-guides.ts` and passes `validateGuideHtml()`.
 * `en` seeds as empty so admins author it explicitly.
 *
 * Non-AWS providers reuse the same step-keyed content as AWS AUTO
 * because `buildSimpleProviderGuide()` re-uses `DEFAULT_STEP_GUIDES`
 * verbatim. AWS AUTO vs AWS MANUAL only diverges at step 4; all other
 * AWS names share the same HTML across variants.
 */

import type { GuideDetail, GuideName } from '@/lib/types/guide';

const SEEDED_AT = '2026-04-25T00:00:00Z';

// ---------------------------------------------------------------------------
// Step-keyed HTML — matches DEFAULT_STEP_GUIDES in process-guides.ts.
// Manually transcribed so the seed is deterministic and reviewable in
// diffs. If process-guides.ts changes, this file must be updated (the
// drift CI test asserts every ko passes validateGuideHtml).
// ---------------------------------------------------------------------------

const STEP_1_HTML =
  '<h4>연동 대상 DB를 선택해 주세요</h4>' +
  '<p>Run Infra Scan을 통해 조회된 DB 리스트에서 PII 모니터링이 필요한 DB를 체크하고, 하단의 <strong>연동 대상 승인 요청</strong> 버튼을 눌러 주세요.</p>' +
  '<ul>' +
  '<li>Scan은 평균 3~5분 내외 소요되며, 대상 리소스가 많을 경우 더 길어질 수 있습니다.</li>' +
  '<li>보안 설정 또는 권한 문제로 스캔이 실패했다면 <a href="/docs/scan">가이드 문서</a>를 확인해 주세요.</li>' +
  '</ul>';

const STEP_2_HTML =
  '<h4>승인자의 검토를 기다리고 있어요</h4>' +
  '<p>요청하신 DB 연동 대상 목록은 보안팀 및 데이터 관리자의 검토를 받고 있습니다. 승인 결과는 메일과 Slack으로 안내됩니다.</p>' +
  '<ul>' +
  '<li>평균 1영업일 이내 검토가 완료됩니다.</li>' +
  '<li>3영업일 이상 지연 시 <a href="/contact">담당자에게 문의</a>해 주세요.</li>' +
  '</ul>';

const STEP_3_HTML =
  '<h4>승인된 DB를 시스템에 반영하고 있어요</h4>' +
  '<p>승인된 DB에 대한 메타 정보가 PII Agent 관리 시스템에 동기화되는 중입니다. 이 과정은 자동으로 진행되며 별도 조치가 필요하지 않습니다.</p>' +
  '<ul>' +
  '<li>반영 완료까지 최대 10분가량 소요될 수 있습니다.</li>' +
  '<li>이 단계에서는 실제 데이터가 전송되지 않으며, 메타데이터만 동기화됩니다.</li>' +
  '</ul>';

const STEP_4_HTML =
  '<h4>PII Agent를 설치해 주세요</h4>' +
  '<p>발급된 Credential과 설치 스크립트를 사용해 대상 인프라에 PII Agent를 배포합니다. Agent 설치 후 자동으로 다음 단계로 넘어갑니다.</p>' +
  '<ul>' +
  '<li>Credential은 <a href="/credentials">Credentials 메뉴</a>에서 확인할 수 있습니다.</li>' +
  '<li>Docker / Helm / Binary 설치 방식은 <a href="/docs/install">설치 가이드</a>를 참고해 주세요.</li>' +
  '<li>Agent는 설치 환경의 최소 사양(2 vCPU / 4GB RAM) 이상을 권장합니다.</li>' +
  '</ul>';

const STEP_5_HTML =
  '<h4>Agent와 N-IRP 간 통신을 확인하고 있어요</h4>' +
  '<p>설치된 Agent가 N-IRP(개인정보 리스크 플랫폼)와 정상적으로 통신하는지 자동으로 점검합니다. 네트워크 ACL과 방화벽 정책이 올바른지 확인해 주세요.</p>' +
  '<ul>' +
  '<li>테스트 실패 시 네트워크 구간(443, 8443 포트)을 우선 점검해 주세요.</li>' +
  '<li>재시도는 최대 5회까지 자동 수행됩니다.</li>' +
  '</ul>';

const STEP_6_HTML =
  '<h4>최종 관리자 승인을 기다리고 있어요</h4>' +
  '<p>PII Agent 운영팀의 최종 승인이 완료되면 모니터링이 시작됩니다. 승인 결과는 메일로 전달됩니다.</p>' +
  '<ul>' +
  '<li>긴급 건은 <a href="/support">#pii-agent-support</a> 채널로 공유해 주세요.</li>' +
  '<li>승인 취소 또는 설정 변경이 필요하다면 이 단계에서 요청 가능합니다.</li>' +
  '</ul>';

const STEP_7_HTML =
  '<h4>모든 연동이 완료되었습니다</h4>' +
  '<p>PII Agent가 정상 동작 중이며, 탐지 결과는 PII Map 및 대시보드에서 확인할 수 있습니다.</p>' +
  '<ul>' +
  '<li>탐지 리포트는 매일 09:00에 자동 발송됩니다.</li>' +
  '<li>인프라 변경 발생 시 다시 이 화면에서 재연동을 진행해 주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// IDC step-keyed HTML — IDC has no Infra Scan, so step 1 is manual input and
// step 4 is "BDC 측 리소스 설치 → 방화벽 확인" (idc-flow-requirements.md §3.5).
// Steps 2/3/5/6/7 follow the shared flow but reference IP/Domain/Source IP
// identifiers instead of cloud resource IDs.
// ---------------------------------------------------------------------------

const IDC_STEP_1_HTML =
  '<h4>연동 대상 DB 접속 정보를 입력해 주세요</h4>' +
  '<p>IDC 인프라는 자동 스캔이 지원되지 않아 연동 대상 DB의 접속 정보를 직접 입력합니다. <strong>연동 대상 추가</strong> 버튼으로 IP 또는 Domain, Port, DB Type을 등록한 뒤 승인을 요청해 주세요.</p>' +
  '<ul>' +
  '<li>Oracle 등 SID가 필요한 DB는 SID를 함께 입력해 주세요.</li>' +
  '<li>이전에 요청한 적이 있다면 <strong>기존 연동 요청 정보 불러오기</strong>로 목록을 채울 수 있습니다.</li>' +
  '</ul>';

const IDC_STEP_2_HTML =
  '<h4>승인자의 검토를 기다리고 있어요</h4>' +
  '<p>입력하신 연동 대상 목록은 보안팀 및 데이터 관리자의 검토를 받고 있습니다. 승인 결과는 메일과 Slack으로 안내됩니다.</p>' +
  '<ul>' +
  '<li>평균 1영업일 이내 검토가 완료됩니다.</li>' +
  '<li>3영업일 이상 지연 시 <a href="/contact">담당자에게 문의</a>해 주세요.</li>' +
  '</ul>';

const IDC_STEP_3_HTML =
  '<h4>승인된 연동 대상을 시스템에 반영하고 있어요</h4>' +
  '<p>승인된 연동 대상 정보가 PII Agent 관리 시스템에 동기화되는 중입니다. 이 과정은 자동으로 진행되며 별도 조치가 필요하지 않습니다.</p>' +
  '<ul>' +
  '<li>반영 완료까지 최대 10분가량 소요될 수 있습니다.</li>' +
  '<li>이 단계에서는 실제 데이터가 전송되지 않으며, 메타데이터만 동기화됩니다.</li>' +
  '</ul>';

const IDC_STEP_4_HTML =
  '<h4>BDC 리소스 설치와 방화벽을 확인해 주세요</h4>' +
  '<p>BDC망에 PII Agent 수집 모듈과 네트워크 경로를 구성하고, Source IP에서 연동 대상으로의 방화벽 오픈 여부를 점검합니다. 두 단계가 모두 완료되면 자동으로 다음 단계로 넘어갑니다.</p>' +
  '<ul>' +
  '<li>각 연동 대상의 <strong>Source IP → 연동 대상(IP:Port)</strong> 허용 규칙을 서비스 측 방화벽에 등록해 주세요.</li>' +
  '<li>경로가 여러 개인 경우 모든 경로가 열려야 방화벽 오픈으로 표시됩니다.</li>' +
  '</ul>';

const IDC_STEP_5_HTML =
  '<h4>Agent와 N-IRP 간 통신을 확인하고 있어요</h4>' +
  '<p>설치된 Agent가 N-IRP(개인정보 리스크 플랫폼)와 정상적으로 통신하는지 점검합니다. Source IP에서 연동 대상까지의 방화벽 정책이 올바른지 확인해 주세요.</p>' +
  '<ul>' +
  '<li>테스트 실패 시 Source IP → 연동 대상(IP:Port) 방화벽 규칙을 우선 점검해 주세요.</li>' +
  '<li>방화벽 등록 후 <strong>Run Test</strong>를 눌러 다시 시도할 수 있습니다.</li>' +
  '</ul>';

const IDC_STEP_6_HTML =
  '<h4>최종 관리자 승인을 기다리고 있어요</h4>' +
  '<p>연결이 확인되었습니다. PII Agent 운영팀의 최종 승인이 완료되면 모니터링이 시작됩니다. 승인 결과는 메일로 전달됩니다.</p>' +
  '<ul>' +
  '<li>긴급 건은 <a href="/support">#pii-agent-support</a> 채널로 공유해 주세요.</li>' +
  '<li>승인 취소 또는 설정 변경이 필요하다면 이 단계에서 요청 가능합니다.</li>' +
  '</ul>';

const IDC_STEP_7_HTML =
  '<h4>모든 연동이 완료되었습니다</h4>' +
  '<p>PII Agent가 정상 동작 중이며, 탐지 결과는 PII Map 및 대시보드에서 확인할 수 있습니다.</p>' +
  '<ul>' +
  '<li>탐지 리포트는 매일 09:00에 자동 발송됩니다.</li>' +
  '<li>연동 대상 변경이 필요하면 다시 이 화면에서 재연동을 진행해 주세요.</li>' +
  '</ul>';

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const entry = (name: GuideName, ko: string): GuideDetail => ({
  name,
  contents: { ko, en: '' },
  updatedAt: SEEDED_AT,
});

export const guidesSeed: Record<GuideName, GuideDetail> = {
  // AWS (8) — AUTO/MANUAL share every step except step 4 (different guideName).
  AWS_TARGET_CONFIRM: entry('AWS_TARGET_CONFIRM', STEP_1_HTML),
  AWS_APPROVAL_PENDING: entry('AWS_APPROVAL_PENDING', STEP_2_HTML),
  AWS_APPLYING: entry('AWS_APPLYING', STEP_3_HTML),
  AWS_AUTO_INSTALLING: entry('AWS_AUTO_INSTALLING', STEP_4_HTML),
  AWS_MANUAL_INSTALLING: entry('AWS_MANUAL_INSTALLING', STEP_4_HTML),
  AWS_CONNECTION_TEST: entry('AWS_CONNECTION_TEST', STEP_5_HTML),
  AWS_ADMIN_APPROVAL: entry('AWS_ADMIN_APPROVAL', STEP_6_HTML),
  AWS_COMPLETED: entry('AWS_COMPLETED', STEP_7_HTML),
  // AZURE (7)
  AZURE_TARGET_CONFIRM: entry('AZURE_TARGET_CONFIRM', STEP_1_HTML),
  AZURE_APPROVAL_PENDING: entry('AZURE_APPROVAL_PENDING', STEP_2_HTML),
  AZURE_APPLYING: entry('AZURE_APPLYING', STEP_3_HTML),
  AZURE_INSTALLING: entry('AZURE_INSTALLING', STEP_4_HTML),
  AZURE_CONNECTION_TEST: entry('AZURE_CONNECTION_TEST', STEP_5_HTML),
  AZURE_ADMIN_APPROVAL: entry('AZURE_ADMIN_APPROVAL', STEP_6_HTML),
  AZURE_COMPLETED: entry('AZURE_COMPLETED', STEP_7_HTML),
  // GCP (7)
  GCP_TARGET_CONFIRM: entry('GCP_TARGET_CONFIRM', STEP_1_HTML),
  GCP_APPROVAL_PENDING: entry('GCP_APPROVAL_PENDING', STEP_2_HTML),
  GCP_APPLYING: entry('GCP_APPLYING', STEP_3_HTML),
  GCP_INSTALLING: entry('GCP_INSTALLING', STEP_4_HTML),
  GCP_CONNECTION_TEST: entry('GCP_CONNECTION_TEST', STEP_5_HTML),
  GCP_ADMIN_APPROVAL: entry('GCP_ADMIN_APPROVAL', STEP_6_HTML),
  GCP_COMPLETED: entry('GCP_COMPLETED', STEP_7_HTML),
  // IDC (7) — manual DB input flow; reuse the generic per-step guide bodies.
  IDC_TARGET_INPUT: entry('IDC_TARGET_INPUT', STEP_1_HTML),
  IDC_APPROVAL_PENDING: entry('IDC_APPROVAL_PENDING', STEP_2_HTML),
  IDC_APPLYING: entry('IDC_APPLYING', STEP_3_HTML),
  IDC_INSTALLING: entry('IDC_INSTALLING', STEP_4_HTML),
  IDC_CONNECTION_TEST: entry('IDC_CONNECTION_TEST', STEP_5_HTML),
  IDC_CONNECTION_VERIFIED: entry('IDC_CONNECTION_VERIFIED', STEP_6_HTML),
  IDC_COMPLETE: entry('IDC_COMPLETE', STEP_7_HTML),
};
