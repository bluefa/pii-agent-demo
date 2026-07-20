# Admin Task Queue — 페이지별 디자인 명세 (HTML 계층 전수 추출)

> Phase 2 산출물. 원본 = `design/pipeline/admin-taskqueue.html` (같은 폴더, 픽셀 SSOT).
> 구현은 **raw 색상 금지** — `--pl-*` 토큰(`lib/theme.ts` pipelineStyles)과
> `app/admin/pipelines/_components/*` 재사용. 이 문서는 HTML의 모든 시각 계층을
> 컴포넌트 어휘로 번역한 것이다. 값이 프로토타입과 다르면 프로토타입이 이긴다.

## 0. 공통 섀시

| 계층 | 프로토타입 | 구현 매핑 |
|---|---|---|
| 섹션 셸 | 다크 216px 사이드바 + 라이트 캔버스 | 기존 `app/admin/pipelines/layout.tsx` 확장 |
| 사이드바 그룹 | `파이프라인 오케스트레이션`(기존 2항목) 위 + **`TASK QUEUE` 그룹 신설**(운영 대시보드·연동 요청·연결 테스트) | `layout.sidebarTitle` 2개 + 항목 배열 분리. 그룹 간 mt-16 (`.sb-group+.sb-title`) |
| 콘텐츠 폭 | `max-width:1440px; padding:24px 32px 48px` | `layout.content` 그대로 |
| 페이지 제목 | 24/700/1.2/-.02em, 아래 24 | `pipelineText.pageTitle` + `mb-6` |
| 섹션 제목 | 20/600, 위 64 아래 12 | `SectionHeader` |
| 섹션 설명 | 12/400 weak, 제목과 16 | `pipelineText.sectionDesc` |
| 카드 | white·border·r10·shadow-xs·p 20/24/24 | `Card` (`card.base`) |
| breadcrumb | 12 weak · sep `/` · cur 600 medium | `PlBreadcrumb` |
| 토스트 | 하단 중앙 gray-900 | `PlToast` |

## 1. P1 운영 대시보드 `#/queue`

계층 트리 (위→아래):
```
h1 "운영 대시보드"
섹션 "현황"                       ← SectionHeader(20/600)
  stat-row: grid 4열 minmax(0,260px), gap 12
    stat 타일 ×4 = 회색 타일(--pl-gray-100, border, r10, p 20/24/24, 가운데 정렬)
      .lbl 14/600 medium   ← 라벨이 위
      .val 32/600 tabular, 위 12    ← 숫자가 아래
      숫자 톤: 연동 요청 대기=warn-text · 반려>0=err-text · 완료=strong · 테스트 반려>0=err-text
섹션 "Process Status 모니터" + desc "Target Source별 현재 단계와 지연… · 30초마다 자동 갱신돼요"
  Card
    filterbar (gap 8, mb 16)
      Step 셀렉트: h46 r10 14/600 — "프로세스 상태 전체" + "Step n · 라벨" 옵션 7
      지연 seg (seg.lg: 컨테이너 p3 r10 gray-100 / 버튼 h40 pad 0 20 r8 14/600)
        [지연 전체 N] [●1시간↑ N] [●1일↑ N] [●7일↑ N]  ← tdot 8px: 노랑#EAB308/주황#F97316/빨강#EF4444
    tbl (th34 12/600 weak / td44 14 medium, 마지막행 border 없음)
      컬럼: 서비스 이름(600 strong)·서비스 코드(mono12)·Target Source(#id mono)·Cloud(ProvTag)
            ·프로세스 상태(stx 스택)·지연(delay)·상태 변경(meta12)
      stx 스택 = 2줄 세로: "Step n"(mono 12/600 weak) ↑ / tag.gray(12/600, r6, gray-100 bg) 라벨 ↓, gap 3
      delay = 텍스트 색 4단: <1h weak/500 · ≥1h #A16207/600 · ≥1d #C2410C/600 · ≥7d #DC2626/700
    empty-state (조건 무매칭 시): 아이콘 원(44 gray-100, inbox 16 faint) + 16/600 제목 + 14 weak 캡션, py 56/60
    PlPagination (rows 있을 때만): "표시 [10▾] 건씩 · 1–20 / 전체 N건 · ‹ 1 2 ›" 문법
```

## 2. P2 연동 요청 `#/requests`

