# Step 1 「연동 대상 DB 선택」 리소스 테이블 — 디자인 벤치마크 결정 기록

- **일자**: 2026-08-12
- **대상**: `/pass/target-sources/{id}` Step 1 — `CandidateResourceTable` · `CandidateResourceRow` · `ResourceGroupRow`
- **아티팩트**: https://claude.ai/code/artifact/c687904f-7410-4774-92e4-a3faa8c040c0 (시안 A~H · 레퍼런스 22종)
- **구현 PR**: (본 PR)

## 문제 요약 (근거 등급)

| # | 문제 | 등급 |
|---|---|---|
| P1 | 정체성 열은 `max-w-[200px]`에서 먼저 잘리는데, 판별 못 하는 Resource ID 열이 표의 20%를 쓴다 | UX 원칙 (여백 7원칙 ⑦) |
| P2 | RDS 인스턴스 행이 7열 중 3열을 비운 채 가장 높다(86px) — 부피는 크고 정보는 성기다 | UX 원칙 |
| P3 | RDS Cluster 1건 = 344px > 테이블에 남는 309px. 부모와 마지막 멤버를 동시에 볼 수 없다 | UX 원칙 (스캔 속도) |
| P4 | 첫 데이터 행까지 693px(뷰포트의 69%) | UX 원칙 |
| P5 | 스텝 카드 안내문이 우측 가이드 레일과 같은 내용을 반복 | UX 원칙 |
| P6 | 행 상하 패딩 `py-5`(20px)가 간격 세트(4/8/12/16/24/32/40) 밖 — **판례 유의**: 오너 요청으로 `py-4`에서 올린 값 | 수치 위반 |
| P7 | 값 없음 · 상속 · 미판정이 화면에서 전부 "빈 칸" 하나로 보인다 | UX 원칙 |
| P8 | 제외 사유 열이 14행 중 13행 비었는데 158px를 상시 점유 | 제안 |

이번 PR이 다루는 것은 **P2 · P3**이고, 오너 지시(아래)가 그 위에 얹혔다.

## 오너 지시 (2026-08-11)

1. "항상 펼쳐져 있으면, 가독성이 너무 떨어져. 이거는 명심해줘. **Athena도 마찬가지야.**"
2. "**Reader/Writer가 Instance와 최대한 가까웠으면** 하는데요. 정말 중요한 정보잖아요."
3. "**Database라는 정보가 노출이 되어야 해요.** 해당 정보를 숨기면 정말 아무도 못 알아먹어요."

2·3번이 1번의 해석을 정한다 — **접힘은 행 수를 줄이는 장치지 정보를 줄이는 장치가 아니다.**

## 실제 차용한 레퍼런스

| 레퍼런스 | URL | 차용 요소 |
|---|---|---|
| Cloudscape — Split view | https://cloudscape.design/patterns/resource-management/view/split-view/ | "기본 닫힘, 리소스를 선택하면 열린다" · 용도 = "표에 담을 수 없는 하위 리소스·추가 속성" · 표는 리소스 1건 = 1행 유지 |
| Cloudscape — Secondary panels | https://cloudscape.design/patterns/general/secondary-panels/ | 패널은 본문을 **밀지 않고 덮는다**(P1을 악화시키지 않음) · help panel(우측 가이드 레일)과 split panel은 역할이 달라 동시 개방 가능 |
| Azure Portal | https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview | "접힘이 기본" + **사용자의 펼침 선택을 기억한다** |
| Cloudscape — Table with expandable rows | https://cloudscape.design/patterns/resource-management/view/table-with-expandable-rows/ | 접힌 부모 행은 집계를 들고 있어야 한다 |

전체 카탈로그(22종, 실측/문서 확인/기억 기반 배지 포함)는 아티팩트 §3.

## 채택안 — 시안 H (기본 접힘 + 스플릿 뷰)

