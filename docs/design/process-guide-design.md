# 프로세스 가이드 UI/UX 설계서

> 2026-02-08 | feat/process-guide

## 1. 개요

### 배경
현재 프로세스 가이드에 다음 문제가 있음:
1. **전체 프로세스 가이드 부재** — 사용자가 전체 여정을 한눈에 파악할 방법이 없음
2. **Provider별 가이드 격차** — AWS/Azure는 상세, GCP/IDC/SDU는 거의 없음
3. **IDC/SDU의 6단계 프로세스바 부적합** — 해당 없는 단계가 표시됨
4. **StepGuide null 반환** — Step 3(설치), Step 4(연결테스트)에서 가이드 텍스트 부재

### 목표
- 어떤 단계에서든 **전체 프로세스를 확인할 수 있는 가이드 모달** 제공
- Provider별 **명확하고 차별화된 단계별 가이드** 제시
- 기존 디자인 시스템(theme.ts) 활용

---

## 2. 현재 단계별 가이드 명확성 평가

| Step | Provider | 평가 | 문제점 |
|------|----------|------|--------|
| 1. 연동 대상 확정 | 공통 | 보통 (3/5) | Provider별 사전조치 안내 없음, IDC/SDU 텍스트 부적합 |
| 2. 승인 대기 | AWS/Azure/GCP | 양호 (4/5) | 자동 승인 조건 사전 안내 없음, 반려 시 동선 불명확 |
| 3. 설치 진행 | AWS | 양호 (4/5) | 가이드 모달 2종 있음 |
| 3. 설치 진행 | Azure | 양호 (4/5) | 인라인 + PE 가이드 있음 |
| 3. 설치 진행 | **GCP** | **미흡 (1/5)** | 전용 컴포넌트 없음, Subnet 가이드 전무 |
| 3. 설치 진행 | **IDC** | **미흡 (1/5)** | 방화벽 가이드 없음, BDC TF 상태 표시 없음 |
| 3. 설치 진행 | **SDU** | **미흡 (1/5)** | Crawler/Athena 서브스텝 표시 없음 |
| 4. 연결 테스트 | 공통 | 양호 (4/5) | Credential 미설정 사전 경고 부족 |
| 5. 연결 확인 | 공통 | 보통 (3/5) | 관리자 확정 맥락 부족 |
| 6. 완료 | 공통 | 양호 (4/5) | 이후 모니터링 안내 없음 |

---

## 3. 전체 프로세스 가이드 모달

### 3.1 트리거 UI

**권장: StepProgressBar 우측 ghost 버튼**

```
┌──────────────────────────────────────────────────────────────┐
│  ● 1단계 ─── ● 2단계 ─── ◉ 3단계 ─── ○ 4단계   [📖 전체 가이드] │
└──────────────────────────────────────────────────────────────┘
```

- 위치: StepProgressBar 우측 상단
- 스타일: `getButtonClass('ghost', 'sm')` + book 아이콘
- `aria-label="전체 프로세스 가이드 보기"`

**보조 트리거**: StepProgressBar 각 단계 원형 아이콘 클릭 → 해당 단계 하이라이트 상태로 모달 오픈
- 호버 시 커서 pointer + 툴팁 "단계 상세 보기"

### 3.2 모달 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│  전체 프로세스 가이드 (AWS 자동 설치)                      [X] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────┐  ┌──────────────────────────────────────┐│
│  │ ✓ 1. 연동 대상 │  │ ┌──────────────────────────────────┐ ││
│  │ │              │  │ │ 1. 연동 대상 확정          [완료✓] │ ││
│  │ ✓ 2. 승인     │  │ │                                  │ ││
│  │ │              │  │ │ 스캔된 리소스 중 연동할 대상을    │ ││
│  │ ◉ 3. 설치     │  │ │ 선택하고 확정합니다.              │ ││
│  │ │   ← 현재    │  │ │                                  │ ││
│  │ ○ 4. 연결테스트│  │ │ ▸ 사전 조치                      │ ││
│  │ │              │  │ │   - TF Role 등록 (자동설치 시)   │ ││
│  │ ○ 5. 완료     │  │ │   - DB Credential 등록           │ ││
│  │               │  │ │                                  │ ││
│  │               │  │ │ ▸ 수행 절차                      │ ││
│  │               │  │ │   1. 리소스 스캔 실행            │ ││
│  │               │  │ │   2. 연동 대상 선택              │ ││
│  │               │  │ │   3. [연동 대상 확정] 클릭       │ ││
│  │               │  │ │                                  │ ││
│  │               │  │ │ ⓘ 전체 선택 시 자동 승인        │ ││
│  │               │  │ └──────────────────────────────────┘ ││
│  │               │  │                                      ││
│  │               │  │ ┌──────────────────────────────────┐ ││
│  │               │  │ │ 2. 승인 대기              [완료✓] │ ││
│  │               │  │ │ ...                              │ ││
│  │               │  │ └──────────────────────────────────┘ ││
│  │               │  │                                      ││
│  │               │  │ ┌──────────────────────────────────┐ ││
│  │               │  │ │ 3. 설치 진행          ◉ 현재 단계 │ ││
│  │               │  │ │ ...                              │ ││
│  │               │  │ └──────────────────────────────────┘ ││
│  └───────────────┘  └──────────────────────────────────────┘│
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                     [닫기]   │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 모달 사양

