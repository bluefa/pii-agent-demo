# History 공통 컴포넌트 구현 완료

## 구현 일시
- 2026-02-02

## 구현 내용

### History 타입 (수정됨)

**기록 대상**: 프로세스 상태 변경만 기록 (리소스 추가/제외는 기록 안 함)

| 타입 | 설명 | 기록 정보 |
|------|------|----------|
| `TARGET_CONFIRMED` | 연동 대상 확정 | 수행자, 일시, 리소스 개수, 제외 개수 |
| `AUTO_APPROVED` | 자동 승인 | 시스템, 일시 |
| `APPROVAL` | 승인 (수동) | 처리자, 일시 |
| `REJECTION` | 반려 | 처리자, 일시, 반려 사유 |
| `DECOMMISSION_REQUEST` | 폐기 요청 | 요청자, 일시, 사유 |
| `DECOMMISSION_APPROVED` | 폐기 승인 | 처리자, 일시 |
| `DECOMMISSION_REJECTED` | 폐기 반려 | 처리자, 일시, 사유 |

### 자동 승인 조건

다음 조건을 **모두** 만족할 때 자동 승인:
1. 이전에 **연동 제외**한 리소스가 존재
2. 해당 제외 리소스를 **제외한 모든 리소스**가 연동 대상으로 선택됨

### 신규/수정 파일

| 파일 | 설명 |
|------|------|
| `components/ui/HistoryTable/` | 제네릭 테이블 컴포넌트 |
| `components/features/history/ProjectHistoryPanel.tsx` | 통합 패널 |
| `components/features/history/ProjectHistoryTable.tsx` | 프로젝트 히스토리 테이블 |
| `components/features/history/ProjectHistoryFilter.tsx` | 필터 (all/approval) |
| `components/features/history/HistoryTypeBadge.tsx` | 유형별 뱃지 |
| `components/features/history/ProjectHistoryDetailModal.tsx` | **상세 모달** |
| `app/demo/history/page.tsx` | UX 확인용 데모 페이지 |
| `lib/types.ts` | ProjectHistoryType 수정 |
| `lib/mock-history.ts` | 히스토리 함수 수정 |
| `lib/constants/history.ts` | 상수 수정 |
| `lib/__tests__/mock-history.test.ts` | 테스트 업데이트 |
| `docs/cloud-provider-states.md` | History 요구사항 업데이트 |

### 상세 모달 (각 타입별 표시 정보)

| 타입 | 모달 표시 내용 |
|------|---------------|
| TARGET_CONFIRMED | 연동 대상 리소스 개수, 제외 리소스 개수, 설명 |
| AUTO_APPROVED | 자동 승인 조건 설명 |
| APPROVAL | 승인 안내 메시지 |
| REJECTION | **반려 사유** (강조), 재확정 안내 |
| DECOMMISSION_REQUEST | **폐기 사유**, 승인 대기 안내 |
| DECOMMISSION_APPROVED | 폐기 완료 안내 |
| DECOMMISSION_REJECTED | **반려 사유**, 연동 유지 안내 |

### 데모 페이지

**URL**: `/demo/history` (포트 3001)

확인 가능한 내용:
1. History 타입 설명
2. ProjectHistoryPanel (통합 컴포넌트)
3. 개별 컴포넌트 조합 + **상세 모달** (행 클릭 시)
4. 제네릭 HistoryTable (다른 데이터 타입)
5. 빈 상태 / 로딩 상태
6. 자동 승인 조건 설명

## 관련 문서

- `docs/cloud-provider-states.md` - History 요구사항 섹션 업데이트됨
  - 기록 대상 정의
  - 자동 승인 조건 명시
  - 리소스별 상태 관리 방식

## 테스트 방법

```bash
# worktree 이동
cd ../pii-agent-demo-history

# 테스트 실행
npm test -- --run lib/__tests__/mock-history.test.ts

# 개발 서버 시작
npm run dev

# 브라우저에서 확인
open http://localhost:3001/demo/history
```

## 2-패널 레이아웃 기획

**패널 구성**
| 패널 | 용어 | 내용 |
|------|------|------|
| 왼쪽 | **현재 상태** | 프로세스 5단계 진행 상황 |
| 오른쪽 | **진행 내역** | 변경 이력 테이블 |

**용어 선택**
- ~~"PII Agent 설치 History"~~ → **"진행 내역"**
- 더 자연스럽고 사용자 친화적인 한국어 표현

**Tooltip 기능**
| 위치 | 내용 |
|------|------|
| 뱃지 (연동 확정, 승인, 반려 등) | 해당 상태에 대한 설명 |
| 자동승인 조건 ⓘ 아이콘 | 자동 승인 조건 상세 설명 |
| 진행 내역 제목 옆 ⓘ 아이콘 | 진행 내역이란 무엇인지 설명 |

## 신규 컴포넌트

| 컴포넌트 | 설명 |
|----------|------|
| `Tooltip` | 범용 Tooltip 컴포넌트 |
| `InfoTooltip` | ⓘ 아이콘 + Tooltip 조합 |

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-02 | 최초 구현 (HistoryTable, ProjectHistoryPanel) |
| 2026-02-02 | RESOURCE_ADD/EXCLUDE 제거, TARGET_CONFIRMED/AUTO_APPROVED 추가 |
| 2026-02-02 | 자동 승인 조건 문서화 및 구현 |
| 2026-02-02 | ProjectHistoryDetailModal 추가 (타입별 상세 정보 표시) |
| 2026-02-02 | 2-패널 레이아웃 기획, Tooltip 컴포넌트 추가 |
