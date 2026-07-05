# Admin Pipeline — 타이포그래피 스펙 (LIN-20 Round 5)

> **⚠️ 크기·행간은 대체됨 (2026-07-04)**: 텍스트 크기(9롤 스케일)와 행간 값은
> [admin-pipeline-style-guide.md](admin-pipeline-style-guide.md) §1의 5단 스케일(12/14/16/20/32,
> 행간 120/140 2단)이 권위다. 이 문서는 폰트 스택·자간·tabular-nums 근거 자료로 유지.
>
> 폰트·정보 층위별 텍스트 크기·층위 간 거리·자간의 단일 기준.
> `admin-pipeline.html`의 CSS 선언은 이 문서를 따른다.
> 근거: App 실측(`app/globals.css`, `app/layout.tsx`, `design/v15-extract/00-tokens.md`) + 한글 UI 관행.

## 0. 결론 (선언 요약)

```css
:root{
  --font-sans:'Geist',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Malgun Gothic',system-ui,sans-serif;
  --font-mono:'Geist Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;
}
html,body{font-size:13px;letter-spacing:-0.014em;line-height:1.55}
```

| 롤 | px | weight | line-height | letter-spacing | 색 | 용도 (IA 층위 매핑) |
|---|---|---|---|---|---|---|
| `t-display` | 26 | 600 | 1.15 | -0.02em | strong | **L1** — hero 진행 N/M·stat 값 (tabular) |
| `t-title` | 18 | 700 | 1.3 | -0.02em | strong | 페이지 제목 (대시보드·검색 등 hero 없는 페이지) |
| `t-section` | 14 | 600 | 1.4 | -0.014em(상속) | strong | 섹션 제목 (Task 흐름, 파이프라인 목록…) |
| `t-body` | 13 | 400 | 1.55 | 상속 | medium | 본문·설명문·kv 값(=body+500) |
| `t-caption` | 12 | 400 | 1.4 | 상속 | weak | **L4** — 시각·meta·breadcrumb·pager |
| `t-label` | 11 | 600 | 1.3 | +0.03em | weak | 테이블 th **전용** (자간 풀림 = 열 캡션 신호) |
| `t-key` | 12 | 600 | 1.4 | 상속 | weak | kv key·구획 레이블 (한글 11px는 공격적 — th와 분리) |
| `t-micro` | 10.5 | 600 | 1 | +0.02em | (칩 색) | pill·kindchip·ftag 등 배지류 |
| `t-mono` | 12.5 | 400 | (문맥) | 0 | strong | id·계정·error_code·raw response |

숫자를 표시하는 모든 곳(`t-display`, 테이블 셀, N/M, 시각): `font-variant-numeric: tabular-nums`.

## 1. 조사 근거

### 1-1. App(프로덕션)의 현실 — 프로토타입이 따라야 할 기준

- **폰트**: `app/layout.tsx`가 `next/font/google`로 **Geist / Geist Mono** 로드.
  `app/globals.css:98` 폴백 체인: `-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', sans-serif`.
- **Geist는 라틴 전용**(한글 글리프 없음) → App에서도 **한글은 Apple SD Gothic Neo(맥)
  / Pretendard(설치 시) / Malgun Gothic(윈도)으로 렌더**된다. 즉 "숫자·라틴 = Geist,
  한글 = 시스템 고딕"의 혼합 조판이 프로덕션의 실제 모습.
- **자간**: `app/globals.css:99` 전역 `-0.018em`. `00-tokens.md:137`은 이것이 "모든 텍스트
  노드가 상속하는 GLOBAL"임을 명시 (DESIGN.md의 반대 서술은 확인된 divergence).
- **스케일**(`00-tokens.md` `.ds-*`): 28/22/18/15/14/13/12/11px,
  line-height 1.15(display)→1.55(body)→1.3(label), micro만 양수 자간(+0.01em).

### 1-2. 한글 UI 자간 관행

- 한글 글리프는 정사각형을 꽉 채우는 구조라 **큰 사이즈일수록 음수 자간이 밀도와 가독을
  개선**한다 (Toss·카카오·당근 모두 -1%~-2.5% 범위 사용, Pretendard 공식 권장도 유사).
- 반대로 **11px 이하에서 음수 자간은 획이 뭉개진다** → micro/label 층은 0 또는 양수(+2~3%)로
  풀어주고, 이 "자간 풀림"이 그 자체로 캡션임을 알리는 신호가 된다
  (라틴의 uppercase-tracking 관행의 한글 대응 — 한글엔 대문자가 없으므로 자간이 그 역할).
- 사이즈별 자간 tier: display -0.02em / 본문대 -0.014em / label +0.03em.
  전역 -0.018em(App) 대비 본문을 -0.014em으로 살짝 완화한 이유: App 본문은 15px,
  프로토타입 본문은 13px — **같은 자간도 작은 사이즈에서 더 빽빽하게 느껴지므로** 1단계 완화.

### 1-3. 어드민 밀도 관행 (모던 어드민 방향과의 정합)

- Linear·Vercel·Grafana류 콘솔은 **본문 13px**을 기준으로 12(캡션)/11(레이블)을 내리고,
  강조는 크기보다 **weight(400→600)와 색(3단 gray)**으로 먼저 표현한다.
