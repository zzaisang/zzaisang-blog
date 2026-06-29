---
title: "Spring Security 멀티 포탈 인가 — 엣지에서 막고, 부팅 시점에 강제하기"
description: "두 종류의 조직(포탈)이 경로를 공유하는 API에서 인가를 메서드 레벨에 흩뿌리지 않고, 라우팅 엣지의 커스텀 AuthorizationManager와 부팅 시점 검증기로 구조적으로 보장한 설계를 정리합니다."
pubDate: "2026-06-29T10:11:43+09:00"
category: "Spring"
tags: ["spring-security", "authorization", "multi-tenant", "kotlin", "ddd"]
---
하나의 API가 성격이 다른 두 조직을 동시에 상대해야 할 때가 있다. 우리 서비스는 장치를 제작·공급하는 **Provider(서비스 제공자)** 와, 그 장치를 처방·사용하는 **Clinic(병원)** 두 종류의 조직이 같은 백엔드를 쓴다. 둘은 보는 화면도, 할 수 있는 일도 다르다. 그런데 초기 설계에서는 이 두 포탈이 **같은 엔드포인트 경로와 같은 권한 모델을 공유**했고, 누가 어떤 포탈인지 가르는 일을 전적으로 메서드 레벨 `@RequirePermission` 에 맡기고 있었다.

이 글은 그 구조가 어떤 식으로 새기 시작했는지, 그리고 그걸 (1) **라우팅 엣지의 커스텀 `AuthorizationManager`** 와 (2) **부팅 시점 검증기** 두 축으로 어떻게 구조화했는지를 정리한다. Kotlin + Spring Security 6 기준이며, 멀티테넌트/멀티스테이크홀더 API에 일반화할 수 있는 템플릿으로 읽어도 좋다.

## 1. 문제: 인가가 코드 전반에 흩어져 있었다

원래 인가의 무게중심은 컨트롤러 메서드에 붙는 어노테이션 하나였다. 런타임에 이 어노테이션을 강제하는 건 AOP Aspect다.

```kotlin
@Aspect
@Component
class PermissionEnforcementAspect(
    private val permissionChecker: PermissionChecker,
) {

    @Before("@annotation(io.laonmedi.loms.common.core.authorization.annotation.RequirePermission)")
    fun enforce(joinPoint: JoinPoint) {
        val signature = joinPoint.signature as MethodSignature
        val annotation = signature.method.getAnnotation(RequirePermission::class.java) ?: return
        val memberId = SecurityContextUtils.getCurrentMemberIdOrNull()
            ?: throw SecurityPolicyForbiddenException(SecurityErrorCode.PERMISSION_DENIED)
        permissionChecker.checkAll(
            memberId = memberId,
            requiredPermissions = annotation.permissions.toSet(),
        )
    }
}
```

깔끔해 보이지만, 이 방식이 "유일한 방어선"일 때 세 가지 문제가 생긴다.

- **(a) 권한 체크가 코드 전반에 흩어진다.** 엔드포인트가 늘어날수록 인가 결정이 수십 개의 메서드에 분산되고, 전체 정책을 한눈에 볼 수 있는 지점이 사라진다.
- **(b) 한 곳이라도 빠뜨리면 그대로 보안 구멍이 된다.** `@RequirePermission` 을 깜빡한 컨트롤러 메서드는 그냥 인증만 통과하면 누구나 호출할 수 있다. 컴파일러는 이 누락을 잡아주지 않는다.
- **(c) 잘못된 포탈 접근을 라우팅 레벨에서 막을 방법이 없다.** Provider 전용 화면 API를 Clinic 유저가 호출하는 걸 구조적으로 차단할 수 없으니, 결국 핸들러나 서비스 안에 "이 사람 Provider 맞아?"를 확인하는 런타임 방어코드(우리는 이걸 "dashboard 가드"라 불렀다)가 곳곳에 자라났다. 같은 검사가 복붙되며 100줄 가까이 쌓였다.

핵심 통증은 (c)다. **조직 경계(포탈)** 라는, 본질적으로 라우팅에 속하는 정보를 비즈니스 로직 한가운데서 매번 손으로 확인하고 있었다.

