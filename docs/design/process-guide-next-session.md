# 프로세스 가이드 — 다음 세션 가이드

> 다른 Cloud Provider(Azure, GCP, IDC, SDU)의 프로세스 가이드를 추가할 때 참조하세요.

## 작업 순서

1. Provider별 상세 콘텐츠 문서 작성 (`docs/design/{provider}-process-guide-content.md`)
2. 사용자 확인
3. `lib/constants/process-guides.ts`에 가이드 데이터 추가
4. `ProcessStatusCard.tsx`에 variant 분기 로직 추가
5. 테스트 및 리뷰

## 참조 파일

### 설계/콘텐츠 (읽기 전용)

| 파일 | 용도 |
|------|------|
| `docs/design/process-guide-design.md` | 전체 UI/UX 설계서 (2-column 모달 구조, 타임라인, 카드 등) |
| `docs/design/aws-process-guide-content.md` | AWS 콘텐츠 작성 패턴 (자동/수동 설치별 단계 정의) |
| `docs/design/process-guide-todo.md` | Provider별 TODO 및 단계 요약 (#9~#12) |
| `docs/cloud-provider-states.md` | 각 Provider별 프로세스 상태/단계 정의 (원본 비즈니스 로직) |

### 구현 패턴 (코드 참조)

| 파일 | 용도 |
|------|------|
| `lib/types/process-guide.ts` | 타입 정의 (ProcessGuideStep, ProviderProcessGuide) |
| `lib/constants/process-guides.ts` | AWS 가이드 데이터 패턴 + `getProcessGuide()` 헬퍼 |
| `app/components/features/ProcessStatusCard.tsx` | variant 분기 로직 (AWS: auto/manual) |
| `app/components/features/process-status/ProcessGuideModal.tsx` | 모달 컴포넌트 (수정 불필요, 데이터만 추가) |

### 프로젝트 규칙

| 파일 | 용도 |
|------|------|
| `.claude/commands/team-dev.md` | 팀 개발 워크플로우 (Phase 0 필수) |
| `.claude/skills/coding-standards/SKILL.md` | import 경로 매핑 포함 |

## Provider별 작업 범위

### Azure (#9)
- variant: `db-only`, `db-vm`
- 6단계: 확정 → 승인 → 설치 → PE 승인 → 연결 테스트 → 완료
- 특이점: Private Endpoint 승인 단계 존재, DB+VM일 때 VM은 수동 TF

### GCP (#10)
- variant: `basic`, `subnet`
- 기본 5단계 / Subnet 6단계 (Subnet 생성 단계 추가)
- 특이점: Subnet 생성이 별도 단계

### IDC (#11)
- variant: `default`
- 4단계: 리소스 직접 입력 → 방화벽+BDC TF → 연결 테스트 → 완료
- 특이점: 스캔 없음 (리소스 직접 입력), 방화벽 설정 포함

### SDU (#12)
- variant: `default`
- 4단계: S3 업로드 확인 → 환경 구성(Crawler+Athena) → 연결 테스트 → 완료
- 특이점: Terraform 없음, AWS 서비스(Crawler, Athena) 구성

## 주의사항

- `ProcessStatus` enum은 6단계이지만, Provider에 따라 실제 단계 수가 다름 (4~6단계)
- `getProcessGuide(provider, variant)` 함수에 새 Provider 데이터 등록 필요
- `getProcessGuideVariants(provider)` 함수에 variant 목록 추가 필요
- 콘텐츠 문서 먼저 작성 → 사용자 확인 → 구현 (Phase 0 필수)