| 항목 | 값 |
|------|-----|
| 크기 | max-w-2xl (672px) |
| 높이 | max-h-[80vh] |
| 레이아웃 | 2-column (좌 200px + 우 flex-1) |
| 좌측 | 세로 타임라인 (고정, 스크롤 없음) |
| 우측 | 단계별 카드 (overflow-y-auto) |
| 제목 | 동적 — "전체 프로세스 가이드 ({Provider} {Mode})" |

### 3.4 좌측 타임라인

**상태별 스타일** (theme.ts 토큰):

| 상태 | 원형 | 연결선 | 텍스트 |
|------|------|--------|--------|
| 완료 | `statusColors.success` bg + 체크아이콘 | success border | success textDark |
| 현재 | `statusColors.info` bg + ring-2 | pending border | info textDark, font-semibold |
| 대기 | `statusColors.pending` border only | pending border | pending textDark |

**인터랙션**:
- 모든 단계 클릭 가능 → 우측 패널 smooth scroll
- 호버 시 `hover:bg-gray-50`
- 모달 오픈 시 현재 단계로 자동 scrollIntoView

### 3.5 우측 단계 카드

**카드 구조** (아코디언):
- 완료 단계: 접힌 상태 (제목 + 체크), 클릭으로 펼침
- **현재 단계: 펼쳐진 상태 + 좌측 border-l-4 blue + bg-blue-50**
- 대기 단계: 접힌 상태 (회색), 클릭으로 펼침

**카드 내부 섹션**:
1. **제목 + 상태 뱃지** (완료/진행중/대기)
2. **요약 설명** (1-2문장)
3. **사전 조치** (필수 조건, 접이식)
4. **수행 절차** (번호 매긴 스텝)
5. **주의사항** (amber 배경, `statusColors.warning`)
6. **Provider별 분기 안내** (해당 시)

---

## 4. Provider별 프로세스 단계 정의

### AWS 자동 설치
```
1. 연동 대상 확정 — 스캔 → 리소스 선택 → 확정
2. 승인 대기 — 관리자 승인 (자동 승인 가능)
3. 설치 진행 — 시스템 자동 TF 실행 (Service TF + BDC TF)
4. 연결 테스트 — Test Connection 실행
5. 완료 — 연동 완료
```

### AWS 수동 설치
```
1. 연동 대상 확정 — 스캔 → 리소스 선택 → 확정
2. 승인 대기 — 관리자 승인 (자동 승인 가능)
3. TF Script 실행 — 다운로드 → terraform init/plan/apply
4. 연결 테스트 — Test Connection 실행
5. 완료 — 연동 완료
```

### Azure (DB Only)
```
1. 연동 대상 확정 — 스캔 → 리소스 선택 → 확정
2. 승인 대기 — 관리자 승인
3. 설치 진행 — TF 자동 설치
4. Private Endpoint 승인 — Azure Portal에서 PE 승인
5. 연결 테스트 — Test Connection
6. 완료
```

### Azure (DB + VM)
```
1. 연동 대상 확정 — 스캔 → DB/VM 리소스 선택
2. 승인 대기 — 관리자 승인
3. 설치 진행 — DB: TF 자동 + PE | VM: TF Script 수동
4. Private Endpoint 승인 — DB 리소스별 PE 승인
5. 연결 테스트
6. 완료
```

### GCP (기본)
```
1. 연동 대상 확정 — 스캔 → 리소스 선택
2. 승인 대기
3. 설치 진행 — TF 설치
4. 연결 테스트
5. 완료
```

### GCP (Subnet 필요)
```
1. 연동 대상 확정 — 스캔 → 리소스 선택
2. 승인 대기
3. Subnet 생성 — VPC/Region 선택, 시스템 자동 생성
4. 설치 진행 — TF 설치
5. 연결 테스트
6. 완료
```

