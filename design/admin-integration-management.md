# 연동 관리 (Admin) — 페이지 구성 확정안

> 상태: **확정 초안** — 사용자 검토·수정 대기. 수정 포인트는 ✍️ 표시.
> 작성일: 2026-07-13
> 위치: `/integration/admin/pipelines` 좌측 사이드바에 새 그룹으로 추가.
> 전제: 파생 상태는 서버가 매 조회 라이브 계산(ADR-023). 프론트는 대표 상태를 받기만 한다.

---

## 1. 상태 모델 전제 (혼동 방지)

| 축 | 값 | 비고 |
|---|---|---|
| **ProcessStatus** (Step 1~7) | 1 연동대상 확정대기 · 2 승인대기 · 3 반영중 · 4 설치중 · 5 연결테스트 대기 · 6 연결확인 완료(관리자 확정 대기) · 7 설치완료 | `lib/types.ts` `ProcessStatus` |
| **ConfirmStatus** (Step 1~3 내부) | 대표 상태: 신청 / 승인됨 / 확정중 / 확정완료 / 반려됨 (+ 취소·연동불가) | 내부 state diagram 다수 → 서버가 대표 상태로 파생 |
| **설치 확정** (Step 6) | TEST_CONNECTION_COMPLETED / TEST_CONNECTION_REJECTED | 신규 reject/status API |

ConfirmStatus ≠ ProcessStatus. Step 6 심사는 "연동 설치 여부를 결정"하는 별개 목적.

---

## 2. 유저 시나리오 (확정)

### A. 프로세스 모니터링 (읽기 전용)
- A1. 전체 Target Source의 Process(Step 1~7) 조회
- A2. Provider(AWS/Azure/GCP/IDC/SDU 표기) · Process Status 필터 + 서비스명/코드/ID 검색
- A3. 특정 step 장기 체류(정체) 조회 — 정체 시간 = 현재 step 진입 시각 기준 경과, 내림차순 정렬 + 임계 초과 강조
- A4. step별 체류 건수 KPI (승인 대기 N · 확정 대기 N · 정체 N · 진행 중 N)
- A5. 행에서 해당 심사 화면(B'/C')으로 바로 이동

### B. 연동 확정 승인 (ConfirmStatus, Step 1~3)
- B1. 대표 상태(신청/확정중/확정완료/반려·취소·불가)로 목록 조회
- B2. 신청 건의 연동 신청 내역(요청 리소스 목록 · 신청자 · 신청 시각) 조회
- B3. 신청 건 승인/반려 — 반려 사유 필수, 신청자에게 전달
- B4. IDC 신청 건 NLB Index 설정 — NLB 테이블 현황 보며 선택, 미설정 시 승인 게이팅
- B5. 승인/반려 이력 조회 (누가·언제·사유, AUTO_APPROVED 구분 표시)
- B6. 확정중(APPLYING_APPROVED) 장기 체류·SYSTEM_ERROR 건 식별

### C. 설치 확정 (Step 6 심사)
- C1. CONNECTION_VERIFIED 목록 조회 + 배치 status로 "테스트 완료/재실행 요청됨" 배지
- C2. 확정 리소스 목록 + 논리 DB 목록/제외 DB 목록 조회 (최대 1만 건 → 서버 pagination + 종합 카운트)
- C3. PII Agent 연동 완료를 명시적으로 수행 (확인 모달, 수행자·시각 기록)
- C4. Test Connection 재실행 요청 (reject + 사유 ≤512자)
- C5. 재실행 요청된 건의 사유·시각 조회, 담당자 재실행 시 상태 복귀 확인
- C6. (후순위) 논리 DB Healthy 여부 — API 신설 필요
- C7. (후순위) 리소스별 연동 상태 · 승인 가능 여부 API

### D. 횡단
- D1. 승인·반려·확정 액션은 ADMIN 권한만
- D2. 액션 결과는 사용자 측 프로세스 화면과 즉시 일관 (파생 상태 라이브)

---

## 3. IA / 라우트 (확정)

```
파이프라인            ← 기존 그룹
  대시보드
  서비스·대상 검색
연동 관리             ← 신규 그룹 ✍️(그룹명 후보: 연동 관리 / 승인 프로세스 관리 / 연동 프로세스)
  프로세스 현황        /admin/pipelines/process
  연동 승인           /admin/pipelines/approvals
  설치 확정           /admin/pipelines/installations
```

드릴다운 상세 (사이드바 active 없음, 기존 `targets/[id]` 문법):

