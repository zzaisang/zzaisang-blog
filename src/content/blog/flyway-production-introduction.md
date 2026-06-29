---
title: "운영 DB에 Flyway 처음 도입하기 — 멘탈 모델부터 함정까지"
description: "feature flag로 코드는 선택 배포하면서 DB는 단일 경로로 전 환경에 전진시키는 이유와, 도입하며 실제로 부딪힌 Flyway 함정들을 정리합니다."
pubDate: "2026-06-29T10:10:43+09:00"
category: "Database"
tags: ["flyway", "postgresql", "migration", "spring-boot", "expand-contract"]
---
DB 마이그레이션 도구가 0개인 서비스에 운영(prod) 환경을 붙이려다 막혔다. 코드는 feature flag로 "원하는 것만" 켜고 끄는데, 막상 DB 스키마는 어떻게 "원하는 것만" 배포할지 답이 안 나왔다. 결론부터 말하면 그 질문 자체가 잘못된 전제 위에 서 있었다. 이 글은 그 멘탈 모델을 바로잡는 과정과, Flyway를 실제로 붙이며 부딪힌 함정들을 정리한 기록이다.

대상 독자는 "Flyway 이름은 들어봤고 `V1__...sql`이 뭔지는 아는데, 운영에 처음 도입하려니 무엇을 조심해야 할지 모르겠는" 중급 백엔드 개발자다.

---

## 1. 출발점이 된 의문 — "DB는 왜 선택 배포가 안 되지?"

우리는 단일 trunk/단일 빌드 전략을 쓴다. 그래서 운영에 미완성 코드를 올려두되 **feature flag로 특정 코드 경로만 활성화**한다. 배포(deploy)와 릴리스(release)를 분리하는 흔한 방식이다.

문제는 DB였다. 마이그레이션은 단일 경로(`classpath:db/migration`)에 모여 있고, Flyway는 부팅할 때마다 **pending 마이그레이션을 버전 순으로 전부** 적용한다. 그래서 이런 우려가 나왔다.

> "flag로 *특정 코드만* prod에 배포하려는데, DB는 단일 경로의 마이그레이션을 **전부** 적용한다. 그러면 '원하는 대상만 운영에 배포'가 DB에선 불가능한 것 아닌가? 게다가 Flyway Community는 `undo`가 없어 롤백을 forward로만 해야 한다. 이걸 어떻게 극복하나?"

답은 "극복"이 아니라 **전제를 바로잡는 것**이었다.

### DB는 코드처럼 "선택 배포"하는 대상이 아니다

DB는 **단일 공유 가변 상태(single shared mutable state)** 다. 롤링 배포 중에는 구버전 task, 신버전 task, flag-on 코드, flag-off 코드가 **같은 테이블 하나**를 동시에 읽고 쓴다. 어떤 순간에도 물리 스키마는 하나뿐이다. 그러니 스키마를 기능별로 분기하거나 환경별로 골라 배포할 수 없고, 그렇게 해서도 안 된다.

여기서 글 전체를 관통하는 한 문장이 나온다.

> **선택성은 DB가 아니라 코드(flag)에서 얻는다. flag는 코드 경로를 감싼다 — 데이터베이스가 아니라.**

마이그레이션은 전 환경(local/dev/stage/prod)에 **동일하게**, 하위호환(additive)으로 전진시킨다. 대신 새 컬럼·테이블을 아직 아무 코드도 건드리지 않으면 그 스키마는 **inert(불활성)** 하게 남는다. flag로 잠든(dormant) 코드가 깨어나는 순간 비로소 그 스키마가 쓰인다. "배포됐지만 켜지지 않은" 상태를 코드가 아니라 스키마에도 적용하는 셈이다.

이 원칙을 받아들이면 나머지 결정이 줄줄이 따라온다.

