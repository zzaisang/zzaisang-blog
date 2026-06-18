---
title: "JPA Pessimistic Lock 으로 동시성 재고 처리 (Shared Lock)"
description: "REPEATABLE READ 격리수준에서 SELECT 가 락을 걸지 않아 동시 주문이 같은 재고를 가져가는 문제를, JPA @Lock(PESSIMISTIC_WRITE)(SELECT for update)로 해결한 과정을 정리합니다."
pubDate: "2026-06-18T09:03:00+09:00"
category: "Spring"
tags: ["jpa", "mariadb", "lock", "concurrency", "pessimistic-lock", "isolation-level"]
---

# MariaDB Shared Lock

- 상품 주문을 하고 재고의 상태를 변경 시키는 로직이 있는 경우입니다.
- DB의 Isolation Level Default 인 REAPETABLE READ 상태입니다.
- Spring JPA 사용중

재고테이블의 현재 남은 재고들을 조회하는 쿼리 실행 후
Sorting 하여 재고 중 한개를 판매상태로 변경 시키는 로직입니다. 
해당 API를 동시성 테스트를 진행하던중 , 같은 재고를 여러 주문건에서 동시에 가져가게 되는 현상 발견. 
처음에는 Transaction Level 의 문제인줄 알았으나 재고테이블 SELECT 당시에는 LOCK 을 걸 수 없기 때문에 발생한 문제.

transaction isolation level이 serializable가 아니면 다른 transaction이 공유 테이블을 SELECT 조회를 해도 lock이 걸리지 않았습니다. 

결국 Jpa에서 제공하는 @Lock(LockmodeType.PERSSIMISTIC_WRITE)를 이용하여 해결 하였습니다. (내부적으로 mariadb에서 select for update 구문을 사용합니다.)

```java
//TO-BE
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT l FROM x l INNER JOIN l.child c ON c.id = :id")
List<TableName> findAllById(@Param("id") int goodsId);
```

자세한 내용은 아래 문서를 참조해주세요.

- [nespot2/study-nespot2](https://github.com/nespot2/study-nespot2/blob/master/database/lock.md)
- [Lock in Share Mode](https://mariadb.com/kb/en/library/lock-in-share-mode/)
- [Shared and Exclusive Locks](https://mariadb.com/kb/en/library/innodb-lock-modes/)
- [Pessimistic Locking in Jpa](https://www.baeldung.com/jpa-pessimistic-locking)
