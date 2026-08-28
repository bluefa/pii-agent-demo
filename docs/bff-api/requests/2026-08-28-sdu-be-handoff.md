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

**신규 6건 + 기존 2건 재사용**이고, 기존 2건 중 하나는 권한 조건 하나만 바뀐다(§6).

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

## 2. 엔드포인트 6건

| Method | Path (base 생략) | 설명 |
| --- | --- | --- |
| GET | `/definition` | 연동 대상 정의 읽기 |
| PUT | `/definition` | 연동 대상 정의 저장 → 무효화 재계산 |
| POST | `/definition/submit` | 제출 → ProcessStatus 1 → 4 |
| GET | `/upload` | 2단계 전체를 **한 응답**으로 |
| PUT | `/upload/acks` | 방화벽·업로드 확인 답변 |
| PUT | `/upload/recipients` | S3 Access Key 수신자 **등록**(발송 아님) |

기존 재사용 2건:

| Method | Path | 무엇이 필요한가 |
| --- | --- | --- |
| GET | `/install/v1/services/{serviceCode}/authorized-users` | **담당자 권한으로도 200** 이어야 한다 (§6) |
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
| Region 추가 | (버릴 것 없음 — 답이 아직 없다) | 유지 | (버릴 것 없음) |
| Region 삭제 | 그 Region 답변 폐기 | 유지 | 그 Region 답변 폐기 |
| `upload_ip` 변경 | **전부** 폐기 | 유지 | 유지 |
| `database_types` 만 | 유지 | 유지 | 유지 |
| `cloud` 만 | 유지 | 유지 | 유지 |

`upload_ip` 만 자기 행보다 넓게 번지는 이유: 방화벽 규칙은 **출발지 → 목적지 쌍**이라
출발지가 바뀌면 모든 규칙이 다른 규칙이 된다. 명령문에는 출발지 IP 가 없어서 살아남는다.

**답변을 Region 단위로 저장해 달라**는 요청이 여기서 나온다. 블록당 boolean 하나로 두면
한 번의 수정이 전부를 지우고, 담당자는 되돌아가는 것을 피하게 된다.

