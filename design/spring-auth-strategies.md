# Spring Server 인증 헤더 관리 · 현재 유저 관리 전략

> 작성: 2026-07-26 · 대상: BFF(Spring Boot 3.x) · 연관: 프론트 PR #578 (IAP/SSO 헤더 passthrough)
>
> 전제: 프론트엔드는 임시로 2곳(GCP IAP 뒤 / SSO 뒤)에서 운영되고, 인증 자격증명을
> 검증 없이 BFF로 무손실 전달한다(allowlist: `authorization`, `cookie`,
> `x-goog-iap-jwt-assertion`, `x-goog-authenticated-user-email`, `x-goog-authenticated-user-id`).
> **검증 책임은 전적으로 BFF에 있다** (ADR-008: 401 = 미인증/SSO 만료).

---

## 0. 대원칙: 헤더는 신뢰 대상이 아니라 검증 대상

| 헤더 | 성격 | 취급 |
|---|---|---|
| `x-goog-iap-jwt-assertion` | IAP가 서명한 JWT (ES256) | **서명·issuer·audience 검증 후** claim에서 신원 추출. 이것이 IAP 경로의 유일한 신뢰 근거 |
| `x-goog-authenticated-user-email` / `-id` | 평문 헤더 | 스푸핑 가능. 로깅/디버깅 참고용으로만. 신원 판단에 사용 금지 |
| `authorization` / SSO 쿠키 | SSO 토큰 | IdP 서명 검증(JWT) 또는 introspection 후 신원 추출 |

인증(Authentication)이 끝나면 "누구인가(principal)"가 확정되고, 인가(Authorization)는
그 principal에 "무엇을 할 수 있는가(authorities)"를 붙여 판단한다. 이 문서의 모든 전략은
마지막에 같은 인가 접점으로 수렴하도록 설계했다 — **인가 서버가 아직 없어도 접점만
고정해두면 나중에 구현체만 교체하면 된다** (§5).

## 공통 기반: `CurrentUser` 모델

어떤 전략을 골라도 애플리케이션 코드가 보는 것은 이 타입 하나여야 한다.
전략을 갈아타도 컨트롤러/서비스 코드가 안 바뀌는 격리선이다.

```java
/** The one identity type application code sees. Auth strategy changes must not leak past this. */
public record CurrentUser(
    String id,          // sub claim or SSO user id
    String name,
    String email,
    AuthChannel channel // IAP or SSO — for audit logging, not for branching business logic
) {
  public enum AuthChannel { IAP, SSO }
}
```

---

## 전략 A — 순수 서블릿 필터 + RequestScope (Spring Security 없음)

가장 작은 구현. `OncePerRequestFilter`가 헤더를 검증해 `CurrentUser`를 만들고,
request-scoped 빈에 담는다.

```java
@Component
public class AuthFilter extends OncePerRequestFilter {

  private final IapTokenVerifier iapVerifier;   // wraps JWT verification (§전략 C의 JwtDecoder 재사용 가능)
  private final SsoTokenVerifier ssoVerifier;
  private final CurrentUserHolder holder;       // request-scoped

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    String iapJwt = req.getHeader("x-goog-iap-jwt-assertion");
    Optional<CurrentUser> user = (iapJwt != null)
        ? iapVerifier.verify(iapJwt)
        : ssoVerifier.verify(req);   // reads Authorization header or SSO cookie

    if (user.isEmpty()) {
      res.sendError(HttpServletResponse.SC_UNAUTHORIZED); // ADR-008: 401 = unauthenticated
      return;
    }
    holder.set(user.get());
    chain.doFilter(req, res);
  }
}

@Component
@RequestScope
public class CurrentUserHolder {
  private CurrentUser user;
  public void set(CurrentUser u) { this.user = u; }
  public CurrentUser get() {
    if (user == null) throw new IllegalStateException("no authenticated user in request scope");
    return user;
  }
}
```

사용:

```java
@RestController
public class UserMeController {
  private final CurrentUserHolder holder;

  @GetMapping("/install/v1/user/me")
  public UserMeResponse me() {
    CurrentUser u = holder.get();
    return new UserMeResponse(u.id(), u.name(), u.email());
  }
}
```