- `/admin/pipelines/approvals/[targetSourceId]` — B' 승인 상세
- `/admin/pipelines/installations/[targetSourceId]` — C' 확정 상세

A 전용 상세는 없음. A 행 액션이 상태에 따라 B'/C'로 연결 (Step 1~3 → B', Step 5~6 → C', Step 4·7 조회 전용).

라우트를 `pipelines` 하위에 두는 것은 레이아웃 공유 목적의 실용적 선택. 도메인이 어색해지면 layout 승격 후 `/admin/*`로 분리하는 리팩터링 여지만 남기고 지금은 하지 않는다.

---

## 4. 페이지 구성 (확정)

공통: 목록 3종은 대시보드 문법(`Card`/`FilterBar`/`PlTable`/`StatusPill`/`RelativeTime`/`PlPagination`) 재사용. 상세 2종은 R24 상세 문법(브레드크럼 + 헤더 우측 CTA + 메타 스트립). fetch 전략은 대시보드와 동일(서버 필터 + 클라 검색/페이지).

### 4.1 A. 프로세스 현황 `/admin/pipelines/process`

| 영역 | 구성 |
|---|---|
| KPI 타일 4 | 승인 대기 N · 확정 대기 N · 정체 N(임계 초과) · 진행 중 N |
| 필터바 | Provider ▾ · Process Status(Step 1~7) ▾ · [정체만 보기] 토글 · 🔍 검색 |
| 테이블 | ID · 서비스(코드/명) · Provider · 현재 Step(pill) · Step 진입 시각 · **정체 시간** · 액션 |
| 정렬 | 정체 시간 내림차순 고정 (재정렬 없음) |
| 액션 셀 | Step 1~3 "승인 심사→B'" · Step 5~6 "확정 심사→C'" · 그 외 없음 |

- 정체 임계(강조 기준): **72시간** 기본, 서버 설정값. ✍️ step별 임계 차등 필요하면 기입
- 신규분은 정체 시간 컬럼 + install BFF 데이터 소스뿐. 나머지는 재사용.

### 4.2 B. 연동 승인 목록 `/admin/pipelines/approvals`

| 영역 | 구성 |
|---|---|
| 세그먼트 | **신청(기본)** \| 확정중 \| 확정완료 \| 반려·취소·불가 |
| 필터바 | Provider ▾ · 🔍 검색 |
| 테이블 | ID · 서비스 · Provider · 신청자 · 신청 시각 · 경과 · 요청 리소스 수 · 상태 pill · ⚑NLB 미설정(IDC) · [심사] |

- "확정중" 탭: 장기 체류 강조 + SYSTEM_ERROR 배지 (B6)
- 행 클릭 = [심사] = B' 이동

### 4.3 B'. 승인 상세 `/admin/pipelines/approvals/[id]`

```
[브레드크럼]  연동 승인 › {서비스명}
[헤더]        서비스명 · TS-{id} · Provider 태그 · 상태 pill      [반려] [승인]
[메타 스트립]  신청자 · 신청 시각 · 경과 시간 (1줄)
[IDC 전용]    NLB Index 설정 카드 — nlb/table 현황(인덱스별 수용량) + 선택 + 저장
              미설정 시 [승인] 비활성 + 사유 툴팁
[본문]        요청 리소스 목록 테이블 — 리소스ID/이름/타입/리전/메타 요약 + 카운트 + pagination
[하단]        승인 이력 타임라인 — 누가/언제/승인·반려·AUTO_APPROVED/사유
```

- 승인 = 확인 모달. 반려 = 사유 필수 입력 모달.
- 비(非)신청 상태의 화면: 액션 버튼 제거, 상태 배너로 대체 — 확정중=진행 배너(+SYSTEM_ERROR 에러 배너) · 반려됨=사유 · 확정완료=완료 시각.
- NLB 게이팅 = 승인 필수 조건으로 확정. ✍️ 아니라면(승인 후 설정 가능) 여기 수정

### 4.4 C. 설치 확정 목록 `/admin/pipelines/installations`

| 영역 | 구성 |
|---|---|
| 세그먼트 | **확정 대기(기본)** \| 재실행 요청됨 \| 연동 완료 |
| 필터바 | Provider ▾ · 🔍 검색 |
| 테이블 | ID · 서비스 · Provider · 테스트 완료 시각 · 경과 · 논리 DB(대상 N/제외 M) · 상태 배지 · [심사] |

