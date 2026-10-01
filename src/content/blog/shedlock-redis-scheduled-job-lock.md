---
title: "ECS 멀티 인스턴스 환경 스케줄링 작업 구현 방식 검토 ShedLock Redis 선택"
description: "ECS task 여러 개로 운영 중인 Spring Boot 서비스에 신규 정기 작업을 추가하면서, 6가지 구현 방식을 비교해 ShedLock + Redis를 고른 근거와 적용·검증 과정을 정리합니다."
pubDate: "2026-10-01T14:57:47+09:00"
category: "Spring"
tags: ["spring", "shedlock", "redis", "scheduling", "distributed-lock", "ecs", "kotlin"]
---
운영 중인 Spring Boot 서비스에 매일 새벽 도는 동기화 작업을 새로 붙여야 했다. 당장 필요한 잡은 2개이고, 이후로도 정기 작업이 계속 늘어날 예정이다.

문제는 이 서비스가 ECS task 2개로 떠 있다는 점이다. `@Scheduled`는 JVM 하나 안의 스케줄러일 뿐이라, 그대로 붙이면 인스턴스 수만큼 잡이 돈다. 롤링 배포(minHealthy 100 / max 200) 중에는 이전 task와 새 task가 함께 떠 있어서 최대 4중으로 돈다.

그래서 잡을 작성하기 전에 "멀티 인스턴스 환경에서 정기 작업을 어떻게 돌릴 것인가"를 먼저 검토했다. 결론은 ShedLock + Redis provider다. 이 글은 그 결론에 이르기까지 무엇을 비교했고 무엇을 버렸는지, 그리고 적용하면서 확인한 함정을 정리한 기록이다.

---

## 1. 요구사항과 제약

검토 기준을 먼저 고정했다.

요구사항

- 잡은 정해진 시각에 **회차당 한 인스턴스에서만** 실행된다.
- 잡이 늘어날 때마다 땜질하지 않도록, 잡 단위로 재사용할 수 있는 공통 구조여야 한다.
- 실행 이력을 한 곳에서 추적할 수 있어야 한다. 한 회차를 여러 task가 나눠 처리하는 구조는 피한다.

제약

- ECS 서비스 1개, task 2개. 롤링 배포 중 최대 4개.
- 인프라 코드(IaC)가 없다. ECS 서비스·태스크 정의·알람을 추가하면 dev/prod 두 벌을 손으로 관리해야 한다.
- Redis와 RDB는 이미 운영 중이다. 새 인프라는 가능한 한 늘리지 않는다.
- 당장 대상 잡은 멱등이고, 실행 시간은 로컬 실측 약 0.7초다.

---

## 2. 문제 분해: 트리거 1회 ≠ 부수효과 1회

선택지를 비교하기 전에 문제를 쪼갰다. "잡이 한 번만 실행되게 하라"는 요구에는 사실 서로 다른 질문 세 개가 섞여 있다.

| 층 | 질문 | 수단 |
|---|---|---|
| 정확성 | 같은 대상을 한 번만 처리하나 | 행 단위 선점(`FOR UPDATE SKIP LOCKED`, 조건부 UPDATE), 멱등키 |
| 트리거 단일화 | 누가 발화하나 | ShedLock, Quartz 클러스터, advisory lock |
| 실행 위치 | 어디서 도나 | API task 안, 배치 전용 서비스, 일회성 task |

핵심은 **트리거를 한 번으로 만들어도 부수효과가 정확히 한 번이 되지는 않는다**는 점이다. 롤링 배포 겹침, 락 만료 후 재실행, 저장소 failover, at-least-once 전달… 어떤 스케줄러를 써도 어딘가에서 샌다. 외부 발송을 "정확히 1회" 보장해주는 스케줄러는 없다.

그래서 이번 결정의 범위를 트리거 단일화 층으로 한정했다. 정확성은 잡 자체의 멱등성이 책임지고, 실행 위치는 당분간 API task 안에 둔다. 이 구분이 아래 모든 판단의 기준이 된다.

---

## 3. 검토한 선택지 6가지

비용은 운영 환경 1개 기준, 기존 인프라에 더해지는 월 금액 추정이다.