- **장점**: 의존성 zero, 코드 전체가 한눈에 보임. 학습 비용 최소.
- **단점**: 경로별 인증 제외(`/actuator/health` 등)를 손으로 관리. 인가를 붙이는 순간
  `@PreAuthorize` 같은 선언적 도구가 없어 if-else 인가 코드가 서비스 층에 스며든다.
  async(`@Async`, 별도 스레드풀)로 넘어가면 RequestScope가 끊긴다.
- **적합**: 엔드포인트가 적고 인가 요구가 당분간 전혀 없을 때. **이 프로젝트에는 비추천**
  — 인가 연계가 예고돼 있으므로 A로 시작하면 B/C로 다시 이사하게 된다.

---

## 전략 B — Spring Security Pre-Authenticated 패턴

Spring Security가 정확히 이 상황("인증은 앞단 인프라가 했고, 나는 그 결과를 받는다")을
위해 만들어 둔 공식 패턴: `AbstractPreAuthenticatedProcessingFilter` +
`PreAuthenticatedAuthenticationProvider`.

```java
/** Extracts the pre-authenticated principal from IAP/SSO headers. Verification happens in the provider. */
public class DualChannelPreAuthFilter extends AbstractPreAuthenticatedProcessingFilter {

  @Override
  protected Object getPreAuthenticatedPrincipal(HttpServletRequest req) {
    String iapJwt = req.getHeader("x-goog-iap-jwt-assertion");
    if (iapJwt != null) return new PendingCredential(AuthChannel.IAP, iapJwt);
    String bearer = req.getHeader(HttpHeaders.AUTHORIZATION);
    if (bearer != null) return new PendingCredential(AuthChannel.SSO, bearer);
    Cookie ssoCookie = WebUtils.getCookie(req, "SSO_SESSION");
    return ssoCookie != null ? new PendingCredential(AuthChannel.SSO, ssoCookie.getValue()) : null;
  }

  @Override
  protected Object getPreAuthenticatedCredentials(HttpServletRequest req) { return "N/A"; }
}

/** Verifies the pending credential and resolves it into a CurrentUser-backed UserDetails. */
public class ChannelVerifyingUserDetailsService
    implements AuthenticationUserDetailsService<PreAuthenticatedAuthenticationToken> {

  private final IapTokenVerifier iapVerifier;
  private final SsoTokenVerifier ssoVerifier;

  @Override
  public UserDetails loadUserDetails(PreAuthenticatedAuthenticationToken token) {
    PendingCredential cred = (PendingCredential) token.getPrincipal();
    CurrentUser user = switch (cred.channel()) {
      case IAP -> iapVerifier.verify(cred.raw()).orElseThrow(() -> new UsernameNotFoundException("invalid IAP JWT"));
      case SSO -> ssoVerifier.verify(cred.raw()).orElseThrow(() -> new UsernameNotFoundException("invalid SSO token"));
    };
    // Authorities are EMPTY today — the authorization server will fill these later (§5).
    return new CurrentUserDetails(user, List.of());
  }
}

@Configuration
@EnableWebSecurity
@EnableMethodSecurity   // enables @PreAuthorize now, even with empty authorities
public class SecurityConfig {

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http, AuthenticationManager authManager) throws Exception {
    var preAuth = new DualChannelPreAuthFilter();
    preAuth.setAuthenticationManager(authManager);
    return http
        .csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .addFilterBefore(preAuth, AnonymousAuthenticationFilter.class)
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health").permitAll()
            .anyRequest().authenticated())
        .exceptionHandling(e -> e.authenticationEntryPoint(
            (req, res, ex) -> res.sendError(401)))   // ADR-008 contract
        .build();
  }

  @Bean
  AuthenticationManager authManager(ChannelVerifyingUserDetailsService uds) {
    var provider = new PreAuthenticatedAuthenticationProvider();
    provider.setPreAuthenticatedUserDetailsService(uds);
    return new ProviderManager(provider);
  }
}
```

