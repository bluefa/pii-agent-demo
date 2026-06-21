# Pipeline — Implementation Notes (구현 런북 · 아키텍처 불변식 아님)

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의 **구현 노트**.
> 여기 담긴 것은 **아키텍처 결정이 아니라 특정 구현(Java 21 Virtual Thread)의 운영 제약·배포 체크리스트**다.
> 아키텍처 불변식은 결정 6(비블로킹 async 발사 D-T2 · 관측=실행 주체·상태=tick D-T4)이며, 그 불변식은
> 구현과 무관하다 — 아래가 미충족이어도 다른 async 구현으로 대체 가능하고 불변식은 불변이다.

---

## A. Virtual Thread 런타임

BFF의 async 실행 구현 선택은 Java 21+ Virtual Thread다. 아래는 그 구현의 운영 제약이다.

- **자원: 개수는 비문제, pinning이 실제 제약.** target ≈ 2000개라도 동시 진행 호출은 일부다
  (CONDITION_CHECK은 ≥10분 분산, TERRAFORM_JOB은 slotCap 제한). VT는 힙 객체라 수천 개도 메모리
  무시 수준 — "스레드 개수 초과"는 VT를 쓰는 한 사실상 없다. **진짜 제약은 carrier thread
  pinning**: VT park 시 carrier를 놓지 않으면 코어 수만큼만 동시 실행되어 굶는다. 유발 지점은
  `synchronized` 내 블로킹 I/O(Java 21; JEP 491/Java 24+는 대부분 해소), 네이티브 호출, 일부
  레거시 HTTP 클라이언트.
- **HTTP backing client가 VT-friendly해야 한다.** Feign 등 추상화를 써도 carrier를 잡느냐는
  backing이 정한다: **위험** = Feign 기본 `Client.Default`(→ `HttpURLConnection`, 내부
  synchronized → pinning); **안전** = `feign-java11`(→ `java.net.http.HttpClient`) 또는
  `feign-hc5`(Apache HttpClient 5.x). Spring Cloud OpenFeign은 classpath 의존성으로 backing을
  auto-select하므로 VT-friendly client를 명시해 기본값에 떨어지지 않게 한다.
- **검증은 실측.** `-Djdk.tracePinnedThreads=full`(Java 21)로 느린 호출을 돌리며 pinning을
  확인한다. 개수 계산이 아니라 이 로그가 근거다. **배포 체크리스트 항목.**

---

## B. Handler 레지스트리 (handler_key 라우팅)

[task-model 결정 2](./task-model.md) handler 계약의 구현. **핸들러가 키를 선언하고 레지스트리는 자동 수집**
한다 — 손으로 유지하는 목록이 없어 중복·drift가 없다(Spring `List<T>` 빈 주입).

```java
// 1) 핸들러가 자기 키를 선언 — 키 문자열의 단일 출처(클래스명과 무관, rename해도 키 유지)
interface PipelineHandler {
    String key();            // 안정 식별자, 예: "aws.tf.network"
    TaskKind kind();
    // dispatch(...) / check(...) ...
}

@Component
class TerraformApplyNetwork implements PipelineHandler {
    public String key()    { return "aws.tf.network"; }
    public TaskKind kind() { return TERRAFORM_JOB; }
}

// 2) 레지스트리 = 자동 수집(수동 목록 없음). 중복 키·미등록은 부팅/런타임에 fail-fast
@Component
class HandlerRegistry {
    private final Map<String, PipelineHandler> byKey;
    HandlerRegistry(List<PipelineHandler> handlers) {            // ← @Component 핸들러 전부 자동 주입
        this.byKey = handlers.stream()
            .collect(toMap(PipelineHandler::key, identity()));   // 중복 키 → 부팅 실패
    }
    PipelineHandler get(String key) {
        var h = byKey.get(key);
        if (h == null) throw new UnknownHandlerException(key);   // 런타임 미해결 → task FAILED(HANDLER_NOT_FOUND)
        return h;
    }
}

// 3) recipe(코드 default)는 handler를 class로 참조(컴파일 타임 안전, 문자열 중복 0)
//    저장: task.handler_key = registry.of(TerraformApplyNetwork.class).key()
var AWS_INSTALL = List.of(
    task(TerraformApplyNetwork.class,     "네트워크 적용"),   // name = 표시 라벨
    task(TerraformApplyIntegration.class, "통합 적용"),
    task(AwsReadyCheck.class,             "설치 확인"));

// 4) 부팅 검증: default recipe가 참조하는 모든 handler가 등록됐는지(새 bad row 차단)
// 5) reconciler: registry.get(task.handlerKey()).dispatch(...)  — 추측 없는 라우팅
```

- **Task는 in-place 수정 없이 `_V1/_V2` append-only**로 관리한다 — 동작이 바뀌면 `TerraformApplyNetwork_V2`를
  *추가*(키 `aws.tf.network_v2`)하고 `_V1`은 불변 유지. 옛 row·snapshot의 `_V1` 키가 영원히 resolve된다.
- **런타임 미해결 종료:** 이미 만들어진 옛 row의 handler가 (규율 위반으로) 사라지면 `get()`이 throw → task는
  **즉시 FAILED(`HANDLER_NOT_FOUND`)**, RUNNING TERRAFORM_JOB의 in-flight job은 죽일 수 없어 orphan으로
  흡수(state-machine 종결표). 무한 폴링·크래시 루프 없음.