| 선택지 | 추가 비용/월 | 판단 |
|---|---|---|
| A. `@Scheduled` + DB 행 선점 | ≈ $0.01 | 탈락. 아래 별도 설명 |
| **B. `@Scheduled` + ShedLock** | ≈ $0 | **채택** |
| C. 같은 이미지로 배치 전용 ECS 서비스 | $20 ~ $83 | 탈락. IaC가 없어 서비스·태스크 정의·알람을 dev/prod 두 벌 수동 관리. desired 1이어도 배포 중엔 2개가 뜨고, 겹침을 없애려 min0으로 두면 공백 동안 cron이 누락된다 |
| D. 별도 Spring Batch 서버 | C + 메타테이블 | 탈락. Spring Batch는 스케줄러가 아니라 트리거가 따로 필요하다. `BATCH_*` 테이블 관리, API와 동시 배포, 빈 스캔 분리까지 공수가 가장 크다 |
| E. EventBridge Scheduler → RunTask | 일 1회 잡 ≈ $0.7 | 탈락. at-least-once 전달, 매 틱 JVM 콜드스타트와 이미지 풀. IaC가 선결 조건이다 |
| F. Quartz JDBC 클러스터 | ≈ $0.2 ~ 0.9 | 탈락. 아래 별도 설명 |

C·D·E는 "실행 위치"를 API task 밖으로 빼는 안이다. 장기적으로는 맞는 방향일 수 있지만, IaC 없이 배포 단위를 늘리는 비용이 지금 잡 규모에 비해 크다. 남는 건 API task 안에서 트리거를 하나로 만드는 A·B·F다.

### 왜 DB 행 선점(A)이 아닌가

처음에는 행 선점을 "어떤 선택지든 필수인 기반"으로 봤다. `FOR UPDATE SKIP LOCKED`로 집으면 배포 중 4개 task가 동시에 돌아도 서로 다른 행을 가져가니, 겹침이 오히려 처리량이 된다. 그래도 최종적으로는 잡을 한 번에 하나만 실행하는 쪽을 골랐다.

- **행이 없는 잡에는 선점이 통하지 않는다.** 이번 대상이 바로 전체 스캔으로 담당자를 맞추는 동기화 잡이다. 집을 "행"이 없으니 N중 실행이 그대로 남는다. 잡이 늘면 결국 advisory lock과 lease를 직접 만들게 되고, 그건 ShedLock을 재발명하는 일이다.
- **실행자가 여럿이면 운영 추적이 어렵다.** 같은 회차를 여러 task가 나눠 처리하면 "이번 실행에서 무슨 일이 있었나"를 보려고 task별 로그를 이어 붙여야 한다. 요구사항의 "실행 이력을 한 곳에서"와 충돌한다.

행 선점은 버린 게 아니라 필요한 곳에서만 쓴다. 외부 발송처럼 비멱등인 잡이 들어오면 그 잡 안에서 다시 꺼낸다.

### 왜 Quartz(F)가 아닌가

Quartz와 Spring Batch는 자주 함께 쓰여서 헷갈리지만 서로 다른 층의 도구다. Quartz는 "언제 실행하나"를 담당하는 스케줄러이고, JDBC JobStore로 클러스터를 구성하면 노드 여러 개 중 한 곳에서만 트리거가 발화한다. 즉 ShedLock과 **같은 문제를 푸는 직접 경쟁안**이다. Spring Batch는 "어떻게 처리하나"(청크, 재시작, 실행 이력)를 담당하고 스케줄러가 아니다.

Boot 공식 자동 구성(`spring-boot-starter-quartz`)도 있고 misfire 복구, 동적 스케줄, `@DisallowConcurrentExecution` 같은 기능도 강력하다. 그래도 고르지 않았다.

- **잡 규모 대비 과하다.** `QRTZ_*` 테이블 약 11개를 마이그레이션으로 관리해야 하고, 잡마다 `JobDetail`/`Trigger` 보일러플레이트가 생긴다. 잡 2개에 붙이기엔 무겁다.
- **잡 작성 방식이 `@Scheduled`와 달라진다.** ShedLock은 일반 `@Scheduled` 메서드에 애노테이션 하나만 얹는다. 팀이 이미 익숙한 방식을 유지할 수 있다.
- **필요하면 나중에 붙인다.** misfire 복구나 동적 스케줄이 필요한 잡이 생기면 그때 트리거로 Quartz를 도입해도 늦지 않다.

