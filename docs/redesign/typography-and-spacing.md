# 텍스트 계층 · 간격 기준

> 작성 2026-07-31 · 근거 화면 `/pass/target-sources/1008` (Step 4 Agent 설치)
> 상위 권위: `.claude/skills/design-guide/SKILL.md` (오너 제공 가이드 3종의 요약)

## 0. 왜 필요한가

Step 4 화면 한 장을 실측한 결과:

| 항목 | 현재 | 업계 상한 |
|---|---|---|
| 고유 폰트 크기 | **14** | 6~7 |
| size × weight 조합 | **24** | — |
| 인접 계층 간 고유 간격값 | **14** (24쌍 중) | 4~5 |

이건 "시스템에 정의된 스타일 수"가 아니라 **한 화면에 동시에 떠 있는 수**다.
계층이 이만큼 많으면 사용자는 각 크기가 무엇을 뜻하는지 학습할 수 없고,
크기 차이는 정보가 아니라 노이즈로 읽힌다. 13px과 13.5px, 3px과 4px 간격은
나란히 놓아도 사람이 구분하지 못한다 — 가이드 §3의 *"1px 차이는 계층이 아니라
오차"* 가 그대로 나타난 상태다.

### 벤치마크

| 시스템 | 정의된 텍스트 스타일 | 고유 px 크기 |
|---|---|---|
| GitHub Primer | 11 semantic styles | **6** (12/14/16/20/32/40) |
| Shopify Polaris | ~10 variants | **6** (12/14/16/20/24/32), 비율 1.2 + 4px 반올림 |
| Atlassian | 14 (heading 7 + body 3 + metric 3 + code 1) | 7 |
| Material 3 | 15 (5 역할 × 3 크기) | 12+ |

Material 3 문서는 스스로 *"your product will likely not need all 15 default
styles"* 라고 쓴다. 15개는 모바일·데스크톱·워치를 모두 커버하는 뷔페지 한
화면의 메뉴가 아니다. Primer와 Polaris는 스타일 이름이 10개를 넘어도 실제 px는
6개다 — 계층을 **크기가 아니라 weight와 색으로** 갈랐다.

