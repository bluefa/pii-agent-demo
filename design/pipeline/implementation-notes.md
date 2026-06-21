# Pipeline — Implementation Notes (구현 런북 · 아키텍처 불변식 아님)

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의 **구현 노트**.
> 여기 담긴 것은 **아키텍처 결정이 아니라 특정 구현(Java 21 Virtual Thread)의 운영 제약·배포 체크리스트**다.
> 아키텍처 불변식은 결정 6(비블로킹 async 발사 D-T2 · 관측=실행 주체·상태=tick D-T4)이며, 그 불변식은
> 구현과 무관하다 — 아래가 미충족이어도 다른 async 구현으로 대체 가능하고 불변식은 불변이다.

---

## A. Virtual Thread 런타임

BFF의 async 실행 구현 선택은 Java 21+ Virtual Thread다. 아래는 그 구현의 운영 제약이다.

- **자원: 개수는 비문제, pinning이 실제 제약.** target ≈ 2000개라도 동시 진행 호출은 일부다
  (WAIT_EXTERNAL은 ≥10분 분산, EXECUTE는 slot N 제한). VT는 힙 객체라 수천 개도 메모리
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
