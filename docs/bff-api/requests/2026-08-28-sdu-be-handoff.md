# SDU (Self Data Upload) 담당자 흐름 BFF API — 구현 요청

- 대상: `install/v1` BFF, base `/install/v1/target-sources/{targetSourceId}/sdu`
- 요청자: Pass FE
- 작성일: 2026-08-28
- **이 문서 하나가 전달물의 전부다.** 계약 세부까지 여기 다 있고, 별도 첨부는 없다.

## 0. 요약

SDU 는 **담당자가 데이터를 직접 S3 에 올리는** 연동이다. 우리가 스캔할 인프라도, 담당자가
실행할 Terraform 도 없다. 그래서 승인 단계가 없고, 담당자는 **무엇을 올릴지 정의하고(1단계)
→ 올리고(2단계) → 기다린다(3·4단계).**

`install-v1.yaml` 이 SDU 에 대해 말하는 것은 셋뿐이고 **셋 다 오퍼레이션이 아니다** —
`cloud_provider` enum 의 `SDU`, `metadata.is_sdu_type`, `metadata.is_china_region`(그리고
terraform 스크립트 이름 `SDU_BDC_SERVICE_COMMON` / `SDU_BDC_SERVICE`). 연동 대상 정의도,
방화벽 행도, 업로드 명령도, S3 Access Key 수신자도, BDC 리소스 단계도 **엔드포인트가 없다.**
아래 6건이 요청 범위다.

**신규 6건, 전부 담당자 권한**(§10) **+ 기존 재사용**이고, 재사용 쪽은 경로를 바꾸지
않는다 — SDU 대상 소스로 불렸을 때 받아 주기만 하면 된다(§9.3). 관리자 콘솔 전용으로
새로 만들 것은 없다.

## 1. 공통 규칙

- **인증**: 그 대상 소스가 속한 서비스의 **담당자**. ADMIN 도 통과한다. 이 화면은 관리자
  화면이 아니다
- wire 는 **snake_case**, 시각은 ISO-8601 UTC 문자열
- 에러 응답은 install-v1 의 `ErrorMessage` 그대로

```jsonc
{
  "timestamp": "2026-08-28T02:27:09.123Z",
  "status": "BAD_REQUEST",
  "code": "INVALID_PARAMETER",
  "message": "정의에 없는 Region 입니다: cx",
  "path": "/install/v1/target-sources/1100/sdu/upload/acks"
}
```

### 1.1 ProcessStatus — 격자는 그대로다

**7격자를 바꾸지 않는다.** 담당자 화면이 4단계로 보이는 것은 화면의 접기이고, 관리자
콘솔은 지금처럼 7단계를 본다.

| ProcessStatus | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 담당자 화면 단계 | 1 | 2 | 2 | 2 | 3 | 3 | 4 |

2·3 이 4 와 한 단계인 것은 SDU 에 승인이 없기 때문이고, 5 가 6 과 한 단계인 것은 관리자의
스캔 → Terraform → 연결 테스트 → Airflow 가 담당자에게는 한 문장이기 때문이다.
2단계 안의 네 블록은 **상태가 아니다** — wire 에 이름이 없다.

### 1.2 권역(region_scope)과 Region

- `region_scope` 는 **읽기 전용 파생값**이다. `metadata.is_china_region` 을 그대로 읽는다.
  AWS 가 같은 필드로 갈리는 것과 같고, **담당자가 고르지 않는다**
- `region` 은 AWS region 코드가 아니라 **우리 이름**이다. `GLOBAL` 이 `asia|us|eu|cx` 를,
  `CHINA` 가 `china` 를 **배타적으로** 소유한다. 그래서 China 대상 소스의 업로드 경로는
  항상 하나다
- 정렬 기준 순서: `asia, us, eu, cx, china`

## 2. 엔드포인트 — 신규 6건, 전부 담당자 상세 페이지

| Method | Path (base 생략) | 설명 |
| --- | --- | --- |
| GET | `/definition` | 연동 대상 정의 읽기 |
| PUT | `/definition` | 연동 대상 정의 저장 → 무효화 재계산 |
| POST | `/definition/submit` | 제출 → ProcessStatus 1 → 4 |
| GET | `/upload` | 2단계 전체를 **한 응답**으로 — **Region별 방화벽 목적지 IP · Region별 업로드 명령 문자열** · 수신자 · BDC 상태 · 무효화. 서버가 주는 값이 여기 다 있다 |
| PUT | `/upload/acks` | 방화벽·업로드 확인 답변 |
| PUT | `/upload/recipients` | S3 Access Key 수신자 **등록**(발송 아님) |

