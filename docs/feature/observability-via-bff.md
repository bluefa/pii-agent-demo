# FE 관측성 아키텍처 (중간 산출물, v3)

> 상태: **✅ 확정 (3라운드 답변으로 승인)** — 배포 환경 실측(V-2~V-4)만 남음. 구현 착수.
> 이 문서는 `error-boundary-and-error-tracking-plan.md`(LIN-58/59 구현 가이드)의 **상위 아키텍처를 대체**한다.
> v1(07-10): Bugsink 셀프호스트 → v2(07-12 오전): BFF 경유+BFF망 Bugsink → **v3(07-12): 기존 인프라(Stackdriver/Grafana) 활용, 신규 수집 서버 없음.**

---

## 1. Q&A 로그 — 질문과 받은 답변 (누적)

### 1라운드 (07-12)

| # | 질문 | 답변 | 반영 |
|---|------|------|------|
| Q1 | FE 서버 아웃바운드 허용 범위? | **BFF, OAuth, 인가 서버만.** Slack 등 외부 호출 불가 | 모든 설계의 전제 |
| Q2 | BFF 쪽 기존 수집 인프라? | 아직 없음 | v2에서 BFF망 Bugsink 안 도출 (→ 2라운드에서 폐기) |
| Q3 (신규 요구) | — | "FE가 **어떤 상황에서 API Call**을 수행했는지" 추적 가능해야 | §5 컨텍스트 설계 |
| Q4 (원칙) | — | FE는 많은 작업 불가, 메트릭 저장은 FE 밖으로 | 모든 설계의 전제 |

### 2라운드 (07-12)

| # | 질문 | 답변 | 반영 |
|---|------|------|------|
| O-1 | BFF팀에 중계 라우트+Bugsink 컨테이너 호스팅 요청 가능? | **"이게 뭐지? 꼭 필요한건가?"** (사용자 역질문) | **필요 없어짐** — O-2/O-3 답변으로 신규 수집 서버 자체가 불필요해져 요청 철회. §3 참고 |
| O-2 | FE 서버 컨테이너 stdout 로그 수집되는가? | **Stackdriver 연동되어 있어 수집 가능할 듯** | ★ 설계 전환점: 에러 저장소 = Cloud Logging |
| O-3 | BFF 망에서 Slack 가능? | **가능. Grafana도 가능** | ★ 알림 = Grafana→Slack, 대시보드 = Grafana |
| O-4 | BFF에 observability 경로 할당 가능? | **`/integration/observability/*` 가능** | 지금은 미사용. Bugsink 승격 시를 위한 확보 옵션으로만 기록 (§4) |

### 3라운드 (07-12)

| # | 질문 | 답변 | 반영 |
|---|------|------|------|
| U-1 | Grafana 권한·데이터소스? | **있음. GCP의 metric으로 Grafana 구성 가능** | Phase 5 = Cloud Logging **로그 기반 metric**(severity≥ERROR 카운트) 정의 → Cloud Monitoring 경유 → Grafana 패널·알림 룰 |
| U-2 | FE→Stackdriver 직행이 "모두 BFF로 전송" 의도에 어긋나지 않는가? | **어긋나지 않음.** "BFF로 전송"은 표현이 틀렸고, 실제 의도는 "outbound가 심하게 제약되고 VPC 내부 컴포넌트 접근이 어렵다"는 것. Stackdriver/GCP Monitoring 활용 가능 | **아키텍처 v3 승인** — 제약의 본질은 "임의 목적지로 나가지 못함"이며, 플랫폼 수집(stdout)과 GCP 매니지드 서비스는 그 제약 밖 |

## 2. 남은 확인 항목

기술 검증 (배포 환경 필요, 접근 필요 시 도움 요청):

| # | 항목 |
|---|------|
| V-2 | **프로덕션 FE 컨테이너의 stdout이 실제로 Stackdriver(Cloud Logging)에 들어가는지** 실측 — "가능할 듯"을 확정으로. 배포 형태(GCE/GKE/Cloud Run)에 따라 로깅 에이전트 구성이 다름 |
| V-3 | **GCP Error Reporting이 이 로그에서 스택트레이스를 자동 그룹핑하는지** — 구조화 JSON에 stack을 담는 포맷(`message`에 스택 포함 또는 `@type: ReportedErrorEvent`)이 배포 형태에서 인식되는지 실측 |
| V-4 | Grafana에서 Cloud Logging 기반 알림 룰(에러 로그 발생 → Slack)이 구성 가능한지 — 불가하면 Cloud Monitoring 알림으로 대체 |