참고: [Material 3 type scale](https://m3.material.io/styles/typography/type-scale-tokens) ·
[Primer typography](https://primer.style/foundations/primitives/typography) ·
[Atlassian typography](https://atlassian.design/foundations/typography) ·
[Polaris font and typescale](https://polaris-react.shopify.com/design/typography/font-and-typescale) ·
[Nathan Curtis, Typography in Design Systems](https://medium.com/eightshapes-llc/typography-in-design-systems-6ed771432f1e)

---

## 1. 타입 램프 — 5 크기 × 3 weight = 7 역할

Polaris/Atlassian/Primer가 수렴한 4px 그리드 램프. 오너 가이드 §1의 짝수
세트(12/14/16/20/24)와 정확히 일치한다.

| 역할 | px / weight | line-height | 용도 |
|---|---|---|---|
| **pageTitle** | 24 / 700 | 32 | 페이지 H1 |
| **sectionTitle** | 20 / 700 | 28 | 카드 헤더, 섹션 제목 |
| **cardTitle** | 16 / 700 | 24 | 카드 내 블록 제목, 패널 제목 |
| **body** | 14 / 400 | 20 | 본문, 설명문 |
| **bodyStrong** | 14 / 600 | 20 | 강조 본문, 항목 제목, 조치 문구 |
| **caption** | 12 / 400 | 16 | 메타, 타임스탬프, 보조 설명 |
| **captionStrong** | 12 / 600 | 16 | 태그, 라벨, 카운트, 작은 버튼 |

**14 크기 / 24 조합 → 5 크기 / 7 역할.**

### 규칙

- **line-height는 배수(%)가 아니라 px로 고정한다.** 이게 §2 간격 기준의 선행
  조건이다 (아래 참조).
- letter-spacing은 크기에 묶는다: **≥20px은 `-0.02em`, 미만은 `-0.01em`**.
  현재 −0.13 / −0.288 / normal이 섞여 있다.
- **최소 크기는 12px.** 현재 11 / 11.5 / 10px은 가이드 하한 아래다.
- 새 크기가 필요해 보이면 램프에 값을 추가하지 말고 **역할 배정을 재검토**한다
  (가이드 §1).

### ⚠️ 적용 범위에서 제외

**admin 파이프라인 화면(Figma R24)에는 적용하지 않는다.** R24
(`SzifNRYweRXhiIDI0uyK3R` node 9-2)의 디자이너 램프가 section 15 / primary-link
13 / caption 12.5 / th 11 / mini 10.5를 **직접 선언**하고 있어, 그쪽 홀수·소수는
드리프트가 아니라 Figma 충실 반영이다. 그 화면까지 바꾸려면 Figma 파일을 먼저
개정해야 한다 (오너 선행 결정 사항).

이 문서의 램프는 **사용자향 타겟소스 상세·스텝 화면**을 대상으로 한다.

---

## 2. 간격 — 요소가 아니라 "관계"에 붙인다

`제목은 mt-4` 처럼 요소에 값을 매기면 매번 재결정이 필요하다. **두 계층 사이의
관계 4종**만 정의하면 값은 자동으로 결정된다.

| 관계 | 언제 | 값 |
|---|---|---|
| **tight** | 한 덩어리로 읽혀야 하는 쌍 — 라벨↔값, 제목↔부제 | **4px** |
| **related** | 같은 그룹의 형제 항목, 카드 내 문단 사이 | **8px** |
| **group** | 그룹 제목 ↔ 그룹 본문, 카드 내 블록 경계 | **16px** |
| **section** | 섹션 ↔ 섹션, 카드 ↔ 카드 | **32px** |

각 단계가 **정확히 2배**다. 가이드 §3의 *"섹션 간 여백은 섹션 내부 여백의 2배
이상"* 을 규칙이 아니라 **구조로** 보장한다 — 지킬지 판단할 일이 없어진다.

### 비대칭 규칙 (여백 7원칙 §2)

> **제목 아래** = 그 제목이 여는 단위의 **내부** 값
> **제목 위** = 그 제목이 여는 단위의 **경계** 값

| 제목 종류 | 위 | 아래 |
|---|---|---|
| 섹션 제목 | 32 | 16 |
| 그룹 제목 | 16 | 8 |
| 라벨 | 8 | 4 |

값을 따로 외울 필요 없이 한 칸씩 밀면 된다.

### 선행 조건 — line-height부터 정수로

측정되는 "간격"은 선언한 margin이 아니다. line-height가 19.5 / 18.75 / 16.9px
처럼 소수라 텍스트 박스 위아래에 소수점 half-leading이 붙고 그것이 margin에
더해진다. 그래서 `mt-2.5`(10px)를 선언해도 눈에 보이는 거리는 계층 조합마다
달라진다.

**line-height를 §1 램프의 px 값으로 고정하지 않으면 이 간격 기준은 지켜지지
않는다.** 순서는 타이포 → 간격이다.

### margin이 아니라 gap

컨테이너의 `gap`으로 적용한다. margin은 상쇄(collapse)와 "누가 여백을
소유하는가" 문제를 만들고, 현재 코드가 정확히 그 상태다.

---

## 3. 토큰

`lib/theme.ts`에 선언한다.

```ts
export const textStyles = {
  pageTitle:     'text-[24px] font-bold leading-[32px] tracking-[-0.02em]',
  sectionTitle:  'text-[20px] font-bold leading-[28px] tracking-[-0.02em]',
  cardTitle:     'text-[16px] font-bold leading-[24px] tracking-[-0.01em]',
  body:          'text-[14px] font-normal leading-[20px] tracking-[-0.01em]',
  bodyStrong:    'text-[14px] font-semibold leading-[20px] tracking-[-0.01em]',
  caption:       'text-[12px] font-normal leading-[16px] tracking-[-0.01em]',
  captionStrong: 'text-[12px] font-semibold leading-[16px] tracking-[-0.01em]',
} as const;

/** 텍스트 계층 간 수직 거리 — 요소가 아니라 두 계층의 '관계'에 붙는다. */
export const stackGap = {
  tight:   'gap-1',  // 4px
  related: 'gap-2',  // 8px
  group:   'gap-4',  // 16px
  section: 'gap-8',  // 32px
} as const;
```

---

## 4. 이 기준 밖의 것

혼동을 막기 위해 명시한다.

1. **컨테이너 패딩은 별도다.** `cardStyles.header`(28/28/12),
   `body`(16/28/28)의 28px은 4px 그리드에는 맞지만 8의 배수가 아니다. v15 카드
   기하로 굳어진 값이라 건드리지 않는다. 이 문서의 간격 스케일은 **텍스트 계층
   사이**에만 적용한다.
2. **가로 간격은 다른 시스템이다.** 태그 사이 `gap-1.5`(6px) 같은 인라인 간격은
   별도 스케일로 둔다. 여기서 정의하는 건 수직 리듬뿐이다.
3. **`tagStyles` 등 컴포넌트 토큰의 색상은 대상이 아니다.** 크기·weight만
   램프에 맞춘다.

---

## 5. 적용 순서

| 단계 | 내용 | 위험 |
|---|---|---|
| ① | `textStyles` / `stackGap` 토큰 추가 | 없음 (추가만) |
| ② | **Step 4 (Agent 설치) 적용** ← 현재 여기 | 화면 변경 |
| ③ | 나머지 스텝 화면 확대 | 화면 변경 |
| ④ | 공용 chrome(페이지 H1·IdentityBar·스테퍼) 정렬 | **전 스텝 동시 변경** |

②에서 공용 chrome을 건드리지 않는 이유: `ProjectPageMeta`(H1 24/800,
IdentityBar 17/700)와 `cardStyles.cardTitle`(22/800)은 **모든 스텝·모든
프로바이더가 공유**한다. Step 4만 검증하려면 Step 4가 소유한 컴포넌트에
한정해야 한다.

### ② 범위 (Step 4 소유 컴포넌트)

- `app/components/features/process-status/install-status-detail/InstallStatusDetail.tsx`
- `app/components/features/process-status/aws/AwsInstallStatusDetail.tsx`
- `app/components/features/process-status/aws/AwsInstallationInline.tsx` (카드 body)
- `app/components/features/process-status/shared/InstallationLoadingView.tsx`

**기계적 치환 금지.** 현재 13px 하나가 weight 700 / 600 / 400 세 역할로 갈려
있어 일괄 치환하면 계층이 무너진다. 역할을 먼저 배정하고 그 매핑으로 바꾼다.