## 2. 권한 모델부터 포탈로 쪼갠다

해결의 전제는 권한 자체를 포탈 단위로 정규화하는 것이다. `Permission` enum은 각 권한이 **어느 포탈에 속하는지**를 `portals` 필드로 들고 있다.

```kotlin
enum class Permission(
    val displayName: String,
    val description: String,
    val portals: Set<Portal>,
) {

    PROVIDER_PRESCRIPTION_DETAIL_VIEW(
        displayName = "처방 상세 조회",
        description = "개별 처방의 상세 정보·환자 정보 조회",
        portals = setOf(Portal.PROVIDER),
    ),
    CLINIC_PRESCRIPTION_DETAIL_VIEW(
        displayName = "처방 상세 조회",
        description = "개별 처방의 상세 정보·환자 정보 조회",
        portals = setOf(Portal.CLINIC),
    ),
    // ...
}
```

여기서 의도적으로 잡은 불변식이 하나 있다. **모든 권한은 정확히 하나의 포탈에만 속한다(`portals.size == 1`).** 그래서 "처방 상세 조회"처럼 두 포탈에 다 있는 개념도 `PROVIDER_PRESCRIPTION_DETAIL_VIEW` / `CLINIC_PRESCRIPTION_DETAIL_VIEW` 로 쪼개진다. 표시 이름이 같아도 권한은 별개다. 이 "권한 = 단일 포탈" 규칙이 뒤에 나올 부팅 검증기가 기댈 토대가 된다.

`Portal` 자체는 단순하다. 다만 "현재 요청자가 어느 포탈인지"를 판정하는 팩토리를 같이 둔다.

```kotlin
enum class Portal {
    PROVIDER,
    CLINIC,
    ;

    companion object {
        fun of(isServiceProvider: Boolean): Portal = if (isServiceProvider) PROVIDER else CLINIC
    }
}
```

## 3. 해결 1 — 엣지 포탈 인가 매처

경로 네임스페이스를 포탈별로 미러링한다. `/provider/**` 와 `/clinic/**` 두 prefix를 두고, 각 prefix에 **그 포탈만** 들어올 수 있게 라우팅 단계에서 못을 박는다. 이때 쓰는 게 Spring Security 6의 `AuthorizationManager<RequestAuthorizationContext>` 다.

```kotlin
class PortalAuthorizationManager(
    private val expectedPortal: Portal,
) : AuthorizationManager<RequestAuthorizationContext> {

    override fun authorize(
        authentication: Supplier<out Authentication?>,
        context: RequestAuthorizationContext,
    ): AuthorizationResult {
        val memberDetails = authentication.get()?.details as? AuthenticatedMemberDetails
            ?: return AuthorizationDecision(false)
        val providerContext = runCatching { ProviderRequestContextUtils.get(context.request) }.getOrNull()
            ?: return AuthorizationDecision(false)
        val isServiceProvider = providerContext.isServiceProvider(memberDetails.organizationId)
        return AuthorizationDecision(Portal.of(isServiceProvider) == expectedPortal)
    }
}
```

읽는 법은 이렇다.

- 인증 주체에서 `AuthenticatedMemberDetails` 를 꺼내고, 없으면 즉시 거부(`AuthorizationDecision(false)`).
- 앞단 필터가 요청 속성에 심어둔 `ProviderRequestContext` 를 꺼낸다. 이 컨텍스트가 없으면(예: 컨텍스트 세팅이 누락된 요청) 안전하게 거부한다. `runCatching { ... }.getOrNull()` 로 감싼 건, 컨텍스트 부재를 예외가 아니라 "거부"로 환원하기 위함이다.
- `providerContext.isServiceProvider(organizationId)` 로 요청자의 조직이 Provider인지 판정하고, 이를 `Portal.of(...)` 로 포탈로 환산해 **이 라우트가 기대하는 포탈(`expectedPortal`)과 일치하는지**만 본다.

이 매처를 `SecurityConfig` 에서 prefix별로 배선한다.