## 3. 아키텍처 v3 — "에러도 로그다"

O-2/O-3으로 드러난 사실: **저장(Stackdriver)·대시보드(Grafana)·알림(Slack)이 이미 존재**한다. 없는 것은 "에러를 그 파이프에 넣는 부분"뿐이다. 따라서 에러 전용 수집 서버(Bugsink)와 그것을 위한 SDK·터널·BFF 중계를 전부 접고, 에러를 구조화 로그로 취급한다.

```
[브라우저]
  렌더 에러 / unhandled rejection / 바운더리 리포트
      │ 자체 캡처 ~40줄 (window.onerror 등) + 직전 API 호출 링버퍼 첨부
      ▼ POST /integration/api/v1/observability/client-errors
[FE 서버]
  서버 예외 → handleUnexpectedError (기존 함수)
  API 요청/응답 → withV1 (기존 래퍼)
      │ 전부 구조화 JSON 한 줄 로그로 stdout에 출력  ← FE의 역할은 여기서 끝
      ▼ (플랫폼 로깅 에이전트가 수집 — 앱의 아웃바운드 아님)
[Cloud Logging (Stackdriver)] ── 저장·검색·보존
      ├─→ [GCP Error Reporting] 스택트레이스 자동 그룹핑 (V-3)
      └─→ [Grafana] 대시보드 + 알림 룰 → [Slack]
```

**신규 인프라 0, 신규 의존성 0(또는 pino 1개), BFF 팀 작업 0.** FE는 "구조화 로그를 찍는 것" 이상을 하지 않으므로 "FE는 많은 작업 불가" 원칙에 가장 충실한 안이다.

### 왜 이전 안(v1/v2)보다 나은가

| | v2: BFF망 Bugsink + Sentry SDK | **v3: 로그 기반** |
|---|---|---|
| 신규 컨테이너 | 2 (Bugsink+Postgres) + 운영(백업·업그레이드) | **0** |
| BFF 팀 작업 | 중계 라우트 + 호스팅 협의 | **0** |
| FE 신규 코드 | SDK 설정 3파일 + 중계 route + 훅 | 로거 + 클라 캡처 + route 1개 (총 ~150줄) |
| 신규 의존성 | @sentry/nextjs (버전 핀 관리) | 0~1 (pino) |
| 알림 | Bugsink→Slack (BFF망 가정) | Grafana→Slack (**이미 있음**) |
| 대시보드 | Bugsink UI (영어, 신규 학습) | Grafana (**이미 씀**) + GCP 콘솔 |
| 브라우저 에러 소스맵 심볼리케이션 | ○ (단, Next 16 실측 게이트 필요) | ✗ — §4 트레이드오프 |
| 이슈 라이프사이클 (할당/해결/회귀 감지) | ○ | △ (Error Reporting의 기본 그룹핑/해결 표시 수준) |

## 4. 접는 것과 그 트레이드오프 (정직하게)

**접는 것**: `@sentry/nextjs` SDK, Bugsink, BFF 중계 라우트, 터널 설계 전부.

**잃는 것 두 가지**:

1. **브라우저 minified 스택의 자동 심볼리케이션.** 완화: ① 클라 리포트에 페이지·컴포넌트 스택·직전 API 이력을 첨부하므로 "어디서 무슨 에러"는 대부분 특정 가능. ② 빌드마다 소스맵을 아티팩트로 보관(이미지에는 미포함)하고, 정말 필요한 스택만 오프라인에서 수동 디코드(`source-map` CLI). 1~3인 팀 트래픽에서 이 빈도는 낮다.
2. **Sentry식 이슈 관리**(중복 병합·할당·해결·회귀 알림). Error Reporting의 자동 그룹핑+Grafana 알림이 하한선을 담당.