기존 재사용 2건:

| Method | Path | 무엇이 필요한가 |
| --- | --- | --- |
| GET | `/install/v1/services/{serviceCode}/authorized-users` | 그대로. 담당자 권한으로 200 (오너 확인, §6) |
| POST | `/install/v1/target-sources/{targetSourceId}/reset` | SDU 에서는 업로드 상태만 버린다 (§8) |

## 3. 연동 대상 정의 — `/definition`

```jsonc
// GET → 200
{
  "region_scope": "GLOBAL",          // 읽기 전용 파생값. §1.2
  "targets": [{
    "target_id":      "t-1",
    "cloud":          "AWS",         // AWS | GCP | AZURE | IDC | OTHER
    "region":         "us",          // 권역이 소유한 값만
    "upload_ip":      "10.20.30.40", // IPv4, 대상당 1개
    "database_types": ["MySQL", "Aurora MySQL"]
  }],
  "updated_at": "2026-08-24T07:41:00Z"   // 첫 저장 전에는 null
}
```

```jsonc
// PUT  body { "targets": [...] }        // 한 번도 저장 안 된 행은 target_id 생략 가능
                                          // region_scope 는 보내지 않는다(보내도 무시)
// → 200  GET 과 같은 모양
// → 400  INVALID_PARAMETER
```

서버 검증 — **넷 다 저장된 정의가 있어야 판단할 수 있어서 클라이언트가 대신 하지 않는다**:

- `region` 은 그 대상 소스의 권역이 소유한 값이어야 한다
- `database_types` 는 대상당 20개 이하, 각 50자 이하, trim 후 비어 있지 않을 것
- `upload_ip` 는 유효한 IPv4
- `cloud` 는 다섯 중 하나

### 3.1 무효화 — 저장이 2단계 답변에 하는 일

저장은 이미 받아 둔 2단계 답변이 **아직 무슨 뜻인지** 다시 계산한다.

| 1단계에서 고친 것 | 방화벽 확인 | 수신자 | 업로드 확인 |
| --- | --- | --- | --- |
| Region 추가 | **초기화** | 유지 | **초기화** |
| Region 삭제 | 유지 | 유지 | 유지 |
| `upload_ip` 변경 | **초기화** | 유지 | 유지 |
| `database_types` 만 | 유지 | 유지 | 유지 |
| `cloud` 만 | 유지 | 유지 | 유지 |

- **Region 추가**는 둘 다 초기화한다. 새 Region 은 아무도 결재하지 않은 방화벽 규칙과,
  아무도 `ls` 해 보지 않은 업로드 경로를 함께 가져온다
- **Region 삭제**는 아무것도 버리지 않는다. 남은 답이 아직 참이다
- **`upload_ip` 변경**은 방화벽만 초기화한다. 방화벽 규칙은 **출발지 → 목적지 쌍**이라
  출발지가 바뀌면 모든 규칙이 다른 규칙이 된다. 명령 세 줄에는 출발지 IP 가 없어서
  업로드 확인은 살아남는다

결과는 §5 의 `invalidation` 으로 되돌려 주고, **한 번만 말한다** — 다음 `PUT /upload/acks`
가 지운다. 삭제된 Region 은 `invalidation` 에 없다: 버린 것이 없으면 할 말도 없다.

## 4. 제출 — `POST /definition/submit`

```
→ 204
→ 400  INVALID_PARAMETER   // 대상 0건
```

대상이 최소 1건 있어야 한다. ProcessStatus 를 **1 → 4** 로 옮긴다(SDU 에는 승인이 없으니
제출이 곧 데이터 업로드로 보내는 행위다). 본문은 읽지 않는다 — 화면은 `process-status` 를
다시 읽어 어느 단계인지 안다.

## 5. 데이터 업로드 단계 — `GET /upload`

**한 응답이다.** 안의 모든 목록은 region 으로 키를 잡는다.

이 절이 **서버가 담당자에게 내려 주는 값 전부**를 담는다 — 특히 둘:

