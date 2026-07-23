---
title: "동시성 채번, 테스트는 통과하는데 프로덕션에서 깨진다 — Postgres atomic upsert 로 다시 쓰기"
description: "SELECT FOR UPDATE + 재시도로 짠 하루 단위 순번 채번이 실제로는 왜 동작하지 않았는지, 그리고 INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING 한 문장으로 다시 쓴 과정을 정리합니다."
pubDate: "2026-07-23T17:50:02+09:00"
category: "Database"
tags: ["postgres", "jooq", "upsert", "concurrency", "kotlin"]
---

주문 번호처럼 "하루 단위로 1번부터 순차 증가하는, 사람이 읽을 수 있는 번호"를 발급해야 할 때가 있다. `ORD-20260723-0001`, `ORD-20260723-0002`… 판매자(seller)별로 매기고, 날짜가 바뀌면 다시 1번부터. UUID 대신 이런 번호를 쓰는 건 대개 사람이 전화로 불러주거나 송장에 찍어야 하기 때문이다.

문제는 이 "다음 번호 발급"이 동시성 지점이라는 거다. 같은 판매자에게 같은 초에 주문 두 건이 들어오면, 두 요청이 같은 번호를 받으면 안 된다. 처음엔 비관적 락에 재시도를 얹어 짰는데, 그 코드가 테스트는 통과하면서 실제 동시성 상황에서는 동작하지 않았다. 이 글은 왜 안 됐는지 뜯어보고, `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` 한 문장으로 다시 쓴 기록이다.

## 처음 설계: SELECT ... FOR UPDATE + INSERT + 재시도

번호를 `(seller_id, date) → last_sequence` 카운터 테이블로 관리한다고 하자. 처음 짠 채번 로직은 대략 이랬다.

```kotlin
private fun incrementOrInsert(tx: DSLContext, sellerId: String, date: LocalDate): Long {
    val existing = tx.select(field("id"), field("last_sequence"))
        .from(table("request_number_sequences"))
        .where(field("seller_id").eq(sellerId))
        .and(field("sequence_date").eq(date))
        .forUpdate()          // 비관적 락
        .fetchOne()

    if (existing != null) {
        val next = existing.get("last_sequence", Long::class.java)!! + 1
        tx.update(table("request_number_sequences"))
            .set(field("last_sequence"), next)
            .where(field("id").eq(existing.get("id", String::class.java)))
            .execute()
        return next
    }

    // (seller, date) 최초 요청 → row 를 만든다
    return try {
        tx.insertInto(table("request_number_sequences"))
            .set(field("id"), newId())
            .set(field("seller_id"), sellerId)
            .set(field("sequence_date"), date)
            .set(field("last_sequence"), 1L)
            .execute()
        1L
    } catch (_: DataIntegrityViolationException) {
        // 최초 row 생성 경합: 다른 트랜잭션이 먼저 넣었으니 다시 조회해 증가
        incrementOrInsert(tx, sellerId, date)
    }
}
```

발상은 평범하다. row 가 있으면 `FOR UPDATE` 로 잠그고 +1, 없으면 INSERT 를 시도하되 유니크 제약 위반이 나면 "누가 먼저 넣었구나" 하고 다시 조회해서 증가시킨다. 진짜 경합이 생기는 창구는 특정 `(seller, date)` 의 첫 row 가 아직 없을 때 동시 요청 두 건이 모두 INSERT 를 시도하는 순간뿐이고, 그걸 catch-재시도로 흡수한다는 그림이었다. `SELECT ... FOR UPDATE` 로 행을 잠그는 건 [JPA 비관적 락으로 재고 동시성을 처리](../jpa-pessimistic-lock/)할 때도 쓴, 손에 익은 방법이었다.

그런데 이 코드가 두 군데서 깨져 있었다.

## 왜 안 됐나 (1) — catch 가 죽은 코드였다

`catch (_: DataIntegrityViolationException)` 은 Spring 의 예외를 잡는다. 그런데 이 경로는 jOOQ `DSLContext` 로 직접 SQL 을 실행한다. jOOQ 는 제약 위반이 나면 Spring 의 `DataIntegrityViolationException` 이 아니라 자기 native 예외(`org.jooq.exception.DataAccessException` 계열)를 던진다. Spring 의 예외 변환(`@Repository` + `PersistenceExceptionTranslationPostProcessor`)은 Spring Data / JPA 경로에 걸리는 거지, `DSLContext` 를 직접 부르는 코드에는 자동으로 끼어들지 않는다.

그러니 실제로 던져지는 예외와 catch 절의 타입이 어긋나 있었다. catch 는 한 번도 매칭되지 않고, 경합이 나면 예외가 그대로 위로 튀어 요청이 실패한다. 컴파일러는 이런 죽은 catch 를 알려주지 않으니 눈으로 보기 전엔 몰랐다.