- 숫자 열은 `tabular-nums`가 표준 — 열 정렬 유지 + 폴링 갱신 시 너비 흔들림 방지.

### 1-4. 층위 표현의 우선순위 규칙

같은 정보 블록 안에서 층위를 낮출 때는 **① weight → ② 색 → ③ 크기** 순서로 조정한다.

- 크기 변화는 IA 층위가 **2단계 이상** 차이날 때만 사용 (L1 hero 26px vs L4 meta 12px).
- 인접 층위(kv key vs value)는 크기 대신 weight+색으로: key 12/600/weak ↔ value 13/500/strong
  (크기 차 1px + weight·색 — 크기만으로 층위를 만들지 않는다).
- 크기 단계는 위 9롤로 **고정** — 새 크기가 필요해 보이면 롤 선택이 잘못된 것.

## 2. 층위 간 거리 (proximity — 4px 그리드)

> 원칙: **같은 것은 붙이고, 다른 것은 띄운다.** 거리 자체가 정보 구조다.
> 3단 거리 체계 = 4~6 / 8~12 / 24 (대략 1:2:4 비율).

| 거리 | 값 | 적용 |
|---|---|---|
| 요소 내부 (레이블↔값, 아이콘↔텍스트) | **4~6px** | stat 카드 lbl→val 6, pill 아이콘 gap 6 |
| 관련 블록 사이 (같은 섹션의 행·카드 내부 블록) | **8~12px** | kv row-gap 10, hero meta행→상태행 8, 카드 간 12 |
| 섹션 사이 | **24px** | 섹션 제목 `margin: 24px 0 10px` |
| 섹션 제목의 비대칭 | 위 24 / 아래 10 | 제목이 **아래 내용에 소속**됨을 거리로 표현 (위>아래 필수) |
| 카드 패딩 | 20px | 내부 블록 간 12~16 |

## 3. 선언 방식 — 하이브리드 (토큰 변수 + 롤 클래스)

- **`:root` 변수**: 폰트 스택 2종만 변수화. 크기·자간을 개별 변수로 쪼개지 않는다
  (조합 폭발 방지 — 롤이 곧 조합).
- **롤 클래스**: §0 표의 9롤을 CSS 클래스로 선언하고, 컴포넌트 규칙(`.tbl th`, `.kv .k`,
  `.pill`…)은 **롤의 값을 그대로 복제**해 쓴다(HTML 클래스 나열 대신 CSS에서 상속).
  주석으로 롤 이름을 표기: `/* role: t-label */`.
- 기존 클래스명(`meta`/`note`/`formula`/`mono`)은 유지하되 정의를 롤에 정렬:
  `meta`=t-caption, `note`=t-body, `formula`·`mono`=t-mono, 테이블 th=t-label, kv k=t-key.

### D1 이식 경로 — ⚠️ 이 스케일은 프로토타입 전용 컴팩트 스케일

이 문서의 스케일(26/18/…/10.5)은 **canonical `.ds-*` 스케일(28/22/18/15/14/13/12/11,
`00-tokens.md`)과 다르다** — 어드민 밀도를 위해 의도적으로 한 단계씩 압축한 것이며 1:1이 아니다.
D1에서 App으로 옮길 때는 아래 매핑으로 **App 쪽 canonical 값을 채택**하는 것이 기본
(프로토타입 값을 App에 이식하지 않는다; 밀도 요구가 확정되면 그때 `.ds-*`에 compact tier를 추가):

| 프로토타입 롤 | px | → D1 canonical | px |
|---|---|---|---|
| t-display | 26 | `.ds-h1` (`--type-display`) | 28 |
| t-title | 18 | `.ds-h3` (`--type-h3`) | 18 |
| t-section | 14 | `.ds-card-title`(uppercase 제외) / `--type-body-sm`+600 | 14 |
| t-body | 13 | `--type-caption`(13) 또는 `--type-body-sm`(14) — 밀도 결정 필요 | 13~14 |
| t-caption | 12 | `.ds-label` (`--type-label`) | 12 |
| t-key | 12 | `.ds-label`+600 | 12 |
| t-label | 11 | `.ds-micro`+600 | 11 |
| t-micro | 10.5 | `.ds-micro` | 11 |
| t-mono | 12.5 | `.ds-mono` + `--type-caption` | 13 |

폰트는 next/font의 Geist가 이미 있으므로 D1에서 스택 선언 불필요. 전역 자간은 App이 이미
-0.018em — 프로토타입의 -0.014em은 13px 본문 보정이므로 App 15px 본문에는 적용하지 않는다.

## 4. 검증 체크리스트

- [ ] 한글·숫자 혼합 행(예: `생성 2026-06-30 14:02`)에서 숫자만 Geist로 렌더돼도 어색하지 않은가
      (Geist 미설치 환경 = 전부 시스템 고딕 — 두 경우 모두 확인)
- [ ] 11px 이하 텍스트에 음수 자간이 남아있지 않은가
- [ ] 테이블 숫자 열이 tabular-nums로 정렬되는가
- [ ] 크기 단계가 9롤 밖의 값을 쓰는 곳이 없는가
- [ ] 섹션 제목의 위/아래 거리 비대칭(24/10)이 전 페이지에서 일관적인가