```kotlin
.authorizeHttpRequests {
    // ASYNC re-dispatch는 REQUEST dispatch에서 이미 인가를 통과한 경우에만 도달하므로 재평가하지 않는다.
    // (SSE 타임아웃 re-dispatch 시 SecurityContext 미복원으로 인한 AuthorizationDeniedException 방지 — LOMS-API-2R)
    it.dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll()
    it.requestMatchers(*SecurityPathConfiguration.PERMITTED_PATHS).permitAll()
    it.requestMatchers("/provider/**").access(PortalAuthorizationManager(Portal.PROVIDER))
    it.requestMatchers("/clinic/**").access(PortalAuthorizationManager(Portal.CLINIC))
    it.anyRequest().authenticated()
}
.exceptionHandling {
    it.accessDeniedHandler(portalAccessDeniedHandler)
}
```

핵심은 **순서**다. 포탈 검증은 `@RequirePermission` AOP가 돌기 **전에**, 즉 요청이 컨트롤러에 닿기도 전에 끝난다. 잘못된 포탈은 컨트롤러 코드 한 줄 실행하지 않고 라우팅 레벨에서 튕긴다. 덕분에 핸들러/서비스 안에 흩어져 있던 런타임 dashboard 가드(~100줄)를 통째로 지웠다.

거부 응답의 일관성도 신경 썼다. 엣지에서 거부되면 Spring Security는 `AccessDeniedException` 을 던지는데, 이걸 `PortalAccessDeniedHandler` 가 받아서 `@RequirePermission` 실패와 **완전히 동일한 403 JSON** 으로 변환한다.

```kotlin
class PortalAccessDeniedHandler(
    private val resolver: HandlerExceptionResolver,
) : AccessDeniedHandler {

    override fun handle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        accessDeniedException: AccessDeniedException,
    ) {
        resolver.resolveException(
            request,
            response,
            null,
            SecurityPolicyForbiddenException(SecurityErrorCode.PERMISSION_DENIED),
        )
    }
}
```

`HandlerExceptionResolver` 에 위임해 우리 애플리케이션의 표준 예외 핸들링 파이프라인을 그대로 타게 했다. 그래서 권한 부족이든 포탈 불일치든 클라이언트가 보는 건 같은 `PERMISSION_DENIED` 응답이다. 인가가 어느 레이어에서 막혔는지가 클라이언트 계약에 새어 나가지 않는다.

## 4. 해결 2 — 부팅 시점 검증기

엣지 매처가 "포탈 단위" 경계를 잡았다면, 남은 문제는 1절의 (b), 즉 **누락**이다. Kotlin/Spring에는 "이 컨트롤러 메서드에 인가 어노테이션이 없다"를 컴파일타임에 잡아줄 장치가 없다. 그래서 런타임 언어에서 할 수 있는 가장 빠른 대안 — **부팅 시점에 전수 검사하고, 누락이 있으면 부팅 자체를 실패시키기** — 를 택했다.

### 4-1. 모든 핸들러 매핑을 수집한다

먼저 `RequestMappingHandlerMapping` 으로 등록된 전체 핸들러를 훑어 매핑 정보를 모은다. `SmartInitializingSingleton` 이라 모든 빈 초기화가 끝난 시점에 한 번 돈다.

```kotlin
@Component
class PermissionMappingRegistry(
    private val requestMappingHandlerMapping: RequestMappingHandlerMapping,
    private val securityPathConfiguration: SecurityPathConfiguration,
) : SmartInitializingSingleton {

    private val mappings: MutableList<EndpointPermissionMapping> = mutableListOf()

    override fun afterSingletonsInstantiated() {
        requestMappingHandlerMapping.handlerMethods.forEach { (info, handler) ->
            val mappedPaths = info.pathPatternsCondition?.patternValues.orEmpty()
            val requirePermission = handler.getMethodAnnotation(RequirePermission::class.java)
            val requiredPermissions = requirePermission
                ?.permissions
                ?.toSet()
                ?: emptySet()
            val classAuthenticatedOnly =
                AnnotationUtils.findAnnotation(handler.beanType, AuthenticatedOnly::class.java) != null
            val methodAuthenticatedOnly = handler.hasMethodAnnotation(AuthenticatedOnly::class.java)
            val isAuthenticatedOnly = classAuthenticatedOnly || methodAuthenticatedOnly
            val isPermittedPath = mappedPaths.any { securityPathConfiguration.isPermittedPath(it) }

            mappings += EndpointPermissionMapping(
                handlerMethod = handler,
                mappedPaths = mappedPaths,
                requiredPermissions = requiredPermissions,
                isAuthenticatedOnly = isAuthenticatedOnly,
                isPermittedPath = isPermittedPath,
            )
        }
    }

    fun allMappings(): Collection<EndpointPermissionMapping> = mappings
}
```