- **장점**: Spring Security 생태계 전부가 열림 — `@PreAuthorize`, `SecurityContextHolder`,
  method security, 테스트 지원(`@WithMockUser`), async 전파(`DelegatingSecurityContextExecutor`).
  인가 서버가 오면 `loadUserDetails`에서 authorities만 채우면 끝.
- **단점**: IAP JWT 검증 코드는 여전히 직접 작성(전략 C가 이 부분을 표준화함).
  Security 필터체인 학습 비용.
- **적합**: SSO처럼 "표준 OAuth2가 아닌 사내 토큰"이 섞여 있을 때의 정석.

---

## 전략 C — OAuth2 Resource Server 패턴 (IAP 검증의 정석)

IAP assertion은 결국 JWT다. Spring Boot의 `oauth2-resource-server`를 쓰면 서명 검증,
JWKS 캐싱·키 로테이션, exp/iss/aud 검증이 전부 설정으로 끝난다. 직접 짜면 틀리기 쉬운
부분(키 로테이션, clock skew)을 프레임워크가 담당한다.

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class ResourceServerConfig {

  /** IAP signs with ES256; keys at Google's public JWKS endpoint. */
  @Bean
  JwtDecoder iapJwtDecoder(
      @Value("${auth.iap.audience}") String expectedAudience) { // e.g. /projects/NUM/global/backendServices/ID
    NimbusJwtDecoder decoder = NimbusJwtDecoder
        .withJwkSetUri("https://www.gstatic.com/iap/verify/public_key-jwk")
        .jwsAlgorithm(SignatureAlgorithm.ES256)
        .build();
    decoder.setJwtValidator(JwtValidators.createDefaultWithValidators(
        new JwtIssuerValidator("https://cloud.google.com/iap"),
        new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
            aud -> aud != null && aud.contains(expectedAudience))));
    return decoder;
  }

  /** The IAP assertion is not in the Authorization header — resolve it from IAP's own header. */
  @Bean
  BearerTokenResolver iapHeaderResolver() {
    return request -> request.getHeader("x-goog-iap-jwt-assertion");
  }

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http, JwtDecoder iapJwtDecoder,
                                  BearerTokenResolver iapHeaderResolver) throws Exception {
    return http
        .csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .oauth2ResourceServer(rs -> rs
            .bearerTokenResolver(iapHeaderResolver)
            .jwt(jwt -> jwt.decoder(iapJwtDecoder)
                          .jwtAuthenticationConverter(new IapJwtToUserConverter())))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health").permitAll()
            .anyRequest().authenticated())
        .build();
  }
}

/** Maps verified IAP claims → domain Authentication carrying CurrentUser. */
public class IapJwtToUserConverter implements Converter<Jwt, AbstractAuthenticationToken> {
  @Override
  public AbstractAuthenticationToken convert(Jwt jwt) {
    CurrentUser user = new CurrentUser(
        jwt.getSubject(),                                  // stable Google subject
        jwt.getClaimAsString("email"),                     // display fallback: email
        jwt.getClaimAsString("email"),
        CurrentUser.AuthChannel.IAP);
    return new CurrentUserAuthentication(user, List.of()); // authorities empty until authz server (§5)
  }
}
```

**듀얼 채널(IAP + SSO) 결합** — SSO 토큰도 JWT라면 `JwtIssuerAuthenticationManagerResolver`
(issuer별 decoder 라우팅)로 설정만으로 확장된다. SSO가 opaque 토큰이면 introspection
(`opaqueToken()`) 또는 전략 B의 커스텀 provider를 SSO 경로에만 쓰는 하이브리드가 자연스럽다:

```java
/** Route per request: IAP assertion → JWT decoder; otherwise → SSO authentication manager. */
@Bean
AuthenticationManagerResolver<HttpServletRequest> channelResolver(
    AuthenticationManager iapManager, AuthenticationManager ssoManager) {
  return request ->
      request.getHeader("x-goog-iap-jwt-assertion") != null ? iapManager : ssoManager;
}
// http.oauth2ResourceServer(rs -> rs.authenticationManagerResolver(channelResolver))
```

- **장점**: IAP 검증이 사실상 설정 수준. 키 로테이션/JWKS 캐시/검증 엣지케이스를
  프레임워크가 소유. 표준 패턴이라 신규 합류자도 문서로 학습 가능.
- **단점**: SSO가 비표준이면 결국 B의 커스텀 조각이 필요(하이브리드).
- **적합**: **본 프로젝트 권장의 중심축.** IAP 경로는 무조건 이 방식이 옳다.

---

## 전략 D — 게이트웨이 신뢰 헤더 (참고용, 현 구조에선 비추천)

앞단(게이트웨이/프록시)이 검증을 끝내고 `X-User-Id` 같은 **정규화된 내부 헤더**만
내려보내고, BFF는 무조건 신뢰하는 방식.

```java
// DANGEROUS unless the network guarantees only the gateway can reach this server.
String userId = req.getHeader("X-Verified-User-Id");
```

- 성립 조건: mTLS 또는 네트워크 정책으로 "BFF에 도달하는 요청은 반드시 게이트웨이를
  거쳤다"가 **물리적으로** 보장될 때만. 외부에서 같은 헤더를 꽂으면 즉시 인증 우회가 된다.
- 현재 구조는 Next 프록시가 검증 없이 통과만 시키므로 이 전제가 성립하지 않는다.
  **선택하지 말 것.** (미래에 서비스 메시/내부 게이트웨이가 생기면 재평가 가치는 있음.)

---

## 4. 공통 마감재: 컨트롤러에서 현재 유저 꺼내기

전략 B/C 어느 쪽이든 `SecurityContext`에 `CurrentUser`가 들어있으므로, 컨트롤러는
`@AuthenticationPrincipal` 하나로 끝난다. `/user/me`는 이렇게 닫힌다:

```java
@RestController
public class UserMeController {

