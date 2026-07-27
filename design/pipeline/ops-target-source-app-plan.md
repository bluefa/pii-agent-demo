# Target Source 운영 페이지 — App 구현 계획

> Figma `pYCA7zTWcZysYOpYykuYAN` 재설계를 실제 앱(Next.js 14)으로 구현하는 계획.
> 원본 프로토타입: `design/pipeline/admin-ops.html` (`#/ts/2013/process`).
> 계약이 없는 API는 **가정 계약**으로 구현하고 `docs/api/ops-assumed-contracts.md`에 명시한다.

## 1. 스코프

**포함** (Figma에 그려진 것):

| Figma 노드 | 내용 |
|---|---|
| `4:2` | 운영 콘솔 — Target Source 운영 상세 (진행 상태 탭 포함) |
| `4:78` 헤더 | breadcrumb · 현재 단계 pill · 서비스명 H1 + `Target # id` + 서비스코드 태그 · AWS 계정 인라인 행(Global/설치모드 태그) · Scan/TF Role ARN 서브행 · 협업 채널 말풍선 |
| `22:40` 탭바 | 진행 상태(활성) · 스캔 · 연동 요청 정보 · 파이프라인 · Test Connection — 인디케이터 스타일 |
| `4:235` | 현재 Process 카드 (7-step rail + 캡션) |
| `30:3` | 승인 요청 내역 카드 (요청 일시/상태/요청자/상세 보기, 페이지네이션) ‖ 상태 변경 이력 카드 (일시/변경 Step→Step/수행자, 페이지네이션) |
| `51:5` | 설치 모드 변경 모달 |
| `1:2` | Role 권한 확인 모달 (Target Source 요약 + 검증 상태 + 필요 권한 목록) |
| `2:2` | Role 수정 모달 (이름만 입력 → 계정 정보로 ARN 조립) |

**제외** (이번 PR 아님):
- 진행 상태 외 탭 콘텐츠 (스캔/연동 요청 정보/파이프라인/Test Connection) — 탭은 노출하되 비활성 처리
- 운영 알림 · 서비스 운영 페이지 (사이드바 그룹만 추가, 항목은 Target Source 운영만)
- AWS 외 CSP의 Role 영역 (GCP/Azure/IDC는 Role 서브행·설치모드 태그 미노출)

## 2. 배치

- 라우트: `/admin/pipelines/ops/target-sources/[targetSourceId]` (기존 admin pipelines 셸/사이드바 재사용)
- 인덱스: `/admin/pipelines/ops/target-sources` — Target Source ID 입력 진입점(최소). 목록/검색 고도화는 후속.
- 사이드바: `운영 콘솔` 그룹 신설, 항목 `Target Source 운영` 1개.

## 3. 데이터 매핑

### 3-1. 기존 계약으로 커버되는 것 (swagger install-v1)

| 화면 요소 | API | 비고 |
|---|---|---|
| 서비스명·코드·CSP·AWS 계정·Global/China·설치모드(조회) | `GET /target-sources/{id}` | `getRawTargetSourceDetail` 기존 클라이언트. 설치모드 = `metadata.grant_service_terraform_execution_permission` |
| 현재 단계 pill + Process rail | `GET /target-sources/{id}/process-status` | `getProcessStatus` 기존. `BffProcessStatus` 7값 ↔ Step 1~7 |
| 승인 요청 내역 (페이지네이션) | `GET /target-sources/{id}/approval-history?page&size` | `getApprovalHistory` 기존. Spring `Page` |
| 상세 보기 | approval-history content 항목 | 기존 `ApprovalRequestDetailModal` 재사용 |
| Scan Role ARN + 검증 상태 | `GET /target-sources/{id}/aws/verify-scan-role` | 라우트 기존, CSR 클라이언트 신규 추가 |
| TF Role ARN + 검증 상태 | `GET /target-sources/{id}/aws/verify-execution-role` | 〃 |

### 3-2. 계약이 없는 것 → 가정 계약 (mock-first, 상세는 docs/api/ops-assumed-contracts.md)