### ShedLock이 보장하는 것과 보장하지 않는 것

ShedLock은 분산 스케줄러가 아니다. "같은 시각에 여러 인스턴스가 깨어나도 락을 잡은 하나만 본문을 실행하고 나머지는 건너뛴다"만 보장한다. 2장의 구분으로 말하면 트리거 단일화 층만 책임진다. 이번 요구사항에는 정확히 그만큼이 필요했다.

---

## 4. 락 저장소: 왜 JDBC가 아니라 Redis인가

ShedLock은 저장소를 고를 수 있다. 비교 검토에서는 오히려 **JDBC provider를 우선 추천**했다.

| 기준 | Redis provider | JDBC provider (`usingDbTime()`) |
|---|---|---|
| 스키마 | 없음 | `shedlock` 테이블 1개 |
| failover 시 락 | 비동기 복제라 짧은 창에서 유실 가능 | 커밋된 행이라 보존 |
| 시계 기준 | TTL은 Redis, cron 발화는 각 노드 시계 | DB 서버 시계 하나 |
| 장애 영역 | Redis 장애 = 잡 미실행 (새로 추가) | DB 장애면 잡도 어차피 실패 (추가 없음) |
| 테스트(H2) | 대체 LockProvider 필요 | 그대로 동작 |
| 커넥션 | 커넥션 풀 미사용 | 잡 시작·종료 시 짧게 사용 |

표만 보면 JDBC가 낫다. 그래도 Redis를 골랐다.

> JDBC가 failover에 더 강하다. 다만 대상 잡이 멱등이고 1초 이내라 락 유실은 무해하고, 운영 중인 Redis를 재사용할 수 있다. 비멱등 잡을 올릴 때 저장소를 다시 판단한다.

JDBC의 장점은 대부분 "락이 유실되면 안 되는 상황"에서 의미가 있다. 이번 대상 잡은 멱등이고 실행 시간이 약 0.7초라, failover 순간에 락이 유실돼 두 번 돌아도 결과가 같다. 그렇다면 테이블과 마이그레이션을 추가하지 않고 이미 운영 중인 Redis를 쓰는 편이 싸다. H2 테스트 문제도 실제로는 영향이 없었다. 애플리케이션 전체 컨텍스트를 띄우는 테스트가 없어서, 스케줄링 설정이 테스트에서 Redis를 요구하지 않았다.

대신 이 결정에는 **유효기간**이 있다. 알림 발송처럼 두 번 실행되면 안 되는 잡이 들어오는 시점에 저장소를 다시 판단하기로 했다.

받아들인 결과도 명시해 두었다.

- **Redis 장애 시 잡을 실행하지 않는다(fail-closed).** 락 획득이 실패하면 스케줄러가 로그를 남기고 그 회차를 건너뛴다. 중복 실행이 아니라 미실행으로 끝나고, 다음 회차가 따라잡는다.
- **dev와 prod가 같은 캐시를 쓴다.** 그래서 키에 환경을 넣었다. SSE 채널·캐시 키에 이미 쓰던 profile prefix 관례를 그대로 따랐다.

---

## 5. 구성

### 의존성

버전은 `gradle.properties` 한 곳에서 관리한다.

```kotlin
// 애플리케이션 엔트리포인트 모듈
implementation("org.springframework.boot:spring-boot-starter-data-redis")
implementation("net.javacrumbs.shedlock:shedlock-spring:$shedlockVersion")
implementation("net.javacrumbs.shedlock:shedlock-provider-redis-spring:$shedlockVersion")

// 잡이 있는 도메인 모듈 (애노테이션만 필요)
implementation("net.javacrumbs.shedlock:shedlock-spring:$shedlockVersion")
```

도메인 모듈은 `@SchedulerLock` 애노테이션만 알면 되고, Redis provider는 엔트리포인트 모듈에만 둔다. "활성화는 부트 모듈, 애노테이션 의존은 사용 모듈"이라는, 이미 `@EnableRetry`에서 쓰던 형태다.

엔트리포인트 모듈에 `spring-boot-starter-data-redis`를 직접 넣은 이유도 있다. Redis 설정은 다른 모듈에 있었지만 `implementation`으로만 받고 있어서, 엔트리포인트 모듈의 컴파일 클래스패스에는 `RedisConnectionFactory`가 없었다.