### IDC
```
1. 리소스 직접 입력 — IP/Port/DatabaseType (Oracle: ServiceId)
2. 방화벽 + BDC TF 설치 — Source IP 확인, 방화벽 오픈, BDC TF
3. 연결 테스트
4. 완료
```

### SDU
```
1. S3 업로드 확인 — S3 데이터 업로드 완료 확인 (API)
2. 환경 구성 — Crawler → Athena Table → 확정 → BDC Athena 설정
3. 연결 테스트
4. 완료
```

---

## 5. 컴포넌트 구조

### 파일 구조

```
lib/
├── types/
│   └── process-guide.ts            ← 가이드 타입 정의
└── constants/
    └── process-guides.ts           ← Provider별 가이드 데이터

app/components/features/process-status/
├── ProcessGuideModal.tsx           ← 메인 모달 (좌+우 레이아웃)
├── ProcessGuideTimeline.tsx        ← 좌측 세로 타임라인
├── ProcessGuideStepCard.tsx        ← 우측 단계 카드
├── StepProgressBar.tsx             ← 수정: 가이드 트리거 버튼 추가
└── StepGuide.tsx                   ← 수정: null 반환 제거, 인라인 가이드 개선
```

### 의존성 흐름

```
lib/types/process-guide.ts
  ↓
lib/constants/process-guides.ts
  ↓
ProcessGuideTimeline.tsx + ProcessGuideStepCard.tsx
  ↓
ProcessGuideModal.tsx
  ↓
StepProgressBar.tsx (트리거) → ProcessStatusCard.tsx (통합)
```

### 수정 파일 요약

| 파일 | 변경 |
|------|------|
| `lib/types/process-guide.ts` | **신규** — 가이드 타입 |
| `lib/constants/process-guides.ts` | **신규** — Provider별 데이터 |
| `ProcessGuideModal.tsx` | **신규** — 메인 모달 |
| `ProcessGuideTimeline.tsx` | **신규** — 세로 타임라인 |
| `ProcessGuideStepCard.tsx` | **신규** — 단계 카드 |
| `StepProgressBar.tsx` | **수정** — 가이드 트리거 추가 |
| `ProcessStatusCard.tsx` | **수정** — 모달 연동 |

---

## 6. 타입 정의

```typescript
// lib/types/process-guide.ts

interface ProcessGuideStep {
  stepNumber: number;
  label: string;
  description: string;
  prerequisites?: string[];   // 사전 조치
  procedures?: string[];      // 수행 절차
  warnings?: string[];        // 주의사항
  notes?: string[];           // 참고사항 (ⓘ 형태)
}

interface ProviderProcessGuide {
  provider: CloudProvider;
  variant: string;            // 'auto' | 'manual' | 'db-only' | 'db-vm' | 'basic' | 'subnet'
  title: string;              // 모달 제목에 표시
  steps: ProcessGuideStep[];
}
```

---

## 7. 접근성 (a11y)

| 요소 | 적용 |
|------|------|
| 모달 | `role="dialog"`, `aria-modal="true"` |
| 타임라인 | `role="navigation"`, `aria-label="프로세스 단계"` |
| 현재 단계 | `aria-current="step"` |
| 단계 버튼 | `<button>` + `aria-label="Step N: {label} - {status}"` |
| 키보드 | ESC(닫기), Tab(이동), Enter/Space(선택) |

---

## 8. 구현 우선순위

1. **[즉시]** 전체 프로세스 가이드 모달 — 가장 큰 사용자 니즈
2. **[즉시]** StepProgressBar 가이드 트리거 추가
3. **[단기]** Provider별 가이드 데이터 구축 (AWS/Azure 우선)
4. **[단기]** GCP/IDC/SDU 가이드 데이터 추가
5. **[중기]** StepGuide 인라인 가이드 개선 (null 반환 제거)
6. **[중기]** StepProgressBar 클릭 인터랙션 (단계 클릭 → 모달)

---

## 9. 기존 코드 문제점 (추가 발견)

### theme.ts 미경유 색상 사용 (CLAUDE.md 위반)
- `StepGuide.tsx` — bg-green-100, text-green-700 등 직접 사용
- `StepProgressBar.tsx` — bg-green-500, bg-blue-500 등 직접 사용
- `ProcessStatusCard.tsx` — bg-blue-50, border-blue-200 직접 사용

→ 이번 작업에서 수정 대상 파일(StepProgressBar, ProcessStatusCard)의 raw 색상도 함께 theme.ts 토큰으로 교체

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-08 | 초안 — UX 분석 + UI 설계 + 구현 분석 종합 |