| 화면 요소 | 가정 API | 구현 |
|---|---|---|
| 상태 변경 이력 | `GET /target-sources/{id}/status-history?page&size` | Next 라우트 + in-memory mock |
| 설치 모드 변경 | `PUT /target-sources/{id}/installation-mode` | 〃 |
| Scan/TF Role 등록·수정 | `PUT /target-sources/{id}/aws/scan-role` · `/aws/execution-role` | 〃 (body `{ role_name }`, 서버가 ARN 조립) |
| 협업 채널 조회·관리 | `GET/PUT /target-sources/{id}/collaboration-channel` | 〃 |

가정 라우트는 `app/api/v1/ops/_lib/store.ts` (globalThis 가드 in-memory store, admin queue 패턴)로 상태를 유지한다.

## 4. 컴포넌트 분해

```
app/admin/pipelines/ops/target-sources/
├── page.tsx                          # 인덱스: TS ID 입력
└── [targetSourceId]/
    ├── page.tsx                      # 서버 셸 (id 파싱 → 클라이언트 뷰)
    └── _components/
        ├── OpsTargetView.tsx         # 데이터 로드 + 헤더 + 탭 + 진행 상태 탭
        ├── OpsHeader.tsx             # breadcrumb·pill·타이틀·클라우드 행·Role 행·협업 채널
        ├── ProcessCard.tsx           # 현재 Process (InstallationProcessProgressBar 재사용)
        ├── ApprovalHistoryCard.tsx   # 승인 요청 내역 + 페이저 + 상세 모달
        ├── StatusHistoryCard.tsx     # 상태 변경 이력 + 페이저
        ├── InstallModeModal.tsx      # 51:5
        ├── RoleVerifyModal.tsx       # 1:2 (검증 GET 재호출 버튼 포함)
        ├── RoleEditModal.tsx         # 2:2 (이름 검증 /^[\w+=,.@-]{1,64}$/, ARN 미리보기)
        └── ChannelModal.tsx          # 협업 채널 관리 (이슈 키 + URL)
```

재사용: `pipelineStyles`(card/pill/table/pager/button/modal), `InstallationProcessProgressBar`,
`ApprovalRequestDetailModal`, `PlButton`/`PlToast`, `getRawTargetSourceDetail`, `getProcessStatus`, `getApprovalHistory`.

## 5. 디자인 결정 (Figma 대비)

- Figma raw hex → `--pl-*` 토큰 매핑 (`#2563eb`→`--pl-primary`, `#101828`→`--pl-text-strong` 등). 신규 hex 도입 금지.
- Role ARN 클릭 → **권한 확인 모달**, 모달 푸터의 `Role 수정` 버튼 → 수정 모달. (Figma에서 케밥이 사라져 수정 진입점이 미정 — 이 배선은 가정이며 사용자 피드백으로 조정)
- 미구현 탭 4종은 `disabled` + "준비 중" 라벨. 동작하는 척 하지 않는다.
- 상태 변경 이력의 Step pill 색상: Figma의 단계별 tone(회색/주황/파랑/진파랑)을 `--pl-*` 시맨틱 토큰으로 재현.
- China 계정이면 ARN prefix `arn:aws-cn:` (RoleEditModal 미리보기 포함).

## 6. 검증

1. `npx tsc --noEmit` 0 에러
2. `npm run lint` 0 에러
3. `npx vitest run` 기존 그린 유지
4. dev 서버 + Chrome에서 `/admin/pipelines/ops/target-sources/2013` 렌더 → Figma `4:2` 스크린샷과 대조 (헤더/탭/카드 구조·토큰)
5. 모달 3종 열림/검증/저장 mock 왕복 확인

## 7. 후속 (이번 PR 밖)

- 가정 계약 4종의 BFF 실구현 협의 (`docs/api/ops-assumed-contracts.md` 기준)
- 스캔 탭 (계약 존재: `/scan`, `/scan/history`, `/scanJob/latest`) — 프로토타입 `tabScan` 포팅
- 운영 알림 · 서비스 운영 페이지
- 인덱스 페이지 목록화 (`/admin/queue/target-sources` 재사용)