- `firewall.rows[].destination_ips` — **Region별 목적지 IP 목록.** 담당자가 사내 방화벽
  결재를 올릴 때 그대로 옮겨 적는 값이다. 엔드포인트·포트도 같은 행에 있다
- `commands.rows[].command` — **Region별 업로드 확인 명령**(`aws s3 ls …`). 담당자가
  올린 파일이 실제로 도착했는지 확인하는 세 줄이다

둘 다 **서버만 아는 값**이다(§5.1). 화면은 만들지 않고 받아서 그린다.

```jsonc
// → 200
{
  "submitted_at": "2026-08-24T06:00:00Z",
  "regions": ["us", "eu"],              // 정의에서 파생. 중복 없음, §1.2 순서
  "firewall": {
    "rows": [{
      "region": "us",
      "s3_endpoint": "s3.us-east-1.amazonaws.com",
      "port": 443,
      "destination_ips": ["52.216.0.0/15", "54.231.0.0/16", "3.5.0.0/19"]
    }],
    "acked": true,                      // 대상 소스 단위 답 하나. §7
    "acked_at": "2026-08-25T10:40:00Z", // 미답이면 null
    "acked_by": { "id": "user-1", "name": "홍길동", "email": "hong@company.com" }
  },
  "recipients": {
    "users": [{ "id": "user-1", "name": "홍길동", "email": "hong@company.com" }],
    "updated_at": "2026-08-24T07:41:00Z"
  },
  "commands": {
    "rows": [{ "region": "us", "command": "export http_proxy=...\n...\naws s3 ls ..." }],
    "acked": false,
    "acked_at": null,
    "acked_by": null
  },
  "bdc": {
    "status": "NOT_STARTED",            // NOT_STARTED | IN_PROGRESS | COMPLETED
    "checked_at": "2026-08-24T07:50:00Z",
    "completed_at": null
  },
  "invalidation": { "added_regions": [], "upload_ip_changed": false }
}
```

- `regions` 는 정의에서 파생한다. 업로드 경로는 **Region 단위**이지 database type 단위가
  아니라, 같은 Region 을 쓰는 대상들은 버킷 경로 하나를 공유한다
- `firewall.rows` 와 `commands.rows` 는 `regions` 와 **정확히 1:1**
- `acked_at` · `acked_by` 는 **관리자 몫이다.** 담당자 화면은 자기가 방금 누른 답에 시각을
  붙여 읽지 않는다. 승인 조건 ①의 근거 행이 「방화벽 확인 · 홍길동 · 08-25 10:40」을 쓴다.
  `confirmed: false` 로 되돌리면 둘 다 그 되돌린 사실로 갱신된다(비우지 않는다 — 되돌린
  것도 누군가 한 일이다)

### 5.1 명령은 문자열, 방화벽은 구조

`command` 는 **정확히 세 줄짜리 문자열 하나**다 — proxy export 둘과 `ls` 하나.

```
export http_proxy=http://proxy.bdc.com:8080
export https_proxy=http://proxy.bdc.com:8080
aws s3 ls s3://bdc-sdu-<aws-region>/<targetSourceId>/ --recursive --human-readable
```

화면은 이 문자열을 **그대로 그리고 절대 파싱하지 않는다.** 화면이 여기서 `s3://` 를
꺼내는 순간 wire 포맷이 화면 계약이 되고, 네 번째 줄이나 다른 proxy 주소가 표시를 바꾸는
대신 화면을 깬다. 그러니 줄을 늘리거나 주소를 바꿔도 이쪽은 안전하다.

반대로 방화벽은 **구조**다. 화면이 CIDR 을 한 줄에 하나씩 쌓기 때문에, 한 폼 줄이 한
CIDR 이다.

Region → AWS region / endpoint 매핑은 **서버 것**이고 클라이언트는 읽기만 한다. China 는
다른 파티션(`amazonaws.com.cn`)이라는 점도 서버가 안다.

## 6. 수신자 — `PUT /upload/recipients`

```
body { "user_ids": ["user-1", "user-5"] }
→ 204
→ 400  INVALID_PARAMETER   // 모르는 user id
```