- 상태 배지 = `test-connection/status/batch` 응답 (TEST_CONNECTION_COMPLETED/REJECTED)
- "재실행 요청됨" 탭 = C5 추적함. 담당자 재실행 시 확정 대기로 복귀.

### 4.5 C'. 확정 상세 `/admin/pipelines/installations/[id]`

```
[브레드크럼]  설치 확정 › {서비스명}
[헤더]        서비스명 · TS-{id} · Provider · 상태 pill    [재실행 요청] [연동 완료]
[요약 카드열]  확정 리소스 N · 논리 DB 대상 N · 제외 M · 테스트 완료 시각  (+후순위 Healthy 자리)
[본문 탭]     ① 논리 DB 목록(기본) — 서버 pagination + 검색 + 리소스별 필터 (+후순위 Healthy 컬럼)
              ② 제외 DB 목록 — 제외 사유 컬럼
              ③ 확정 리소스 목록 (+후순위 리소스별 연동 상태 컬럼)
[하단]        재실행 요청 이력 — 사유/요청 시각
```

- **연동 완료** = 확인 모달("PII Agent 연동을 완료 처리합니다" + 수행자·시각 기록 고지). 재실행 요청됨 상태면 비활성 + 상단 반려 사유 배너.
- **재실행 요청** = 사유 입력 모달(≤512자) → reject API.
- 1만 건 = ①탭 서버 pagination + 요약 카드 종합 카운트로 해소. 별도 페이지 없음.

---

## 5. 신규 BFF 계약 요구 (프론트가 필요로 하는 것)

기존 swagger(`install-v1.yaml`)에 없는 것만. 상세 스키마는 백엔드와 계약 후 swagger에 반영 → 프론트는 swagger만 따른다(contract-fidelity).

| # | API | 용도 | 페이지 |
|---|---|---|---|
| 1 | Process별 Target Source 목록 (step·provider 필터, **step 진입 시각/정체 시간 포함**, page) | A 목록 | A |
| 2 | ConfirmStatus 대표 상태별 Target Source 목록 (신청자·신청시각·요청 리소스 수 포함) | B 목록 | B |
| 3 | confirmProcess 상세 (대표 상태 + 신청 내역 + 요청 리소스 목록) | B' | B' |
| 4 | Step6 목록 (테스트 완료 시각 · 논리 DB 카운트) | C 목록 | C |
| 5 | `POST .../test-connection/reject` (사유 ≤512) | 재실행 요청 | C' |
| 6 | `GET .../test-connection/status` (단건) | C' 상태 | C' |
| 7 | `POST .../test-connection/status/batch` (List\<Long\>) | C 목록 배지 | C |
| 8 | (후순위) 논리 DB Healthy 목록 | C6 | C' |
| 9 | (후순위) 승인 가능 상태 여부 | C7 | B'/C' |

기존 재사용: `approval-requests/{approve,reject}` · `approval-history` · `tested-logical-databases` · `excluded-databases` · `resources` · `idc/nlb/table` · `pii-agent-installation/confirm`.

✍️ #1~4를 별도 신규 엔드포인트로 팔지, 기존 목록 API 확장으로 갈지는 백엔드 협의 사항.

---

## 6. 구현 순서 (확정)

1. **C + C'** (설치 확정) — 신규 가치 최대, 신규 API 의존이 명확 (mock-first)
2. **B + B'** (연동 승인) — 기존 approval API 재사용 비중 큼
3. **A** (프로세스 현황) — 재사용 최대, 신규 API #1만 필요
4. 사이드바 그룹은 1단계에서 함께 추가 (미구현 메뉴는 숨김, "준비 중" 노출 안 함)

각 단계: mock-first(별도 route fixtures) → 계약 확정 시 어댑터 교체.

---

## 7. 열린 질문 ✍️

| # | 질문 | 임시 결정 |
|---|---|---|
| Q1 | 그룹명 | 연동 관리 |
| Q2 | 정체 임계 | 72h 고정(서버 설정) |
| Q3 | NLB 설정 = 승인 필수 조건? | 필수 (미설정 시 승인 비활성) |
| Q4 | B 목록 "신청" 탭에 UNAVAILABLE(연동 불가) 포함 위치 | "반려·취소·불가" 탭으로 분리 |
| Q5 | 연동 완료 후(Step 7) 건을 C "연동 완료" 탭에 얼마나 보관 | 전체 보관, 기간 제한 없음 |
| Q6 | A 목록에 Step 7(완료) 포함 여부 | 포함 (필터로 제외 가능) |