## 왜 안 됐나 (2) — Postgres 에서는 재시도 자체가 성립하지 않는다

예외 타입을 정확히 맞춰도 소용없다. 같은 트랜잭션 안에서 재시도하는 발상이 Postgres 에서는 애초에 안 통한다.

Postgres 는 트랜잭션 안의 문장 하나가 제약 위반으로 실패하면 트랜잭션 전체를 aborted 상태로 만든다. 그다음부터는 후속 쿼리가 전부

```text
current transaction is aborted, commands ignored until end of transaction block
```

로 거부된다. INSERT 가 유니크 제약으로 실패한 직후 같은 트랜잭션에서 `incrementOrInsert` 를 다시 부르면, 그 안의 `SELECT ... FOR UPDATE` 도 같이 실패하는 것이다. "실패하면 다시 조회한다"는 전략이 savepoint 없이는 성립하지 않는다([Postgres 공식 문서 Transactions 장](https://www.postgresql.org/docs/current/tutorial-transactions.html)). MySQL 처럼 문장 단위로 롤백해 트랜잭션을 살려두는 엔진에 익숙하면 정확히 여기서 감이 어긋난다.

정리하면, catch 가 살아 있었어도 그 안의 재시도가 aborted 트랜잭션 위에서 도는 거라 어차피 깨졌을 코드였다.

## 그런데 테스트는 왜 초록불이었나 — H2

제일 찜찜했던 부분이다. 이 어댑터엔 스레드 16개로 100번 동시에 채번을 요청해 "중복 없이 1~100 이 순차 발급되는가"를 보는 통합 테스트가 있었고, 그게 통과하고 있었다.

그 테스트가 H2(PostgreSQL 호환 모드) 위에서 돈다는 게 함정이었다. H2 는 Postgres 의 aborted-transaction 시맨틱을 그대로 재현하지 않고, 스레드 스케줄링이나 락 타이밍도 실제 Postgres 와 다르다. 그래서 테스트는 문제의 재시도 경로를 한 번도 밟지 않은 채 초록불을 냈다. 진짜 경합 창구인 첫 row INSERT 충돌이 H2 에선 재현되지 않았거나, 재현돼도 catch 죽음·abort 문제가 드러나지 않는 방식으로 흘러간 거다.

인메모리 DB 로 동시성이나 제약 위반 경로를 검증하려는 시도는 대체로 검증하는 시늉만 낸다. 엔진별 트랜잭션 시맨틱 차이가 정확히 그 지점에서 갈리기 때문이다. "테스트가 통과한다"와 "그 코드 경로가 검증됐다"는 전혀 다른 얘긴데, 이 버그는 딱 그 틈으로 프로덕션까지 갔다.

## 해법: 락도 재시도도 지우고 upsert 한 문장으로

경합을 애플리케이션에서 락·재시도로 다루려던 게 애초에 무리였다. 원자성은 DB 엔진이 이미 준다. Postgres 의 `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` 은 "없으면 넣고 있으면 갱신"을 한 문장으로 원자적으로 처리하고, 갱신된 값을 그 자리에서 돌려준다.

```kotlin
override fun issueNext(sellerId: String, date: LocalDate): String {
    val lastSequence = field("last_sequence", Long::class.java)
    val now = Instant.now()

    val next = dslContext.insertInto(table("request_number_sequences"))
        .set(field("id", String::class.java), newId())
        .set(field("seller_id", String::class.java), sellerId)
        .set(field("sequence_date", LocalDate::class.java), date)
        .set(lastSequence, 1L)
        .set(field("created_at", Instant::class.java), now)
        .set(field("updated_at", Instant::class.java), now)
        .onConflict(
            field("seller_id", String::class.java),
            field("sequence_date", LocalDate::class.java),
        )
        .doUpdate()
        .set(lastSequence, lastSequence.plus(1))
        .set(field("updated_at", Instant::class.java), now)
        .returning(lastSequence)
        .fetchOne(lastSequence)!!

    return "ORD-%s-%04d".format(date.format(DateTimeFormatter.BASIC_ISO_DATE), next)
}
```

`(seller_id, sequence_date)` 유니크 인덱스가 충돌 판정 기준이다. 첫 요청은 `last_sequence = 1` 로 INSERT 되고, 이후 요청은 전부 `DO UPDATE` 로 넘어가 `last_sequence + 1` 이 된 뒤 `RETURNING` 으로 그 값을 받는다. 두 요청이 동시에 들어와도 유니크 인덱스가 직렬화 지점을 만들어 주니 락도 재시도도 catch 도 필요 없다. 코드 줄 수가 준 게 핵심이 아니라, 정확성을 책임질 주체가 애플리케이션에서 DB 엔진으로 넘어간 게 핵심이다.

## 함정: `DO UPDATE SET` 우변의 ambiguous 컬럼

여기서 한 번 더 걸렸다. `DO UPDATE` 의 SET 우변에서 "기존 행의 last_sequence 를 읽어 +1" 하려고 unqualified `last_sequence` 를 참조했더니 Postgres 가 거부했다.

```text
column reference "last_sequence" is ambiguous
```

`ON CONFLICT DO UPDATE` 문맥에서 `last_sequence` 라는 이름은 두 곳에 있다. 대상 테이블(기존 행)의 `last_sequence`, 그리고 INSERT 하려던 값이 담긴 `EXCLUDED.last_sequence`. 우변에서 "기존 값 +1"을 의도했으면 테이블명으로 qualify 해서 어느 쪽인지 못박아야 한다.

```kotlin
val lastSequence = field("last_sequence", Long::class.java)                       // 좌변(대입 대상)
val currentLastSequence = field(name("request_number_sequences", "last_sequence"), // 우변(기존 행 읽기)
    Long::class.java)
// ...
.doUpdate()
.set(lastSequence, currentLastSequence.plus(1))   // request_number_sequences.last_sequence + 1
```

jOOQ 에서는 `DSL.name(tableName, columnName)` 로 qualified 한 별도 `Field` 를 만들어 우변 읽기에 쓰면 된다. 좌변(대입 대상)은 qualify 하지 않아도 대상 테이블로 해석된다.

## 남은 트레이드오프: H2 가 못 파싱하는 SQL

새 upsert 를 통합 테스트로 검증하려 했는데, H2 는 `ON CONFLICT ... DO UPDATE ... RETURNING` 을 파싱조차 못한다(그 버전 기준 `DO NOTHING` 만 지원). 이 SQL 은 실제 Postgres 없이는 실행 자체가 안 된다. 원래 있던 "16스레드 100요청" 통합 테스트는 어차피 거짓 양성이었으니 미련 없이 지웠다.

선택지는 둘이었다.

1. Postgres 대상 테스트 인프라(Testcontainers 등)를 이 변경에서 새로 들인다.
2. 인프라 도입은 별건으로 미루고, 지금은 `DSLContext` 를 목으로 스텁해서 "upsert 가 돌려준 `last_sequence` 를 올바른 형식(`ORD-yyyyMMdd-####`)으로 포맷하는가"만 유닛 테스트로 본다.

이번엔 2번을 택했다. 원자성의 정확성은 Postgres 엔진이 보증하는 영역이라 우리가 테스트로 재증명할 대상이 아니고(목으로는 재증명할 수도 없다), 이 어댑터에서 우리가 짠 로직은 돌려받은 숫자를 문자열로 포맷하는 부분뿐이다. 대신 이건 갚아야 할 빚으로 남겨뒀다. atomic upsert 의 동시성 정확성을 실제로 확인하려면 Postgres 통합 테스트가 필요하고, 그 인프라는 따로 들여야 한다. 다시 "인메모리 DB 로 검증한 척"으로 돌아가지 않는 게 이 결정의 조건이다.

## 정리

채번 함수 하나 고치는 일이었는데 걸린 게 여러 겹이었다.

jOOQ `DSLContext` 를 직접 실행하는 경로에서는 Spring 의 예외 변환이 자동으로 끼지 않는다. 잡을 예외는 실제로 던져지는 타입으로 잡아야 하고, catch 절은 조용히 죽어 있어도 컴파일러가 짚어주지 않는다.

Postgres 에서 "제약 위반 → 같은 트랜잭션에서 재시도"는 성립하지 않는다. 문장 하나가 실패하면 트랜잭션이 abort 되니까, savepoint 없는 in-transaction 재시도는 설계 단계에서 이미 틀린 셈이다.

그래서 동시성·제약 경로는 엔진에 맡길 수 있으면 맡기는 게 낫다. `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` 은 락과 재시도를 통째로 지운다. 대신 `DO UPDATE` 우변의 컬럼은 대상 테이블과 `EXCLUDED` 사이에서 ambiguous 하니, 기존 값을 읽을 땐 테이블명으로 qualify 해야 한다.

무엇보다, 인메모리 DB 통과는 검증 완료가 아니다. 트랜잭션 시맨틱이나 동시성이 걸린 경로라면 특히, 그 테스트는 문제의 코드 경로를 아예 밟지 않고도 초록불을 낼 수 있다. 검증하려는 속성이 엔진에 의존한다면, 결국 그 엔진 위에서 테스트해야 한다.