ShedLock 7.10.1은 Spring Boot 4.1.x로 빌드됐고 프로젝트는 Boot 4.0.1이다. 메이저가 같아 호환 매트릭스상 문제는 없지만, 마이너 차이는 빌드와 로컬 부팅으로 확인했다.

### SchedulingConfig: 설정은 한 곳에

```kotlin
@Configuration
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
class SchedulingConfig(
    @Value("\${spring.profiles.active}") private val activeProfile: String,
) {

    @Bean
    fun lockProvider(connectionFactory: RedisConnectionFactory): LockProvider =
        RedisLockProvider.Builder(connectionFactory)
            .environment(activeProfile)
            .build()
}
```

- `environment(activeProfile)`: Redis 키가 `job-lock:{profile}:{lockName}` 형태가 된다. dev와 prod가 같은 Redis를 바라봐도 락이 섞이지 않는다.
- **구성하면서 발견한 숨은 결합**: 다른 모듈(SSE용 Redis 설정 클래스)에 `@EnableScheduling`이 숨어 있었다. 기존 heartbeat 잡이 돌던 건 순전히 그 설정 덕이었고, 새 잡도 그대로 두면 같은 우연에 기대게 된다. SSE 설정을 정리하는 순간 스케줄링 전체가 조용히 멈출 구조였다. 그쪽 `@EnableScheduling`을 지우고 `SchedulingConfig` 한 곳으로 모았다. 저장소를 바꿀 때도 이 파일만 고치면 된다.

### 잡에 락 적용

```kotlin
@Scheduled(cron = "0 0 5 * * *", zone = "Asia/Seoul")
@SchedulerLock(
    name = "order.manager-reconciliation",
    lockAtMostFor = "PT10M",
    lockAtLeastFor = "PT30S",
)
fun reconcileManagers() {
    LockAssert.assertLocked()
    // ...
}
```

- **`lockAtMostFor = 10m`**: 락을 잡은 인스턴스가 죽어도 최대 10분 뒤엔 락이 풀린다. 데드락 방지용 상한이다. 실측 실행 시간 0.7초에 비해 넉넉하다.
- **`lockAtLeastFor = 30s`**: 잡이 5ms 만에 끝나도 락은 최소 30초 유지된다. 이게 없으면 인스턴스 간 시계 오차나 트리거 지연으로 B가 조금 늦게 깨어났을 때, A가 이미 끝내고 락을 푼 뒤라 B가 같은 회차를 순차로 한 번 더 실행할 수 있다.
- **`LockAssert.assertLocked()`**: ShedLock은 기본 모드(`PROXY_METHOD`)에서 AOP 프록시로 동작한다. 같은 클래스 안에서 호출(self-invocation)하거나 프록시가 안 걸리면 락 없이 **조용히** 실행된다. Kotlin은 클래스가 기본 `final`이라 CGLIB 프록시가 걸리지 않는 함정도 있다(`kotlin-spring` 플러그인이 `@Component` 클래스를 `open`으로 바꿔 줘서 이 프로젝트에서는 동작한다). 본문 첫 줄에서 단언해 두면 이런 경우 예외가 나서 바로 드러난다.

### 락을 걸면 안 되는 잡

기존 SSE heartbeat 잡은 각 인스턴스가 자기에게 붙은 연결에 핑을 보낸다. 이런 인스턴스 로컬 잡에 락을 걸면 한 인스턴스만 heartbeat를 보내고 나머지 연결은 끊긴다. "모든 `@Scheduled`에 락"이 아니라 "**클러스터에서 한 번만 돌아야 하는 잡**에만 락"이다.

### 스케줄러 스레드와 graceful shutdown

```yaml
spring:
  lifecycle:
    timeout-per-shutdown-phase: 20s
  task:
    scheduling:
      pool:
        size: 3
      shutdown:
        await-termination: true
        await-termination-period: 5s
```