각 엔드포인트가 가진 정보는 단순한 데이터 클래스로 들고 다닌다. 경로, 요구 권한 집합, `@AuthenticatedOnly` 여부, 그리고 로그인/헬스체크 같은 공개 경로(`isPermittedPath`) 여부다.

```kotlin
data class EndpointPermissionMapping(
    val handlerMethod: HandlerMethod,
    val mappedPaths: Set<String>,
    val requiredPermissions: Set<Permission>,
    val isAuthenticatedOnly: Boolean,
    val isPermittedPath: Boolean,
)
```

`@AuthenticatedOnly` 는 "권한 세분화는 필요 없고 로그인만 되어 있으면 되는" 엔드포인트를 위한 마커다. 클래스/메서드 양쪽에 붙을 수 있어서 둘 다 확인한다.

### 4-2. 두 가지를 검증한다

수집된 매핑을 들고, 또 다른 `SmartInitializingSingleton` 이 두 가지 불변식을 검사한다.

```kotlin
@Component
class PermissionAnnotationValidator(
    private val permissionMappingRegistry: PermissionMappingRegistry,
    private val environment: Environment,
) : SmartInitializingSingleton {

    private val logger = LoggerFactory.getLogger(javaClass)

    override fun afterSingletonsInstantiated() {
        validateAnnotationPresence()
        validatePortalAlignment()
    }

    // (A) 존재 검증
    private fun validateAnnotationPresence() {
        val missing = permissionMappingRegistry.allMappings()
            .filterNot { it.isPermittedPath }
            .filter { it.requiredPermissions.isEmpty() && !it.isAuthenticatedOnly }

        if (missing.isEmpty()) return

        val report = missing.joinToString("\n") { mapping ->
            "  - ${mapping.handlerMethod.shortLogMessage} (paths=${mapping.mappedPaths.joinToString()})"
        }

        if (isProdProfile()) {
            throw IllegalStateException(
                "Endpoints missing @RequirePermission or @AuthenticatedOnly:\n$report"
            )
        }

        logger.warn("Endpoints missing permission annotation:\n{}", report)
    }
    // ...
}
```

**(A) 존재 검증.** 공개 경로가 아닌 모든 엔드포인트는 `@RequirePermission(...)` 또는 `@AuthenticatedOnly` 중 **하나는 반드시** 가져야 한다. 둘 다 없으면 누락이다. 여기서 프로파일에 따라 처분이 갈린다.

- **prod 프로파일**: `IllegalStateException` 을 던져 **부팅을 실패**시킨다. 누락이 한 건이라도 있으면 그 빌드는 배포가 막힌다.
- **dev 등 그 외**: WARN 로그만 남기고 부팅은 계속한다. 개발 중에는 미완성 엔드포인트가 있을 수 있으니 막지 않되, 눈에는 띄게 한다.

이게 런타임 언어에서 "컴파일타임 비슷한" 안전장치다. 어노테이션을 깜빡한 컨트롤러가 운영에 올라가는 경로를 **배포 게이트에서 봉쇄**한다.

**(B) 포탈-권한 정합 검증.** `/provider` 경로에 실수로 `CLINIC_*` 권한을 붙이는 식의 어긋남을 잡는다.

