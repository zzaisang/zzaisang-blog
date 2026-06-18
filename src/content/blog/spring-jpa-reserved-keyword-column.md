---
title: "Spring JPA 예약어 컬럼 이슈"
description: "SpringJPA_ReservedWords_Issue (DB 예약어 컬럼 이슈.) 현재 버전 : Spring Boot 2.1.7.RELEASE / Maria DB 10.2 (MySQL 5.6) 테이블 모델링을 하다보면 데이터베이스에서 이미 사용하는 예약어를 컬럼명으로 사용할 때가…"
pubDate: "2023-02-06T20:10:03+09:00"
category: "Spring"
tags: ["Java", "ORM", "Spring", "SpringDataJpa", "springJPA"]
---
# SpringJPA\_ReservedWords\_Issue (DB 예약어 컬럼 이슈.)

-   현재 버전 : Spring Boot 2.1.7.RELEASE / Maria DB 10.2 (MySQL 5.6)
-   테이블 모델링을 하다보면 데이터베이스에서 이미 사용하는 예약어를 컬럼명으로 사용할 때가 있다.
-   해당 컬럼명을 그대로 SpringJPA 에서 사용하면 Query 실행 중에 Syntax Error 가 발생하게 된다.

---

##### DB 예약어 목록

MariaDB Doc : [https://mariadb.com/kb/en/reserved-words/](https://mariadb.com/kb/en/reserved-words/)

### 해당 Issue 해결방법

-   Entity 정의 할 때 컬렁 명을 추가한다.
-   AS-IS

```java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString
public class Test {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    private String key; //key는 DB 예약어이다.

}
```

-   TO-BE

```java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@ToString
public class Test {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(nullable = false, name = "`key`")
    private String key; //key는 DB 예약어이다.

}
```

-   @Column Annotation을 활용하여 컬럼명 사이 \`\`(backtick) 을 추가하면 된다!

### 만약 update 컬럼이 예약어가 아니일때

-   JPA 는 Dirty Checking (상태 변경 검사) 으로 생성되는 UpdateQuery 는 모든 컬럼을 업데이트 한다.
-   따라서 특정 컬럼만 수정하고싶을 때 @DynamicUpdate Annotation을 추가하면 Update 대상인 특정 컬럼만 Update 된다!

```java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@DynamicUpdate
@ToString
public class Test {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(nullable = false, name = "`key`")
    private String key; //key는 DB 예약어이다.

}
```

참조자료

-   [https://stackoverflow.com/questions/2224503/creating-field-with-reserved-word-name-with-jpa](https://stackoverflow.com/questions/2224503/creating-field-with-reserved-word-name-with-jpa)
-   [https://mariadb.com/kb/en/reserved-words/](https://mariadb.com/kb/en/reserved-words/)
-   [https://jojoldu.tistory.com/415](https://jojoldu.tistory.com/415)