비교표(아티팩트 §5) 기준. 시안 B(인스턴스 행을 모든 열로 정상화)와 **배타**이며, B는 오너 지시 1번과 정면으로 충돌한다 — 행을 더 잘 만드는 방향이라 행 수가 그대로다.

| 항목 | 구현 내용 |
|---|---|
| 기본 접힘 | Athena 그룹 · RDS Cluster 모두. `collapsedGroups`(닫힌 키) → `expandedGroups`(열린 키)로 뒤집어, 필터·재스캔으로 새로 생긴 그룹도 접힌 채 시작하고 사용자가 편 그룹은 세션 내내 열려 있다 |
| 인스턴스 = 패널 | 인스턴스 행 제거 → `RdsInstancePanel`(우측 400px, 표를 덮음). 카드 3줄 = `◉ 이름 [역할]` / `AZ · 엔진` / `host:port`. 엔드포인트·AZ는 표에 열이 없어 이번에 처음 보인다 |
| 역할 인접 | 역할 칩이 인스턴스 이름 **바로 옆**. 접힌 클러스터 행도 `↳ [Reader] demo-aurora-mysql-2` |
| 접힌 행이 정보를 들고 있음 | Athena 부모가 **하위 DB 이름을 나열**(3개 + `외 N개`). Database Type 열은 모든 행 유지 |
| 열림 상태 | 페이지 로드 시 패널 닫힘. 클러스터 행(포인터) 또는 `↳` 줄(키보드, `aria-expanded`)로 열고, ✕·Esc로 닫는다 |

**실측 결과** — 상위 리소스 2건(Athena 그룹 + 클러스터): 528px → **188px**. 목 데이터 기준 Athena 그룹 82px, 클러스터 107px.

### 판례 갱신

PR #630의 "부모 행 `· x 선택` 요약 제거 — 선택 표기는 자식 행 칩으로 단일화(재도입 금지)"는 **자식이 늘 보인다는 전제** 위의 결정이었다. 기본 접힘으로 그 전제가 사라져 접힌 부모가 선택 결과를 표시한다. 다만 되돌아온 것은 **선택 결과**(`↳ Reader demo-aurora-mysql-2`)이지, 기각된 **개수 요약**(`인스턴스 3 · 1 선택`)이 아니다 — 기각 사유였던 "같은 말을 두 군데서 한다"는 발생하지 않는다.

같은 PR의 "기본 펼침 항상 유지(체크 무관)" 확정은 2026-08-11 오너가 뒤집었다.

### 구현 메모 — sticky 패널

패널을 `absolute inset-y-0`으로 표에 붙이면, 표가 뷰포트보다 클 때 마지막 행에서 연 패널이 화면 위로 잘려 나간다. 그래서 **레일(표 높이 전체, `pointer-events-none`) + sticky 카드** 구조다. 이때 offset parent에 `overflow-hidden`이 있으면 그 박스가 스크롤포트가 되어 sticky가 죽으므로, `relative` 래퍼가 기존 `overflow-hidden` 박스를 **감싸는** 형태여야 한다.

## 스코프 밖 (후속)

- **시안 A(열 예산 재배분)** — 이름 열 296 → 460px. H와 상보 관계다: 이름 열이 넓어지면 접힌 클러스터 행이 3줄 → 2줄(84px)로 줄어 H의 비용을 깎는다. 순서상 A를 먼저 하는 편이 이득.
- **시안 F(밀도 토글)** — 넉넉/보통/조밀 3단. 기본값은 현행 `py-5`라 P6의 판례를 건드리지 않는다.
- **시안 C·D** — 빈 칸에 뜻 주기(P7), 세로 예산 회수(P4·P5).
- **Steps 2·3 승인 테이블(`WaitingApprovalTable`)** — 같은 `ResourceGroupRow`를 쓰지만 이번 변경 대상이 아니다. 검토 화면은 "요청에 무엇이 들어 있는가"를 펼쳐 보여야 하는 성격이라 접힘 기본을 그대로 옮길지는 별도 결정이 필요하다. `subline` prop은 optional이라 현재 동작은 무변경.