| 결정 | 내용 |
|---|---|
| 스키마는 선택 배포하지 않는다 | 단일 마이그레이션 경로를 전 환경에 동일하게 전진 |
| 선택성은 코드에서 | feature flag는 코드 경로만 게이팅, 스키마는 못 끈다 |
| 스키마-코드를 한 배포에 묶지 않는다 | 추가(ADD)는 스키마 먼저, 제거/이름변경(REMOVE/RENAME)은 코드 먼저 |
| 운영 롤백은 forward-only | down 스크립트 없이 앞으로 고치는 새 마이그레이션으로 |

> 환경별 마이그레이션 폴더로 prod에서 스키마를 빼두거나, Flyway `target`으로 특정 버전에서 hold-back 하는 방법도 있다. 둘 다 **기각**했다. 환경 간 스키마가 갈라지는 "schema drift" 안티패턴이라, prod가 하위 환경에서 검증되지 않은 상태가 되기 때문이다. 환경별 *값* 차이는 placeholders/callbacks로(스키마가 아니라 값만) 다룬다.

---

## 2. 도구 구성 — Flyway + Hibernate validate

도구는 둘로 나뉜다. 역할을 섞지 않는 게 핵심이다.

- **Flyway(Community) = 스키마 변경.** `V<n>__<설명>.sql` 파일을 버전 순으로 한 번씩 실행하고, 무엇을 실행했는지 `flyway_schema_history` 테이블에 체크섬과 함께 기록한다.
- **Hibernate `ddl-auto=validate` = 검증만.** 스키마를 절대 생성·변경하지 않는다. 엔티티가 기대하는 컬럼이 실제 DB에 있는지만 보고, 어긋나면 부팅을 실패시킨다(fail-fast).

`validate`의 성질 하나가 전체 전략을 떠받친다. **이 검증은 단방향이다.** 엔티티 → DB 방향(엔티티가 기대하는 게 DB에 있나)만 보고, **매핑되지 않은 추가 컬럼은 무시한다.** 그래서 expand 단계에서 먼저 추가해 둔 inert 컬럼은, 아직 그 컬럼을 모르는 구버전 task의 부팅을 깨지 않는다. "스키마 먼저, 코드 나중"이 안전한 이유가 바로 이 단방향성이다.

### 부팅 시 순서

```text
1) DataSource 연결
2) Flyway 실행
     - history 없고 스키마 비어있음  → V1부터 전부 실행
     - history 없고 스키마 차있음    → baseline-version(=1)로 마킹 후 V2부터 실행
     - history 있음                 → 아직 기록 안 된 버전만 순서대로 실행
3) Hibernate ddl-auto=validate (엔티티 ↔ 스키마 불일치면 부팅 실패)
4) 정상 기동
```

2번의 분기가 환경별 동작을 가른다. **local/dev/test 빈 DB는 Flyway가 V1부터 자동 실행**한다. 반면 **운영 최초**는 greenfield라도 사람이 리뷰한 `V1__baseline.sql`을 직접 한 번 적용한 뒤, Flyway가 그 상태를 baseline으로 마킹하게 한다. 운영 DB에 앱이 자동으로 첫 DDL을 치게 두지 않으려는 의도적 절차다. 이를 위한 설정이 아래 두 줄이다.

```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true   # 비어있지 않은 DB(=prod 수동 적용분)를 baseline 으로 인식
    baseline-version: 1         # V1 까지는 적용된 것으로 마킹, V2 부터 실행
  jpa:
    hibernate:
      ddl-auto: validate        # 스키마를 변경하지 않고 엔티티↔스키마 일치만 검증(fail-fast)
```

`baseline-on-migrate: true`는 "history 테이블이 없는, 비어있지 않은 DB"를 만나면 `baseline-version`까지는 이미 적용된 것으로 마킹하고 그 다음 버전부터 실행한다. prod 수동 적용분(V1)을 덮어쓰지 않고 인식시키는 장치다.

### baseline은 pg_dump가 아니라 엔티티에서