**승격 경로 보존**: 이 갭이 실제로 아프면 그때 Bugsink를 BFF 망에 승격한다. 근거 리서치(R1/R3: Bugsink 선정, SDK ≥10.57 핀, tunnel SaaS 전용 → 수동 중계, `release.create:false` 등)는 `error-boundary-and-error-tracking-plan.md` Part D에 검증 완료 상태로 보존되어 있고, O-4로 확보한 `/integration/observability/*` 경로가 그때의 중계 주소가 된다. **지금 미리 만들지 않는다.**

## 5. "어떤 상황에서 API Call" 설계 (v2에서 유지)

수정 지점은 두 파일. 새 파이프라인 없음.

**(a) 컨텍스트 헤더** — `lib/fetch-json.ts`(모든 CSR 호출의 단일 래퍼)가 매 요청에 부착, `lib/bff/http.ts`가 allowlist forward(현재는 인입 헤더 전부 드랍 — 이 allowlist는 향후 인증 헤더 전파에도 재사용):

| 헤더 | 값 | 용도 |
|---|---|---|
| `X-Request-Id` | 클라 생성 UUID | 브라우저→FE 로그→BFF 로그 전 구간 상관관계 (LIN-61 해소) |
| `X-Client-Page` | 호출 시점 `location.pathname` | 어느 화면에서 |
| `X-Client-Action` | 선택: 트리거 액션명 | 무슨 행위로 |

FE의 `withV1` 액세스 로그와 BFF의 액세스 로그 양쪽에 이 컨텍스트가 남는다 → "누가·어느 화면에서·무슨 요청"을 FE(Stackdriver)와 BFF 어느 쪽에서든 조회 가능.

**(b) 직전 호출 링버퍼** — `fetch-json.ts`가 최근 API 호출 10건 `{method, path(쿼리 제거), status, duration, requestId}`을 모듈 레벨 링버퍼에 유지 → 클라이언트 에러 리포트에 첨부. Sentry breadcrumbs의 수동 구현(~15줄).

## 6. 구현 계획

| Phase | 내용 | 규모 | 검증 |
|---|---|---|---|
| 1 | **에러 바운더리 4파일** (기존 계획 Part A 그대로) | 반나절 | prod 빌드에서 강제 에러 → 대체 UI + 다시 시도 |
| 2 | **서버 구조화 로깅** (LIN-62 선행분과 통합): `handleUnexpectedError`·`withV1`을 구조화 JSON 로그로 — severity/message/stack/requestId/path/duration, Error Reporting 인식 포맷 | 반나절 | 로컬 JSON 출력 스냅샷 테스트; 배포 후 V-2/V-3 실측 |
| 3 | **브라우저 에러 캡처 + 수신 route**: 전역 핸들러 2개(onerror/onunhandledrejection)+바운더리 리포트+링버퍼 → `POST .../observability/client-errors` → 구조화 로그. 클라 스로틀(동일 에러 반복 억제)·서버 크기 제한·body 미로깅 원문 유지 | 반나절~1일 | 강제 렌더 에러/rejection → 로그 도착, 링버퍼·페이지 컨텍스트 포함 확인 |
| 4 | **API 컨텍스트**: `fetch-json.ts` 헤더+링버퍼, `lib/bff/http.ts` allowlist forward | 반나절 | FE·BFF 로그에 X-Request-Id/X-Client-Page 상관관계 확인 |
| 5 | **Grafana 대시보드 + Slack 알림 룰** (U-1/V-4에 따라) | 반나절 | 테스트 에러 → Slack 수신 |
| — | 소스맵: 빌드 아티팩트로 보관만 (이미지 미포함). 심볼리케이션은 승격 시 | 빌드 스크립트 1줄 | — |

의존성: Phase 1~4는 전부 로컬에서 완결(순차 무관, 1+2 병행 가능). Phase 5와 V-2/V-3만 배포 환경 필요. **총 개발 2.5~3.5일** — v2 대비 줄었고 협의 대기가 사라짐.

## 7. 폐기 기록 (왜 바뀌었는지 추적용)

- ~~v1: FE 인그레스 터널 + FE 옆 Bugsink~~ — FE 아웃바운드 제한(Q1)으로 폐기
- ~~v2: BFF망 Bugsink + BFF 중계 라우트 + Sentry SDK tunnel~~ — 기존 인프라 존재(O-2/O-3)로 폐기. "관측성 인프라 제로" 가정이 깨짐. Bugsink 승격 시 재사용할 리서치·경로는 §4에 보존