결과는 §5 의 `invalidation` 으로 되돌려 주고, **한 번만 말한다** — 다음 `PUT /upload/acks`
가 지운다.

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
    "acked_regions": ["us"]
  },
  "recipients": {
    "users": [{ "id": "user-1", "name": "홍길동", "email": "hong@company.com" }],
    "updated_at": "2026-08-24T07:41:00Z"
  },
  "commands": {
    "rows": [{ "region": "us", "command": "export http_proxy=...\n...\naws s3 ls ..." }],
    "acked_regions": []
  },
  "bdc": {
    "status": "NOT_STARTED",            // NOT_STARTED | IN_PROGRESS | COMPLETED
    "checked_at": "2026-08-24T07:50:00Z",
    "completed_at": null
  },
  "invalidation": {
    "added_regions": [], "removed_regions": [], "upload_ip_changed": false
  }
}
```

- `regions` 는 정의에서 파생한다. 업로드 경로는 **Region 단위**이지 database type 단위가
  아니라, 같은 Region 을 쓰는 대상들은 버킷 경로 하나를 공유한다
- `firewall.rows` 와 `commands.rows` 는 `regions` 와 **정확히 1:1**

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

### 6.1 ⚠️ 후보는 그 서비스의 담당자다 — 권한 조건 하나

수신자 후보를 전체 사용자 검색(`/users/search`)에서 **그 서비스의 담당자**로 좁혔다.
아무나 그 서비스의 키를 받을 수 있으면 안 되기 때문이다. 화면이 부르는 것은:

```
GET /install/v1/services/{serviceCode}/authorized-users
→ 200 { "users": [{ "id", "name", "email" }] }
```

**이 엔드포인트가 담당자 권한으로도 200 이어야 한다.** 경로가 `/admin/...` 이 아니고,
같은 사실의 관리자용 목록은 `/admin/access/services/{code}/owners` 로 따로 있으니
이쪽은 담당자용이 맞다고 읽었다. ADMIN 전용이면 **담당자가 자기 화면에서 잠긴다.**

→ 현재 권한 조건이 무엇인지 알려 달라. ADMIN 전용이라면 완화가 필요하다.

### 6.2 확인 필요 — id 네임스페이스

`authorized-users` 가 주는 `id` 를 그대로 `user_ids` 에 실어 보낸다. 두 값이 같은
식별자인지 확인이 필요하다. 다르면 `authorized-users` 응답에 수신자 등록이 받는 키를
함께 실어 달라.

## 7. 확인 답변 — `PUT /upload/acks`

```
body { "kind": "FIREWALL" | "UPLOAD", "regions": ["us"], "confirmed": true }
→ 204
→ 400  INVALID_PARAMETER   // 현재 정의에 없는 region
```

- `confirmed: true` 는 해당 `acked_regions` 에 더하고, `false` 는 뺀다
- `regions` 는 §5 `regions` 의 부분집합
- **`false` 는 값이지 무응답이 아니다.** 2단계 게이트는 전진만 막는다 — 끝난 블록은
  접히되 잠기지 않고, 모든 블록이 되돌아갈 길을 가진다. "아직 답 안 함"은 `acked_regions`
  에 없는 것으로 이미 구별되므로 `YES/NO` enum 은 세 번째 상태가 닿지 않는다
- ack 저장은 `invalidation`(§3.1)도 지운다

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

## 9. 확인이 필요한 것

각 항목이 답에 따라 화면을 바꾼다.

| # | 질문 | 다르게 답하면 |
| --- | --- | --- |
| 1 | **§6.1** `authorized-users` 의 현재 권한 조건 | ADMIN 전용이면 담당자가 수신자를 못 고른다 |
| 2 | **§6.2** `authorized-users.id` 와 `user_ids` 가 같은 식별자인가 | 다르면 응답에 등록용 키가 추가돼야 한다 |
| 3 | `region_scope` 를 §3 응답에 실어 주나, 화면이 `metadata.is_china_region` 을 직접 읽나 | 후자면 §3 에서 필드가 빠진다 |
| 4 | cloud·region 이 대상별인가 대상 소스별인가 | 대상 소스별이면 "Region 2곳"이 성립하지 않는다 |
| 5 | Region → 버킷/엔드포인트 매핑이 고정인가, 대상 소스별인가, 권역별인가 | 고정이 아니면 §5 를 매번 다시 읽어야 한다 |
| 6 | 목적지 IP 가 정말 구조로 오나 | 문자열이면 §5 방화벽 표가 터미널 블록으로 바뀐다. CIDR 개수 상한도 모른다 |
| 7 | `upload_ip` 가 계속 스칼라인가, 배열로 열리나 | 배열이면 1단계 행의 입력이 바뀐다 |
| 8 | `upload_ip` 변경이 우리 쪽에 또 무엇을 요구하나(버킷 정책 allowlist) | 담당자의 재확인만으로 안 끝난다면 화면이 그 절반을 말해야 한다 |
| 9 | `database_types` 만 고친 것이 관리자 스캔 비교에 무엇을 바꾸나 | 여기서는 아무것도 무효화하지 않는데, 그게 "아무 일도 없다"와 같지는 않다 |
| 10 | ProcessStatus 는 대상 소스당 **한 값**이라 "10건 중 2건만 확인 필요"를 말할 수 없다 | Region/대상 단위 상태가 필요하면 격자 밖에 별도 필드가 있어야 한다 |
| 11 | BDC 완료 **후에** 대상을 추가하면 BDC 가 다시 도나 | 안 돌면 추가한 대상은 영원히 반영되지 않는다 |

## 10. 우리가 정한 것 (계약 형태에 대한 선택)

시안(`design/sdu/sdu-flow-design.html` `#contract`)의 초안과 다른 세 곳이고, 전사 오류가
아니라 선택이다.

1. **snake_case.** 이 저장소의 가정 계약은 전부 snake 다. camel 로 오면 변경은
   `app/lib/api/sdu.ts` 와 wire 타입에만 갇힌다
2. **`GET /upload` 를 셋으로 쪼개지 않았다.** 2단계는 게이트 사슬이라 상태가 셋에 **걸쳐**
   계산된다 — `bdc` 는 셋을 다 봐야 답할 수 있고 `invalidation` 은 셋을 한 번에 말한다.
   세 번 부르면 화면이 다른 둘이 못 본 정의를 기준으로 게이트를 그린다
3. **`confirmed: boolean`.** 이름 둘인 값 둘은 값 하나다(§7)