우리는 greenfield라 **현재 JPA 엔티티 = prod 스키마**(drift 0)다. 그래서 `V1__baseline.sql`은 운영 덤프가 아니라 **엔티티에서 생성한 DDL**로 만들고 사람이 리뷰했다. 자동 생성 DDL은 의도와 미세하게 다를 수 있어서, `jsonb` 컬럼이 제대로 나왔는지, FK의 `ON DELETE SET NULL`이 반영됐는지, UUID 폭이 맞는지 등을 손으로 확인했다. 실제로 Hibernate가 자동 생성하지 못한 server DEFAULT는 손으로 보정해야 했는데, baseline 상단에 그 흔적이 남아 있다.

```sql
-- 수동 보정: prescriptions.clinic_manager_synced_version 에 DEFAULT 0 추가
-- ...
clinic_manager_synced_version bigint not null default 0,
```

이 `NOT NULL DEFAULT 0` 한 줄이 뒤에서 다룰 expand-contract 규율의 표본이다.

---

## 3. 실제로 부딪힌 함정들

여기부터가 이 글의 본론이다. 각 함정은 **기대 vs 실제(에러 메시지) → 원인 → 해결** 순으로 정리한다. 아래는 전부 로컬 Docker(PostgreSQL + Redis)에 앱을 실제로 띄워 **직접 재현·관찰한 것**이다. 문서로만 정리한 예방적 주의는 4~5장에서 따로 표시한다.

### 함정 1 — 의존성 모듈이 두 번 쪼개져 있다

기대: `flyway-core`만 넣으면 되겠지.

실제: PostgreSQL을 인식하지 못하거나, 그 전에 Flyway 자동설정 자체가 안 떴다. 두 겹의 모듈 분리에 걸린 것이다.

- **Flyway 10+의 벤더 모듈 분리** — `flyway-core`는 DB 벤더 지원을 품지 않는다. PostgreSQL은 `flyway-database-postgresql`을 별도로 넣어야 인식된다.
- **Spring Boot 4의 자동설정 모듈 분리** — Spring Boot 4는 자동설정을 기술별 모듈로 쪼갰다. 그래서 `flyway-core`만으론 `FlywayAutoConfiguration`이 뜨지 않는다. 자동설정과 flyway-core를 함께 가져오는 `spring-boot-flyway`를 써야 한다.

해결한 실제 의존성은 이렇다.

```kotlin
// common/database/rdb/build.gradle.kts
// Spring Boot 4 는 자동설정을 기술별 모듈로 분리 → flyway-core 만으론 FlywayAutoConfiguration 이 안 뜬다.
// spring-boot-flyway 가 자동설정 + flyway-core 를 함께 가져온다.
implementation("org.springframework.boot:spring-boot-flyway")
// Flyway 10+ 는 DB 벤더별 모듈 분리 → PostgreSQL 지원에 별도 의존성 필수
implementation("org.flywaydb:flyway-database-postgresql")
```

버전은 핀하지 않는다. Spring Boot BOM이 Flyway 버전을 관리한다. (블로그를 쓰는 시점 기준으로, 같은 LOMS 운영 가이드 문서가 `flyway-core`로 안내하고 있어 코드와 문서가 어긋나 있었다. 정본을 코드로 맞추는 정리가 필요했다.)

### 함정 2 — `.env`가 안 읽혀 `${POSTGRESQL_URL}`이 문자 그대로 들어간다

기대: IntelliJ에서 잘 떴으니 CLI로도 뜨겠지.

실제 로그:

```text
We found a .env file, but failed to load it
Driver ... claims to not accept jdbcUrl, ${POSTGRESQL_URL}
```

원인: 우리는 `springboot4-dotenv`로 루트 `.env`를 읽는데, 이 라이브러리는 **CWD에서만** `.env`를 찾고 상위로 거슬러 올라가지 않는다. 그런데 `./gradlew :common:api:bootRun`의 작업 디렉터리(CWD)는 워크트리 루트가 아니라 **모듈 디렉터리 `common/api/`** 다. 그래서 `.env`를 못 찾고, `POSTGRESQL_URL` 자리표시자가 치환되지 않은 채 `${POSTGRESQL_URL}` 리터럴이 jdbcUrl로 주입됐다. IntelliJ는 CWD를 프로젝트 루트로 잡아 멀쩡히 떠서 더 헷갈렸다.

