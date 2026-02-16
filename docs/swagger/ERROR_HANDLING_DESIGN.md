# Error Handling 설계 논의

> **상태**: 설계 논의 중 (2026-02-15~)
> **관련 문서**: `docs/swagger/SCAN_ERROR_UX.md`

---

## 1. 문제 정의

현재 코드베이스는 에러 처리가 비일관적:
- 서버(V1 Route Handlers): RFC 9457 ProblemDetails 사용 (구조화됨)
- 클라이언트(`app/lib/api/*.ts`): `if (!res.ok) throw new Error(message)` — 구조 소실
- 컴포넌트: `useState<string | null>` — message만 가지고 있어 status/code 분기 불가

**핵심 gap**: 서버는 `{ status, code, retriable }` 을 보내는데, 클라이언트가 `message` 문자열로 축소시킴.

---

## 2. 에러 분류 체계

### 2.1 큰 분류: 예상된 에러 vs 예상하지 못한 에러

```
에러
├── 예상된 에러 (Expected)
│   ├── 정상 흐름 (Expected-Flow)     ← 에러지만 UI가 정상 동작으로 전환
│   └── 차단 필요 (Expected-Block)    ← 에러를 사용자에게 명시적으로 알림
│       ├── Soft Block               ← 다시 시도 가능
│       └── Hard Block               ← 사용자 조치 필요 (설정 변경, 권한 요청 등)
└── 예상하지 못한 에러 (Unexpected)    ← 서버 버그, 파싱 실패 등
```

### 2.2 구체 예시

| HTTP Status | 예시 상황 | 분류 | UI 동작 |
|:-----------:|----------|------|---------|
| 409 | POST /scan → 이미 진행 중 | **Expected-Flow** | info 배너 + 폴링 자동 시작 |
| 409 | 다른 API 충돌 | **Expected-Block (Soft)** | 에러 배너 + "새로고침" CTA |
| 404 | 스캔 대상 없음 | **Expected-Block (Hard)** | 에러 배너 + 버튼 비활성화 |
| 403 | 권한 없음 | **Expected-Block (Hard)** | 에러 배너 + "권한 요청" CTA |
| 401 | 인증 만료 | **Expected-Block (Hard)** | 로그인 페이지 리다이렉트 |
| 429 | Rate Limit | **Expected-Block (Soft)** | "잠시 후 다시 시도" + Retry-After |
| 500 | 서버 내부 오류 | **Unexpected** | 일반 에러 + "다시 시도" + "문의" |
| - | 네트워크 끊김 | **Expected-Block (Soft)** | "네트워크 오류" + "다시 시도" |
| - | 응답 파싱 실패 | **Unexpected** | 일반 에러 + "문의" |

### 2.3 핵심 인사이트

> **같은 status code라도 API 맥락에 따라 분류가 달라진다.**
>
> - scan POST 409 → Expected-Flow (정상 흐름으로 전환)
> - 일반 POST 409 → Expected-Block (충돌 에러)
>
> 따라서 status code만으로 UI 동작을 결정할 수 없다.
> `code` (KnownErrorCode)가 있어야 맥락 구분이 가능하다.

---

## 3. 2-Layer 설계: 정규화 vs 동작 결정

### 핵심 원칙

```
fetchJson (Layer 1)          →     호출하는 쪽 (Layer 2)
"에러를 구조화한다"                "에러를 어떻게 처리할지 결정한다"
(기계적, 맥락 모름)               (비즈니스 맥락 알고 있음)
```

### Layer 1: fetchJson — 정규화 (Normalization)

역할: HTTP 응답을 **구조화된 AppError**로 변환. 이 레이어는 "409가 뭘 의미하는지" 모른다.

