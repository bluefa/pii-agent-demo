# 프로세스 가이드 구현 TODO

> 2026-02-08 | feat/process-guide

## 이번 세션 (AWS 집중)

### 공통 기반

- [ ] **#5 타입 정의 + 가이드 데이터 구조**
  - `lib/types/process-guide.ts` — ProcessGuideStep, ProviderProcessGuide 등
  - `lib/constants/process-guides.ts` — 기본 구조, 헬퍼 함수

- [ ] **#6 ProcessGuideModal + Timeline + StepCard 컴포넌트** (← #5 완료 후)
  - `ProcessGuideModal.tsx` — 메인 모달 (2-column 레이아웃)
  - `ProcessGuideTimeline.tsx` — 좌측 세로 타임라인
  - `ProcessGuideStepCard.tsx` — 우측 단계 카드 (아코디언)

- [ ] **#7 StepProgressBar 트리거 + ProcessStatusCard 연동** (← #6 완료 후)
  - `StepProgressBar.tsx` 수정 — "전체 가이드" ghost 버튼 추가
  - `ProcessStatusCard.tsx` 수정 — useModal 연동
  - raw 색상 → theme.ts 토큰 교체

### AWS

- [ ] **#8 AWS 프로세스 가이드 데이터** (← #5 완료 후, #6과 병렬 가능)
  - AWS 자동 설치 (5단계): 연동 대상 확정 → 승인 → 설치(자동 TF) → 연결 테스트 → 완료
  - AWS 수동 설치 (5단계): 연동 대상 확정 → 승인 → TF Script 실행 → 연결 테스트 → 완료
  - 각 단계별: 사전조치, 수행절차, 주의사항, 참고사항

## 다음 세션

### Azure
- [ ] **#9 Azure 프로세스 가이드 데이터**
  - DB Only (6단계): 확정 → 승인 → 설치 → PE 승인 → 연결 테스트 → 완료
  - DB + VM (6단계): 확정 → 승인 → 설치(DB:TF+PE / VM:수동TF) → PE 승인 → 연결 테스트 → 완료

### GCP
- [ ] **#10 GCP 프로세스 가이드 데이터**
  - 기본 (5단계): 확정 → 승인 → 설치 → 연결 테스트 → 완료
  - Subnet (6단계): 확정 → 승인 → Subnet 생성 → 설치 → 연결 테스트 → 완료

### IDC
- [ ] **#11 IDC 프로세스 가이드 데이터**
  - 4단계: 리소스 직접 입력 → 방화벽+BDC TF → 연결 테스트 → 완료

### SDU
- [ ] **#12 SDU 프로세스 가이드 데이터**
  - 4단계: S3 업로드 확인 → 환경 구성(Crawler+Athena) → 연결 테스트 → 완료

## 의존성

```
#5 타입/데이터 구조
 ├── #6 모달 컴포넌트 셸
 │    └── #7 트리거 연동
 ├── #8 AWS 데이터      ← 이번 세션
 ├── #9 Azure 데이터    ← 다음 세션
 ├── #10 GCP 데이터     ← 다음 세션
 ├── #11 IDC 데이터     ← 다음 세션
 └── #12 SDU 데이터     ← 다음 세션
```