해결: `.env`를 `common/api/`에 둔다. "내 IDE에선 되는데 CLI에선 안 됨"의 전형이었다.

### 함정 3 — `ddl-auto=validate`가 부팅 전체를 한 줄로 막는다

이건 함정이라기보다 **의도된 안전장치**인데, 처음 보면 함정처럼 느껴진다. 엔티티에 있는 컬럼을 일부러 DB에서 떨궈 보면:

```text
org.hibernate.tool.schema.spi.SchemaManagementException:
  Schema-validation: missing column [team_id] in table [public.members]
...
APPLICATION FAILED TO START
```

엔티티(`@Column`)를 바꾸면서 대응 마이그레이션을 깜빡하면, 다음 부팅에서 정확히 이 메시지로 앱이 죽는다. "코드는 새 버전인데 스키마는 옛것"인 상태를 prod에 내보내지 않으려는 fail-fast다. 해결은 누락된 마이그레이션을 추가하는 것뿐이다. 이 장치 덕에 "스키마-엔티티 불일치"를 런타임이 아니라 부팅 시점에 잡는다.

### 함정 4 — 적용된 마이그레이션은 수정도, 삭제도 안 된다

기대: 오타 하나니까 그 파일 고치면 되겠지.

실제 — 이미 적용된 파일 내용을 바꾸면 체크섬이 달라져 전 환경 부팅이 막힌다.

```text
Validate failed: Migration checksum mismatch for migration version ...
```

그럼 파일을 지우면? 그것도 막힌다. DB엔 적용 기록이 있는데 classpath에 파일이 없으니:

```text
Validate failed: Detected applied migration not resolved locally: 3
```

원인: Flyway는 적용 시점의 체크섬을 history에 박아두고, 매 부팅 때 로컬 파일과 대조한다. 파일을 고치거나 지우면 "내가 적용한 그 버전"을 더 이상 신뢰할 수 없으니 막는 것이다. 이건 버그가 아니라 환경 간 일관성을 지키는 핵심 안전장치다.

해결: 변경은 **항상 새 `V{n+1}__` 파일로.** 잘못 추가한 컬럼을 되돌릴 때도 파일 삭제가 아니라 "되돌리는 마이그레이션"을 앞으로 추가한다. 되돌림조차 forward로 기록된다. (덧붙여, 열린 PR 둘이 같은 `V7__`을 쓰면 머지 순서에 따라 한쪽이 깨진다. 버전 번호 충돌은 별도 글에서 CI 가드로 막는 이야기를 다룬다 → [마이그레이션 버전 충돌 CI 가드](../flyway-migration-version-ci-guard/).)

### 함정 5 — 테스트는 왜 Flyway를 껐나

기대: 테스트에서도 실제 마이그레이션을 돌려 검증하면 좋지.

실제: `V1__baseline.sql`은 PostgreSQL 전용 문법(`jsonb`, `ON DELETE SET NULL`, advisory lock 등)을 포함한다. 테스트가 쓰는 H2(MODE=PostgreSQL)에서 이걸 돌리면 깨진다.

해결: 테스트는 Flyway를 끄고 H2 `create-drop`을 유지한다. 즉 H2가 엔티티로부터 스키마를 직접 만든다.

```yaml
# common/database/rdb/src/test/resources/application.yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL
    driver-class-name: org.h2.Driver
  flyway:
    enabled: false        # 테스트는 H2 + create-drop 유지, Flyway 미사용
  jpa:
    hibernate:
      ddl-auto: create-drop
```

대가는 분명하다. **CI가 실제 마이그레이션 SQL을 검증하지 못한다.** 그래서 V1 검증 책임은 "빈 PostgreSQL에 띄워 V1이 실행되고 validate까지 통과하는지" 보는 로컬 체크리스트가 떠안았다. 실제 PostgreSQL에서 마이그레이션을 검증하는 Testcontainers 전환은 후속 과제로 남겼다 — 도커가 무겁고 변경 범위가 커서 별도 티켓으로 분리했다.

### 직접 재현한 going-forward 시나리오들