```typescript
// 의사 코드
async function fetchJson<T>(url, options): Promise<T> {
  try {
    const res = await fetch(url, options);

    if (res.ok) return await res.json();

    // 비정상 응답 → AppError로 정규화
    const body = await res.json().catch(() => null);
    throw new AppError({
      status: res.status,
      code: body?.code ?? 'UNKNOWN',        // ProblemDetails의 code
      message: body?.detail ?? body?.title ?? 'Unknown error',
      retriable: body?.retriable ?? false,
      retryAfterMs: body?.retryAfterMs,
      requestId: body?.requestId,
    });
  } catch (err) {
    if (err instanceof AppError) throw err;  // 이미 정규화됨

    // 네트워크/타임아웃 등
    if (err instanceof TypeError) {
      throw new AppError({ status: 0, code: 'NETWORK', message: '네트워크 오류', retriable: true });
    }
    throw new AppError({ status: 0, code: 'UNKNOWN', message: String(err), retriable: false });
  }
}
```

**Q: BFF API가 이 매핑을 인지해야 하는가?**
- **A: 아니다.** fetchJson은 BFF 응답을 있는 그대로 구조화할 뿐이다.
- BFF가 ProblemDetails를 보내면 그걸 파싱하고, 안 보내면 status code + 기본값으로 채운다.
- BFF 쪽은 기존 V1 `withV1()` 래퍼가 이미 ProblemDetails를 보내고 있으므로 추가 작업 불필요.

### Layer 2: 호출하는 쪽 — 동작 결정 (Interpretation)

역할: AppError의 `code`/`status`를 보고 **맥락에 맞는 동작**을 결정.

```typescript
// 예: ScanPanel에서 스캔 시작
const startScan = async () => {
  try {
    await postScan(targetSourceId);
    startPolling();
  } catch (err) {
    if (err instanceof AppError) {
      switch (err.code) {
        case 'CONFLICT_IN_PROGRESS':          // 409 → 정상 흐름
          startPolling();                      // 폴링 시작 (에러 UI 안 보여줌)
          return;
        case 'TARGET_SOURCE_NOT_FOUND':        // 404 → Hard Block
          setError({ type: 'hard', message: '스캔 대상을 찾을 수 없습니다.' });
          return;
        default:                               // 나머지 → 기본 처리
          setError({ type: err.retriable ? 'soft' : 'hard', message: err.message });
          return;
      }
    }
    // AppError가 아닌 에러 (이론적으로 발생하면 안 됨)
    setError({ type: 'soft', message: '알 수 없는 오류가 발생했습니다.' });
  }
};
```

### 왜 2-Layer인가?

**단일 레이어(status → UI 동작 자동 매핑)의 문제점:**
- 409를 항상 "충돌 에러"로 보여주면, scan의 "이미 진행 중" 케이스를 처리할 수 없음
- 404를 항상 "페이지 없음"으로 보여주면, "스캔 대상 없음"이라는 구체적 메시지를 줄 수 없음
- 결국 예외 케이스가 늘어나면서 매핑 테이블이 복잡해지고, 유지보수가 어려워짐

**2-Layer의 장점:**
- Layer 1은 단순하고 변하지 않음 (HTTP → 구조화 객체)
- Layer 2에서 각 화면이 자기 맥락에 맞게 해석
- 새 API가 추가되어도 Layer 1은 수정 불필요

---

## 4. 미결 사항 (Open Questions)

### Q1: ErrorView 컴포넌트 구조
- 옵션 A: 단일 `<ErrorView variant="inline|section|page" error={appError} />`
- 옵션 B: 별도 `<InlineError>`, `<SectionError>`, `<PageError>`
- → 논의 필요

### Q2: 기본 CTA 매핑 테이블 (ErrorCatalog)
- Layer 2에서 매번 switch/case를 쓰면 반복 코드가 많아짐
- 기본 매핑 테이블을 제공하되, 오버라이드 가능하게?
- → 논의 필요

### Q3: React Error Boundary 도입 여부
- API 에러: try/catch로 처리 (Error Boundary 대상 아님)
- 렌더링 에러: Error Boundary가 잡아야 함
- → v1 or v2?

### Q4: 기존 47개 API 함수 마이그레이션 전략
- 한 번에? 점진적으로?
- → 논의 필요

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-15 | 초안 작성. 에러 분류 체계 + 2-Layer 설계 제안 |