  @GetMapping("/install/v1/user/me")
  public UserMeResponse me(@AuthenticationPrincipal CurrentUser user) {
    return new UserMeResponse(user.id(), user.name(), user.email());
  }
}
```

서비스 계층에서 필요하면 정적 헬퍼 대신 주입 가능한 provider로 (테스트 용이):

```java
@Component
public class CurrentUserProvider {
  public CurrentUser get() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !(auth.getPrincipal() instanceof CurrentUser user)) {
      throw new AuthenticationCredentialsNotFoundException("no authenticated user");
    }
    return user;
  }
}
```

**async 주의**: `@Async`/별도 스레드풀로 넘어가면 `SecurityContextHolder`(ThreadLocal)가
끊긴다. `DelegatingSecurityContextExecutor`로 감싸거나, 태스크 제출 시 `CurrentUser`를
값으로 캡처해서 넘겨라(파이프라인 워커처럼 "요청 밖" 실행이면 후자가 정직하다).

---

## 5. 인가(Authorization) 연계 — 서버가 아직 없어도 지금 고정할 접점

인가 서버 부재는 문제가 아니다. **접점을 인터페이스로 고정**해두면 지금은 로컬 구현,
나중엔 인가 서버 호출로 교체된다. 접점은 정확히 두 곳이다.

### 접점 1: authorities 적재 (인증 마지막 단계)

```java
/** The ONLY seam the future authorization server replaces. */
public interface AuthorityResolver {
  Collection<GrantedAuthority> resolve(CurrentUser user);
}

/** Today: derive from what already exists — e.g. the service-level permission table
    behind GET /services/{serviceCode}/authorized-users. */
@Component
public class LocalDbAuthorityResolver implements AuthorityResolver {
  private final ServicePermissionRepository repo;

  @Override
  public Collection<GrantedAuthority> resolve(CurrentUser user) {
    return repo.findServiceCodes(user.id()).stream()
        .map(code -> new SimpleGrantedAuthority("SERVICE_" + code))
        .collect(Collectors.toSet());
    // Tomorrow: replace this class with an authorization-server client (same interface).
  }
}
```

전략 B라면 `loadUserDetails`에서, 전략 C라면 `IapJwtToUserConverter`에서
`authorityResolver.resolve(user)`를 호출해 채운다. **호출부는 안 바뀐다.**

### 접점 2: 판정 지점 (선언적으로)

```java
// Method security — reads naturally, testable, and the rule lives next to the endpoint.
@PreAuthorize("hasAuthority('SERVICE_' + #serviceCode)")
@GetMapping("/install/v1/services/{serviceCode}/target-sources")
public List<TargetSourceDetail> list(@PathVariable String serviceCode) { ... }
```

규칙이 복잡해지면(리소스 소유권, 상태 조건) 판정 로직을 빈으로 중앙화:

```java
/** Central policy point. When a PDP (authorization server) arrives, this asks it instead. */
@Component("targetSourceAccessManager")
public class TargetSourceAccessManager {
  public boolean canAccess(CurrentUser user, long targetSourceId) {
    // today: local join (target_source → service_code → permission)
    // tomorrow: pdpClient.check(user.id(), "target-source:read", targetSourceId)
    ...
  }
}