**목록이지 발송이 아니다.** 키는 관리자가 메일로 직접 전달한다. 이 엔드포인트는 **누구에게
가는지만** 기록한다. 이 계약 어디에도 발송 의미는 없고, 화면도 저장이 무언가를 보냈다는
인상을 주지 않는다 — 발송·재발송·재발급·발급 이력 전부 없다.

### 6.1 후보는 그 서비스의 담당자다 — 요청 없음

수신자 후보를 전체 사용자 검색(`/users/search`)에서 **그 서비스의 담당자**로 좁혔다.
아무나 그 서비스의 키를 받을 수 있으면 안 되기 때문이다. 화면이 부르는 것은:

```
GET /install/v1/services/{serviceCode}/authorized-users
→ 200 { "users": [{ "id", "name", "email" }] }
```

**이미 있는 계약이고 ADMIN 전용이 아니다** (오너 확인, 2026-08-28) — 담당자 권한으로
200 이다. **이 절에는 BE 에 요청할 것이 없다.**

`user_ids`(§6)에 싣는 값은 이 응답의 `id` 다. 응답이 `id · name · email` 셋뿐이라
다른 후보가 없고, `/upload/recipients` 는 우리가 쓰는 가정 계약이므로 **받는 키가
`authorized-users.id` 라는 것도 이 문서가 정한다.**

## 7. 확인 답변 — `PUT /upload/acks`

```
body { "kind": "FIREWALL" | "UPLOAD", "confirmed": true }
→ 204
→ 400  INVALID_PARAMETER   // kind 가 둘 중 하나가 아니거나 confirmed 가 boolean 이 아님
```

- **답은 대상 소스 단위로 하나다.** 방화벽 확인도, 업로드 확인도 마찬가지다
- `confirmed: true` 는 그 블록의 `acked` 를 세우고, `false` 는 내린다
- **`false` 는 값이지 무응답이 아니다.** 2단계 게이트는 전진만 막는다 — 끝난 블록은
  접히되 잠기지 않고, 모든 블록이 되돌아갈 길을 가진다. `YES/NO` enum 은 이름 둘인 값
  둘이라 boolean 하나와 같다
- ack 저장은 `invalidation`(§3.1)도 지운다

### 왜 Region 단위가 아닌가

화면은 **"모든 Region의 방화벽 결재 내역을 확인하셨습니까?" 하나만 묻는다.** 예 버튼도
하나다. Region 단위로 저장할 답이 애초에 만들어지지 않으므로, 배열은 화면이 묻지 않은
것을 실어 보내는 자리가 된다.

## 8. BDC 진행과 초기화 — 엔드포인트가 아니라 규칙

`bdc.status` 는 §5 가 보고한다.

- **현재 모든 Region 이 두 목록 모두에서 확인됐고 + 수신자가 1명 이상**이면 `IN_PROGRESS`
- 완료되면 `COMPLETED` 이고, 대상 소스는 ProcessStatus **5**(`WAITING_CONNECTION_TEST`)로
  간다
- 완료 전에 조건 하나라도 잃으면 `NOT_STARTED` 로 **돌아간다.** 무효화된 확인은 BDC 가
  반쯤 끝난 것이 아니라 **다시 기다리는 중**이라는 뜻이다
- 화면은 BDC 를 상세히 그리지 않는다. "돌고 있다" 하나뿐이라, 진행률·리소스 목록·단계
  이름은 필요 없다

기존 `POST /install/v1/target-sources/{id}/reset` 은 SDU 에서 **업로드 상태만**(확인 답변 ·
수신자 · BDC) 버리고 **연동 대상 정의는 남긴다.** 초기화는 담당자를 1단계로 돌려보내는데,
1단계가 바로 정의를 고치는 자리다 — 정의까지 지우면 외워서 다시 타이핑할 빈 화면을 주게
된다(스캔 결과를 남기는 것과 같은 이유).

## 9. Admin 콘솔 — 신규 엔드포인트 없음

SDU 대상도 운영 콘솔의 **여덟 탭을 전부 받는다.** 지금은 SDU 가 콘솔에 들어오면 안내 한
장으로 막히는데, 그 전제("우리가 설치하는 계정")가 SDU 에서는 틀렸을 뿐 Terraform·연결
테스트·Airflow 확인은 SDU 에도 필요하다.