위 함정들 외에, baseline이 깔린 데이터-있는 DB에 데모 마이그레이션(`V2__demo_*`, `V3__demo_*`, `V4__demo_*`)을 만들어 운영 흐름을 직접 굴려봤다(전부 데모용, 커밋하지 않음).

- **증분 적용** — V1 위에 V2가 얹히고, 기존 데이터는 보존됐다(`flyway_schema_history` 2행).
- **expand → migrate → contract** — V2(nullable 컬럼 추가) → V3(기존 행 backfill) → V4(NOT NULL 강화)를 한 배포에 넣으면 Flyway가 버전 순서대로 각각 적용했다. 순서가 왜 중요한지도 직접 봤다. V2 직후 곧장 NOT NULL을 걸면 기존 행을 채울 값이 없어 `column "..." contains null values`로 실패한다. V3가 먼저 빈 칸을 채운 덕에 V4가 성공한다.
- **데이터 교정(data-correction)** — 이미 쌓인 값을 새 업무 규칙으로 일괄 변경할 때 `WHERE`로 영향 범위를 한정하면, 조건에 맞는 행만 바뀌고 나머지는 보존됐다.

이 관찰들이 다음 두 장(규율·롤백)의 근거가 된다.

---

## 4. 무중단 스키마 변경 규율 — expand-contract

롤링 배포에선 구버전 task와 신버전 task가 잠시 **같은 테이블을 동시에** 읽고 쓴다. 따라서 스키마는 양쪽 코드 모두와 호환되어야 한다.

### 컬럼 추가는 nullable 또는 server DEFAULT만

구버전 task의 `INSERT`는 새 컬럼의 존재를 모른다. 그래서 추가 컬럼이 `NOT NULL`인데 DEFAULT가 없으면 구버전 task의 INSERT가 깨진다.

```sql
-- 안전: nullable → 구버전 task의 INSERT 도 영향 없음
ALTER TABLE prescription ADD COLUMN memo varchar(1000);

-- 안전: NOT NULL 이 꼭 필요하면 server DEFAULT 동반
ALTER TABLE prescription ADD COLUMN priority integer NOT NULL DEFAULT 0;
```

baseline의 `clinic_manager_synced_version bigint NOT NULL DEFAULT 0`이 정확히 이 규칙의 표본이다.

### 삭제·이름변경은 3단계로 — "그냥 RENAME" 금지

한 번에 `DROP`/`RENAME`하면 아직 그 컬럼을 읽는 구버전 task가 깨진다. 그래서 하나의 논리적 변경을 **여러 PR/릴리스에 걸쳐** 쪼갠다.

```text
1단계 expand   : 새 컬럼 추가(+ dual-write). 읽기는 아직 구 컬럼.
2단계 migrate  : 데이터 backfill → 읽기를 신 컬럼으로 전환. 구 컬럼 미사용화 + 관측.
3단계 contract : 어떤 가동 버전도 구 컬럼을 안 쓰는 게 확실해지면 DROP.
```

RENAME은 "새 컬럼 추가 → 복사 → 읽기 전환 → 옛 컬럼 DROP"의 특수 케이스로 푼다. 주의할 점은, **contract 단계를 끝까지 수행하지 않으면 시작보다 나쁜 상태**가 된다는 것이다. flag와 구 컬럼이 기술 부채로 남는다. expand-contract는 규율 의존적이다.

> ⚠️ 이 장의 일부는 **예방적으로 정리한 항목**이다. 위 1·2번 규칙과 3단계 시퀀스는 로컬에서 데모 마이그레이션으로 직접 돌려 확인했지만, 대량 UPDATE의 락·배치 부하 같은 운영 규모 이슈는 우리가 아직 트래픽 위에서 겪은 게 아니라 사전에 규율로만 못박아 둔 것이다.

---

## 5. 운영 롤백은 forward-only — 3중 안전망