```kotlin
private fun validatePortalAlignment() {
    val violations = permissionMappingRegistry.allMappings()
        .filter { it.requiredPermissions.isNotEmpty() }
        .mapNotNull { mapping ->
            val expectedPortal = inferPortal(mapping) ?: return@mapNotNull null
            val mismatched = mapping.requiredPermissions.filter {
                expectedPortal !in it.portals || it.portals.size != 1
            }
            if (mismatched.isEmpty()) {
                null
            } else {
                "  - ${mapping.handlerMethod.shortLogMessage} " +
                    "(paths=${mapping.mappedPaths.joinToString()}, expectedPortal=$expectedPortal, " +
                    "mismatched=${mismatched.joinToString { "${it.name}${it.portals}" }})"
            }
        }

    if (violations.isEmpty()) return
    // ... prod면 throw, 아니면 warn (A와 동일)
}

private fun inferPortal(mapping: EndpointPermissionMapping): Portal? = when {
    mapping.mappedPaths.any { it.startsWith(PROVIDER_PREFIX) } -> Portal.PROVIDER
    mapping.mappedPaths.any { it.startsWith(CLINIC_PREFIX) } -> Portal.CLINIC
    else -> null
}
```

검사 조건 `expectedPortal !in it.portals || it.portals.size != 1` 이 두 가지를 동시에 강제한다.

1. **경로에서 추론한 포탈(`expectedPortal`)이 권한의 `portals` 에 들어 있어야 한다.** `/provider` 경로인데 `CLINIC_MEMBER_LIST_VIEW`(portals=`[CLINIC]`) 가 붙어 있으면 위반이다.
2. **그 권한은 정확히 하나의 포탈만 가져야 한다(`size != 1`).** 2절에서 세운 "권한 = 단일 포탈" 불변식을 여기서 다시 보증한다.

주의할 점은 판정 기준이 **권한의 이름이 아니라 `portals` 필드**라는 것이다. 이름이 `CLINIC_` 으로 시작해도 `portals` 가 `[PROVIDER]` 라면 `/provider` 경로에서 통과한다. 이름은 사람 편의를 위한 라벨일 뿐, 진실의 원천은 데이터다.

### 4-3. 테스트로 굳힌 행동 명세

이 검증기는 부팅 흐름에 박혀 있어서 회귀가 무섭다. 그래서 행동을 테스트로 못 박았다(Kotest `DescribeSpec`). 예컨대 prod에서 누락이 있으면 예외 메시지에 그 핸들러가 찍히는지,

```kotlin
context("prod profile 이고 누락 endpoint 가 1개 이상") {
    it("IllegalStateException 을 던지며 메시지에 누락 endpoint 가 포함된다") {
        every { environment.activeProfiles } returns arrayOf("prod")
        every { permissionMappingRegistry.allMappings() } returns listOf(
            mapping("/missing"),
            mapping("/ok", requiredPermissions = setOf(Permission.PROVIDER_MEMBER_LIST_VIEW)),
        )

        val ex = shouldThrow<IllegalStateException> {
            validator.afterSingletonsInstantiated()
        }
        ex.message shouldContain "Handler#/missing"
        ex.message shouldContain "@RequirePermission"
    }
}
```

그리고 "이름은 `CLINIC_` 이지만 `portals` 가 `PROVIDER`" 인 경계 케이스가 이름이 아닌 `portals` 기준으로 통과하는지, dev 프로파일에서는 같은 위반이 예외 없이 WARN으로만 끝나는지까지 케이스로 고정했다. 검증기 자체가 보안 정책이므로, 검증기의 행동을 테스트로 고정해 두는 게 중요하다.

## 5. 트레이드오프와 곁다리 함정

설계의 진짜 이야기는 결정의 대가에 있다.

### 빅뱅 마이그레이션, 그리고 그걸 가능케 한 안전장치

이 전환은 점진 롤아웃이 아니라 **빅뱅**이었다. 엔드포인트 네임스페이스 전체를 한 번에 `/provider/**` · `/clinic/**` 로 복제하고, 권한도 `PROVIDER_X` / `CLINIC_X` 로 갈랐다. 부분 적용은 오히려 위험했다 — 절반만 포탈로 갈라진 상태가 가장 헷갈린다.