```
h1 "연동 요청" / section-desc "서비스가 보낸 연동 승인 요청을 검토하고 처리해요"
Card
  seg.lg 탭 (id req-seg): [승인 대기 N] [반려 N] [전체 N]  ← 카운트 .cnt 400 faint(on일 때 weak)
  tbl — 컬럼 탭별:
    공통 4: 서비스 이름 · 서비스 코드 · Target Source · Cloud   ← 상태 컬럼 없음(탭이 상태)
    반려 탭 +2: 반려 사유(rr hover 툴팁: 260px 말줄임 + gray-900 320px 툴팁) · 반려 일자(meta)
    승인 대기 탭 +1: 우측 정렬 detail-link = "상세보기" 14/600 primary + ↗ 아이콘 14 (gap 4)
  행 클릭: 승인 대기 탭만 row 전체 클릭 → 상세 (hover bg gray-50)
  empty-state 탭별 문구:
    PENDING: 승인을 기다리는 요청이 없어요 / 새 연동 요청이 들어오면 여기에 표시돼요
    REJECTED: 반려된 요청이 없어요 / 반려 처리한 요청이 여기에 모여요
    ALL: 연동 요청이 없어요 / 서비스가 연동을 요청하면 여기에 표시돼요
  PlPagination (비었으면 숨김)
```

## 3. P3 연동 요청 상세 `#/requests/{id}`

```
breadcrumb: Task Queue / 연동 요청 / {서비스이름} #{id}
page-head: h1 "{서비스이름} #{id}"  + head-sub(gap 8): ProvTag · mono 서비스코드 · StatusPill(요청 상태)
  actions 우측: [연동 요청 반려](btn danger: white bg + err-text/err-border) [연동 요청 승인](btn primary)
섹션 "요청 정보" → Card 안 kv2 그리드(130px 1fr 130px 1fr, gap 10/16)
  k=12/600 weak, v=14/500 strong: 요청자 · 요청 일시 · 요청 상태(StatusPill) · 선택 리소스(n/전체 m)
섹션 "연동 대상 리소스" (+desc 리소스 수 표기)
  Card 안 res-wrap(border r10 상단만, overflow hidden) + res-tbl  ← 앱 db-list-table 문법
    thead: bg gray-50, th 12/600 weak pad 12/16
    td: pad 13/16, border-top gray-100, hover bg-inner
    row-excluded: bg gray-100 텍스트 weak, hover gray-200, tag.blue→gray 강등
    IDC 컬럼: 구분(tag: IP|Host) · Database Type(tag.blue) · 연동 대상(mono ip들 ' · ' join 또는 host)
              · Port(tabular) · Oracle SID(mono|—) · Source IP(mono) · NLB Index(select.sel.sm h28)
              · 배정 NLB 상태(occbar 96×6 + n/50 + ftag) · 저장(btn sm)
    비-IDC(AWS 등) 컬럼: Resource ID(res-id-cell: mono 300px 말줄임 + copy 22px 버튼) · Database Type ·
              Region · 연동 대상 여부(target-yes ok-text 600 / target-no weak "연동 대상 제외") · 제외 사유(meta)
    NLB select 상태: dirty → border primary + ring / 저장 버튼 primary 활성화
    occbar 톤: <30 gray-400 / ≥30 warn / ≥50 err · ftag: 여유(na)/주의(warn)/Hard Limit(err)
    Hard Limit(≥50) NLB는 select option disabled
섹션 "NLB 리스너 현황" — 헤더 우측 secondary 버튼 [NLB 리스너 현황] → 모달(아래 §6)
```

## 4. P4 연결 테스트 `#/tc`

P2와 동일 문법. seg.lg: [완료 N] [재실행 요청 N].
- 완료 탭: 공통4 + 완료 일자(meta) + detail-link (행 전체 클릭)
- 재실행 요청 탭: 공통4 + 반려 사유(rr hover) + 반려 일자 + detail-link
- empty: 완료된 연결 테스트가 없어요… / 재실행을 요청한 건이 없어요…

## 5. P5 연결 테스트 상세 `#/tc/{id}`

```
breadcrumb: Task Queue / 연결 테스트 / {서비스이름} #{id}
page-head: h1 + head-sub(ProvTag·mono 코드·상태 pill: 연결 테스트 완료=t-ok / 재실행 요청=t-err)
  actions (완료 상태만): [연결 테스트 재실행 요청](danger) [연동 승인](primary)
재실행 요청 상태면: reject-box(err-bg/err-border r8, 아이콘+rb-title 14/600 err-text
  + rb-body 14 medium + rb-meta 12 weak) — 반려 사유 상시 노출
섹션 "연결 테스트 결과" + desc "완료 일자 … · 연동 대상 논리 DB n개 · 제외 논리 DB m개"
  Card > res-wrap + res-tbl:
    컬럼: Database Type(tag.blue) · Resource ID(res-id-cell 말줄임+copy) · 연동 대상(mono)
          · 연동 대상 논리 DB(ldb-link: primary 600, 클릭→모달 '연동 대상' 탭) 
          · 연동 제외 논리 DB(ldb-link → '연동 제외' 탭) · Connection Status(tag green|red)
    실패 행: 논리 DB 셀 "—" (링크 없음)
  PlPagination
  section-desc(mb 0) "논리 DB 개수를 누르면 연동 대상·제외 목록을 바로 볼 수 있어요"
```