- **`pool.size: 3`**: 기본 스케줄러 풀은 스레드 1개였고, 25초마다 도는 heartbeat가 이미 그 하나를 쓰고 있었다. 배치 잡을 같은 스레드에 올리면 배치가 오래 걸릴 때 heartbeat가 밀려 SSE 연결이 끊길 수 있다. 참고로 virtual thread를 켜면 Boot가 다른 스케줄러 구현을 쓰기 때문에 이 설정이 적용되지 않는다. 이 프로젝트는 virtual thread를 쓰지 않는다.
- **`await-termination`**: 기본값(`false`)이면 SIGTERM을 받았을 때 스케줄러가 실행 중인 잡을 기다리지 않는다. 컨텍스트가 닫히면서 DataSource도 닫혀 잡이 중간에 끊긴다.
- **숫자의 근거**: ECS는 SIGTERM 후 `stopTimeout`(기본 30초)이 지나면 SIGKILL을 보낸다. 웹 graceful 20초 + 스케줄러 대기 5초 = 25초로 그 안에 들어오게 맞췄다. 그래도 SIGKILL로 락이 남으면 `lockAtMostFor`(10분)까지 다음 실행이 미뤄질 뿐, 중복 실행은 아니다.

---

## 6. 로컬 검증에서 걸린 것: `safeUpdate(true)`와 Redis ACL

처음 계획은 `safeUpdate(true)`였다. 비교 검토 단계에서는 "필수로 켠다"고까지 적어 두었다. 기본 해제는 소유자 확인 없이 키를 지우거나(`DEL`) 만료 시간을 바꾸는데(`SET XX PX`), `safeUpdate`는 내가 잡은 락인지 확인한 뒤에 해제한다. 잡이 `lockAtMostFor`를 넘겨 락이 만료되고 다른 인스턴스가 새 락을 잡은 상황에서, 늦게 끝난 원래 인스턴스가 남의 락을 지우는 사고를 막아준다.

그런데 로컬에서 돌려보니 잡이 끝나도 락이 풀리지 않고 10분간 남아 있었다.

```text
NOPERM this user has no permissions to run the 'evalsha' command
```

`safeUpdate`는 소유자 확인과 해제를 원자적으로 하려고 **Lua 스크립트(`EVALSHA`)** 를 쓴다. 그런데 사용 중인 Redis ACL 사용자에게 스크립트 실행 권한이 없어서 unlock이 실패한 것이었다. 해제에 실패한 키는 획득 시점의 TTL(`lockAtMostFor` 10분)을 그대로 안고 남는다. 문서만 봐서는 알 수 없었고, 어떤 명령을 쓰는지는 7.10.1 바이트코드를 열어 확인했다.

구조상 실패 시점도 고약하다. ShedLock은 본문을 다 실행한 뒤 `finally`에서 unlock을 호출하므로, 예외는 처리가 끝난 다음에 난다. 에러 로그만 보면 잡이 실패한 것 같지만 실제 처리는 이미 끝난 상태일 수 있다.

선택지는 ACL 권한을 넓히거나, 기본값(`false`)을 쓰는 것이었다. Redis ACL 설정에 의존하는 구조를 만들지 않으려고 기본값을 택했다. 대신 `safeUpdate`가 막아주던 위험은 운영 규칙으로 막았다. 실행 시간이 `lockAtMostFor`의 절반을 넘지 않게 유지하면 "실행 중 락 만료 → 남의 락 삭제" 시나리오 자체가 생기지 않는다. 지금은 0.7초 대 10분이다.

> 교훈: 라이브러리 옵션 하나가 내부적으로 어떤 Redis 명령을 쓰는지 모르면, 권한 모델이 다른 환경에서 조용히 깨진다. 옵션을 끄거나 켤 때는 그 옵션이 쓰는 명령과 운영 Redis 사용자의 권한을 같이 확인해야 한다.

---

## 7. 롤링 배포에서 생기는 일

락은 "같은 시각에 두 곳에서 동시에"만 막는다. 이전 버전과 새 버전이 함께 떠 있는 롤링 배포 동안에는 따로 챙겨야 할 경우가 있다.

| 상황 | 결과 | 대응 |
|---|---|---|
| 이전·새 task가 같은 cron 시각에 동시 발화 | 한쪽만 락을 얻는다 | 없음. ShedLock 기본 동작 |
| 락 이름을 바꾸는 배포 | 이전·새 버전이 서로 다른 락을 잡아 동시 실행 | 락 이름은 영구 고정 |
| 잡 실행 중 SIGKILL | 락이 남아 `lockAtMostFor`까지 다음 실행이 지연 | 지연일 뿐 중복은 아님. `lockAtMostFor`를 과하게 길게 잡지 않는다 |
| 새 task가 먼저 마이그레이션, 락은 이전 task가 가져감 | 이전 코드가 새 스키마에서 잡을 실행 | expand → contract. 잡이 쓰는 컬럼은 한 배포 안에서 지우지 않는다 |