| 탭 | SDU 에서 필요한 것 | BE 작업 |
| --- | --- | --- |
| 진행 상태 | 7단계 레일에서 2·3·5 비활성 | 없음 (화면) |
| 스캔 | 업로드된 S3 데이터를 훑는다. 권한 카드 자리는 **수신자 목록**이 갖는다 | 기존 scan 이 SDU 대상을 받으면 됨 |
| 연동 요청 정보 | 담당자 입력(정의·수신자·확인 답변) | §3 + §5 를 읽는다 |
| 확정 정보 | Region별 업로드 경로 · 대상 · 스캔이 찾은 리소스 | **응답 확장** (§9.2) |
| 인프라 작업 | 집계 대신 작업별 적용 상태. `SDU_BDC_SERVICE_COMMON` · `SDU_BDC_SERVICE` | 기존 `terraform-status` 가 SDU 를 받으면 됨 |
| 연결 테스트 | 그대로 | 기존 `test-connection/*` 가 SDU 를 받으면 됨 |
| 관리자 승인 | 조건 3장 유지. ①의 **근거 행**에 담당자 응답이 앉는다 | §5 를 읽는다 |
| Airflow 확인 | 그대로 | 기존 오퍼레이션이 SDU 를 받으면 됨 |

Terraform · TC · Airflow 의 **기능은 이미 있다.** SDU 대상이 그 오퍼레이션에 들어가게
열어 주면 된다 — 경로가 전부 `/target-sources/{id}/...` 로 프로바이더에 묶여 있지 않다.

### 9.1 응답 이력은 만들지 않는다

시안은 이 탭에 「2단계 응답 이력」을 회차 누적 표로 그렸다. **만들지 않는다.**

그 표를 정당화하던 것은 Region 단위 답이었다 — "1회차 방화벽 확인이 왜 US·EU였는데 지금은
US·Asia인가"를 관리자가 재구성해야 한다는 것. 답이 대상 소스 단위 하나가 된 지금 회차는
`예 → 아니오 → 예` 뿐이고, 그걸 위해 append-only 로그를 세우는 것은 값에 비해 비싸다.

승인 조건 ①이 실제로 읽는 것은 **현재 상태**다 — 방화벽 확인 · 업로드 확인 · 수신자 수.
셋 다 §5 가 이미 준다. 거기에 `acked_at` · `acked_by` 두 쌍만 붙으면 근거 행이 완성된다.

되돌린 이력(누가 언제 아니오를 눌렀다가 다시 예를 눌렀는지)은 **잃는다.** 그것이 승인
판단에 필요하다고 밝혀지면 그때 로그를 만든다 — 지금은 필요하다는 근거가 없다.

### 9.2 확정 정보 — 기존 경로, SDU 행 모양 정의 필요

`GET /install/v1/target-sources/{targetSourceId}/confirmed-integration` 이 SDU 에서 무엇을
행으로 갖는지가 정해져 있지 않다. 화면이 그리려는 것은 **Region별 업로드 경로 · 그 Region
의 대상 · 스캔이 찾은 리소스**다. 신규 경로가 아니라 이 응답의 SDU 케이스를 정의해 달라.

### 9.3 SDU 대상을 받아야 하는 기존 오퍼레이션

경로 변경 없이, **SDU 대상 소스로 호출됐을 때 404/400 이 아니어야** 한다.