빅뱅을 감히 할 수 있었던 이유가 바로 4절의 부팅 검증기다. 수백 개 엔드포인트를 손으로 옮기면서 어딘가 어노테이션을 빠뜨리거나 포탈을 잘못 붙이는 건 거의 필연인데, 그 실수가 **운영에 도달하기 전 배포 시점에 부팅 실패로 잡힌다.** 검증기가 빅뱅의 안전벨트였다.

### 세분화 권한을 포탈 레벨로 "다운그레이드"

리팩터 도중, 처방 담당자 배정 같은 일부 엔드포인트는 사실 "특정 권한"이 아니라 "아무 Provider 유저나 하면 되는" 동작이라는 게 드러났다. 이런 곳은 굳이 전용 `Permission` 을 만들지 않고 `@RequirePermission` 을 `@AuthenticatedOnly` 로 **낮췄다**. 포탈 경계는 엣지 매처가 이미 보장하니, 그 안에서는 로그인 여부만 보면 충분했다.

교훈: **권한 세분화는 비즈니스 로직에 맞춰야 한다.** 무조건 최대한 잘게 쪼개는 게 정답이 아니다. 의미 없는 세분화는 그 자체로 유지보수 부채다.

### 엔드포인트 통합 ≠ 데이터 격리 포기

반대 방향의 결정도 있었다. 포탈마다 경로를 나누는 게 기본이지만, 로직이 거의 같은 일부는 공통 엔드포인트로 합치고 핸들러 안에서 `auth.portal` 로 분기했다. 단, 여기서 **IDOR 방지(특히 Clinic 스코프)는 그대로 유지**했다. 같은 엔드포인트를 쓴다고 데이터 격리까지 한 바구니에 담는 게 아니다. "라우팅 통합"과 "조회 스코프 격리"는 별개의 결정이고, 후자는 어떤 경우에도 포기하지 않는다.

### SSE async re-dispatch 함정

마지막은 곁다리 함정이다. 우리는 SSE를 쓰는데, 서블릿 비동기 요청은 타임아웃 등으로 **ASYNC dispatch로 다시 한 번** 시큐리티 필터 체인을 탈 수 있다. 이때 `SecurityContext` 가 복원되지 않은 상태로 인가가 재평가되면, 이미 정상 인증된 요청이 `AuthorizationDeniedException` 으로 **false-deny** 나는 일이 생긴다.

해결은 1줄이다. REQUEST dispatch에서 이미 인가를 통과해야만 ASYNC dispatch에 도달할 수 있으니, ASYNC는 재평가하지 않는다.

```kotlin
// ASYNC re-dispatch는 REQUEST dispatch에서 이미 인가를 통과한 경우에만 도달하므로 재평가하지 않는다.
// (SSE 타임아웃 re-dispatch 시 SecurityContext 미복원으로 인한 AuthorizationDeniedException 방지)
it.dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll()
```

커스텀 `AuthorizationManager` 를 쓰면 모든 dispatch 타입에서 호출될 수 있다는 점을 잊기 쉽다. 비동기 엔드포인트가 있다면 반드시 같이 점검해야 한다.

## 6. 마무리

핵심을 한 문장으로 줄이면 이렇다. **조직 경계를 "런타임에 매번 체크"하지 말고, "라우팅에서 구조적으로 보장하고 + 부팅에서 누락을 강제하라."**

- **엣지 매처(`PortalAuthorizationManager`)** 가 포탈 경계를 라우팅 레벨에서 못 박아, 흩어진 런타임 가드를 없앤다.
- **부팅 검증기(`PermissionAnnotationValidator`)** 가 어노테이션 누락과 포탈-권한 불일치를 배포 시점에 잡아, 빅뱅 마이그레이션마저 안전하게 만든다.
- **세분화 권한 vs 포탈 인증, 엔드포인트 통합 vs 데이터 격리** 는 케이스별로 저울질하되, 데이터 격리만큼은 양보하지 않는다.

`AuthorizationManager<RequestAuthorizationContext>` 와 `SmartInitializingSingleton` 이 두 패턴은 Spring Security 6를 쓰는 멀티테넌트/멀티스테이크홀더 API라면 거의 그대로 가져다 쓸 수 있는 보안 템플릿이다.