---

## 8. 잡을 작성할 때 지킬 규칙

락만 걸었다고 끝이 아니다. ShedLock은 "동시에 한 번"을 보장할 뿐, "정확히 한 번"을 보장하지 않는다. 그래서 팀 문서에 아래 규칙을 남겼다.

1. **처리 끝난 대상은 조회 조건에서 빠지게 만든다.** 락 만료 후 재실행이나 순차 재실행이 일어나도 두 번째 실행의 대상이 0건이 되도록, 잡 자체를 상태 수렴형(멱등)으로 짠다.
2. **락 이름은 바꾸지 않는다.** 이름을 바꾸면 롤링 배포 중 구버전과 신버전이 서로 다른 락을 잡아 중복 실행된다. 이름 규칙은 `{module}.{job}` kebab-case.
3. **실행 시간은 `lockAtMostFor`의 절반 이하.** 넘으면 실행 중에 락이 풀린다. `safeUpdate`를 끈 대가이기도 하다.
4. **인스턴스 로컬 잡에는 락을 걸지 않는다.** heartbeat처럼 각 인스턴스가 해야 하는 일은 그대로 둔다.

---

## 9. 검증

- 로컬에서 인스턴스 2개(8080/8081)를 띄우고 cron을 임시로 매분으로 바꿔 확인했다(임시 cron은 커밋하지 않았다). 4회차 동안 매번 한쪽만 본문을 실행했고 에러는 없었다.
- Redis 키가 `job-lock:local:*` 형태로 생기는 것을 확인했다.
- 아직 확인하지 않은 것: 배포 후 dev(2 task)에서의 단일 실행, `job-lock:dev:*` / `job-lock:prod:*` 분리, 운영 Redis 사용자의 `SET`/`DEL`/`PEXPIRE` 권한. 확인되면 이 글에 덧붙일 예정이다.

---

## 10. 정리

- 멀티 인스턴스에서 `@Scheduled`는 인스턴스 수만큼 돈다. 롤링 배포 중에는 그보다 더 돈다.
- "한 번만 실행"은 정확성 / 트리거 단일화 / 실행 위치 세 층으로 나눠서 판단한다. ShedLock은 트리거 단일화 층만 책임진다.
- IaC가 없으면 실행 위치를 API 밖으로 빼는 안(전용 서비스, EventBridge)은 비용이 크다. 행이 없는 잡에는 행 선점이 통하지 않고, 잡 규모가 작으면 Quartz는 과하다.
- 락 저장소는 "락이 유실되면 실제로 해가 되나"로 고른다. 멱등이고 짧은 잡이면 Redis로 충분하고, 비멱등 잡이 들어오면 다시 판단한다.
- `lockAtLeastFor`와 `LockAssert`는 사실상 필수다.
- `safeUpdate` 같은 옵션은 내부 구현(Lua)과 인프라 권한(ACL)이 맞물린다. 끄기로 했다면 그 위험을 규칙으로 메꾼다.

다음 단계로는 잡 실행 지표와 미실행 알람을 붙일 예정이다. 이번에 지표를 미룬 이유가 두 가지 있다. Spring 기본 지표(`tasks.scheduled.execution`)는 락을 못 얻어 건너뛴 실행도 성공으로 기록해서, 한 task가 실패하고 다른 task가 건너뛰면 실패가 가려진다. 그리고 CloudWatch 무료 custom metric이 10개뿐이라, 락 이름 수만큼 늘어나는 ShedLock 지표는 export 범위와 비용을 먼저 정해야 했다. 지금은 Redis 장애로 "아무도 실행하지 않은" 회차가 생겨도 알 방법이 없다.

관련 글: [Spring Batch Quartz 표현식 (Cron 문법) 정리](../spring-batch-quartz-cron-expression/), DB 행 단위 락은 [JPA Pessimistic Lock 으로 동시성 재고 처리](../jpa-pessimistic-lock/)에서 다뤘다.