Flyway Community에는 `undo`가 없다. `flyway undo`/U-마이그레이션은 유료 에디션 전용이다. 그런데 이건 Community의 한계라기보다 성숙한 팀의 표준에 가깝다. down 마이그레이션은 데이터를 영구 파괴할 수 있고, 실패하면 unknown state를 남긴다. 그래서 유료 에디션을 사도 prod에선 대체로 피하는 기능이다. 우리가 돈을 쓸 이유가 없었다.

대신 "되돌리기"를 세 겹의 안전망으로 푼다.

1. **즉시 롤백 = flag off, 또는 앱을 한 버전 뒤로.** 스키마는 하위호환 상태로 유지되므로 그대로 둬도 안전하다. 초 단위로 되돌릴 수 있는 1차 방어선이다.
2. **스키마 정정 = forward 보상 마이그레이션 `V{n+1}`.** 잘못된 변경을 앞으로 고치는 새 마이그레이션을 추가한다.
3. **데이터 손실·파괴적 변경 = 백업 + PITR(시점 복원).** 진짜 의미의 undo는 이쪽이다.

앞의 함정 3·4가 이 정책과 맞물린다. 앱-only 롤백(이전 이미지 재배포)이 안전한 건 스키마가 expand-호환으로 유지될 때뿐이다. 비호환 변경을 해두면 롤백한 구버전 앱이 `missing column`으로 죽는다(함정 3). 그래서 expand-contract와 forward-only는 한 세트다.

> ⚠️ 여기서도 1·2번은 로컬에서 직접 확인했지만(되돌리는 V3로 컬럼을 제거, 파일 삭제 시 validate 차단), **3번 백업·PITR과, 앞서 언급한 advisory lock 직렬화·`lock_timeout`/재시도·`CREATE INDEX CONCURRENTLY`(트랜잭션 밖, 실패 시 INVALID 인덱스) 같은 PostgreSQL 운영 주의는 문서로 정리만 한 예방적 항목**이다. Flyway 10이 `pg_advisory_lock`으로 동시 migrate를 직렬화한다는 점은 동시 부팅을 가볍게 관측해 봤지만, 정밀한 동시성·복구 검증은 후속 Testcontainers 스코프로 미뤘다. 정직하게 선을 긋자면, 이 글의 신뢰 가능한 부분은 3장과 4·5장의 직접 확인 항목이고, 운영 규모 검증은 아직 우리 앞에 남아 있다.

참고로, 단일 마이그레이션이 실행 중 실패하면 어떻게 될까. PostgreSQL은 DDL도 트랜잭션이라, Flyway가 각 마이그레이션을 트랜잭션으로 감싸 **원자적으로 롤백**한다(부분 적용 없음, 해당 버전은 다시 pending). 단 `CREATE INDEX CONCURRENTLY`처럼 트랜잭션 밖에서 도는 명령은 예외다.

---

## 6. 마무리

운영 DB에 Flyway를 붙이며 배운 핵심은 도구 사용법이 아니라 멘탈 모델이었다.

> **flag는 코드만 게이팅하고, 스키마는 전 환경에 동일하게 전진한다.**

선택성은 코드(flag)에서 얻고, DB는 단일 경로로 하위호환을 지키며 앞으로만 간다. 환경별 폴더나 `target` hold-back으로 스키마를 환경마다 다르게 두는 것은 schema drift 안티패턴이라 금지한다. 롤백은 down이 아니라 forward + flag + 백업의 3중 안전망으로 처리한다.

그리고 함정의 절반은 도구가 아니라 환경에서 나왔다. 모듈이 두 겹으로 쪼개진 의존성, IDE와 CLI의 CWD 차이로 안 읽히는 `.env` — 이런 것들은 "어떻게 동작하는가"를 알아야만 디버깅된다. validate fail-fast와 체크섬 검증은 처음엔 부팅을 막는 장애물처럼 보였지만, 결국 "코드와 스키마가 어긋난 채 prod로 나가는 일"을 부팅 시점에 잡아주는 가장 든든한 안전장치였다.

실제 운영 데이터와 트래픽 위에서 expand-contract와 PITR을 굴려보는 일은 아직 남아 있다. 그건 다음 기록의 몫이다.