- `POST /scan` · `GET /scanJob/latest` · `GET /scan/history`
- `GET /terraform-status` (작업 이름은 `SDU_BDC_SERVICE_COMMON` · `SDU_BDC_SERVICE`
  둘뿐이고 **둘 다 BDC 주체**다 — SERVICE 쪽 작업이 없다는 사실 자체가 "담당자가 자기
  계정에서 돌릴 것이 없다"는 SDU 의 성질이다)
- `GET /confirmed-integration` (§9.2)
- `/test-connection/*` 전부
- `GET /process-status` · `POST /reset`(§8) · 설치 완료 처리
- Airflow 확인 탭이 쓰는 오퍼레이션

## 10. 권한 — 신규 6건은 전부 담당자

| # | 엔드포인트 | 권한 |
| --- | --- | --- |
| 1 | `GET /sdu/definition` | **담당자** (ADMIN 통과) |
| 2 | `PUT /sdu/definition` | **담당자** (ADMIN 통과) |
| 3 | `POST /sdu/definition/submit` | **담당자** (ADMIN 통과) |
| 4 | `GET /sdu/upload` | **담당자** (ADMIN 통과) |
| 5 | `PUT /sdu/upload/acks` | **담당자** (ADMIN 통과) |
| 6 | `PUT /sdu/upload/recipients` | **담당자** (ADMIN 통과) |

기준은 **화면이 누구 것인가**이고, 여섯 건 모두 담당자 상세 페이지가 부른다. **ADMIN 전용
신규 엔드포인트는 없다** — 관리자 콘솔이 필요로 하는 것은 전부 위 여섯 건과 기존
오퍼레이션이 이미 답한다(§9).

재사용 2건: `authorized-users` 는 **담당자**(§6.1, 오너 확인), `reset` 은 기존 권한 그대로.

## 11. 확인이 필요한 것

각 항목이 답에 따라 화면을 바꾼다.

| # | 질문 | 다르게 답하면 |
| --- | --- | --- |
| 1 | `region_scope` 를 §3 응답에 실어 주나, 화면이 `metadata.is_china_region` 을 직접 읽나 | 후자면 §3 에서 필드가 빠진다 |
| 2 | cloud·region 이 대상별인가 대상 소스별인가 | 대상 소스별이면 "Region 2곳"이 성립하지 않는다 |
| 3 | Region → 버킷/엔드포인트 매핑이 고정인가, 대상 소스별인가, 권역별인가 | 고정이 아니면 §5 를 매번 다시 읽어야 한다 |
| 4 | 목적지 IP 가 정말 구조로 오나 | 문자열이면 §5 방화벽 표가 터미널 블록으로 바뀐다. CIDR 개수 상한도 모른다 |
| 5 | `upload_ip` 가 계속 스칼라인가, 배열로 열리나 | 배열이면 1단계 행의 입력이 바뀐다 |
| 6 | `upload_ip` 변경이 우리 쪽에 또 무엇을 요구하나(버킷 정책 allowlist) | 담당자의 재확인만으로 안 끝난다면 화면이 그 절반을 말해야 한다 |
| 7 | `database_types` 만 고친 것이 관리자 스캔 비교에 무엇을 바꾸나 | 여기서는 아무것도 무효화하지 않는데, 그게 "아무 일도 없다"와 같지는 않다 |
| 8 | ProcessStatus 는 대상 소스당 **한 값**이라 "10건 중 2건만 확인 필요"를 말할 수 없다 | Region/대상 단위 상태가 필요하면 격자 밖에 별도 필드가 있어야 한다 |
| 9 | BDC 완료 **후에** 대상을 추가하면 BDC 가 다시 도나 | 안 돌면 추가한 대상은 영원히 반영되지 않는다 |
| 10 | **§9.2** `confirmed-integration` 의 SDU 행이 무엇인가 | 정해지지 않으면 확정 정보 탭이 빈다 |
| 11 | Terraform 작업 응답에 **적용 시각·실패 사유가 없다** | 「적용 실패」에서 왜로 가는 길이 지금 계약에 없다 |

**이미 답이 나온 것** — `authorized-users` 는 ADMIN 전용이 아니고 응답은
`id · name · email` 이다(오너, 2026-08-28). §6.1 은 요청이 아니라 기록이다.

## 12. 우리가 정한 것 (계약 형태에 대한 선택)

시안(`design/sdu/sdu-flow-design.html` `#contract`)의 초안과 다른 세 곳이고, 전사 오류가
아니라 선택이다.

1. **snake_case.** 이 저장소의 가정 계약은 전부 snake 다. camel 로 오면 변경은
   `app/lib/api/sdu.ts` 와 wire 타입에만 갇힌다
2. **`GET /upload` 를 셋으로 쪼개지 않았다.** 2단계는 게이트 사슬이라 상태가 셋에 **걸쳐**
   계산된다 — `bdc` 는 셋을 다 봐야 답할 수 있고 `invalidation` 은 셋을 한 번에 말한다.
   세 번 부르면 화면이 다른 둘이 못 본 정의를 기준으로 게이트를 그린다
3. **`confirmed: boolean` 하나, Region 배열 없음.** 이름 둘인 값 둘은 값 하나이고(§7),
   화면이 한 번만 묻는 것을 Region 별로 저장할 이유도 없다