@PreAuthorize("@targetSourceAccessManager.canAccess(principal, #targetSourceId)")
@GetMapping("/install/v1/target-sources/{targetSourceId}")
public TargetSourceDetail get(@PathVariable long targetSourceId) { ... }
```

이렇게 하면 인가 서버 도입일에 바뀌는 것은 `AuthorityResolver` 구현체 1개와
`AccessManager` 내부뿐이다. 컨트롤러의 `@PreAuthorize` 선언, 서비스 코드, 인증
파이프라인은 전부 그대로다.

### 401 vs 403 계약 (ADR-008 정합)

| 상황 | 응답 | 프론트 해석 |
|---|---|---|
| 자격증명 없음/만료/검증 실패 | **401** | SSO 재로그인 유도 |
| 인증됐으나 권한 없음 | **403** | 권한 요청 안내 |

Spring Security 기본이 이 구분과 일치한다(`AuthenticationEntryPoint`→401,
`AccessDeniedHandler`→403). 커스텀 에러 바디를 쓰더라도 status 구분은 유지할 것.

---

## 6. 테스트 지원

```java
// Strategy B/C both work with spring-security-test out of the box.
@Test
void me_returns_current_user() throws Exception {
  mockMvc.perform(get("/install/v1/user/me")
          .with(authentication(new CurrentUserAuthentication(
              new CurrentUser("u1", "홍길동", "hong@company.com", AuthChannel.IAP), List.of()))))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.email").value("hong@company.com"));
}
```

반복되면 커스텀 애너테이션(`@WithCurrentUser(id = "u1")` + `WithSecurityContextFactory`)으로
접어라. 필터 자체 테스트는 유효/무효/부재 JWT 3케이스면 골격이 잡힌다.

---

## 7. 권장안 (요약)

**전략 C를 축으로, SSO 채널만 B의 커스텀 provider로 보강한 하이브리드.**

1. IAP 경로: `oauth2-resource-server` + IAP 헤더 resolver + ES256 JwtDecoder (전략 C 코드 그대로).
2. SSO 경로: `AuthenticationManagerResolver`로 분기해 커스텀 `SsoAuthenticationProvider`
   (SSO가 표준 JWT/OIDC라면 이것도 decoder 라우팅으로 흡수 — 커스텀 코드 소멸).
3. 두 경로 모두 최종적으로 `CurrentUser` principal + `AuthorityResolver`로 수렴.
4. 인가: 지금부터 `@EnableMethodSecurity` + `@PreAuthorize`를 켜고, authorities는
   기존 service 권한 테이블에서 적재. 인가 서버가 오면 `AuthorityResolver` 구현체 교체.
5. 전략 A는 인가 예고 때문에 비추천, 전략 D는 현 네트워크 전제상 금지.

| | A 순수 필터 | B Pre-Auth | C Resource Server | D 신뢰 헤더 |
|---|---|---|---|---|
| 구현 비용 | 최소 | 중 | 소(IAP)/중(SSO) | 최소 |
| IAP 검증 품질 | 직접 구현 | 직접 구현 | **프레임워크** | 없음 |
| 인가 확장 | 수작업 | `@PreAuthorize` | `@PreAuthorize` | 수작업 |
| 비표준 SSO 수용 | 쉬움 | **정석** | introspection/하이브리드 | — |
| 보안 전제 | — | — | — | 네트워크 격리 필수 |
| 권장 | ✕ | 부분 채택(SSO) | **축** | ✕ |