## 6. 모달 5종 — 앱 모달 문법 (`.modal.app`)

공통 해부(위→아래) — ModalShell 위에 신규 `TqModal` 계층:
```
모달: w720(논리DB·NLB=840) r20 p0, 내부 스크롤 max-h 88vh
am-header (p 36/40/4)
  am-eyebrow: ●6px primary dot + ctx(weak) · sep(faint) · #id(primary 700) — mono 12/600 uppercase ls.09
  am-title: 24/700/-.02em, 아래 8
  [am-meta]  (논리 DB 모달만): tag.blue DB타입 + mono 리소스 식별자, 아래 8
  am-sub: 16/400 weak lh1.5 — 목적 문장. API path·UI 동작 설명 금지, 선언형 "—" 금지
am-body (p 24/40/0)
  [내용별 블록]
am-footer (p 16/40/20, border-top, 우측 정렬 gap 8, 위 24)
```

| 모달 | 본문 블록 | CTA |
|---|---|---|
| 연동 요청 승인 | (NLB 미저장 변경 있으면 am-note warn 박스) + am-label "관리자 메시지 · 선택" + textarea(min-h 120) + am-count "n/1,024" | 취소 secondary / 승인 primary |
| 연동 요청 반려 | am-label "반려 사유 · 필수" + textarea + count 1,024 | 취소 / 반려 dangersolid(사유 없으면 disabled: gray-100 bg faint) |
| 연결 테스트 재실행 요청 | am-label "요청 사유 · 필수" + textarea + count **512** | 취소 / 재실행 요청 dangersolid |
| 연동 승인 (tc) | am-stats: 3열 grid gap12 — 타일(bg-inner border r8 p16/12 중앙): lb 12/600 weak ↑ v 24/700 tabular+단위 small 14/600 ↓ = [리소스 n건][연동 대상 논리 DB n개][연동 제외 n개] | 취소 / 승인 primary |
| NLB 리스너 현황 | res-tbl: NLB Index(mono #n) · IP(mono ' · ' join) · 점유(occ-num n/50 + occbar) · 상태(ftag) | 닫기 secondary |
| 논리 DB 확인 (w840) | seg 탭 [연동 대상 N][연동 제외 N] (기본 seg, mb16) + res-tbl(구분 tag.gray DATABASE|SCHEMA · Database mono · Schema mono|— · 제외 탭+제외 사유) + **PlPagination**(탭 전환 시 1페이지 리셋) | 닫기 |

## 7. 신규로 만들어야 하는 조각 (기존 컴포넌트에 없음)

1. **seg.lg** — SegControl 확장 variant (h40 버튼/p3 컨테이너/r10·8) + tdot 색점 옵션
2. **sel.lg** — PlSelect h46 variant (같은 행의 seg.lg 컨테이너 높이 46과 정렬)
3. **delay 4단 텍스트 톤** — d1 `#A16207`/d2 `#C2410C`/d3 `#DC2626` → `--pl-*` 신규 토큰으로 등록 후 사용 (raw 금지 규칙)
4. **stx 스텝 스택** — mono Step 캡션 + tag.gray 2줄 컴포넌트
5. **res-tbl(앱 테이블)** — PlTable은 admin tbl(th34/td44) 문법. 앱 문법(thead gray-50·td 13/16·row-excluded)은 신규 `AppResourceTable` 스타일 그룹
6. **detail-link** — 텍스트+↗ 링크 (재사용 3곳)
7. **empty-state 대형** — PlEmptyState와 다른 값(원44/16·14 계층)이면 variant 추가
8. **TqModal(앱 모달 계층)** — ModalShell 골격 재사용 + am-* 헤더/바디/푸터
9. **occbar** — 96×6 점유 막대 + ftag
10. **rr hover 툴팁** — 말줄임 + gray-900 툴팁

## 8. 금지 목록 (프로토타입 진화 중 확정된 규칙)

- 보조 텍스트에 API path·선언형 "—" 절·UI 동작 서술 금지. 목적 문장만.
- 모니터 프로세스 상태에 상태별 색상 금지 — 단일 회색 badge + Step 접두.
- resourceId는 P3 IDC 표에 비노출 (내부 보존만).
- 같은 행 컨트롤 높이 혼용 금지 (seg.lg 46 컨테이너 ↔ sel.lg 46).
- 스케일 밖 폰트 크기 금지 {12,14,16,20,24,32}.
